/**
 * Netlify serverless function for OCR extraction
 * Uses Google Cloud Vision API with proper PDF handling
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
        body: JSON.stringify({ 
          success: false,
          error: 'No file uploaded' 
        }),
      };
    }

    const file = result.files[0];
    console.log('Processing file:', file.filename, 'Size:', file.content.length);

    // Check file size (Google Vision limit is 20MB for base64)
    if (file.content.length > 20 * 1024 * 1024) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'File too large. Please upload a file smaller than 20MB.'
        }),
      };
    }

    const base64File = Buffer.from(file.content).toString('base64');

    // Call Google Cloud Vision API
    console.log('Calling Google Vision API...');
    const ocrText = await performGoogleOCR(base64File);

    if (!ocrText) {
      throw new Error('No text extracted from document');
    }

    console.log('OCR successful, text length:', ocrText.length);

    // Parse the OCR text to extract structured data
    const extractedData = parseOCRText(ocrText);

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
    console.error('Error processing deed:', error);
    
    // Return a friendly error with empty fields so user can enter manually
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
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
        error: error.message,
        message: 'Could not extract data automatically. Please enter information manually.',
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
              type: 'DOCUMENT_TEXT_DETECTION',
              maxResults: 1
            }
          ],
          imageContext: {
            languageHints: ['en']
          }
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
      },
      timeout: 30000 // 30 second timeout
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('Google Vision API response status:', res.statusCode);
          
          if (res.statusCode !== 200) {
            reject(new Error(`API returned status ${res.statusCode}: ${data}`));
            return;
          }

          const response = JSON.parse(data);
          
          if (response.error) {
            reject(new Error(response.error.message || 'Google Vision API error'));
            return;
          }

          if (response.responses && response.responses[0]) {
            const result = response.responses[0];
            
            if (result.error) {
              reject(new Error(result.error.message || 'OCR processing error'));
              return;
            }

            const fullTextAnnotation = result.fullTextAnnotation;
            if (fullTextAnnotation && fullTextAnnotation.text) {
              console.log('Text extracted successfully');
              resolve(fullTextAnnotation.text);
            } else {
              reject(new Error('No text found in document'));
            }
          } else {
            reject(new Error('Invalid response from Google Vision API'));
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

    req.write(requestBody);
    req.end();
  });
}

function parseOCRText(text) {
  console.log('Parsing OCR text...');
  
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
