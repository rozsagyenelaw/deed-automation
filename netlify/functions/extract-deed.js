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
    
    // Call OCR.space API (supports PDFs directly!)
    const ocrText = await performOCR(base64File, mimeType);

    if (!ocrText) {
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
      timeout: 60000
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
            console.log('First 2000 chars:', text.substring(0, 2000));
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
    // Clean up extra spaces
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
    /(Los Angeles|Ventura|Riverside|San Bernardino|Orange|Pasadena|Glendale|Burbank|Santa Monica)/i,
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
  // Grant deeds typically have legal description after "receipt of which is hereby acknowledged"
  // Pattern: Look for text between acknowledgment and APN or end markers
  
  // Find start point
  const startMarkers = [
    /receipt\s+of\s+which\s+is\s+hereby\s+acknowledged[,\s]+(?:hereby\s+)?(?:grant|convey)[s]?\s+to[^:]+:\s*/i,
    /the\s+following\s+(?:described\s+)?(?:real\s+)?property[:\s]*/i,
    /property\s+is\s+(?:situated|located)\s+in[^:]+:\s*/i,
  ];
  
  let startIndex = -1;
  for (const pattern of startMarkers) {
    const match = text.match(pattern);
    if (match) {
      startIndex = match.index + match[0].length;
      console.log('Found legal description start at index:', startIndex);
      break;
    }
  }
  
  if (startIndex === -1) {
    // Try alternative: look for "Lot" keyword
    const lotMatch = text.match(/\b(Lot\s+[0-9]+)/i);
    if (lotMatch) {
      startIndex = lotMatch.index;
      console.log('Found Lot at index:', startIndex);
    }
  }
  
  if (startIndex === -1) {
    console.log('No legal description start marker found');
    return '';
  }
  
  // Find end point
  const endMarkers = [
    /(?:APN|AP#|Assessor)/i,
    /EXCEPTING/i,
    /(?:This\s+)?(?:Grant|conveyance)\s+is\s+made/i,
  ];
  
  let endIndex = text.length;
  const searchText = text.substring(startIndex);
  
  for (const pattern of endMarkers) {
    const match = searchText.match(pattern);
    if (match && match.index < (endIndex - startIndex)) {
      endIndex = startIndex + match.index;
      console.log('Found legal description end at index:', endIndex);
      break;
    }
  }
  
  // Extract and clean
  let legalDesc = text.substring(startIndex, endIndex).trim();
  legalDesc = legalDesc.replace(/\s+/g, ' '); // Normalize whitespace
  
  // Validate length
  if (legalDesc.length >= 30 && legalDesc.length <= 2000) {
    console.log('Found Legal Description, length:', legalDesc.length);
    return legalDesc;
  }
  
  console.log('Legal description too short or too long:', legalDesc.length);
  return '';
}

function extractMailingAddress(text) {
  // Not used - we use property address
  return '';
}
