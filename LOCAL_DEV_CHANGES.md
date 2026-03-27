# Local Development Configuration Changes

**Date:** March 28, 2026  
**Purpose:** Transition from cloud-only deployment to local development setup  
**Status:** ✅ Complete — ready for local testing before GitHub push and production deployment

---

## What Changed

### 1. Backend API Configuration (`neurolearn-api/.env.local`)

**Before:**
```env
VITE_VERCEL_API_URL="https://neurolearn-api.vercel.app"  # ← Remote URL
ML_SERVICE_URL=http://127.0.0.1:8000
```

**After:**
```env
ML_SERVICE_URL=http://127.0.0.1:8000
DEV_MODE=true
LOCAL_API_URL=http://127.0.0.1:3000  # ← Localhost reference
# Removed: VITE_VERCEL_API_URL (production only)
```

**Why:** Eliminates dependency on Vercel-hosted API during local development. Backend now runs via `npm run serve` (Vercel CLI local dev server) on localhost:3000.

---

### 2. Frontend Configuration (`neurolearn/.env.local`)

**Status:** ✅ Already correct
```env
VITE_VERCEL_API_URL=http://127.0.0.1:3000  # ← Already localhost
```

**Why:** No change needed. Frontend dev server already points to local backend API.

---

### 3. ML Service Configuration (`neurolearn-ml/.env`)

**Status:** ✅ Already configured for local
```env
VERCEL_WEBHOOK_URL=http://127.0.0.1:3000/api/webhook/ml-result
ML_WEBHOOK_SECRET=5cdc922305e36732f8684eb377f0b91b14398ac2d52350d671a4b0af676a47c9
```

**Why:** ML service already posts results back to local backend webhook on localhost:3000.

---

## Architecture

```
LOCAL DEVELOPMENT FLOW
═════════════════════

┌──────────────────┐
│    Browser       │
│ localhost:5173   │
│  (React + Vite)  │
└────────┬─────────┘
         │ axios
         ▼
┌──────────────────────────────┐
│   Backend API                │
│ localhost:3000               │
│ (Vercel CLI)                 │
│ ├─ /api/analyze-handwriting  │
│ ├─ /api/generate-report      │
│ ├─ /api/webhook/ml-result    │
│ └─ ...other endpoints        │
└───────┬───────────┬──────────┘
        │           │
    HTTP POST   HTTP POST
        │           │
        ▼           ▼
┌──────────────┐  ┌──────────────────┐
│   Firebase   │  │  ML Service      │
│  Firestore   │  │ localhost:8000   │
│  (Remote)    │  │ (Python FastAPI) │
│              │  │ ├─ /analyze      │
│   - Auth     │  │ └─ /docs (Swagger)
│ - Firestore  │  │                  │
│ - Gen AI     │  │ Posts results ──┐│
│              │  │                 ││
└──────────────┘  └──────────────────┘
                         │
                         │ posts back
                         │
                    ┌────▼────┐
                    │ Webhook │
                    │ Handler │
                    └─────────┘
```

---

## Environment Variables Summary

### `neurolearn/.env.local` (Frontend)
| Var | Value | Source | Purpose |
|-----|-------|--------|---------|
| VITE_FIREBASE_API_KEY | AIzaSy... | Firebase Console | Web auth |
| VITE_FIREBASE_PROJECT_ID | neurolearn-tutor-app | Firebase Console | DB project |
| VITE_VERCEL_API_URL | http://127.0.0.1:3000 | ← Local | API base URL |
| VITE_GENAI_API_KEY | AIzaSy... | Google AI Studio | Gemini calls |

### `neurolearn-api/.env.local` (Backend)
| Var | Value | Source | Purpose |
|-----|-------|--------|---------|
| FIREBASE_SERVICE_ACCOUNT_JSON | {...} | Firebase Console | Admin SDK auth |
| ML_SERVICE_URL | http://127.0.0.1:8000 | ← Local | ML endpoint |
| ML_WEBHOOK_SECRET | 5cdc92... | Shared secret | ML→API validation |
| DEV_MODE | true | ← Flag | Development mode |
| LOCAL_API_URL | http://127.0.0.1:3000 | ← Reference | Webhook responses |

### `neurolearn-ml/.env` (ML Service)
| Var | Value | Source | Purpose |
|-----|-------|--------|---------|
| VERCEL_WEBHOOK_URL | http://127.0.0.1:3000/api/webhook/ml-result | ← Local | Results endpoint |
| ML_WEBHOOK_SECRET | 5cdc92... | Shared secret | Validation |

---

## What's Local vs. Remote

### ✅ LOCAL (Can run offline)
- Frontend dev server (5173)
- Backend API (3000, via Vercel CLI)
- ML Service (8000, via Python)

### ☁️ REMOTE (Requires internet)
- Firestore database
- Google Generative AI (Gemini)
- Firebase authentication

**Note:** Firebase and Gen AI are remote because:
1. Setting up Firebase Emulator locally is complex
2. Gen AI needs live API access
3. Current setup acceptable for feature development
4. Can migrate to local emulator later if needed

---

## Start Services

### Quick Start (3 terminals)

**Terminal 1:**
```bash
cd neurolearn-api && npm run serve
```

**Terminal 2:**
```bash
cd neurolearn-ml && python main.py
```

**Terminal 3:**
```bash
cd neurolearn && npm run dev
```

### Or Use Auto-Start Script

**Windows:**
```bash
START_LOCAL_DEV.bat
```

**macOS/Linux:**
```bash
./start-local-dev.sh
```

---

## Verification

All services should respond:
```bash
# Frontend
curl http://localhost:5173

# Backend API
curl http://localhost:3000

# ML Service
curl http://localhost:8000/docs
```

See `VERIFICATION_CHECKLIST.md` for end-to-end testing steps.

---

## Next: Deploy & GitHub

### Phase 2: Push to GitHub
```bash
git add .
git commit -m "Local dev setup complete"
git push origin main
```

### Phase 3: Deploy Production
1. **Backend**: `cd neurolearn-api && npm run deploy`
   - Creates Vercel production endpoint
2. **Frontend**: `cd neurolearn && npm run deploy`
   - Updates `VITE_VERCEL_API_URL` to production backend URL
   - Deploys to Firebase Hosting

### Phase 4: Verification in Production
- Update `.env.local` files with production URLs (for reference)
- Test live at https://neurolearn-tutor-app.web.app
- Monitor Vercel dashboard for backend errors

---

## Files Added/Modified

**New Documentation:**
- ✅ `LOCAL_DEV_SETUP.md` — Detailed architecture & configuration
- ✅ `QUICK_START.md` — Fast 3-step startup guide
- ✅ `START_LOCAL_DEV.bat` — Windows auto-start script
- ✅ `start-local-dev.sh` — macOS/Linux auto-start script
- ✅ `VERIFICATION_CHECKLIST.md` — Testing checklist

**Modified Configuration:**
- ✅ `neurolearn-api/.env.local` — Removed production URL, added DEV_MODE flag

**No Code Changes:**
- Frontend code unchanged (already points to localhost)
- Backend code unchanged (auto-detects local setup)
- ML service unchanged (already local-first)

---

## Quick Reference

| Need | Do This |
|------|---------|
| Start all services | Windows: `START_LOCAL_DEV.bat` / macOS: `./start-local-dev.sh` |
| Start backend only | `cd neurolearn-api && npm run serve` |
| Start ML only | `cd neurolearn-ml && python main.py` |
| Start frontend only | `cd neurolearn && npm run dev` |
| Verify setup | See `VERIFICATION_CHECKLIST.md` |
| Check service status | See table above; use `curl` to test URLs |
| Debug API calls | Browser DevTools → Network tab |
| Debug ML analysis | Check `neurolearn-ml` terminal output |
| Deploy later | Instructions in each folder's README.md |

---

**Status:** ✅ Ready for local testing  
**Next Action:** Run `QUICK_START.md` steps or execute `START_LOCAL_DEV.bat`
