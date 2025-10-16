# Quick Start Guide

Get your Trust Transfer Deed Automation app running in 5 minutes!

## Prerequisites Checklist

- [ ] Node.js 18+ installed (`node --version`)
- [ ] Python 3.11+ installed (`python --version`)
- [ ] Tesseract OCR installed (`tesseract --version`)
- [ ] Git installed (`git --version`)

## Installation (2 minutes)

```bash
# 1. Navigate to project directory
cd ~/Documents/deed-automation

# 2. Install Node dependencies
npm install

# 3. Install Python dependencies
cd backend
pip install -r requirements.txt
cd ..
```

## Local Development (1 minute)

```bash
# Start the development server
npm run dev
```

Visit: **http://localhost:3000**

## Test the Application (2 minutes)

1. **Upload a sample deed:**
   - Drag and drop `samples/deeds/deed1.pdf`
   - Or click to browse and select it

2. **Review extracted data:**
   - Check APN, address, legal description
   - Current owner should appear in the form

3. **Fill in trust information:**
   - Trust Name: "The John Doe Revocable Living Trust"
   - Trust Date: "January 1, 2024"
   - County: "Los Angeles"

4. **Generate documents:**
   - Click "Generate Documents"
   - Two PDFs will download:
     - Trust Transfer Deed
     - PCOR Form

## Deploy to Netlify (Optional)

See [GITHUB_SETUP.md](./GITHUB_SETUP.md) for detailed instructions:

```bash
# Quick deploy
git remote add origin https://github.com/rozsagyenelaw/deed-automation.git
git push -u origin main

# Then connect on Netlify website
```

## Troubleshooting

### "Command not found: npm"
**Install Node.js:** https://nodejs.org

### "Command not found: python"
**Install Python:** https://python.org

### "Command not found: tesseract"
```bash
# macOS
brew install tesseract

# Ubuntu/Debian
sudo apt-get install tesseract-ocr

# Windows
# Download from: https://github.com/UB-Mannheim/tesseract/wiki
```

### "Port 3000 already in use"
```bash
# Use a different port
PORT=3001 npm run dev
```

### Dependencies fail to install
```bash
# Clear cache and retry
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

- [ ] Read [README.md](./README.md) for full documentation
- [ ] Review [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment details
- [ ] Customize OCR patterns in `backend/ocr_extractor.py`
- [ ] Add your county PCOR forms to `samples/pcors/`
- [ ] Test with your actual deed documents
- [ ] Deploy to Netlify for production use

## File Structure Overview

```
deed-automation/
├── app/                      # Next.js pages
│   └── page.tsx             # Main application page
├── components/              # React components
│   ├── FileUpload.tsx       # Drag-and-drop upload
│   ├── DeedForm.tsx         # Data entry form
│   └── DocumentPreview.tsx  # PDF preview
├── backend/                 # Python OCR
│   ├── ocr_extractor.py    # OCR extraction logic
│   └── requirements.txt     # Python packages
├── netlify/functions/       # API endpoints
│   ├── extract-deed.js     # OCR API
│   ├── generate-deed.js    # Deed generation
│   └── fill-pcor.js        # PCOR form filling
└── samples/                 # Test files
    ├── deeds/              # Sample deeds
    └── pcors/              # County forms
```

## Common Tasks

### Add a new county
1. Add PCOR form to `samples/pcors/`
2. Update `types/index.ts` COUNTIES array
3. Update `netlify/functions/fill-pcor.js` mapping

### Customize deed template
Edit `netlify/functions/generate-deed.js`

### Improve OCR accuracy
Edit `backend/ocr_extractor.py` patterns

### Change styling
Edit `styles/globals.css` or component files

## Support

- **Documentation:** See README.md
- **Issues:** GitHub Issues (once deployed)
- **OCR Problems:** Check Tesseract installation
- **Build Problems:** Check Node/Python versions

## Success Indicators

You'll know it's working when:
- ✅ Dev server starts without errors
- ✅ Website loads at localhost:3000
- ✅ Can upload sample deed files
- ✅ Data appears in the form
- ✅ Documents download successfully

Happy automating! 🚀
