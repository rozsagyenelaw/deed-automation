# 🚀 Deploy to GitHub & Netlify NOW

## Copy-Paste Commands to Deploy

### Step 1: Create GitHub Repository

1. Open browser and go to: **https://github.com/new**
2. Fill in:
   - Repository name: `deed-automation`
   - Description: `Automated trust transfer deed generation with OCR extraction`
   - Private or Public: **Private** (recommended)
   - **DO NOT** check any boxes (no README, no .gitignore, no license)
3. Click **"Create repository"**

### Step 2: Push Code to GitHub

Open Terminal and run these commands **exactly as shown**:

```bash
# Navigate to project directory (if not already there)
cd ~/Documents/deed-automation

# Add GitHub remote
git remote add origin https://github.com/rozsagyenelaw/deed-automation.git

# Push code to GitHub
git push -u origin main
```

**Note:** You may be prompted for credentials:
- Username: Your GitHub username
- Password: Use a **Personal Access Token** (not your password)

#### Creating a Personal Access Token (if needed)

If you don't have a token:

1. Go to: **https://github.com/settings/tokens**
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Give it a name: `Deed Automation Deploy`
4. Check the `repo` scope
5. Click **"Generate token"**
6. **COPY THE TOKEN** (you won't see it again!)
7. Use this token as your password when pushing

### Step 3: Deploy to Netlify

#### Option A: Netlify UI (Easier)

1. Go to: **https://app.netlify.com**
2. Sign up or log in (you can use your GitHub account)
3. Click **"Add new site"** → **"Import an existing project"**
4. Click **"GitHub"**
5. Authorize Netlify to access your GitHub
6. Search for and select: `deed-automation`
7. Build settings should auto-populate:
   - Build command: `npm run build`
   - Publish directory: `.next`
   - Functions directory: `netlify/functions`
8. Click **"Deploy site"**
9. Wait 3-5 minutes for first deployment
10. Your site will be live at: `https://[random-name].netlify.app`

#### Option B: Netlify CLI (Advanced)

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize and deploy
netlify init

# Follow prompts, then deploy
netlify deploy --prod
```

### Step 4: Test Your Deployed Site

Once deployed, you'll get a URL like: `https://your-site-name.netlify.app`

1. Visit the URL
2. Upload a sample deed from your local `samples/deeds/` folder
3. Fill in the form
4. Generate and download documents
5. Verify everything works!

## Troubleshooting

### Problem: "Remote origin already exists"

```bash
git remote remove origin
git remote add origin https://github.com/rozsagyenelaw/deed-automation.git
git push -u origin main
```

### Problem: "Authentication failed"

You need a Personal Access Token:
1. Go to https://github.com/settings/tokens
2. Generate new token (classic)
3. Give it `repo` access
4. Use token as password when pushing

### Problem: "Repository not found"

Make sure you created the repo on GitHub first at:
https://github.com/rozsagyenelaw/deed-automation

### Problem: Netlify build fails

Check the build logs in Netlify dashboard. Common issues:
- Missing dependencies (should auto-install)
- Node version (uses Node 18 by default)
- Build command incorrect (should be `npm run build`)

## That's It!

Your application should now be:
- ✅ Pushed to GitHub
- ✅ Deployed on Netlify
- ✅ Live on the internet
- ✅ Automatically deploying on every git push

## Next Steps

1. **Custom Domain (Optional):**
   - Go to Netlify site settings
   - Add your custom domain
   - Update DNS records

2. **Environment Variables (If Needed):**
   - Go to Netlify site settings
   - Environment variables section
   - Add any needed variables

3. **Configure OCR:**
   - For production OCR, you'll need to set up Tesseract in Netlify
   - Or integrate a cloud OCR service (Google Vision, AWS Textract, etc.)
   - Update `netlify/functions/extract-deed.js` to use real OCR

## Important Notes

- **First deployment** takes longer (3-5 minutes)
- **Subsequent deployments** are faster (1-2 minutes)
- **Automatic deployments** happen on every push to `main`
- **Deploy previews** are created for pull requests

## Support Resources

- **GitHub Help:** https://docs.github.com
- **Netlify Help:** https://docs.netlify.com
- **Project Docs:** See README.md in this project

## Your URLs

After deployment, save these URLs:

- **GitHub Repository:** https://github.com/rozsagyenelaw/deed-automation
- **Netlify Dashboard:** https://app.netlify.com/sites/[your-site-name]
- **Live Application:** https://[your-site-name].netlify.app

---

**Ready? Let's deploy!** 🚀

Start with Step 1 above and follow through to Step 4.
