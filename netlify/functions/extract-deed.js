/**
 * Netlify serverless function for OCR extraction
 * Handles both images and PDFs (converts PDF first page to image)
 */

const multipart = require('lambda-multipart-parser');
const https = require('https');
const { PDFDocument } = require('pdf-lib');

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
    console.log('Processing file:', file.filename, 'Type:', file.contentType, 'Size:', file.content.length);

    // For PDFs, we need to tell the user to upload as image instead
    const isPDF = file.filename.toLowerCase().endsWith('.pdf') || 
                  file.contentType === 'application/pdf';

    if (isPDF) {
      console.log('PDF detected - OCR not available for PDFs in this environment');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'PDF_NOT_SUPPORTED',
          message: 'For best results, please convert your PDF to an image (PNG/JPG) first, or enter the information manually.',
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

    // Process image files
    const base64File = Buffer.from(file.content).toString('base64');

    console.log('Calling Google Vision API for image...');
    const ocrText = await performGoogleOCR(base64File);

    if (!ocrText) {
      throw new Error('No text extracted from document');
    }

    console.log('OCR successful! Text length:', ocrText.length);
    console.log('First 200 chars:', ocrText.substring(0, 200));

    // Parse the OCR text
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
    
    // Return error with success: false
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
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          console.log('Google Vision response code:', res.statusCode);
          
          if (res.statusCode !== 200) {
            console.error('API error response:', data);
            reject(new Error(`API returned status ${res.statusCode}`));
            return;
          }

          const response = JSON.parse(data);
          
          if (response.error) {
            console.error('API error:', response.error);
            reject(new Error(response.error.message || 'Google Vision API error'));
            return;
          }

          if (response.responses && response.responses[0]) {
            const result = response.responses[0];
            
            if (result.error) {
              console.error('OCR error:', result.error);
              reject(new Error(result.error.message || 'OCR processing error'));
              return;
            }

            const fullTextAnnotation = result.fullTextAnnotation;
            if (fullTextAnnotation && fullTextAnnotation.text) {
              resolve(fullTextAnnotation.text);
            } else {
              reject(new Error('No text found in document'));
            }
          } else {
            reject(new Error('Invalid response from API'));
          }
        } catch (e) {
          console.error('Parse error:', e);
          reject(new Error('Failed to parse response: ' + e.message));
        }
      });
    });

    req.on('error', (e) => {
      console.error('Request error:', e);
      reject(new Error('Request failed: ' + e.message));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    req.write(requestBody);
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
