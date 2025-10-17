/**
 * Netlify serverless function for generating Trust Transfer Deeds
 * Generates deed matching California trust transfer deed format with cover page
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
    console.log('Received data:', data);

    // Validate required fields
    const required = ['grantor', 'trustee', 'trustName', 'trustDate', 'apn', 'propertyAddress', 'city', 'county', 'legalDescription'];
    for (const field of required) {
      if (!data[field]) {
        console.error(`Missing field: ${field}`);
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Missing required field: ${field}` }),
        };
      }
    }

    // Default vesting if not provided
    const vesting = data.vesting || 'an unmarried man';

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Embed fonts
    const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);

    // ==================== PAGE 1: COVER SHEET ====================
    const coverPage = pdfDoc.addPage([612, 792]);
    const { width, height } = coverPage.getSize();
    const margin = 54;
    let y = height - 60;

    // Helper function to draw text
    const drawText = (text, x, yPos, size = 11, fontType = font, page = coverPage) => {
      page.drawText(text, {
        x,
        y: yPos,
        size,
        font: fontType,
        color: rgb(0, 0, 0),
      });
    };

    // Cover page header
    const headerText = 'THIS COVER SHEET ADDED TO PROVIDE ADEQUATE SPACE FOR RECORDING INFORMATION';
    const headerText2 = '($3.00 Additional Recording Fee Applies)';
    drawText(headerText, (width - font.widthOfTextAtSize(headerText, 10)) / 2, y, 10, font, coverPage);
    y -= 12;
    drawText(headerText2, (width - font.widthOfTextAtSize(headerText2, 10)) / 2, y, 10, font, coverPage);
    y -= 30;

    // Recording requested by section
    drawText('RECORDING REQUESTED BY', margin, y, 11, boldFont, coverPage);
    y -= 14;
    drawText(data.trustName, margin, y, 11, font, coverPage);
    y -= 20;

    drawText('WHEN RECORDED MAIL TO', margin, y, 11, boldFont, coverPage);
    y -= 14;
    drawText(data.trustee || data.grantor, margin, y, 11, font, coverPage);
    y -= 14;
    if (data.mailingAddress) {
      drawText(data.mailingAddress, margin, y, 11, font, coverPage);
    }
    y -= 30;

    // Draw horizontal line
    coverPage.drawLine({
      start: { x: margin, y: y },
      end: { x: width - margin, y: y },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
    y -= 20;

    // Draw vertical line (left side) - from top to this point
    coverPage.drawLine({
      start: { x: width / 2, y: height - 50 },
      end: { x: width / 2, y: y + 20 },
      thickness: 1,
      color: rgb(0, 0, 0),
    });

    // Space above for recorder's use
    const recorderText = "SPACE ABOVE FOR RECORDER'S USE ONLY";
    drawText(recorderText, width - margin - font.widthOfTextAtSize(recorderText, 11), y, 11, font, coverPage);
    y -= 40;

    // Title
    const title = 'TRUST TRANSFER DEED';
    drawText(title, (width - boldFont.widthOfTextAtSize(title, 14)) / 2, y, 14, boldFont, coverPage);
    y -= 40;

    // Senate Bill 2 text
    const sb2Text = 'Pursuant to Senate Bill 2 – Building Homes and Jobs Act (GC Code Section 27388.1), effective January 1, 2018, a fee of seventy-five dollars ($75.00) shall be paid at the time of recording of every real estate instrument, paper, or notice required or permitted by law to be recorded, except those expressly exempted from payment of recording fees, per each single transaction per parcel of real property. The fee imposed by this section shall not exceed two hundred twenty-five dollars ($225.00).';
    
    y = drawWrappedText(sb2Text, margin, y, width - (margin * 2), 10, 13, font, coverPage);
    y -= 20;

    // Checkboxes
    drawText('☐ Exempt from fee per GC 27388.1 (a) (2); recorded concurrently "in connection with" a transfer subject to', margin, y, 9, font, coverPage);
    y -= 11;
    drawText('    the imposition of documentary transfer tax (DTT).', margin, y, 9, font, coverPage);
    y -= 16;

    drawText('☒ Exempt from fee per GC 27388.1 (a) (2); recorded concurrently "in connection with" a transfer of real', margin, y, 9, font, coverPage);
    y -= 11;
    drawText('    property that is a residential dwelling to an owner-occupier.', margin, y, 9, font, coverPage);
    y -= 16;

    drawText('☐ Exempt from fee per GC 27388.1 (a) (1); fee cap of $225.00 reached.', margin, y, 9, font, coverPage);
    y -= 16;

    drawText('☐ Exempt from the fee per GC 27388.1 (a) (1); not related to real property.', margin, y, 9, font, coverPage);
    y -= 40;

    // Bottom text
    const bottomText1 = 'THIS COVER SHEET ADDED TO PROVIDE ADEQUATE SPACE FOR RECORDING INFORMATION';
    const bottomText2 = '($3.00 Additional Recording Fee Applies)';
    drawText(bottomText1, (width - font.widthOfTextAtSize(bottomText1, 10)) / 2, 80, 10, font, coverPage);
    drawText(bottomText2, (width - font.widthOfTextAtSize(bottomText2, 10)) / 2, 66, 10, font, coverPage);

    // ==================== PAGE 2: MAIN DEED ====================
    const page2 = pdfDoc.addPage([612, 792]);
    y = height - 60;

    // Recording box
    page2.drawRectangle({
      x: margin,
      y: height - 140,
      width: width - (margin * 2),
      height: 80,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    drawText('RECORDING REQUESTED BY', margin + 10, y, 11, boldFont, page2);
    y -= 14;
    drawText(data.trustName, margin + 10, y, 11, font, page2);
    y -= 20;
    
    drawText('WHEN RECORDED MAIL TO', margin + 10, y, 11, boldFont, page2);
    y -= 14;
    drawText(data.trustee || data.grantor, margin + 10, y, 11, font, page2);
    y -= 14;
    if (data.mailingAddress) {
      drawText(data.mailingAddress, margin + 10, y, 11, font, page2);
    }

    y = height - 150;

    // APN
    drawText(`APN: ${data.apn}`, margin, y, 11, font, page2);
    drawText('Escrow No. ______________', margin + 250, y, 11, font, page2);
    y -= 30;

    // Title
    drawText(title, (width - boldFont.widthOfTextAtSize(title, 14)) / 2, y, 14, boldFont, page2);
    y -= 14;

    // Subtitle
    const subtitle = '(Grant Deed Excluded from Reappraisal Under Proposition 13,';
    const subtitle2 = 'i.e., Calif. Const. Art 13A Section 1, et seq.)';
    drawText(subtitle, (width - font.widthOfTextAtSize(subtitle, 10)) / 2, y, 10, font, page2);
    y -= 12;
    drawText(subtitle2, (width - font.widthOfTextAtSize(subtitle2, 10)) / 2, y, 10, font, page2);
    y -= 25;

    // Documentary transfer tax
    drawText('DOCUMENTARY TRANSFER TAX IS: $ 0.00', margin, y, 11, boldFont, page2);
    y -= 20;

    // Declaration
    drawText('The undersigned Grantor(s) declare(s) under penalty of perjury that the foregoing is true', margin, y, 10, font, page2);
    y -= 12;
    drawText('and correct: THERE IS NO CONSIDERATION FOR THIS TRANSFER.', margin, y, 10, font, page2);
    y -= 18;

    // Trust transfer statement
    drawText('This is a Trust Transfer under section 62 of the Revenue and Taxation Code and', margin, y, 10, font, page2);
    y -= 12;
    drawText('Grantor(s) has/have checked the applicable exclusions:', margin, y, 10, font, page2);
    y -= 18;

    // Checkbox
    drawText('[X] This conveyance transfers the Grantors interest into his or her revocable trust, R&T 11930.', margin, y, 10, font, page2);
    y -= 25;

    // Format trust date
    const trustDateFormatted = formatTrustDate(data.trustDate);

    // Main granting clause with vesting (uppercase for proper format)
    const vestingText = vesting.toUpperCase();
    const grantorLine = `GRANTOR(S) ${data.grantor}, ${vestingText}, hereby GRANT(s) to ${data.trustee}, TRUSTEE OF`;
    drawText(grantorLine, margin, y, 11, font, page2);
    y -= 14;
    
    const trustLine = `THE ${data.trustName} DATED ${trustDateFormatted}, AND ANY AMENDMENTS THERETO`;
    drawText(trustLine, margin, y, 11, font, page2);
    y -= 18;

    const propertyLine = `the real property in the CITY OF ${data.city.toUpperCase()} County of ${data.county} State of CA, described as:`;
    drawText(propertyLine, margin, y, 11, font, page2);
    y -= 18;

    // Legal Description
    y = drawWrappedText(data.legalDescription, margin, y, width - (margin * 2), 10, 13, font, page2);
    y -= 18;

    // Commonly known as
    drawText(`Commonly known as: ${data.propertyAddress}`, margin, y, 11, font, page2);
    y -= 25;

    // Date
    const today = new Date();
    const dateStr = `${getMonthName(today.getMonth())} ${today.getDate()}, ${today.getFullYear()}`;
    drawText(`Dated: ${dateStr}`, margin, y, 11, font, page2);
    y -= 35;

    // Signature line
    drawText('_________________________________', margin, y, 11, font, page2);
    y -= 14;
    drawText(data.grantor, margin, y, 11, font, page2);
    y -= 30;

    // Mail tax statements
    drawText('MAIL TAX STATEMENTS TO:', margin, y, 10, boldFont, page2);
    y -= 14;
    drawText(data.trustee || data.grantor, margin, y, 10, font, page2);
    y -= 12;
    if (data.mailingAddress) {
      drawText(data.mailingAddress, margin, y, 10, font, page2);
    }

    // ==================== PAGE 3: NOTARY ====================
    const page3 = pdfDoc.addPage([612, 792]);
    y = height - 100;

    // Notary box at top
    page3.drawRectangle({
      x: margin,
      y: height - 90,
      width: width - (margin * 2),
      height: 50,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });

    const disclaimerTop = 'A notary public or other officer completing this certificate verifies only the identity of the';
    const disclaimerTop2 = 'individual who signed the document to which this certificate is attached, and not the';
    const disclaimerTop3 = 'truthfulness, accuracy, or validity of that document.';
    
    drawText(disclaimerTop, margin + 10, height - 60, 9, font, page3);
    drawText(disclaimerTop2, margin + 10, height - 72, 9, font, page3);
    drawText(disclaimerTop3, margin + 10, height - 84, 9, font, page3);

    y = height - 120;

    // State and County
    drawText('STATE OF CALIFORNIA', margin, y, 11, font, page3);
    y -= 20;
    drawText(') SS.', margin + 180, y, 11, font, page3);
    y -= 14;
    drawText('COUNTY OF _____________  )', margin, y, 11, font, page3);
    y -= 25;

    // Notary text
    const notaryLine1 = 'On ________________, before me, ___________________________________, a Notary Public,';
    const notaryLine2 = 'personally appeared ____________________________________________, who proved to me on';
    const notaryLine3 = 'the basis of satisfactory evidence to be the person whose name is subscribed to the within';
    const notaryLine4 = 'instrument acknowledged to me that he/she/they executed the same in his/her/their';
    const notaryLine5 = 'authorized capacity, and that by his/her/their signature on the instrument the person, or';
    const notaryLine6 = 'the entity upon behalf of which the person acted, executed the instrument.';
    
    drawText(notaryLine1, margin, y, 10, font, page3);
    y -= 12;
    drawText(notaryLine2, margin, y, 10, font, page3);
    y -= 12;
    drawText(notaryLine3, margin, y, 10, font, page3);
    y -= 12;
    drawText(notaryLine4, margin, y, 10, font, page3);
    y -= 12;
    drawText(notaryLine5, margin, y, 10, font, page3);
    y -= 12;
    drawText(notaryLine6, margin, y, 10, font, page3);
    y -= 20;

    drawText('I certify under PENALTY OF PERJURY under the laws of the State of California that the', margin, y, 10, font, page3);
    y -= 12;
    drawText('foregoing paragraph is true and correct.', margin, y, 10, font, page3);
    y -= 18;

    drawText('WITNESS my hand and official seal.', margin, y, 10, font, page3);
    y -= 25;

    drawText('Notary Public __________________________________ (SEAL)', margin, y, 10, font, page3);
    y -= 16;
    drawText('Print Name of Notary _______________________________', margin, y, 10, font, page3);
    y -= 16;
    drawText('My Commission Expires: ______________.', margin, y, 10, font, page3);

    // Serialize PDF
    console.log('Saving PDF...');
    const pdfBytes = await pdfDoc.save();
    const base64Pdf = Buffer.from(pdfBytes).toString('base64');

    console.log('PDF generated successfully');
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
    console.error('Stack:', error.stack);
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

// Helper function for wrapped text
function drawWrappedText(text, x, startY, maxWidth, size, lineHeight, fontType, page) {
  const words = text.split(' ');
  let line = '';
  let y = startY;

  for (const word of words) {
    const testLine = line + word + ' ';
    const testWidth = fontType.widthOfTextAtSize(testLine, size);

    if (testWidth > maxWidth && line !== '') {
      page.drawText(line.trim(), { x, y, size, font: fontType, color: rgb(0, 0, 0) });
      line = word + ' ';
      y -= lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line.trim() !== '') {
    page.drawText(line.trim(), { x, y, size, font: fontType, color: rgb(0, 0, 0) });
    y -= lineHeight;
  }

  return y;
}

// Helper function to format trust date
function formatTrustDate(dateStr) {
  try {
    const date = new Date(dateStr);
    const month = getMonthName(date.getMonth());
    return `${month} ${date.getDate()}, ${date.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

// Helper to get month name
function getMonthName(monthIndex) {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                  'July', 'August', 'September', 'October', 'November', 'December'];
  return months[monthIndex];
}
