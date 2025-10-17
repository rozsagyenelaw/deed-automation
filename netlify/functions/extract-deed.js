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
      timeout: 20000
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
            
            if (errorMsg.includes('maximum page limit')) {
              console.log('Page limit hit - but we got some pages, continuing...');
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
  
  data.mailingAddress = data.propertyAddress;
  
  return data;
}

function extractAPN(text) {
  const patterns = [
    // "BEARING ASSESSOR'S IDENTIFICATION NUMBER 8633-014-003"
    /BEARING\s+ASSESSOR['\s]?S?\s+IDENTIFICATION\s+NUMBER\s+([0-9]{4}[-]?[0-9]{3}[-]?[0-9]{3})/i,
    /AP#:\s*([0-9]{4}[-]?[0-9]{3}[-]?[0-9]{3})/i,
    /APN[:\s#]*([0-9]{4}[-\s]?[0-9]{3}[-\s]?[0-9]{3})/i,
    /Assessor['\s]?s?\s+(?:Parcel|Identification)\s+(?:Number|No\.?)[:\s]*([0-9\-\s]+)/i,
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
  // Extract GRANTEE from original deed (they become the grantor in trust transfer)
  
  // Helper function to normalize and clean names
  function cleanName(name) {
    if (!name) return '';
    
    // Remove trailing descriptions
    name = name.replace(/,\s*(?:a|an)\s+.*$/i, '');
    name = name.replace(/\s+as\s+.*$/i, '');
    
    // Normalize spacing
    name = name.replace(/\s+/g, ' ').trim();
    
    // Convert to title case if all caps
    if (name === name.toUpperCase()) {
      name = name.split(' ').map(word => {
        // Keep initials as is (e.g., "D.")
        if (word.length <= 2 || word.endsWith('.')) {
          return word;
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }).join(' ');
    }
    
    return name;
  }
  
  const patterns = [
    // From "WHEN RECORDED MAIL TO:" section - handle ALL CAPS
    // "CANDACE D. ROY" or "Candace D. Roy"
    /(?:WHEN RECORDED|RECORDING REQUESTED BY[\s\S]{0,100}?WHEN RECORDED)[\s\S]{0,50}?MAIL TO:\s*\n?\s*([A-Z][A-Z\s.]+)/i,
    
    // "hereby GRANT(S) to CANDACE D. ROY, a married woman"
    /hereby\s+GRANT\(S\)\s+to\s+([A-Z][A-Z\s.]+?)(?:,\s*(?:a|an)\s+)/i,
    
    // "GRANTEE: CANDACE D. ROY" or with description
    /GRANTEE[:\s]+([A-Z][A-Z\s.]+?)(?:,|\s+a|\s+an|\s*$)/im,
    
    // Standard patterns for mixed case
    /(?:conveys?|grants?|transfers?)\s+to\s+([A-Z][a-z]+(?:\s+[A-Z]\.?)(?:\s+[A-Z][a-z]+)+)(?:,\s*(?:a|an))/i,
    
    // Name followed by marital status
    /\b([A-Z][a-z]+\s+[A-Z]\.?\s+[A-Z][a-z]+),\s*(?:a|an)\s+(?:married|single|unmarried|widowed)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let name = cleanName(match[1]);
      
      // Validate: should have at least first and last name
      const nameParts = name.split(/\s+/).filter(p => p.length > 0);
      if (nameParts.length >= 2 && nameParts.length <= 5) {
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
  // Pattern to match full address with various formats
  const patterns = [
    // Standard format with parenthetical
    /\b([0-9]{3,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*(?:\s*\([^)]+\))?,?\s+(?:CA|California)\s+[0-9]{5})/i,
    
    // Without parenthetical
    /\b([0-9]{3,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?,?\s+(?:CA|California)\s+[0-9]{5})/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim().replace(/\s+/g, ' ');
      console.log('Found property address:', address);
      return address;
    }
  }
  
  // Fallback: construct from parts
  const streetPattern = /\b([0-9]{3,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct)\.?)\b/i;
  const streetMatch = text.match(streetPattern);
  
  if (streetMatch) {
    let address = streetMatch[1].trim();
    const city = extractCity(text);
    
    if (city) {
      address += `, ${city}, CA`;
      
      const zipMatch = text.match(/\b[0-9]{5}\b/);
      if (zipMatch) {
        address += ` ${zipMatch[0]}`;
      }
    }
    
    console.log('Constructed property address:', address);
    return address;
  }
  
  return '';
}

function extractCity(text) {
  const patterns = [
    // "Los Angeles (Tujunga area)"
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\([^)]+\),?\s+(?:CA|California)/i,
    
    // "City of Los Angeles" or "CITY OF LOS ANGELES"
    /CITY\s+OF\s+([A-Z\s]+?)(?:,|\s+COUNTY)/i,
    
    // ", Los Angeles, CA"
    /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:CA|California)/i,
    
    // "IN THE CITY OF GLENDORA"
    /IN\s+THE\s+CITY\s+OF\s+([A-Z]+)/i,
    
    // Known cities (case insensitive)
    /(Los Angeles|Ventura|Riverside|San Bernardino|Orange|Pasadena|Glendale|Burbank|Santa Monica|Tujunga|Glendora)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let city = match[1].trim();
      
      // Convert all-caps to title case
      if (city === city.toUpperCase()) {
        city = city.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
      
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
    /COUNTY\s+OF\s+(LOS ANGELES|VENTURA|RIVERSIDE|SAN BERNARDINO|ORANGE)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let county = match[1].trim();
      
      // Convert all-caps to title case
      if (county === county.toUpperCase()) {
        county = county.split(' ').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        ).join(' ');
      }
      
      console.log('Found County:', county);
      return county;
    }
  }
  
  return 'Los Angeles';
}

function extractLegalDescription(text) {
  console.log('=== SEARCHING FOR LEGAL DESCRIPTION ===');
  
  // Check for Exhibit A reference
  const exhibitARef = /(?:legal\s+description|property\s+description|described)\s+(?:is\s+)?(?:attached\s+as|in|on)\s+Exhibit\s+["\']?A["\']?/i;
  if (exhibitARef.test(text)) {
    console.log('Found Exhibit A reference');
    
    const exhibitAStart = text.search(/EXHIBIT\s+["\']?A["\']?/i);
    if (exhibitAStart !== -1) {
      console.log('Found EXHIBIT A section at index:', exhibitAStart);
      
      const exhibitText = text.substring(exhibitAStart);
      const exhibitBStart = exhibitText.search(/EXHIBIT\s+["\']?B["\']?/i);
      
      let exhibitAContent = exhibitBStart !== -1 
        ? exhibitText.substring(0, exhibitBStart)
        : exhibitText.substring(0, Math.min(2000, exhibitText.length));
      
      exhibitAContent = exhibitAContent
        .replace(/EXHIBIT\s+["\']?A["\']?[:\s]*/i, '')
        .replace(/LEGAL\s+DESCRIPTION[:\s]*/i, '')
        .trim()
        .replace(/\s+/g, ' ');
      
      if (exhibitAContent.length > 30) {
        console.log('Extracted Exhibit A content, length:', exhibitAContent.length);
        return exhibitAContent;
      }
    }
    
    return 'See Exhibit A attached to original deed';
  }
  
  // Pattern 1: Starts with "LOT" or "PARCEL" - common in tract maps
  // "LOT 14 OF TRACT NO. 19560, IN THE CITY OF GLENDORA..."
  const lotPattern = /((?:LOT|PARCEL)\s+[0-9]+[\s\S]{20,1500}?)(?:APN|AP#|Assessor|EXCEPTING|Situated|$)/i;
  let match = text.match(lotPattern);
  if (match) {
    let desc = match[1].trim().replace(/\s+/g, ' ');
    console.log('Found legal description (LOT pattern), length:', desc.length);
    return desc;
  }
  
  // Pattern 2: After "hereby grant(s) to [name], the following"
  const grantPattern = /hereby\s+GRANT\(S\)\s+to\s+[^,]+,\s+(?:the\s+following[^:]*:\s*)([\s\S]{50,2000}?)(?:APN|AP#|Assessor|EXCEPTING|This\s+conveyance|Situated)/i;
  match = text.match(grantPattern);
  if (match) {
    let desc = match[1].trim().replace(/\s+/g, ' ');
    console.log('Found legal description (grant pattern), length:', desc.length);
    return desc;
  }
  
  // Pattern 3: Look for "real property" followed by description
  const realPropertyPattern = /(?:following\s+)?(?:described\s+)?real\s+property[:\s]+([\s\S]{50,2000}?)(?:APN|AP#|Assessor|EXCEPTING|Situated|located)/i;
  match = text.match(realPropertyPattern);
  if (match) {
    let desc = match[1].trim().replace(/\s+/g, ' ');
    console.log('Found legal description (real property pattern), length:', desc.length);
    return desc;
  }
  
  // Pattern 4: Between acknowledgment and APN/Situated
  const acknowledgeIndex = text.search(/receipt\s+of\s+which\s+is\s+hereby\s+acknowledged/i);
  if (acknowledgeIndex !== -1) {
    const endMarkers = [
      { pattern: /(?:APN|AP#)[:.\s]*[0-9]/i, name: 'APN' },
      { pattern: /Situated\s+in/i, name: 'Situated' },
      { pattern: /EXCEPTING/i, name: 'EXCEPTING' },
      { pattern: /BEARING\s+ASSESSOR/i, name: 'BEARING' }
    ];
    
    let earliestEnd = -1;
    for (const marker of endMarkers) {
      const index = text.substring(acknowledgeIndex).search(marker.pattern);
      if (index !== -1 && (earliestEnd === -1 || index < earliestEnd)) {
        earliestEnd = index;
      }
    }
    
    if (earliestEnd !== -1) {
      let startSearch = acknowledgeIndex + 250;
      let endSearch = acknowledgeIndex + earliestEnd;
      
      let legalDesc = text.substring(startSearch, endSearch).trim();
      legalDesc = legalDesc
        .replace(/^[^A-Z]*/, '')
        .replace(/hereby\s+GRANT\(S\)[^:]*:\s*/i, '')
        .replace(/\s+/g, ' ');
      
      if (legalDesc.length >= 30) {
        console.log('Found legal description (acknowledgment pattern), length:', legalDesc.length);
        return legalDesc;
      }
    }
  }
  
  console.log('Could not find legal description');
  return '';
}
