/**
 * Netlify serverless function for OCR extraction
 * Uses tesseract.js for client-side OCR processing
 */

const { createWorker } = require('tesseract.js');
const multipart = require('lambda-multipart-parser');

exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    // Parse multipart form data
    const result = await multipart.parse(event);

    if (!result.files || result.files.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'No file uploaded' }),
      };
    }

    const file = result.files[0];
    const fileBuffer = Buffer.from(file.content);

    // Initialize Tesseract worker
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    // Perform OCR
    const { data: { text } } = await worker.recognize(fileBuffer);
    await worker.terminate();

    // Extract structured data from OCR text
    const extractedData = parseOCRText(text);

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
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to process deed',
        message: error.message,
      }),
    };
  }
};

function parseOCRText(text) {
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
    mailingAddress: extractMailingAddress(text),
  };

  return data;
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
  // In original deed, this is the GRANTEE (who is transferring TO the trust)
  // Example: "Arthur Avagyants, a married man as his sole and separate property"
  const patterns = [
    /GRANTOR\(S\)[:\s]*([^\n]+?)(?:,\s*(?:hereby|TRUSTEE))/i,
    /GRANTEE[:\s]*([^\n]+?)(?:,\s*(?:a|an|the))/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let grantor = match[1].trim();
      // Remove "hereby GRANT(s) to" and similar
      grantor = grantor.replace(/hereby\s+GRANT\(s\)\s+to/i, '').trim();
      return grantor;
    }
  }
  return '';
}

function extractTrustee(text) {
  // Extract trustee name (usually same as grantor but with "TRUSTEE OF")
  const patterns = [
    /GRANT\(s\)\s+to\s+([^,]+),\s*TRUSTEE/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  
  // Default to grantor name if not found
  return extractGrantor(text).split(',')[0].trim();
}

function extractTrustName(text) {
  const patterns = [
    /TRUSTEE\s+OF\s+THE\s+([^\n]+?)(?:DATED|,)/i,
    /([A-Z][a-z]+\s+[A-Z][a-z]+\s+Living\s+Trust)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return '';
}

function extractTrustDate(text) {
  const patterns = [
    /DATED\s+([A-Z][a-z]+\s+\d{1,2},?\s+\d{4})/i,
    /dated\s+([^\n]+?)(?:,|\s+AND)/i,
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
    /(?:located\s+at|property\s+address)[:\s]*([^\n]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      // Remove trailing periods, commas
      address = address.replace(/[,.]$/, '').trim();
      return address;
    }
  }
  return '';
}

function extractCity(text) {
  const patterns = [
    /CITY\s+OF\s+([A-Z]+)/i,
    /,\s*([A-Z][A-Z\s]+),\s*CA/i,
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
  // Legal descriptions are often very long and complex
  // Look for text between property description markers and address
  const startPatterns = [
    /described\s+as[:\s]*/i,
    /real\s+property[^\n]*?[:\s]*/i,
  ];

  const endPatterns = [
    /Commonly\s+known\s+as/i,
    /MAIL\s+TAX/i,
    /Dated:/i,
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
  // Clean up excessive whitespace
  return legalDesc.replace(/\s+/g, ' ').trim();
}

function extractMailingAddress(text) {
  const patterns = [
    /MAIL\s+TAX\s+STATEMENTS\s+TO[:\s]*([^\n]+(?:\n[^\n]+)*?)(?=RECORDING|STATE|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      // Keep first 3 lines (name, street, city/state/zip)
      const lines = address.split('\n').slice(0, 3);
      return lines.join(', ').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}
