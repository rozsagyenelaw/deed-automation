function extractAPN(text) {
  const patterns = [
    /APN[:\s#]*([0-9\-]+)/i,
    /Assessor'?s?\s+Parcel\s+Number[:\s]*([0-9\-]+)/i,
    /A\.P\.N\.[:\s]*([0-9\-]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      console.log('Found APN:', match[1]);
      return match[1].trim();
    }
  }
  return '';
}

function extractGrantor(text) {
  // IMPORTANT: In the ORIGINAL deed, we extract the GRANTEE
  // The GRANTEE from the original deed becomes the GRANTOR in the trust transfer deed
  // Format in original deed: "GRANTEE: John Doe, a married man"
  const patterns = [
    /GRANTEE[:\s]+([^,\n]+(?:,\s*[^,\n]+)?),?\s*(?:a|an|the)/i,
    /(?:TO|CONVEYS?\s+TO)[:\s]+([^,\n]+),?\s*(?:a|an)/i,
    /hereby\s+(?:grant|grants|convey|conveys)\s+to\s+([^,]+),/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let grantee = match[1].trim();
      console.log('Found GRANTEE (will be grantor in trust deed):', grantee);
      return grantee;
    }
  }
  return '';
}

function extractTrustee(text) {
  // Trustee will usually be the same as the grantee/grantor
  // User can modify in the form
  const grantor = extractGrantor(text);
  return grantor.split(',')[0].trim();
}

function extractTrustName(text) {
  // Trust name must be entered by user - not in original deed
  return '';
}

function extractTrustDate(text) {
  // Trust date must be entered by user - not in original deed
  return '';
}

function extractPropertyAddress(text) {
  const patterns = [
    /(?:situated|located)\s+(?:in|at)[^\n]*?([0-9]+[^\n]+?(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir)[^\n]*?)(?:,|\.|\n)/i,
    /(?:Property|Real\s+Property)\s+(?:Address|Located)[:\s]*([^\n]+)/i,
    /commonly\s+known\s+as[:\s]*([^\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      // Clean up
      address = address.replace(/[,.]$/, '').trim();
      // Remove city/state if included
      address = address.replace(/,?\s*(?:Los Angeles|Ventura|Riverside|San Bernardino|Orange),?\s*(?:CA|California).*/i, '').trim();
      console.log('Found Property Address:', address);
      return address;
    }
  }
  return '';
}

function extractCity(text) {
  const patterns = [
    /(?:City|County)\s+of\s+([A-Z][a-z\s]+?)(?:,|\s+County|\s+State)/i,
    /,\s*([A-Z][a-z\s]+),\s*(?:CA|California)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const city = match[1].trim();
      console.log('Found City:', city);
      return city;
    }
  }
  return '';
}

function extractCounty(text) {
  const patterns = [
    /County\s+of\s+(Los Angeles|Ventura|Riverside|San Bernardino|Orange)/i,
    /(?:in|of)\s+(Los Angeles|Ventura|Riverside|San Bernardino|Orange)\s+County/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      console.log('Found County:', match[1]);
      return match[1].trim();
    }
  }
  return 'Los Angeles';
}

function extractLegalDescription(text) {
  // Legal descriptions are typically between "described as" and "APN" or address
  const startPatterns = [
    /(?:legally\s+)?described\s+as\s+follows?[:\s]*/i,
    /(?:real\s+property|land)\s+described\s+as[:\s]*/i,
    /LEGAL\s+DESCRIPTION[:\s]*/i,
  ];
  
  const endPatterns = [
    /(?:APN|Assessor'?s?\s+Parcel)/i,
    /(?:commonly\s+known|also\s+known|street\s+address)/i,
    /(?:EXCEPTING|Subject\s+to)/i,
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
  // Clean up whitespace
  const cleaned = legalDesc.replace(/\s+/g, ' ').trim();
  
  if (cleaned.length > 20) {
    console.log('Found Legal Description, length:', cleaned.length);
    return cleaned;
  }
  
  return '';
}

function extractMailingAddress(text) {
  // Mailing address patterns
  const patterns = [
    /(?:Mail|Send|Return)\s+(?:to|documents to|tax statements to)[:\s]*([^\n]+(?:\n[^\n]+){0,2})/i,
    /MAIL\s+TAX[^\n]*?TO[:\s]*([^\n]+)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      let address = match[1].trim();
      const lines = address.split('\n').slice(0, 2);
      const cleaned = lines.join(', ').replace(/\s+/g, ' ').trim();
      console.log('Found Mailing Address:', cleaned);
      return cleaned;
    }
  }
  
  // If no specific mailing address, use property address
  return extractPropertyAddress(text);
}
