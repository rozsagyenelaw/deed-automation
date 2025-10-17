/**
 * Netlify serverless function for filling PCOR forms
 * Loads PDFs from deployed Netlify site
 */

const { PDFDocument } = require('pdf-lib');

function formatDate(dateString) {
  if (!dateString) {
    const now = new Date();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    const year = now.getFullYear().toString();
    return { month, day, year, full: month + '/' + day + '/' + year };
  }
  const date = new Date(dateString);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear().toString();
  return { month, day, year, full: month + '/' + day + '/' + year };
}

async function loadPDFFromNetlify(county) {
  const fetch = (await import('node-fetch')).default;
  
  // Map county to filename
  const templateMap = {
    'los angeles': 'la-county-pcor.pdf',
    'ventura': 'ventura-pcor.pdf',
    'orange': 'orange-county-pcor.pdf',
    'san bernardino': 'san-bernardino-pcor.pdf',
    'riverside': 'riverside-pcor.pdf'
  };
  
  const filename = templateMap[county.toLowerCase()];
  if (!filename) {
    throw new Error('Unknown county: ' + county);
  }
  
  // Load from deployed Netlify site
  const url = `https://deed-automation.netlify.app/samples/pcors/${filename}`;
  
  console.log('Loading PCOR template from:', url);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    console.log('Successfully loaded template (' + buffer.length + ' bytes)');
    return buffer;
  } catch (error) {
    console.error('Error loading template:', error);
    throw error;
  }
}

async function fillPCORForm(data, pdfBytes) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    console.log('Form has ' + fields.length + ' fields');
    
    // Log all field names
    const fieldInfo = fields.map(field => ({
      name: field.getName(),
      type: field.constructor.name
    }));
    console.log('Available fields:', JSON.stringify(fieldInfo, null, 2));
    
    const dateInfo = formatDate(data.trustDate);
    const today = formatDate(new Date());
    
    // Build addresses
    const buyerFullAddress = `${data.trustee || data.grantor}\n${data.mailingAddress || data.propertyAddress}`;
    
    // Comprehensive field mappings
    const textFieldMappings = {
      // Buyer/Transferee (Trust)
      'NAME AND MAILING ADDRESS OF BUYER/TRANSFEREE': buyerFullAddress,
      'Name and mailing address of buyer/transferee': buyerFullAddress,
      'Text1': buyerFullAddress,
      'Buyer Name': data.trustName,
      'BuyerName': data.trustName,
      
      // APN
      'ASSESSOR\'S PARCEL NUMBER': data.apn,
      'Assessors parcel number': data.apn,
      'ASSESSORS PARCEL NUMBER': data.apn,
      'APN': data.apn,
      'Text2': data.apn,
      
      // Seller/Transferor (Grantor)
      'SELLER/TRANSFEROR': data.grantor,
      'SELLERTRANSFEROR': data.grantor,
      'seller transferor': data.grantor,
      'Text3': data.grantor,
      
      // Property Address
      'STREET ADDRESS OR PHYSICAL LOCATION OF REAL PROPERTY': data.propertyAddress,
      'street address or physical location of real property': data.propertyAddress,
      'Property Address': data.propertyAddress,
      'Text4': data.propertyAddress,
      
      // Date of Transfer
      'MO': today.month,
      'Month': today.month,
      'DAY': today.day,
      'Day': today.day,
      'YEAR': today.year,
      'Year': today.year,
      
      // Mail Tax Information
      'MAIL PROPERTY TAX INFORMATION TO (NAME)': data.trustName,
      'MAIL PROPERTY TAX INFORMATION TO NAME': data.trustName,
      'MailTaxName': data.trustName,
      
      'MAIL PROPERTY TAX INFORMATION TO (ADDRESS)': data.mailingAddress || data.propertyAddress,
      'MAIL PROPERTY TAX INFORMATION TO ADDRESS': data.mailingAddress || data.propertyAddress,
      'MailTaxAddress': data.mailingAddress || data.propertyAddress,
      
      'CITY': data.city,
      'City': data.city,
      
      'STATE': 'CA',
      'State': 'CA',
      
      'ZIP CODE': data.propertyAddress ? data.propertyAddress.match(/\d{5}$/)?.[0] : '',
      'ZIP': data.propertyAddress ? data.propertyAddress.match(/\d{5}$/)?.[0] : '',
      
      // Financial (Trust transfer = $0)
      'Total purchase price': '$0.00',
      'TotalPurchasePrice': '$0.00',
      
      // Signature
      'Name of buyer/transferee/personal representative/corporate officer (please print)': data.trustee || data.grantor,
      'Name of buyer transferee personal representative corporate officer please print': data.trustee || data.grantor,
      'SignatureName': data.trustee || data.grantor,
      
      'title': 'Trustee',
      'Title': 'Trustee',
      
      'Date signed by buyer/transferee or corporate officer': today.full,
      'Date signed by buyer transferee or corporate officer': today.full,
      'SignatureDate': today.full,
    };
    
    // Fill text fields
    let filledCount = 0;
    for (const [fieldName, value] of Object.entries(textFieldMappings)) {
      if (!value) continue;
      
      try {
        const field = form.getTextField(fieldName);
        field.setText(value.toString());
        console.log(`✓ Filled: "${fieldName}"`);
        filledCount++;
      } catch (e) {
        // Try case-insensitive
        const foundField = fields.find(f => 
          f.getName()?.toLowerCase() === fieldName.toLowerCase() &&
          f.constructor.name.includes('TextField')
        );
        
        if (foundField) {
          try {
            const textField = form.getTextField(foundField.getName());
            textField.setText(value.toString());
            console.log(`✓ Filled (case-insensitive): "${foundField.getName()}"`);
            filledCount++;
          } catch (e2) {
            // Skip
          }
        }
      }
    }
    
    console.log(`Filled ${filledCount} text fields`);
    
    // Handle checkboxes by index
    const checkboxes = fields.filter(field => 
      field.constructor.name.includes('CheckBox')
    );
    
    console.log(`Found ${checkboxes.length} checkboxes`);
    
    // For trust transfers, check specific boxes:
    // Index 0: Principal Residence = YES
    // Index 3: Disabled Veteran = NO
    // Index 24 (or nearby): Section L.1 = YES
    
    checkboxes.forEach((checkbox, index) => {
      const name = checkbox.getName() || `checkbox${index}`;
      
      try {
        const cb = form.getCheckBox(name);
        
        if (index === 0) {
          cb.check();
          console.log(`✓ CHECKED Principal Residence (index 0)`);
        } else if (index === 3) {
          cb.check();
          console.log(`✓ CHECKED Disabled Veteran NO (index 3)`);
        } else if (index >= 23 && index <= 26) {
          cb.check();
          console.log(`✓ CHECKED Section L.1 (index ${index})`);
        } else {
          cb.uncheck();
        }
      } catch (e) {
        console.log(`Could not modify checkbox ${index}`);
      }
    });
    
    const pdfBytesResult = await pdfDoc.save();
    return pdfBytesResult;
    
  } catch (error) {
    console.error('Error filling PCOR form:', error);
    throw error;
  }
}

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
    console.log('County:', data.county);
    console.log('Data keys:', Object.keys(data));
    
    // Validate
    if (!data.county || !data.apn || !data.propertyAddress || !data.grantor || !data.trustName) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ 
          error: 'Missing required fields',
          required: ['county', 'apn', 'propertyAddress', 'grantor', 'trustName']
        }),
      };
    }
    
    // Load PDF template from Netlify
    const pdfBytes = await loadPDFFromNetlify(data.county);
    console.log('Template loaded');
    
    // Fill the form
    const filledPdfBytes = await fillPCORForm(data, pdfBytes);
    console.log('Form filled');
    
    // Return as base64
    const base64Pdf = Buffer.from(filledPdfBytes).toString('base64');
    
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
    console.error('=== ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate PCOR',
        message: error.message,
        stack: error.stack
      }),
    };
  }
};
