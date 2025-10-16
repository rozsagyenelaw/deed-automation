"""
OCR Extraction Module for Deed Processing
Extracts key information from deed documents using Tesseract OCR
"""

import re
import pytesseract
from pdf2image import convert_from_path, convert_from_bytes
from PIL import Image
import io
import json
from typing import Dict, Optional, List, Tuple

class DeedExtractor:
    """Extracts structured data from deed documents"""

    def __init__(self):
        # Patterns for extracting specific fields
        self.patterns = {
            'apn': [
                r'APN[:\s]*([0-9\-]+)',
                r'Assessor[\'s]*\s+Parcel\s+Number[:\s]*([0-9\-]+)',
                r'Parcel\s+Number[:\s]*([0-9\-]+)',
                r'A\.P\.N\.[:\s]*([0-9\-]+)',
            ],
            'address': [
                r'(?:Property\s+)?(?:Address|Located\s+at)[:\s]*([0-9]+[^\n]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Lane|Ln|Way|Court|Ct|Circle|Cir)[^\n]*)',
                r'(?:situated\s+in[^\n]+at\s+)([0-9]+[^\n]+)',
            ],
            'grantee': [
                r'(?:GRANTEE|TO)[:\s]*([A-Z][^\n]+?)(?:,\s*(?:a|an|as)\s+(?:married|single|unmarried))',
                r'(?:GRANTEE|TO)[:\s]*([A-Z][^\n]+?)(?:\s+DOES\s+HEREBY)',
                r'(?:conveys?\s+to\s+)([A-Z][^\n]+?)(?:,)',
            ],
            'grantor': [
                r'(?:GRANTOR|FROM)[:\s]*([A-Z][^\n]+?)(?:,\s*(?:a|an|as)\s+(?:married|single|unmarried))',
                r'(?:hereby\s+(?:grant|convey))',
            ],
            'legal_description': [
                r'(?:LEGAL\s+DESCRIPTION|Legal\s+Description)[:\s]*(.+?)(?=EXCEPTING|Subject\s+to|APN|$)',
                r'(?:described\s+as\s+follows)[:\s]*(.+?)(?=EXCEPTING|Subject\s+to|APN|$)',
            ],
            'recording_date': [
                r'(?:Recorded|Recording\s+Date)[:\s]*([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})',
                r'(?:Book\s+[0-9]+\s+Page\s+[0-9]+\s+on\s+)([0-9]{1,2}[/-][0-9]{1,2}[/-][0-9]{2,4})',
            ],
        }

    def extract_from_pdf(self, pdf_path: str = None, pdf_bytes: bytes = None) -> Dict:
        """
        Extract text and data from PDF deed document

        Args:
            pdf_path: Path to PDF file (if file system access)
            pdf_bytes: PDF content as bytes (for uploaded files)

        Returns:
            Dictionary containing extracted deed information
        """
        try:
            # Convert PDF to images
            if pdf_path:
                images = convert_from_path(pdf_path, dpi=300)
            elif pdf_bytes:
                images = convert_from_bytes(pdf_bytes, dpi=300)
            else:
                raise ValueError("Either pdf_path or pdf_bytes must be provided")

            # Extract text from all pages
            full_text = ""
            for i, image in enumerate(images):
                # Use pytesseract to extract text
                text = pytesseract.image_to_string(image, config='--psm 6')
                full_text += f"\n--- Page {i+1} ---\n{text}"

            # Extract structured data
            extracted_data = self.parse_deed_text(full_text)
            extracted_data['raw_text'] = full_text
            extracted_data['page_count'] = len(images)

            return extracted_data

        except Exception as e:
            return {
                'error': str(e),
                'success': False
            }

    def extract_from_image(self, image_path: str = None, image_bytes: bytes = None) -> Dict:
        """
        Extract text and data from image deed document

        Args:
            image_path: Path to image file
            image_bytes: Image content as bytes

        Returns:
            Dictionary containing extracted deed information
        """
        try:
            # Load image
            if image_path:
                image = Image.open(image_path)
            elif image_bytes:
                image = Image.open(io.BytesIO(image_bytes))
            else:
                raise ValueError("Either image_path or image_bytes must be provided")

            # Extract text using pytesseract
            text = pytesseract.image_to_string(image, config='--psm 6')

            # Extract structured data
            extracted_data = self.parse_deed_text(text)
            extracted_data['raw_text'] = text
            extracted_data['page_count'] = 1

            return extracted_data

        except Exception as e:
            return {
                'error': str(e),
                'success': False
            }

    def parse_deed_text(self, text: str) -> Dict:
        """
        Parse extracted text to identify key fields

        Args:
            text: Raw OCR text from deed

        Returns:
            Dictionary with structured data
        """
        result = {
            'apn': None,
            'address': None,
            'grantee': None,
            'grantor': None,
            'legal_description': None,
            'recording_date': None,
            'success': True
        }

        # Extract each field using regex patterns
        for field, patterns in self.patterns.items():
            for pattern in patterns:
                match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
                if match:
                    value = match.group(1).strip()
                    # Clean up the extracted value
                    value = self.clean_extracted_value(value, field)
                    if value:
                        result[field] = value
                        break

        # Additional processing for legal description (often multi-line)
        if not result['legal_description']:
            result['legal_description'] = self.extract_legal_description_advanced(text)

        # Determine deed type
        result['deed_type'] = self.determine_deed_type(text)

        return result

    def clean_extracted_value(self, value: str, field: str) -> str:
        """Clean and normalize extracted values"""
        # Remove excessive whitespace
        value = ' '.join(value.split())

        # Field-specific cleaning
        if field == 'apn':
            # Keep only numbers and hyphens
            value = re.sub(r'[^0-9\-]', '', value)
        elif field == 'address':
            # Capitalize properly
            value = value.title()
            # Clean up extra commas
            value = re.sub(r',+', ',', value)
        elif field in ['grantee', 'grantor']:
            # Remove trailing commas and clean up
            value = value.rstrip(',').strip()
            # Remove common suffixes that might be captured
            value = re.sub(r'\s+(does|hereby|grants?|conveys?).*$', '', value, flags=re.IGNORECASE)
        elif field == 'legal_description':
            # Preserve line breaks but clean up excessive spacing
            value = re.sub(r'\n\s*\n', '\n', value)
            value = re.sub(r' +', ' ', value)

        return value.strip()

    def extract_legal_description_advanced(self, text: str) -> Optional[str]:
        """
        Advanced extraction for legal descriptions which can be complex
        """
        # Look for common legal description keywords
        legal_keywords = [
            'Lot', 'Block', 'Tract', 'Map', 'recorded', 'Township', 'Range',
            'Section', 'Quarter', 'meridian', 'County Recorder', 'Official Records'
        ]

        # Find sections that contain multiple legal keywords
        lines = text.split('\n')
        legal_section = []
        in_legal = False

        for line in lines:
            keyword_count = sum(1 for keyword in legal_keywords if keyword.lower() in line.lower())

            if keyword_count >= 2:
                in_legal = True
                legal_section.append(line)
            elif in_legal and keyword_count >= 1:
                legal_section.append(line)
            elif in_legal and len(legal_section) > 0:
                # Check if this might be continuation
                if line.strip() and not re.match(r'^[A-Z\s]+:.*', line):
                    legal_section.append(line)
                else:
                    break

        if legal_section:
            return ' '.join(legal_section).strip()

        return None

    def determine_deed_type(self, text: str) -> str:
        """Determine the type of deed from the text"""
        text_lower = text.lower()

        if 'quitclaim' in text_lower or 'quit claim' in text_lower:
            return 'Quitclaim Deed'
        elif 'grant deed' in text_lower:
            return 'Grant Deed'
        elif 'warranty deed' in text_lower:
            return 'Warranty Deed'
        elif 'trust deed' in text_lower:
            return 'Trust Deed'
        else:
            return 'Unknown'


def main():
    """Test function for local development"""
    import sys

    if len(sys.argv) < 2:
        print("Usage: python ocr_extractor.py <path_to_deed.pdf>")
        sys.exit(1)

    extractor = DeedExtractor()
    result = extractor.extract_from_pdf(sys.argv[1])

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
