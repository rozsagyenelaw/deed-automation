/**
 * Netlify serverless function for OCR extraction
 * This function receives uploaded PDF/image files and extracts deed information
 */

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

    // For now, return a mock response
    // In production with Python support, this would call the Python OCR module
    const mockData = {
      success: true,
      apn: '1234-567-890',
      address: '123 Main Street, Los Angeles, CA 90001',
      grantee: 'John Doe and Jane Doe',
      grantor: 'Previous Owner Trust',
      legal_description: 'Lot 1, Block 2, Tract 12345, as per map recorded in Book 100, Pages 1-5, Official Records of Los Angeles County, California.',
      recording_date: '01/15/2024',
      deed_type: 'Grant Deed',
      page_count: 2,
      filename: file.filename,
      filesize: file.content.length,
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockData),
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
