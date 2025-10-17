/**
 * Netlify serverless function for OCR extraction
 * Extracts data from ORIGINAL deeds (not trust transfer deeds)
 * The GRANTEE from the original deed becomes the GRANTOR in the trust transfer deed
 */

const multipart = require('lambda-multipart-parser');
const https = require('https');

// OCR.space API - Free tier: 25,000 requests/month
const OCR_API_KEY = 'K87899142388957';

exports.handler = async (event, context) => {
  // Set function timeout context
  context.callbackWaitsForEmptyEventLoop = false;
  
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    console.log('=== EXTRACT DEED STARTED ===');
    const result = await multipart.parse(event);

    if (!result.files || result.files.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'No file uploaded' 
        }),
      };
    }

    const file = result.files[0];
    console.log('Processing file:', file.filename, 'Size:', file.content.length);

    // Convert file to base64
    const base64File = Buffer.from(file.content).toString('base64');
    
    // Detect file type
    const fileExtension = file.filename.split('.').pop().toLowerCase();
    const mimeType = fileExtension === 'pdf' ? 'application/pdf' : 
                     fileExtension === 'png' ? 'image/png' : 
                     fileExtension === 'jpg' || fileExtension === 'jpeg' ? 'image/jpeg' : 
                     'application/pdf';

    console.log('Calling OCR.space API for:', fileExtension);
    
    // Call OCR.space API with timeout protection
    const ocrText = await Promise.race([
      performOCR(base64File, mimeType),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('OCR timeout after 25 seconds')), 25000)
      )
    ]);

    if (!ocrText || ocrText.length < 50) {
      throw new Error('No text extracted from document');
    }

    console.log('OCR successful! Text length:', ocrText.length);

    // Parse the extracted text
    const extractedData = parseOCRText(ocrText);

    console.log('Extracted data:', JSON.stringify(extractedData, null, 2));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ...extractedData,
        filename: file.filename,
      }),
    };

  } catch (error) {
    console.error('ERROR processing deed:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to extract data from document. Please enter information manually.',
        apn: '',
        grantor: '',
        trustee: '',
        trustName: '',
        trustDate: '',
        propertyAddress: '',
        city: '',
        county: 'Los Angeles',
        legalDescription: '',
        mailingAddress: '',
      }),
    };
  }
};

function performOCR(base64File, mimeType) {
  return new Promise((resolve, reject) => {
    const boundary = '----WebKitFormBoundary' + Date.now();
    
    let body = '';
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="base64Image"\r\n\r\n`;
    body += `data:${mimeType};base64,${base64File}\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="language"\r\n\r\n`;
    body += `eng\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="isOverlayRequired"\r\n\r\n`;
    body += `false\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="OCREngine"\r\n\r\n`;
    body += `2\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="detectOrientation"\r\n\r\n`;
    body += `true\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="scale"\r\n\r\n`;
    body += `true\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="isTable"\r\n\r\n`;
    body += `false\r\n`;
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="filetype"\r\n\r\n`;
    body += `PDF\r\n`;
    body += `--${boundary}--\r\n`;

    const options = {
      hostname: 'api.ocr.space',
      path: '/parse/image',
      method: 'POST',
      headers: {
        'apikey': OCR_API_KEY,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 20000 // Reduced from 60000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('OCR.space response status:', res.statusCode);
          
          const response = JSON.parse(data);
          
          if (response.IsErroredOnProcessing) {
            const errorMsg = response.ErrorMessage?.[0] || 'OCR processing error';
            console.error('OCR error:', errorMsg);
            
            // Check if it's a page limit error
            if (errorMsg.includes('maximum page limit')) {
              console.log('Page limit hit - but we got some pages, continuing...');
              // Try to extract text from what we got
              if (response.ParsedResults && response.ParsedResults.length > 0) {
                const text = response.ParsedResults.map(r => r.ParsedText).join('\n');
                console.log('Extracted text from available pages, length:', text.length);
                resolve(text);
                return;
              }
            }
            
            reject(new Error(errorMsg));
            return;
          }

          if (response.ParsedResults && response.ParsedResults.length > 0) {
            const text = response.ParsedResults.map(r => r.ParsedText).join('\n');
            console.log('Text extracted successfully, length:', text.length);
            console.log('First 2500 chars:', text.substring(0, 2500));
            if (text.length > 500) {
              console.log('Last 800 chars:', text.substring(text.length - 800));
            }
            resolve(text);
          } else {
            reject(new Error('No text extracted from document'));
          }
        } catch (e) {
          console.error('Parse error:', e);
          reject(new Error('Failed to parse OCR response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(new Error('OCR request failed: ' + e.message));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OCR request timed out'));
    });

    req.write(body);
    req.end();
  });
}

function parseOCRText(text) {
  // Log for debugging
  console.log('=== PARSING OCR TEXT ===');
  console.log('Full text length:', text.length);
  
  const data = {
    apn: extractAPN(text),
    grantor: extractGrantor(text),
    trustee: extractTrustee(text),
    trustName: extractTrustName(text),
    trustDate: extractTrustDate(text),
    propertyAddress: extractPropertyAddress(text),
    city: extractCity(text),
    county: extractCounty(text),
    legalDescription: extractLegalDescription(text),
    mailingAddress: '',
  };
  
  // Set mailing address to property address
  data.mailingAddress = data.propertyAddress;
  
  return data;
}

function extractAPN(text) {
  const patterns = [
    /AP#:\s*([0-9]{4}[-]?[0-9]{3}[-]?[0-9]{3})/i,
    /APN[:\s#]*([0-9]{4}[-\s]?[0-9]{3}[-\s]?[0-9]{3})/i,
    /Assessor['\s]?s?\s+Parcel\s+(?:Number|No\.?)[:\s]*([0-9\-\s]+)/i,
    /\b([0-9]{4}[-]?[0-9]{3}[-]?[0-9]{3})\b/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let apn = match[1].trim();
      apn = apn.replace(/\s+/g, '').replace(/[^0-9\-]/g, '');
      if (apn.length >= 10) {
        console.log('Found APN:', apn);
        return apn;
      }
    }
  }
  return '';
}

function extractGrantor(text) {
  // Extract GRANTEE from original deed
  const patterns = [
    // From "WHEN RECORDED MAIL TO:" section
    /WHEN RECORDED MAIL TO:\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    
    // "GRANTEE: Arthur Avagyants"
    /GRANTEE[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:,|\s+a|\s+an|\s*$)/i,
    
    // "conveys to Arthur Avagyants, a married"
    /(?:conveys?|grants?|transfers?)\s+to\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:,\s*(?:a|an))/i,
    
    // "Arthur Avagyants, a married man"
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:a|an)\s+(?:married|single|unmarried|widowed)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let name = match[1].trim();
      name = name.replace(/,.*$/, '').trim();
      if (name.split(/\s+/).length >= 2 && name.split(/\s+/).length <= 4) {
        console.log('Found GRANTEE (becomes grantor):', name);
        return name;
      }
    }
  }
  
  return '';
}

function extractTrustee(text) {
  const grantor = extractGrantor(text);
  return grantor;
}

function extractTrustName(text) {
  return '';
}

function extractTrustDate(text) {
  return '';
}

function extractPropertyAddress(text) {
  // Pattern to match: "6821 Saint Estaban Street Los Angeles (Tujunga area), CA 91042"
  const fullAddressPattern = /\b([0-9]{3,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s*\([^)]+\))?,?\s+(?:CA|California)\s+[0-9]{5})/i;
  
  let match = text.match(fullAddressPattern);
  if (match) {
    let address = match[1].trim();
    address = address.replace(/\s+/g, ' ');
    console.log('Found full property address:', address);
    return address;
  }
  
  // Try without parenthetical
  const addressWithZipPattern = /\b([0-9]{3,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,?\s+(?:CA|California)\s+[0-9]{5})/i;
  
  match = text.match(addressWithZipPattern);
  if (match) {
    let address = match[1].trim().replace(/\s+/g, ' ');
    console.log('Found property address with zip:', address);
    return address;
  }
  
  // Fallback: street + city + state (manually add zip if found)
  const streetPattern = /\b([0-9]{3,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct)\.?)\b/i;
  
  match = text.match(streetPattern);
  if (match) {
    let address = match[1].trim();
    console.log('Found street address:', address);
    
    // Try to append city, state, zip
    const city = extractCity(text);
    if (city) {
      address += `, ${city}, CA`;
      
      // Look for zip code
      const zipMatch = text.match(/\b[0-9]{5}\b/);
      if (zipMatch) {
        address += ` ${zipMatch[0]}`;
      }
    }
    
    return address;
  }
  
  return '';
}

function extractCity(text) {
  const patterns = [
    // "Los Angeles (Tujunga area)"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\([^)]+\),?\s+(?:CA|California)/i,
    
    // "City of Los Angeles"
    /City\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    
    // ", Los Angeles, CA"
    /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:CA|California)/i,
    
    // Known cities
    /(Los Angeles|Ventura|Riverside|San Bernardino|Orange|Pasadena|Glendale|Burbank|Santa Monica|Tujunga)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const city = match[1].trim();
      if (city.length >= 3 && city.length <= 30 && !/[0-9]/.test(city)) {
        console.log('Found City:', city);
        return city;
      }
    }
  }
  
  return '';
}

function extractCounty(text) {
  const patterns = [
    /County\s+of\s+(Los Angeles|Ventura|Riverside|San Bernardino|Orange)/i,
    /(Los Angeles|Ventura|Riverside|San Bernardino|Orange)\s+County/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      console.log('Found County:', match[1]);
      return match[1].trim();
    }
  }
  
  return 'Los Angeles';
}

function extractLegalDescription(text) {
  console.log('=== SEARCHING FOR LEGAL DESCRIPTION ===');
  console.log('Searching in text of length:', text.length);
  
  // First check if there's an Exhibit A reference
  const exhibitARef = /(?:legal\s+description|property\s+description|described)\s+(?:is\s+)?(?:attached\s+as|in|on)\s+Exhibit\s+["\']?A["\']?/i;
  if (exhibitARef.test(text)) {
    console.log('Found Exhibit A reference');
    
    // Try to extract the Exhibit A content
    const exhibitAStart = text.search(/EXHIBIT\s+["\']?A["\']?/i);
    if (exhibitAStart !== -1) {
      console.log('Found EXHIBIT A section at index:', exhibitAStart);
      
      // Extract everything after "EXHIBIT A" until we hit another exhibit or end
      const exhibitText = text.substring(exhibitAStart);
      const exhibitBStart = exhibitText.search(/EXHIBIT\s+["\']?B["\']?/i);
      
      let exhibitAContent;
      if (exhibitBStart !== -1) {
        exhibitAContent = exhibitText.substring(0, exhibitBStart);
      } else {
        // Take up to 2000 chars or end of text
        exhibitAContent = exhibitText.substring(0, Math.min(2000, exhibitText.length));
      }
      
      // Clean up the content
      exhibitAContent = exhibitAContent.replace(/EXHIBIT\s+["\']?A["\']?[:\s]*/i, '');
      exhibitAContent = exhibitAContent.replace(/LEGAL\s+DESCRIPTION[:\s]*/i, '');
      exhibitAContent = exhibitAContent.trim().replace(/\s+/g, ' ');
      
      if (exhibitAContent.length > 30) {
        console.log('Extracted Exhibit A content, length:', exhibitAContent.length);
        return exhibitAContent;
      }
    }
    
    // If we can't find the actual exhibit, return a note
    return 'See Exhibit A attached to original deed';
  }
  
  // Try to find legal description in main text
  // Pattern 1: After "hereby grant(s) to [name], the following"
  const pattern1 = /hereby\s+GRANT\(S\)\s+to\s+[^,]+,\s+(?:the\s+following[^:]*:\s*)([\s\S]{50,2000}?)(?:APN|AP#|Assessor|EXCEPTING|This\s+conveyance|Situated)/i;
  let match = text.match(pattern1);
  if (match) {
    let desc = match[1].trim().replace(/\s+/g, ' ');
    console.log('Found legal description (pattern 1), length:', desc.length);
    return desc;
  }
  
  // Pattern 2: Look for "real property" followed by description
  const pattern2 = /(?:following\s+)?(?:described\s+)?real\s+property[:\s]+([\s\S]{50,2000}?)(?:APN|AP#|Assessor|EXCEPTING|Situated|located)/i;
  match = text.match(pattern2);
  if (match) {
    let desc = match[1].trim().replace(/\s+/g, ' ');
    console.log('Found legal description (pattern 2), length:', desc.length);
    return desc;
  }
  
  // Pattern 3: Look for common legal description starters (Lot, Parcel)
  const pattern3 = /((?:Lot|PARCEL|LOT)\s+[0-9]+[^.]{50,2000}?)(?:APN|AP#|Assessor|EXCEPTING|Situated)/i;
  match = text.match(pattern3);
  if (match) {
    let desc = match[1].trim().replace(/\s+/g, ' ');
    console.log('Found legal description (pattern 3), length:', desc.length);
    return desc;
  }
  
  // Pattern 4: Between acknowledgment and APN/Situated
  const acknowledgeIndex = text.search(/receipt\s+of\s+which\s+is\s+hereby\s+acknowledged/i);
  const endMarkers = [
    { pattern: /(?:APN|AP#)[:.\s]*[0-9]/i, name: 'APN' },
    { pattern: /Situated\s+in/i, name: 'Situated' },
    { pattern: /EXCEPTING/i, name: 'EXCEPTING' }
  ];
  
  if (acknowledgeIndex !== -1) {
    console.log('Found acknowledgment at:', acknowledgeIndex);
    
    // Find the earliest end marker
    let earliestEnd = -1;
    let earliestName = '';
    
    for (const marker of endMarkers) {
      const index = text.substring(acknowledgeIndex).search(marker.pattern);
      if (index !== -1 && (earliestEnd === -1 || index < earliestEnd)) {
        earliestEnd = index;
        earliestName = marker.name;
      }
    }
    
    if (earliestEnd !== -1) {
      console.log('Found end marker', earliestName, 'at offset:', earliestEnd);
      
      // Skip forward past the grantee text (usually within 300 chars)
      let startSearch = acknowledgeIndex + 250;
      let endSearch = acknowledgeIndex + earliestEnd;
      
      let legalDesc = text.substring(startSearch, endSearch).trim();
      
      // Clean up
      legalDesc = legalDesc.replace(/^[^A-Z]*/, ''); // Remove leading junk
      legalDesc = legalDesc.replace(/hereby\s+GRANT\(S\)[^:]*:\s*/i, '');
      legalDesc = legalDesc.replace(/\s+/g, ' ');
      
      if (legalDesc.length >= 30) {
        console.log('Found legal description (pattern 4), length:', legalDesc.length);
        console.log('Legal description preview:', legalDesc.substring(0, 150));
        return legalDesc;
      }
    }
  }
  
  console.log('Could not find legal description with any pattern');
  
  // Debug: show text around where it should be
  if (acknowledgeIndex !== -1) {
    console.log('=== DEBUG: Text after acknowledgment (800 chars) ===');
    console.log(text.substring(acknowledgeIndex + 200, acknowledgeIndex + 1000));
  }
  
  return '';
}

function extractMailingAddress(text) {
  // Not used - we use property address
  return '';
}
