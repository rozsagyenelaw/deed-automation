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
    console.log('First 500 chars of OCR text:', ocrText.substring(0, 500));

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
      timeout: 60000 // 60 second timeout for PDFs
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
    /APN[:\s#]*([0-9\-]+)/i,
    /Assessor'?s?\s+Parcel\s+Number[:\s]*([0-9\-]+)/i,
    /A\.P\.N\.[:\s]*([0-9\-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      console.log('Found APN:', match[1]);
      return match[1].trim();
    }
  }
  return '';
}

function extractGrantor(text) {
  // IMPORTANT: In the ORIGINAL deed, we extract the GRANTEE
  // The GRANTEE from the original deed becomes the GRANTOR in the trust transfer deed
  // Format in original deed: "GRANTEE: John Doe, a married man"
  const patterns = [
    /GRANTEE[:\s]+([^,\n]+(?:,\s*[^,\n]+)?),?\s*(?:a|an|the)/i,
    /(?:TO|CONVEYS?\s+TO)[:\s]+([^,\n]+),?\s*(?:a|an)/i,
    /hereby\s+(?:grant|grants|convey|conveys)\s+to\s+([^,]+),/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let grantee = match[1].trim();
      console.log('Found GRANTEE (will be grantor in trust deed):', grantee);
      return grantee;
    }
  }
  return '';
}

function extractTrustee(text) {
  // Trustee will usually be the same as the grantee/grantor
  // User can modify in the form
  const grantor = extractGrantor(text);
  return grantor.split(',')[0].trim();
}

function extractTrustName(text) {
  // Trust name must be entered by user - not in original deed
  return '';
}

function extractTrustDate(text) {
  // Trust date must be entered by user - not in original deed
  return '';
}

function extractPropertyAddress(text) {
  const patterns = [
    /(?:situated|located)\s+(?:in|at)[^\n]*?([0-9]+[^\n]+?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir)[^\n]*?)(?:,|\.|\n)/i,
    /(?:Property|Real\s+Property)\s+(?:Address|Located)[:\s]*([^\n]+)/i,
    /commonly\s+known\s+as[:\s]*([^\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      // Clean up
      address = address.replace(/[,.]$/, '').trim();
      // Remove city/state if included
      address = address.replace(/,?\s*(?:Los Angeles|Ventura|Riverside|San Bernardino|Orange),?\s*(?:CA|California).*/i, '').trim();
      console.log('Found Property Address:', address);
      return address;
    }
  }
  return '';
}

function extractCity(text) {
  const patterns = [
    /(?:City|County)\s+of\s+([A-Z][a-z\s]+?)(?:,|\s+County|\s+State)/i,
    /,\s*([A-Z][a-z\s]+),\s*(?:CA|California)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const city = match[1].trim();
      console.log('Found City:', city);
      return city;
    }
  }
  return '';
}

function extractCounty(text) {
  const patterns = [
    /County\s+of\s+(Los Angeles|Ventura|Riverside|San Bernardino|Orange)/i,
    /(?:in|of)\s+(Los Angeles|Ventura|Riverside|San Bernardino|Orange)\s+County/i,
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
  // Legal descriptions are typically between "described as" and "APN" or address
  const startPatterns = [
    /(?:legally\s+)?described\s+as\s+follows?[:\s]*/i,
    /(?:real\s+property|land)\s+described\s+as[:\s]*/i,
    /LEGAL\s+DESCRIPTION[:\s]*/i,
  ];
  
  const endPatterns = [
    /(?:APN|Assessor'?s?\s+Parcel)/i,
    /(?:commonly\s+known|also\s+known|street\s+address)/i,
    /(?:EXCEPTING|Subject\s+to)/i,
  ];

  let startIndex = -1;
  for (const pattern of startPatterns) {
    const match = text.match(pattern);
    if (match) {
      startIndex = match.index + match[0].length;
      break;
    }
  }

  if (startIndex === -1) return '';

  let endIndex = text.length;
  for (const pattern of endPatterns) {
    const match = text.substring(startIndex).match(pattern);
    if (match) {
      endIndex = startIndex + match.index;
      break;
    }
  }

  const legalDesc = text.substring(startIndex, endIndex).trim();
  // Clean up whitespace
  const cleaned = legalDesc.replace(/\s+/g, ' ').trim();
  
  if (cleaned.length > 20) {
    console.log('Found Legal Description, length:', cleaned.length);
    return cleaned;
  }
  
  return '';
}

function extractMailingAddress(text) {
  // Mailing address patterns
  const patterns = [
    /(?:Mail|Send|Return)\s+(?:to|documents to|tax statements to)[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i,
    /MAIL\s+TAX[^\n]*?TO[:\s]*([^\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      const lines = address.split('\n').slice(0, 2);
      const cleaned = lines.join(', ').replace(/\s+/g, ' ').trim();
      console.log('Found Mailing Address:', cleaned);
      return cleaned;
    }
  }
  
  // If no specific mailing address, use property address
  return extractPropertyAddress(text);
}
