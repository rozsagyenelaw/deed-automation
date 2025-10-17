/**
 * Netlify serverless function for generating Trust Transfer Deeds
 * Generates deed matching California trust transfer deed format
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
    const required = ['grantor', 'trustee', 'trustName', 'trustDate', 'apn', 'propertyAddress', 'city', 'county', 'legalDescription'];
    for (const field of required) {
      if (!data[field]) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Missing required field: ${field}` }),
        };
      }
    }

    // Default vesting if not provided
    if (!data.vesting) {
      data.vesting = 'Single Man';
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed fonts
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // PAGE 1: Main Deed
    const page1 = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page1.getSize();
    
    const margin = 54; // 0.75 inch margins
    const contentWidth = width - (margin * 2);
    let y = height - 80;

    // Helper function to draw text
    const drawText = (text, x, yPos, size = 11, fontType = font, page = page1) => {
      page.drawText(text, {
        x,
        y: yPos,
        size,
        font: fontType,
        color: rgb(0, 0, 0),
      });
    };

    // Helper for wrapped text
    const drawWrappedText = (text, x, startY, maxWidth, size = 11, lineHeight = 14, fontType = font, page = page1) => {
      const words = text.split(' ');
      let line = '';
      let y = startY;

      for (const word of words) {
        const testLine = line + word + ' ';
        const testWidth = fontType.widthOfTextAtSize(testLine, size);

        if (testWidth > maxWidth && line !== '') {
          drawText(line.trim(), x, y, size, fontType, page);
          line = word + ' ';
          y -= lineHeight;
        } else {
          line = testLine;
        }
      }

      if (line.trim() !== '') {
        drawText(line.trim(), x, y, size, fontType, page);
        y -= lineHeight;
      }

      return y;
    };

    // Recording section (top right)
    const recordingX = width - 250;
    drawText('RECORDING REQUESTED BY', recordingX, y, 9);
    y -= 12;
    drawText(data.trustName, recordingX, y, 9);
    y -= 20;
    
    drawText('WHEN RECORDED MAIL TO', recordingX, y, 9);
    y -= 12;
    drawText(data.trustee || data.grantor.split(',')[0], recordingX, y, 9);
    y -= 12;
    if (data.mailingAddress) {
      const mailLines = data.mailingAddress.split(',');
      for (const line of mailLines) {
        drawText(line.trim(), recordingX, y, 9);
        y -= 12;
      }
    }

    // Reset Y for main content
    y = height - 140;

    // APN and Escrow
    drawText(`APN: ${data.apn}`, margin, y, 11);
    drawText('Escrow No. ______________', margin + 200, y, 11);
    y -= 30;

    // Title
    const title = 'TRUST TRANSFER DEED';
    const titleWidth = boldFont.widthOfTextAtSize(title, 14);
    drawText(title, (width - titleWidth) / 2, y, 14, boldFont);
    y -= 20;

    // Subtitle
    const subtitle = '(Grant Deed Excluded from Reappraisal Under Proposition 13,';
    const subtitle2 = 'i.e., Calif. Const. Art 13A Section 1, et seq.)';
    drawText(subtitle, (width - font.widthOfTextAtSize(subtitle, 10)) / 2, y, 10);
    y -= 14;
    drawText(subtitle2, (width - font.widthOfTextAtSize(subtitle2, 10)) / 2, y, 10);
    y -= 25;

    // Documentary transfer tax
    drawText('DOCUMENTARY TRANSFER TAX IS: $ 0.00', margin, y, 11, boldFont);
    y -= 20;

    // Declaration
    const declText = 'The undersigned Grantor(s) declare(s) under penalty of perjury that the foregoing is true';
    drawText(declText, margin, y, 10);
    y -= 12;
    drawText('and correct: THERE IS NO CONSIDERATION FOR THIS TRANSFER.', margin, y, 10);
    y -= 18;

    // Trust transfer statement
    drawText('This is a Trust Transfer under section 62 of the Revenue and Taxation Code and', margin, y, 10);
    y -= 12;
    drawText('Grantor(s) has/have checked the applicable exclusions:', margin, y, 10);
    y -= 18;

    // Checkbox
    drawText('[X] This conveyance transfers the Grantors interest into his or her revocable trust, R&T 11930.', margin, y, 10);
    y -= 25;

    // Format vesting text (convert to lowercase except first letters)
    const vestingLower = data.vesting.toLowerCase();

    // Main granting clause with vesting
    const grantorText = `GRANTOR(S) ${data.grantor}, ${vestingLower}, hereby GRANT(s) to ${data.trustee}, TRUSTEE OF THE ${data.trustName.toUpperCase()} DATED ${formatDate(data.trustDate)}, AND ANY AMENDMENTS THERETO the real property in the CITY OF ${data.city.toUpperCase()} County of ${data.county} State of CA, described as:`;
    
    y = drawWrappedText(grantorText, margin, y, contentWidth, 11, 14, font);
    y -= 10;

    // Legal Description
    y = drawWrappedText(data.legalDescription, margin, y, contentWidth, 10, 13, font);
    y -= 15;

    // Commonly known as
    drawText('Commonly known as: ' + data.propertyAddress, margin, y, 11);
    y -= 30;

    // Date
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    drawText(`Dated: ${today}`, margin, y, 11);
    y -= 40;

    // Signature line
    drawText('_________________________________', margin, y, 11);
    y -= 14;
    drawText(data.grantor.split(',')[0], margin, y, 11);
    y -= 30;

    // Mail tax statements section
    drawText('MAIL TAX STATEMENTS TO:', margin, y, 10, boldFont);
    y -= 14;
    if (data.mailingAddress) {
      const mailLines = data.mailingAddress.split(',');
      for (const line of mailLines) {
        drawText(line.trim(), margin, y, 10);
        y -= 12;
      }
    } else {
      drawText(data.trustee || data.grantor.split(',')[0], margin, y, 10);
      y -= 12;
      drawText(data.propertyAddress, margin, y, 10);
    }

    // PAGE 2: Notary Acknowledgment
    const page2 = pdfDoc.addPage([612, 792]);
    y = height - 180;

    // Notary title
    const notaryTitle = 'ACKNOWLEDGMENT';
    const notaryTitleWidth = boldFont.widthOfTextAtSize(notaryTitle, 14);
    drawText(notaryTitle, (width - notaryTitleWidth) / 2, y, 14, boldFont, page2);
    y -= 40;

    drawText('STATE OF CALIFORNIA', margin, y, 11, font, page2);
    y -= 20;
    drawText(') SS.', margin + 200, y, 11, font, page2);
    y -= 16;
    drawText('COUNTY OF _____________', margin, y, 11, font, page2);
    y -= 30;

    // Notary text
    const notaryText = `On ________________, before me, ___________________________________, a Notary Public, personally appeared ____________________________________________, who proved to me on the basis of satisfactory evidence to be the person whose name is subscribed to the within instrument acknowledged to me that he/she/they executed the same in his/her/their authorized capacity, and that by his/her/their signature on the instrument the person, or the entity upon behalf of which the person acted, executed the instrument.`;
    
    y = drawWrappedText(notaryText, margin, y, contentWidth, 10, 13, font, page2);
    y -= 20;

    drawText('I certify under PENALTY OF PERJURY under the laws of the State of California that the', margin, y, 10, font, page2);
    y -= 13;
    drawText('foregoing paragraph is true and correct.', margin, y, 10, font, page2);
    y -= 25;

    drawText('WITNESS my hand and official seal.', margin, y, 10, font, page2);
    y -= 40;

    drawText('Notary Public __________________________________  (SEAL)', margin, y, 10, font, page2);
    y -= 20;
    drawText('Print Name of Notary _______________________________', margin, y, 10, font, page2);
    y -= 20;
    drawText('My Commission Expires: ______________.', margin, y, 10, font, page2);
    y -= 40;

    // Disclaimer box
    const disclaimerY = y - 60;
    page2.drawRectangle({
      x: margin,
      y: disclaimerY,
      width: contentWidth,
      height: 50,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    const disclaimerText = 'A notary public or other officer completing this certificate verifies only the identity of the individual who signed the document to which this certificate is attached, and not the truthfulness, accuracy, or validity of that document.';
    drawWrappedText(disclaimerText, margin + 10, disclaimerY + 35, contentWidth - 20, 9, 11, font, page2);

    // Serialize PDF
    const pdfBytes = await pdfDoc.save();
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
    console.error('Error generating deed:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to generate deed',
        message: error.message,
        stack: error.stack,
      }),
    };
  }
};

// Helper function to format date
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}
```

**Key changes:**
1. ✅ **Added vesting parameter** - Now accepts and uses the vesting field
2. ✅ **Fixed drawWrappedText function** - Added `fontType` parameter that was missing
3. ✅ **Formatted vesting text** - Converts to lowercase for proper legal format (e.g., "a married man as his sole and separate property")
4. ✅ **Better date formatting** - Added `formatDate()` helper function
5. ✅ **Better error handling** - Returns stack trace for debugging
6. ✅ **Default vesting** - Falls back to "Single Man" if not provided

**The granting clause now looks like:**
```
GRANTOR(S) Arthur Avagyants, a married man as his sole and separate property, 
hereby GRANT(s) to Arthur Avagyants, TRUSTEE OF THE ARTHUR AVAGYANTS LIVING TRUST 
DATED January 15, 2024...
