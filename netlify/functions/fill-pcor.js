/**
 * Netlify serverless function for filling PCOR forms
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

// County to file mapping
const COUNTY_FILES = {
  'los angeles': 'samples/pcors/la-county-pcor.pdf',
  'ventura': 'samples/pcors/ventura-pcor.pdf',
  'riverside': 'samples/pcors/riverside-pcor.pdf',
  'san bernardino': 'samples/pcors/san-bernardino-pcor.pdf',
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
    console.log('=== FILL PCOR FUNCTION CALLED ===');
    
    const data = JSON.parse(event.body);
    console.log('Parsed data:', JSON.stringify(data, null, 2));

    // Validate required fields
    const required = ['county', 'apn', 'propertyAddress', 'grantor', 'trustName'];
    const missing = [];
    
    for (const field of required) {
      if (!data[field] || data[field].trim() === '') {
        missing.push(field);
      }
    }

    if (missing.length > 0) {
      console.error('Missing fields:', missing);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Missing required fields: ${missing.join(', ')}`,
          missingFields: missing 
        }),
      };
    }

    // Get the appropriate PCOR form file
    const countyKey = data.county.toLowerCase().trim();
    console.log('Looking for county:', countyKey);
    console.log('Available counties:', Object.keys(COUNTY_FILES));
    
    const pcrFormPath = COUNTY_FILES[countyKey];

    if (!pcrFormPath) {
      console.error('County not found:', countyKey);
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: `Invalid county selected: ${data.county}`,
          availableCounties: Object.keys(COUNTY_FILES)
        }),
      };
    }

    console.log('Using PCOR form:', pcrFormPath);

    // Read the PCOR form - try multiple path resolutions
    let existingPdfBytes;
    let formPath;
    
    // Try different path resolutions for Netlify environment
    const pathsToTry = [
      path.join(process.cwd(), pcrFormPath),
      path.join('/var/task', pcrFormPath),
      path.join(__dirname, '..', '..', pcrFormPath),
      pcrFormPath
    ];

    for (const tryPath of pathsToTry) {
      try {
        console.log('Trying path:', tryPath);
        existingPdfBytes = await fs.readFile(tryPath);
        formPath = tryPath;
        console.log('Successfully read PDF from:', tryPath);
        break;
      } catch (e) {
        console.log('Path failed:', tryPath, e.message);
      }
    }

    if (!existingPdfBytes) {
      console.error('Could not find PDF file at any path');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          error: 'PCOR form file not found',
          paths: pathsToTry,
          message: 'The PCOR template PDF file could not be located on the server.'
        }),
      };
    }

    console.log('PDF file size:', existingPdfBytes.length);

    // Load the PDF
    const pdfDoc = await PDFDocument.load(existingPdfBytes);
    console.log('PDF loaded successfully');
    
    const form = pdfDoc.getForm();
    console.log('Form extracted');

    // Get all field names for debugging
    const fields = form.getFields();
    const fieldNames = fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name
    }));
    
    console.log('Available fields:', JSON.stringify(fieldNames, null, 2));

    // Prepare today's date
    const today = new Date();
    const dateStr = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`;

    // Try to fill in the form fields with multiple possible field names
    const fieldMappings = [
      // APN variations
      { names: ['APN', 'Assessor Parcel Number', 'AssessorParcelNumber', 'Parcel Number', 'ParcelNumber', 'apn'], value: data.apn },
      
      // Address variations
      { names: ['Property Address', 'PropertyAddress', 'Street Address', 'StreetAddress', 'Address', 'address'], value: data.propertyAddress },
      
      // Seller/Grantor variations
      { names: ['Seller/Transferor', 'SellerTransferor', 'Seller', 'Transferor', 'Grantor', 'seller', 'grantor'], value: data.grantor },
      
      // Buyer/Trust variations
      { names: ['Buyer/Transferee', 'BuyerTransferee', 'Buyer', 'Transferee', 'Trust Name', 'TrustName', 'buyer'], value: data.trustName },
      
      // Trustee variations
      { names: ['Trustee', 'Trustee Name', 'TrusteeName', 'trustee'], value: data.trustee || data.grantor },
      
      // Date variations
      { names: ['Date', 'Transfer Date', 'TransferDate', 'Date of Transfer', 'DateOfTransfer', 'date'], value: dateStr },
      
      // City
      { names: ['City', 'city'], value: data.city },
      
      // County
      { names: ['County', 'county'], value: data.county },
    ];

    let filledFields = 0;
    
    for (const mapping of fieldMappings) {
      let filled = false;
      for (const fieldName of mapping.names) {
        try {
          const field = form.getTextField(fieldName);
          if (field) {
            field.setText(String(mapping.value || ''));
            console.log(`Filled field: ${fieldName} = ${mapping.value}`);
            filledFields++;
            filled = true;
            break;
          }
        } catch (e) {
          // Field doesn't exist or wrong type, continue
        }
      }
      
      if (!filled && mapping.value) {
        console.log(`Could not fill value "${mapping.value}" - no matching field found`);
      }
    }

    console.log(`Filled ${filledFields} fields`);

    // Try to check the trust transfer checkbox (L.1)
    const trustCheckboxNames = [
      'L1', 'L.1', 'L_1', 'L 1',
      'TrustTransfer', 'RevocableTrust', 
      'Trust Transfer', 'Revocable Trust',
      'Change in Ownership - Exempt - Transfer to revocable trust',
      'trust_transfer', 'revocable_trust',
      'exclusion_trust', 'exclusion_l1'
    ];

    let checkboxFound = false;
    for (const checkboxName of trustCheckboxNames) {
      try {
        const checkbox = form.getCheckBox(checkboxName);
        if (checkbox) {
          checkbox.check();
          console.log(`Checked checkbox: ${checkboxName}`);
          filledFields++;
          checkboxFound = true;
          break;
        }
      } catch (e) {
        // Not a checkbox or doesn't exist
      }
    }

    if (!checkboxFound) {
      console.log('No trust transfer checkbox found');
    }

    console.log(`Total fields filled: ${filledFields}`);

    // Flatten the form to make it non-editable
    form.flatten();
    console.log('Form flattened');

    // Save the filled PDF
    const pdfBytes = await pdfDoc.save();
    console.log('PDF saved, size:', pdfBytes.length);
    
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    return {
      statusCode: 200,
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
      },
      body: base64Pdf,
      isBase64Encoded: true,
    };

  } catch (error) {
    console.error('=== ERROR FILLING PCOR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fill PCOR form',
        message: error.message,
        stack: error.stack,
      }),
    };
  }
};
