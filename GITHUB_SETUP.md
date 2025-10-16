# GitHub Setup Instructions

## Connect to GitHub Repository

Your local Git repository is initialized. Follow these steps to connect it to GitHub at `https://github.com/rozsagyenelaw`.

### Step 1: Create Repository on GitHub

1. Go to https://github.com/rozsagyenelaw
2. Click the **"+"** icon (top right) → **"New repository"**
3. Repository settings:
   - **Name:** `deed-automation`
   - **Description:** "Automated trust transfer deed generation with OCR extraction"
   - **Visibility:** Private (recommended) or Public
   - **DO NOT** initialize with README, .gitignore, or license (we already have these)
4. Click **"Create repository"**

### Step 2: Push Local Code to GitHub

From your terminal in the `deed-automation` directory:

```bash
# Add the remote repository
git remote add origin https://github.com/rozsagyenelaw/deed-automation.git

# Push your code to GitHub
git push -u origin main
```

If you're prompted for credentials:
- **Username:** Your GitHub username
- **Password:** Use a Personal Access Token (not your GitHub password)

### Step 3: Create Personal Access Token (if needed)

If you need to create a token:

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. Set:
   - **Note:** "Deed Automation Deploy"
   - **Expiration:** Your preference
   - **Scopes:** Check `repo` (full control of private repositories)
4. Click **"Generate token"**
5. **Copy the token** (you won't see it again!)
6. Use this token as your password when pushing

### Step 4: Verify Upload

After pushing:

1. Go to https://github.com/rozsagyenelaw/deed-automation
2. You should see all your files
3. Verify that:
   - README.md displays properly
   - Sample files are included
   - All directories are present

## Next Steps: Deploy to Netlify

Once your code is on GitHub, follow these steps to deploy:

### Option A: Netlify UI (Recommended)

1. **Go to Netlify:**
   - Visit https://app.netlify.com
   - Sign up or log in (can use GitHub account)

2. **Import Project:**
   - Click **"Add new site"** → **"Import an existing project"**
   - Click **"GitHub"**
   - Authorize Netlify to access your GitHub account
   - Select the `rozsagyenelaw/deed-automation` repository

3. **Configure Build:**
   - **Branch:** `main`
   - **Build command:** `npm run build`
   - **Publish directory:** `.next`
   - Click **"Deploy site"**

4. **Wait for Deployment:**
   - First build may take 3-5 minutes
   - Watch the deploy logs
   - Once complete, you'll get a URL like `https://your-site-name.netlify.app`

### Option B: Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Link to GitHub and deploy
netlify init

# Follow prompts:
# - Create & configure a new site
# - Connect to GitHub repo
# - Set build command: npm run build
# - Set publish directory: .next

# Deploy to production
netlify deploy --prod
```

## Continuous Deployment

Once connected to Netlify via GitHub:

- **Automatic deploys:** Every push to `main` triggers a new deployment
- **Deploy previews:** Pull requests get preview URLs
- **Instant rollback:** Revert to any previous deploy in one click

## Making Updates

After initial setup, to make changes:

```bash
# Make your code changes...

# Stage changes
git add .

# Commit with descriptive message
git commit -m "Description of changes"

# Push to GitHub (triggers Netlify deploy)
git push origin main
```

## Repository Settings (Optional)

### Add Branch Protection

1. Go to repo Settings → Branches
2. Add rule for `main` branch:
   - Require pull request reviews
   - Require status checks to pass
   - Include administrators

### Add Topics/Tags

Add topics to help others find your repo:
- `deed-automation`
- `legal-tech`
- `ocr`
- `nextjs`
- `netlify`

## Troubleshooting

### Authentication Failed

**Solution:** Use Personal Access Token instead of password
- Generate token at https://github.com/settings/tokens
- Use token as password when pushing

### Remote Already Exists

If you see "remote origin already exists":
```bash
# Remove existing remote
git remote remove origin

# Add correct remote
git remote add origin https://github.com/rozsagyenelaw/deed-automation.git
```

### Push Rejected

If your push is rejected:
```bash
# Pull first (in case repo was initialized with files)
git pull origin main --allow-unrelated-histories

# Then push
git push -u origin main
```

## Repository Structure on GitHub

Your repository will include:

```
rozsagyenelaw/deed-automation
├── .github/              # (Optional) GitHub Actions workflows
├── app/                  # Next.js application
├── components/           # React components
├── backend/              # Python OCR backend
├── netlify/              # Serverless functions
├── samples/              # Sample files
├── README.md             # Main documentation
├── DEPLOYMENT.md         # Deployment guide
└── ... other files
```

## Best Practices

1. **Commit Often:** Make small, frequent commits with clear messages
2. **Use Branches:** Create feature branches for major changes
3. **Write Good Commit Messages:** Describe what and why, not how
4. **Keep Secrets Safe:** Never commit `.env` files or API keys
5. **Update README:** Keep documentation current as project evolves

## Resources

- **GitHub Docs:** https://docs.github.com
- **Netlify Docs:** https://docs.netlify.com
- **Git Cheat Sheet:** https://education.github.com/git-cheat-sheet-education.pdf

---

Need help? Check the [README.md](./README.md) or [DEPLOYMENT.md](./DEPLOYMENT.md) for more details.
