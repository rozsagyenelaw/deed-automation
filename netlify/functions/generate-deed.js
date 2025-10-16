/**
 * Netlify serverless function for generating Trust Transfer Deeds
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

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
    const required = ['grantor', 'trustName', 'trustDate', 'apn', 'address', 'legalDescription'];
    for (const field of required) {
      if (!data[field]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Missing required field: ${field}` }),
        };
      }
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    const { width, height } = page.getSize();
    let yPosition = height - 50;

    // Helper function to draw text
    const drawText = (text, x, y, size = 12, fontType = font) => {
      page.drawText(text, {
        x,
        y,
        size,
        font: fontType,
        color: rgb(0, 0, 0),
      });
    };

    // Helper function to draw wrapped text
    const drawWrappedText = (text, x, startY, maxWidth, size = 12) => {
      const words = text.split(' ');
      let line = '';
      let y = startY;

      for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = font.widthOfTextAtSize(testLine, size);

        if (testWidth > maxWidth && line !== '') {
          drawText(line.trim(), x, y, size);
          line = word + ' ';
          y -= size + 4;
        } else {
          line = testLine;
        }
      }

      if (line.trim() !== '') {
        drawText(line.trim(), x, y, size);
        y -= size + 4;
      }

      return y;
    };

    // Draw document
    const margin = 72; // 1 inch margins
    const contentWidth = width - (margin * 2);

    // Title
    drawText('TRUST TRANSFER DEED', width / 2 - 100, yPosition, 16, boldFont);
    yPosition -= 30;

    // Recording space (required for official recording)
    drawText('Recording Requested By:', margin, yPosition, 10);
    yPosition -= 15;
    drawText('When Recorded Mail To:', margin, yPosition, 10);
    yPosition -= 15;
    drawText(`${data.trustName}`, margin, yPosition, 10);
    yPosition -= 15;
    drawText(`${data.address}`, margin, yPosition, 10);
    yPosition -= 30;

    // APN
    drawText(`APN: ${data.apn}`, margin, yPosition, 11, boldFont);
    yPosition -= 25;

    // Main content
    drawText('FOR VALUABLE CONSIDERATION, receipt of which is hereby acknowledged,', margin, yPosition, 11);
    yPosition -= 20;

    // Grantor
    drawText('GRANTOR:', margin, yPosition, 11, boldFont);
    yPosition -= 15;
    yPosition = drawWrappedText(data.grantor, margin + 20, yPosition, contentWidth - 20, 11);
    yPosition -= 10;

    // Grantee
    drawText('GRANTEE:', margin, yPosition, 11, boldFont);
    yPosition -= 15;
    yPosition = drawWrappedText(`${data.trustName}, dated ${data.trustDate}`, margin + 20, yPosition, contentWidth - 20, 11);
    yPosition -= 10;

    drawText('hereby grants and conveys to Grantee the following described real property', margin, yPosition, 11);
    yPosition -= 15;
    drawText(`in the County of ${data.county || 'Los Angeles'}, State of California:`, margin, yPosition, 11);
    yPosition -= 25;

    // Legal Description
    drawText('LEGAL DESCRIPTION:', margin, yPosition, 11, boldFont);
    yPosition -= 15;
    yPosition = drawWrappedText(data.legalDescription, margin, yPosition, contentWidth, 10);
    yPosition -= 20;

    // Property Address
    drawText('Commonly known as:', margin, yPosition, 11, boldFont);
    yPosition -= 15;
    drawText(data.address, margin, yPosition, 11);
    yPosition -= 30;

    // Signature section
    if (yPosition < 150) {
      page = pdfDoc.addPage([612, 792]);
      yPosition = height - 50;
    }

    drawText('EXECUTED this _____ day of ______________, 20___', margin, yPosition, 11);
    yPosition -= 40;

    drawText('GRANTOR:', margin, yPosition, 11, boldFont);
    yPosition -= 50;

    drawText('_________________________________________', margin, yPosition, 11);
    yPosition -= 15;
    drawText('Signature', margin, yPosition, 10);
    yPosition -= 30;

    drawText('_________________________________________', margin, yPosition, 11);
    yPosition -= 15;
    drawText('Printed Name', margin, yPosition, 10);
    yPosition -= 40;

    // Notary Section
    drawText('STATE OF CALIFORNIA', margin, yPosition, 11, boldFont);
    yPosition -= 15;
    drawText('COUNTY OF ____________________', margin, yPosition, 11, boldFont);
    yPosition -= 25;

    const notaryText = 'On _____________ before me, _____________________, Notary Public, personally appeared ' +
                       '_____________________, who proved to me on the basis of satisfactory evidence to be the ' +
                       'person(s) whose name(s) is/are subscribed to the within instrument.';
    yPosition = drawWrappedText(notaryText, margin, yPosition, contentWidth, 10);

    // Serialize PDF to bytes
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
        filename: `Trust_Transfer_Deed_${data.apn.replace(/[^0-9]/g, '')}.pdf`,
      }),
    };

  } catch (error) {
    console.error('Error generating deed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate deed',
        message: error.message,
      }),
    };
  }
};
