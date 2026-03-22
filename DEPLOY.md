# NeuroLearn — Deploy Reference

## Architecture
- Frontend (React + Vite) → Firebase Hosting
- API (Serverless functions) → Vercel
- Database, Auth, Storage → Firebase
- ML service → Render (future)

## Daily workflow

### Making changes to frontend (components, pages, styles)
```powershell
# Local dev
cd neurolearn
npm run dev

# Deploy to Firebase Hosting when ready
npm run deploy
```

### Making changes to API functions
```powershell
# Local dev (runs functions locally)
cd neurolearn-api
npm run dev

# Deploy — EITHER push to GitHub (auto-deploys via Vercel)
git add .
git commit -m "your message"
git push origin main

# OR deploy directly without a git commit
cd neurolearn-api
npm run deploy
```

### Updating Firestore security rules
```powershell
cd neurolearn
npm run deploy:rules
```

### Pulling latest env vars locally
```powershell
# Frontend
cd neurolearn
vercel env pull .env.local

# API
cd neurolearn-api
vercel env pull .env.local
```

### After rotating API keys
1. Update key in Vercel dashboard (both projects)
2. Run vercel env pull .env.local in both folders
3. Run npm run deploy in neurolearn/ to rebuild frontend with new key
4. Push to GitHub to trigger Vercel API redeploy

## URL reference
| URL | What it is |
|---|---|
| https://neurolearn-tutor-app.web.app | Live app — Firebase Hosting (primary) |
| https://neurolearn.vercel.app | Live app — Vercel mirror (secondary) |
| https://neurolearn-api.vercel.app | API functions |
| http://localhost:5173 | Local frontend dev |
| http://localhost:3000 | Local API dev (vercel dev) |
