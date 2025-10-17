/**
 * Netlify serverless function for OCR extraction
 * Uses OCR.space API which handles PDFs directly
 */

const multipart = require('lambda-multipart-parser');
const https = require('https');

// OCR.space API - Free tier: 25,000 requests/month
// Get your own key at: https://ocr.space/ocrapi (use the demo key for now)
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
    /APN[:\s]*([0-9\-]+)/i,
    /Assessor'?s?\s+Parcel\s+Number[:\s]*([0-9\-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function extractGrantor(text) {
  const patterns = [
    /GRANTOR\(S\)\s+([^,]+),\s*(?:a|an)/i,
    /GRANTOR[:\s]+([^,]+),\s*(?:a|an)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function extractTrustee(text) {
  const patterns = [
    /GRANT\(s\)\s+to\s+([^,]+),\s*TRUSTEE/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return extractGrantor(text).split(',')[0].trim();
}

function extractTrustName(text) {
  const patterns = [
    /TRUSTEE\s+OF\s+THE\s+([^\n]+?)(?:DATED)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[1].trim().replace(/^THE\s+/i, '');
    }
  }
  return '';
}

function extractTrustDate(text) {
  const patterns = [
    /DATED\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function extractPropertyAddress(text) {
  const patterns = [
    /Commonly\s+known\s+as[:\s]*([^\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim().replace(/[,.]$/, '');
  }
  return '';
}

function extractCity(text) {
  const patterns = [
    /CITY\s+OF\s+([A-Z]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function extractCounty(text) {
  const patterns = [
    /County\s+of\s+([A-Z][a-z\s]+?)(?:\s+State)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return 'Los Angeles';
}

function extractLegalDescription(text) {
  const startMatch = text.match(/described\s+as[:\s]*/i);
  const endMatch = text.match(/Commonly\s+known/i);
  if (startMatch && endMatch) {
    const start = startMatch.index + startMatch[0].length;
    const end = endMatch.index;
    return text.substring(start, end).trim().replace(/\s+/g, ' ');
  }
  return '';
}

function extractMailingAddress(text) {
  const patterns = [
    /MAIL\s+TAX\s+STATEMENTS\s+TO[:\s]*([^\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}
