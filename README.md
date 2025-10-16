# Trust Transfer Deed Automation

A professional web application for automating trust transfer deed generation with OCR extraction. Built for deployment on Netlify with seamless GitHub integration.

## Features

- **OCR Extraction**: Automatically extract key information from existing deeds using Tesseract OCR
- **Smart Data Parsing**: Extract APN, property address, legal description, and grantee information
- **Trust Transfer Deed Generation**: Generate properly formatted legal deed documents
- **PCOR Form Filling**: Auto-fill county-specific Preliminary Change of Ownership Report forms
- **Modern UI**: Clean, professional interface with drag-and-drop file upload
- **Multi-County Support**: Los Angeles, Ventura, Riverside, San Bernardino, and Orange counties
- **Document Preview & Download**: Preview and download generated documents as PDFs

## Tech Stack

### Frontend
- **Next.js 14** with React 18
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **react-dropzone** for file uploads
- **pdf-lib** for PDF generation

### Backend
- **Python 3.11** for OCR processing
- **Tesseract OCR** for text extraction
- **PyPDF2 & pdf2image** for PDF handling
- **Netlify Serverless Functions** for API endpoints

## Project Structure

```
deed-automation/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main page
├── components/            # React components
│   ├── FileUpload.tsx    # Drag-and-drop upload
│   ├── DeedForm.tsx      # Data entry and editing
│   └── DocumentPreview.tsx # PDF preview modal
├── lib/                   # Utility libraries
│   └── api.ts            # API client
├── types/                 # TypeScript definitions
│   └── index.ts
├── styles/               # Global styles
│   └── globals.css
├── backend/              # Python OCR backend
│   ├── ocr_extractor.py # OCR extraction module
│   └── requirements.txt  # Python dependencies
├── netlify/              # Netlify functions
│   └── functions/
│       ├── extract-deed.js   # OCR API endpoint
│       ├── generate-deed.js  # Deed generation
│       └── fill-pcor.js      # PCOR form filling
├── samples/              # Sample files
│   ├── deeds/           # Sample deed documents
│   └── pcors/           # County PCOR forms
├── public/              # Static assets
├── netlify.toml         # Netlify configuration
├── package.json         # Node dependencies
└── tsconfig.json        # TypeScript config
```

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.11+
- **Tesseract OCR** installed on your system
- **Git** for version control

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/rozsagyenelaw/deed-automation.git
   cd deed-automation
   ```

2. **Install Node dependencies:**
   ```bash
   npm install
   ```

3. **Install Python dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   cd ..
   ```

4. **Install Tesseract OCR:**

   **macOS:**
   ```bash
   brew install tesseract
   ```

   **Ubuntu/Debian:**
   ```bash
   sudo apt-get install tesseract-ocr
   ```

   **Windows:**
   Download installer from: https://github.com/UB-Mannheim/tesseract/wiki

### Local Development

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Open your browser:**
   Navigate to `http://localhost:3000`

3. **Test the application:**
   - Upload a sample deed from `samples/deeds/`
   - Review extracted data
   - Fill in trust information
   - Generate and download documents

## Deployment to Netlify

### Option 1: Deploy via Netlify CLI

1. **Install Netlify CLI:**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify:**
   ```bash
   netlify login
   ```

3. **Initialize site:**
   ```bash
   netlify init
   ```

4. **Deploy:**
   ```bash
   netlify deploy --prod
   ```

### Option 2: Deploy via GitHub Integration

1. **Push to GitHub:**
   ```bash
   git remote add origin https://github.com/rozsagyenelaw/deed-automation.git
   git branch -M main
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Connect to Netlify:**
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" > "Import an existing project"
   - Choose GitHub and select your repository
   - Configure build settings:
     - **Build command:** `npm run build`
     - **Publish directory:** `.next`
   - Click "Deploy site"

3. **Configure Environment:**
   - Netlify will automatically detect Next.js
   - Python functions will be built automatically
   - Ensure Tesseract is available in the build environment

### Environment Variables

No environment variables are required for basic operation. Optional:

- `NEXT_PUBLIC_API_URL`: API base URL (auto-detected in production)

## Usage

### 1. Upload Deed Document

- Drag and drop or click to browse for a deed file (PDF or image)
- Supported formats: PDF, PNG, JPG, TIFF
- OCR will automatically extract key information

### 2. Review and Edit Extracted Data

The system extracts:
- **APN (Assessor's Parcel Number)**
- **Property Address**
- **Legal Description**
- **Grantee Name** (becomes the Grantor for trust transfer)

Review and correct any extracted data as needed.

### 3. Enter Trust Information

- **Trust Name**: Full name of the revocable living trust
- **Trust Date**: Date the trust was established
- **County**: Select the county where property is located

### 4. Generate Documents

Click "Generate Documents" to create:
1. **Trust Transfer Deed** - Properly formatted legal deed
2. **PCOR Form** - County-specific Preliminary Change of Ownership Report

Both documents will be downloaded automatically as PDFs.

## Sample Files

The `samples/` directory contains:

### Deeds (`samples/deeds/`)
- Sample deed documents for testing OCR extraction
- Various formats (Grant Deeds, Quitclaim Deeds)

### PCOR Forms (`samples/pcors/`)
- Official county PCOR forms:
  - Los Angeles County
  - Ventura County
  - Riverside County
  - San Bernardino County
  - Orange County

## OCR Configuration

The OCR module uses Tesseract with optimized settings:
- **DPI**: 300 for high-quality extraction
- **PSM Mode**: 6 (uniform block of text)
- **Pattern Matching**: Regex-based extraction for key fields

### Customizing OCR Patterns

Edit `backend/ocr_extractor.py` to modify extraction patterns:

```python
self.patterns = {
    'apn': [
        r'APN[:\s]*([0-9\-]+)',
        # Add custom patterns here
    ],
    # ... more patterns
}
```

## Troubleshooting

### OCR Not Working
- Ensure Tesseract is installed: `tesseract --version`
- Check Python dependencies: `pip list | grep pytesseract`
- Verify file format is supported

### PDF Generation Issues
- Check that all required fields are filled
- Verify PDF-lib is installed: `npm list pdf-lib`
- Check browser console for errors

### Netlify Deployment Issues
- Verify `netlify.toml` is in root directory
- Check build logs in Netlify dashboard
- Ensure all dependencies are in `package.json`

### Python Functions Not Working
- Verify Python 3.11 is specified in `netlify.toml`
- Check that `requirements.txt` is present in `backend/`
- Review function logs in Netlify dashboard

## Development Notes

### Adding New Counties

1. Add PCOR form PDF to `samples/pcors/`
2. Update county list in `types/index.ts`
3. Add file mapping in `netlify/functions/fill-pcor.js`

### Customizing Deed Template

Edit the PDF generation logic in `netlify/functions/generate-deed.js`:
- Modify layout and formatting
- Add additional fields
- Change fonts and styling

### Improving OCR Accuracy

1. Adjust DPI settings in `backend/ocr_extractor.py`
2. Add preprocessing (image enhancement, noise reduction)
3. Fine-tune regex patterns for your specific deed formats

## Security Considerations

- Files are processed server-side; no data is stored permanently
- PDFs are generated in-memory and returned as base64
- No personal information is logged or retained
- HTTPS is enforced in production (via Netlify)

## Contributing

This is a professional legal automation tool. Contributions should:
- Maintain legal accuracy and professional standards
- Include proper testing
- Follow existing code style
- Update documentation

## License

Proprietary - All rights reserved

## Support

For issues or questions:
- GitHub Issues: https://github.com/rozsagyenelaw/deed-automation/issues
- Email: [Your professional contact]

## Acknowledgments

- Built with Next.js and React
- OCR powered by Tesseract
- PDF generation with pdf-lib
- Deployed on Netlify

---

**Disclaimer**: This tool is for professional use by qualified legal professionals. Generated documents should be reviewed by an attorney before filing. The system provides automation assistance but does not constitute legal advice.
