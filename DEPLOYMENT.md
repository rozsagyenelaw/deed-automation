# Deployment Guide for Netlify

## Quick Start

### Deploy to Netlify with GitHub Integration

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

2. **Import to Netlify:**
   - Visit https://app.netlify.com
   - Click "Add new site" → "Import an existing project"
   - Select "GitHub" and authorize access
   - Choose the `deed-automation` repository
   - Configure build settings (see below)

### Build Settings

Netlify should auto-detect these settings, but verify:

- **Build command:** `npm run build`
- **Publish directory:** `.next`
- **Functions directory:** `netlify/functions`

### Required Build Plugins

Add these plugins in Netlify:
- `@netlify/plugin-nextjs` (usually auto-installed)

### Environment Setup

No environment variables are required for basic operation.

## Python OCR Setup on Netlify

### Option 1: Using Netlify Build Plugins

For full OCR functionality with Python/Tesseract on Netlify:

1. **Add build plugin** in `netlify.toml`:
   ```toml
   [[plugins]]
     package = "netlify-plugin-python-runtime"
   ```

2. **Install the plugin:**
   ```bash
   npm install -D netlify-plugin-python-runtime
   ```

### Option 2: Alternative OCR Solutions

If Tesseract is not available in Netlify build environment, consider:

1. **External OCR API:**
   - Google Cloud Vision API
   - AWS Textract
   - Azure Computer Vision

2. **Update `netlify/functions/extract-deed.js`** to call external service:
   ```javascript
   // Replace mock data with API call
   const ocrResult = await externalOCRService.extract(fileBytes);
   ```

## Testing Deployment

### Before Deploying

1. **Test locally:**
   ```bash
   npm run build
   npm start
   ```

2. **Test Netlify functions locally:**
   ```bash
   netlify dev
   ```

### After Deployment

1. **Check build logs** in Netlify dashboard
2. **Test file upload** with sample deeds
3. **Verify document generation** works
4. **Check function logs** for any errors

## Custom Domain Setup

1. **Add custom domain** in Netlify:
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Follow DNS configuration instructions

2. **Enable HTTPS:**
   - Automatic with Let's Encrypt (free)
   - Enabled by default on Netlify

## Performance Optimization

### Recommended Settings

1. **Enable caching:**
   - Netlify automatically caches static assets
   - Configure headers in `netlify.toml` if needed

2. **Optimize images:**
   - Use Next.js Image component
   - Already configured in the project

3. **Function optimization:**
   - Keep function size under 50MB
   - Use minimal dependencies

## Monitoring

### Enable Netlify Analytics (Optional)

1. Go to Site settings → Analytics
2. Enable Netlify Analytics ($9/month)
3. Track visitor metrics and performance

### Function Logs

Access in Netlify dashboard:
- Functions tab → View logs
- Real-time function execution logs
- Error tracking and debugging

## Troubleshooting

### Build Fails

**Check:**
- Node version (18+)
- All dependencies in `package.json`
- Build command is correct
- No missing files

**Solution:**
```bash
# Clear cache and rebuild
netlify build --clear-cache
```

### Functions Not Working

**Check:**
- Function directory is `netlify/functions`
- Dependencies are installed
- Proper error handling in functions

**View logs:**
```bash
netlify functions:log extract-deed
```

### OCR Not Extracting

**If using mock data:**
- Update `extract-deed.js` to use Python backend
- Ensure Python runtime is available

**If using real OCR:**
- Verify Tesseract is installed in build
- Check Python dependencies
- Review function timeout (default 10s, max 26s on free plan)

## Scaling Considerations

### Free Tier Limits (Netlify)
- 100GB bandwidth/month
- 300 build minutes/month
- 125k function invocations/month
- 100 hours function runtime/month

### Upgrade When:
- Processing > 100 deeds/day
- Need more function runtime
- Require priority support

## Security

### Recommendations

1. **Environment variables:**
   - Store sensitive keys in Netlify environment variables
   - Never commit `.env` files

2. **HTTPS:**
   - Enabled by default
   - Required for production

3. **Function authentication:**
   - Add API keys if needed
   - Rate limiting for public endpoints

## Continuous Deployment

### Automatic Deploys

Already configured via GitHub integration:
- Push to `main` → Auto deploy to production
- Pull requests → Deploy previews

### Branch Deploys

Configure in Netlify:
- Deploy specific branches
- Deploy previews for PRs
- Split testing (A/B)

## Rollback

If deployment fails:
1. Go to Deploys in Netlify
2. Find previous successful deploy
3. Click "Publish deploy"
4. Site reverts to previous version

## Support

- **Netlify Docs:** https://docs.netlify.com
- **Netlify Forums:** https://answers.netlify.com
- **GitHub Issues:** [Your repo URL]

---

**Note:** This application is optimized for Netlify. For other platforms (Vercel, AWS, etc.), configuration will differ.
