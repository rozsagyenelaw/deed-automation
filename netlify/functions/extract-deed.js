/**
 * Netlify serverless function for OCR extraction
 * Uses Google Cloud Vision API - BEST accuracy for scanned legal documents
 */

const multipart = require('lambda-multipart-parser');
const https = require('https');

// Google Cloud Vision API key
const GOOGLE_API_KEY = 'AIzaSyB3wG7fP2uWGYKGWxHUGlMS2Y9zIqlL_gg';

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
        body: JSON.stringify({ error: 'No file uploaded' }),
      };
    }

    const file = result.files[0];
    const base64File = Buffer.from(file.content).toString('base64');

    // Call Google Cloud Vision API
    const ocrText = await performGoogleOCR(base64File);

    if (!ocrText) {
      throw new Error('OCR extraction failed');
    }

    // Parse the OCR text to extract structured data
    const extractedData = parseOCRText(ocrText);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        ...extractedData,
        filename: file.filename,
        rawText: ocrText.substring(0, 1000), // First 1000 chars for debugging
      }),
    };

  } catch (error) {
    console.error('Error processing deed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process deed',
        message: error.message,
        success: false,
      }),
    };
  }
};

function performGoogleOCR(base64File) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      requests: [
        {
          image: {
            content: base64File
          },
          features: [
            {
              type: 'DOCUMENT_TEXT_DETECTION'
            }
          ]
        }
      ]
    });

    const options = {
      hostname: 'vision.googleapis.com',
      path: `/v1/images:annotate?key=${GOOGLE_API_KEY}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (response.error) {
            reject(new Error(response.error.message || 'Google Vision API error'));
            return;
          }

          if (response.responses && response.responses[0]) {
            const fullTextAnnotation = response.responses[0].fullTextAnnotation;
            if (fullTextAnnotation && fullTextAnnotation.text) {
              resolve(fullTextAnnotation.text);
            } else {
              reject(new Error('No text found in document'));
            }
          } else {
            reject(new Error('Invalid response from Google Vision API'));
          }
        } catch (e) {
          reject(new Error('Failed to parse OCR response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error('OCR request failed: ' + e.message));
    });

    req.write(requestBody);
    req.end();
  });
}

function parseOCRText(text) {
  console.log('Parsing OCR text from Google Cloud Vision...');
  
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
    /Parcel\s+Number[:\s]*([0-9\-]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function extractGrantor(text) {
  // The GRANTOR in the trust transfer deed is the person transferring TO the trust
  const patterns = [
    /GRANTOR\(S\)\s+([^,]+(?:,[^,]+)?),\s*(?:a|an|the)/i,
    /GRANTOR[:\s]+([^,]+(?:,[^,]+)?),\s*(?:a|an|the)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let grantor = match[1].trim();
      grantor = grantor.replace(/\s*hereby\s+GRANT.*$/i, '').trim();
      return grantor;
    }
  }
  return '';
}

function extractTrustee(text) {
  const patterns = [
    /GRANT\(s\)\s+to\s+([^,]+),\s*TRUSTEE/i,
    /grants?\s+to\s+([^,]+),\s*(?:as\s+)?TRUSTEE/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  const grantor = extractGrantor(text);
  return grantor.split(',')[0].trim();
}

function extractTrustName(text) {
  const patterns = [
    /TRUSTEE\s+OF\s+THE\s+([^\n]+?)(?:DATED|,\s*dated)/i,
    /TRUSTEE\s+OF\s+([^\n]+?Living\s+Trust)/i,
    /The\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s+Living\s+Trust)/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let trustName = match[1].trim();
      trustName = trustName.replace(/^THE\s+/i, '');
      trustName = trustName.replace(/\s+DATED.*$/i, '').trim();
      return trustName;
    }
  }
  return '';
}

function extractTrustDate(text) {
  const patterns = [
    /DATED\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /dated\s+([^\n,]+?\d{4})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let date = match[1].trim();
      date = date.replace(/,?\s*(?:AND|,).*$/i, '').trim();
      return date;
    }
  }
  return '';
}

function extractPropertyAddress(text) {
  const patterns = [
    /Commonly\s+known\s+as[:\s]*([^\n]+)/i,
    /Property\s+Address[:\s]*([^\n]+)/i,
    /located\s+at[:\s]*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      address = address.replace(/[,.]$/, '').trim();
      return address;
    }
  }
  return '';
}

function extractCity(text) {
  const patterns = [
    /CITY\s+OF\s+([A-Z]+)/i,
    /,\s*([A-Z][A-Z\s]+),\s*CA/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function extractCounty(text) {
  const patterns = [
    /County\s+of\s+([A-Z][a-z\s]+?)(?:\s+State|\s+CA|\n)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return 'Los Angeles';
}

function extractLegalDescription(text) {
  const startMatch = text.match(/described\s+as[:\s]*/i);
  const endMatch = text.match(/Commonly\s+known\s+as/i);

  if (startMatch && endMatch) {
    const start = startMatch.index + startMatch[0].length;
    const end = endMatch.index;
    const legalDesc = text.substring(start, end).trim();
    return legalDesc.replace(/\s+/g, ' ').trim();
  }

  return '';
}

function extractMailingAddress(text) {
  const patterns = [
    /MAIL\s+TAX\s+STATEMENTS\s+TO[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      const lines = address.split('\n').slice(0, 3);
      return lines.join(', ').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}
