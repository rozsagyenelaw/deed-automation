/**
 * Netlify serverless function for filling PCOR forms
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

// County to file mapping
const COUNTY_FILES = {
  'los-angeles': 'samples/pcors/la-county-pcor.pdf',
  'ventura': 'samples/pcors/ventura-pcor.pdf',
  'riverside': 'samples/pcors/riverside-pcor.pdf',
  'san-bernardino': 'samples/pcors/san-bernardino-pcor.pdf',
  'orange': 'samples/pcors/orange-county-pcor.pdf',
};

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
    const data = JSON.parse(event.body);

    // Validate required fields
    if (!data.county || !data.apn || !data.address || !data.grantor || !data.trustName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    // Get the appropriate PCOR form file
    const countyKey = data.county.toLowerCase().replace(/\s+/g, '-');
    const pcrFormPath = COUNTY_FILES[countyKey];

    if (!pcrFormPath) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid county selected' }),
      };
    }

    // Read the PCOR form
    const formPath = path.join(process.cwd(), pcrFormPath);
    const existingPdfBytes = await fs.readFile(formPath);

    // Load the PDF
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    const form = pdfDoc.getForm();

    // Get all field names (for debugging/mapping)
    const fields = form.getFields();
    const fieldNames = fields.map(field => field.getName());

    // Common field mappings (these may vary by county)
    // You'll need to inspect each PDF to get exact field names
    const fieldMappings = {
      'APN': data.apn,
      'Assessor Parcel Number': data.apn,
      'AssessorParcelNumber': data.apn,
      'Property Address': data.address,
      'PropertyAddress': data.address,
      'Street Address': data.address,
      'Seller/Transferor': data.grantor,
      'SellerTransferor': data.grantor,
      'Buyer/Transferee': data.trustName,
      'BuyerTransferee': data.trustName,
      'Date': new Date().toLocaleDateString(),
      'TransferDate': new Date().toLocaleDateString(),
    };

    // Try to fill in the form fields
    let filledFields = 0;
    for (const [fieldName, value] of Object.entries(fieldMappings)) {
      try {
        const field = form.getTextField(fieldName);
        if (field) {
          field.setText(String(value));
          filledFields++;
        }
      } catch (e) {
        // Field might not exist or might be a different type
        console.log(`Could not fill field: ${fieldName}`);
      }
    }

    // Try to check the appropriate box for trust transfer (L.1)
    try {
      // Common checkbox names for trust transfers
      const trustCheckboxNames = [
        'L1', 'L.1', 'L_1', 'TrustTransfer', 'RevocableTrust',
        'Change in Ownership - Exempt - Transfer to revocable trust'
      ];

      for (const checkboxName of trustCheckboxNames) {
        try {
          const checkbox = form.getCheckBox(checkboxName);
          if (checkbox) {
            checkbox.check();
            filledFields++;
            break;
          }
        } catch (e) {
          // Continue trying other names
        }
      }
    } catch (e) {
      console.log('Could not check trust transfer checkbox');
    }

    // If no fields were filled, the form might not have editable fields
    // In that case, we'll overlay text on the PDF
    if (filledFields === 0) {
      console.log('No form fields found, will overlay text instead');
      // You could implement PDF overlay logic here if needed
    }

    // Flatten the form (make it non-editable)
    form.flatten();

    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        pdf: base64Pdf,
        filename: `PCOR_${data.county}_${data.apn.replace(/[^0-9]/g, '')}.pdf`,
        filledFields,
        availableFields: fieldNames,
      }),
    };

  } catch (error) {
    console.error('Error filling PCOR form:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fill PCOR form',
        message: error.message,
      }),
    };
  }
};
