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
            reject(new Error(errorMsg));
            return;
          }

          if (response.ParsedResults && response.ParsedResults.length > 0) {
            const text = response.ParsedResults.map(r => r.ParsedText).join('\n');
            console.log('Text extracted, length:', text.length);
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
  console.log('First 1000 chars:', text.substring(0, 1000));
  
  return {
    apn: extractAPN(text),
    grantor: extractGrantor(text),
    trustee: extractTrustee(text),
    trustName: extractTrustName(text),
    trustDate: extractTrustDate(text),
    propertyAddress: extractPropertyAddress(text),
    city: extractCity(text),
    county: extractCounty(text),
    legalDescription: extractLegalDescription(text),
    mailingAddress: extractMailingAddress(text),
  };
}

function extractAPN(text) {
  const patterns = [
    // Standard APN format: 1234-567-890
    /APN[:\s#]*([0-9]{4}[-\s]?[0-9]{3}[-\s]?[0-9]{3})/i,
    /Assessor['\s]?s?\s+Parcel\s+(?:Number|No\.?)[:\s]*([0-9\-\s]+)/i,
    /Parcel\s*(?:No\.?|Number|#)[:\s]*([0-9\-\s]+)/i,
    /A\.?\s*P\.?\s*N\.?[:\s]*([0-9\-\s]+)/i,
    // Flexible: any sequence of 8-12 digits with hyphens
    /\b([0-9]{4}[-]?[0-9]{3}[-]?[0-9]{3})\b/,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let apn = match[1].trim();
      // Clean and format
      apn = apn.replace(/\s+/g, '').replace(/[^0-9\-]/g, '');
      // Ensure proper format
      if (apn.length >= 10) {
        console.log('Found APN:', apn);
        return apn;
      }
    }
  }
  return '';
}

function extractGrantor(text) {
  // Extract GRANTEE from original deed (becomes grantor in trust transfer)
  const patterns = [
    // "GRANTEE: Arthur Avagyants"
    /GRANTEE[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:,|\s+a|\s+an|\s*$)/i,
    
    // "conveys to Arthur Avagyants, a married"
    /(?:conveys?|grants?|transfers?)\s+to\s+([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)(?:,\s*(?:a|an))/i,
    
    // "Arthur Avagyants, a married man"
    /\b([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:a|an)\s+(?:married|single|unmarried|widowed)/i,
    
    // From mailing address
    /(?:Mail|Return|Send)[^\n]*?(?:to|at)[:\s]*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let name = match[1].trim();
      // Clean up
      name = name.replace(/,.*$/, '').trim();
      // Validate it's a real name (2-4 words, proper case)
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
  const patterns = [
    // "6821 Saint Estaban Street"
    /\b([0-9]{3,6}\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir|Place|Pl)\.?)\b/i,
    
    // "commonly known as: 123 Main St"
    /(?:commonly\s+known\s+as|located\s+at|situated\s+at)[:\s]*([0-9]+[^\n,]+?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct)\.?)/i,
    
    // "property at 123 Main Street"
    /property\s+at\s+([0-9]+[^\n,]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      // Clean up
      address = address.replace(/[,.]$/, '').trim();
      // Remove city/state if included
      address = address.replace(/,?\s*(?:Los Angeles|Ventura|Riverside|San Bernardino|Orange).*$/i, '').trim();
      
      if (address.length > 10) {
        console.log('Found Property Address:', address);
        return address;
      }
    }
  }
  
  return '';
}

function extractCity(text) {
  const patterns = [
    // "City of Los Angeles"
    /City\s+of\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    
    // ", Los Angeles, CA"
    /,\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?),\s*(?:CA|California)/i,
    
    // Look for known cities
    /(Los Angeles|Ventura|Riverside|San Bernardino|Orange|Pasadena|Glendale|Burbank|Santa Monica)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const city = match[1].trim();
      // Validate it's not garbage
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
  // Legal descriptions typically start with "Lot", "Parcel", or "described as"
  const startPatterns = [
    /(?:legally\s+)?described\s+as\s+follows?[:\s]*/i,
    /(?:real\s+property|land)\s+described\s+as[:\s]*/i,
    /LEGAL\s+DESCRIPTION[:\s]*/i,
    /\b(Lot\s+[0-9]+)/i,
    /\b(Parcel\s+[0-9]+)/i,
  ];
  
  const endPatterns = [
    /(?:APN|Assessor)/i,
    /(?:commonly\s+known|also\s+known|street\s+address)/i,
    /(?:situate|located|lying)\s+in/i,
  ];

  let startIndex = -1;
  let bestMatch = null;
  
  for (const pattern of startPatterns) {
    const match = text.match(pattern);
    if (match) {
      if (startIndex === -1 || match.index < startIndex) {
        startIndex = match.index + match[0].length;
        bestMatch = match[0];
      }
    }
  }

  if (startIndex === -1) return '';

  let endIndex = text.length;
  for (const pattern of endPatterns) {
    const match = text.substring(startIndex).match(pattern);
    if (match && match.index < (endIndex - startIndex)) {
      endIndex = startIndex + match.index;
    }
  }

  const legalDesc = text.substring(startIndex, endIndex).trim();
  const cleaned = legalDesc.replace(/\s+/g, ' ').trim();
  
  // Only return if it looks like a real legal description
  if (cleaned.length > 30 && cleaned.length < 1000) {
    console.log('Found Legal Description, length:', cleaned.length);
    return cleaned;
  }
  
  return '';
}

function extractMailingAddress(text) {
  const patterns = [
    // "Mail to: Arthur Avagyants, 6821 Saint Estaban Street"
    /(?:Mail|Send|Return)\s+(?:to|at)[:\s]*([A-Z][a-z]+\s+[A-Z][a-z]+[^\n]*?[0-9]+[^\n]+)/i,
    
    // "Arthur Avagyants\n6821 Saint Estaban Street"
    /([A-Z][a-z]+\s+[A-Z][a-z]+)\s*[\n,]\s*([0-9]+[^\n]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[0].replace(/(?:Mail|Send|Return)\s+(?:to|at)[:\s]*/i, '').trim();
      address = address.replace(/\s+/g, ' ').trim();
      
      if (address.length > 10) {
        console.log('Found Mailing Address:', address);
        return address;
      }
    }
  }
  
  // Fallback: combine name + property address
  const name = extractGrantor(text);
  const propAddress = extractPropertyAddress(text);
  if (name && propAddress) {
    return `${name}, ${propAddress}`;
  }
  
  return '';
}
