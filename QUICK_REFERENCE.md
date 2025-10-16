# Quick Reference Card

## 🚀 Deploy in 3 Commands

```bash
# 1. Push to GitHub (after creating repo at github.com/new)
git remote add origin https://github.com/rozsagyenelaw/deed-automation.git
git push -u origin main

# 2. Go to Netlify
# Visit: https://app.netlify.com
# Import from GitHub → Select deed-automation → Deploy

# 3. Done! Your site is live
```

## 📂 Project Structure

```
deed-automation/
├── app/                    # Next.js pages
├── components/             # React components
├── backend/               # Python OCR
├── netlify/functions/     # API endpoints
├── samples/               # Test files
└── [docs]                 # Documentation
```

## 🛠️ Local Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Open browser
# http://localhost:3000
```

## 📄 Key Files

| File | Purpose |
|------|---------|
| `DEPLOY_NOW.md` | Step-by-step deployment |
| `README.md` | Complete documentation |
| `QUICKSTART.md` | 5-minute setup guide |
| `WHAT_WAS_BUILT.txt` | Build summary |

## 🔗 Important URLs

- **GitHub Repo:** github.com/rozsagyenelaw/deed-automation
- **Netlify:** app.netlify.com
- **Docs:** See README.md

## 💻 Tech Stack

- **Frontend:** Next.js 14 + TypeScript
- **Backend:** Python + Tesseract OCR
- **Hosting:** Netlify
- **Database:** None (stateless)

## ✨ Features

- ✅ OCR extraction
- ✅ Deed generation
- ✅ PCOR form filling
- ✅ 5 counties supported
- ✅ Drag-and-drop upload
- ✅ PDF downloads

## 🎯 User Flow

1. Upload deed → 2. Review data → 3. Enter trust info → 4. Generate docs → 5. Download PDFs

## ⚡ Quick Commands

```bash
# View files
ls -la

# Check git status
git status

# View commits
git log --oneline

# Run build
npm run build

# Type check
npm run type-check
```

## 🔧 Customization

**Add county:**
1. Add form to `samples/pcors/`
2. Update `types/index.ts`
3. Update `fill-pcor.js`

**Edit deed template:**
- `netlify/functions/generate-deed.js`

**Improve OCR:**
- `backend/ocr_extractor.py`

## 📊 Project Stats

- **Files:** 36
- **Commits:** 6
- **Components:** 3
- **API Endpoints:** 3
- **Counties:** 5
- **Docs:** 7

## ⏱️ Time Savings

**Manual:** ~50 min per deed
**Automated:** ~2 min per deed
**Savings:** 96% reduction

## 🎓 Learning Resources

- **Next.js:** nextjs.org/docs
- **Netlify:** docs.netlify.com
- **TypeScript:** typescriptlang.org/docs

## 🐛 Troubleshooting

**Build fails?**
- Check Node version (need 18+)
- Run `npm install`
- Check `netlify.toml`

**Functions not working?**
- Check Netlify dashboard logs
- Verify function directory
- Check CORS settings

**OCR not extracting?**
- Tesseract installed?
- Check Python version
- Update extract-deed.js

## 📞 Get Help

1. Check README.md
2. Review DEPLOYMENT.md
3. See PROJECT_SUMMARY.md
4. Check Netlify docs

## ✅ Pre-Deployment Checklist

- [ ] Git initialized
- [ ] All files committed
- [ ] GitHub repo created
- [ ] Code pushed
- [ ] Netlify connected
- [ ] Build successful
- [ ] Site tested

## 🎉 Success Indicators

- ✅ Build completes without errors
- ✅ Site loads properly
- ✅ Can upload files
- ✅ Forms work
- ✅ PDFs download

---

**Start here:** DEPLOY_NOW.md
**Questions?** Read README.md
**Issues?** Check DEPLOYMENT.md
