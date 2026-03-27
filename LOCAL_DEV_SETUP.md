# NeuroLearn Local Development Setup

All services configured to run locally on your machine before pushing to GitHub or deploying to production.

## Architecture (Local)

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                    │
│  Port: 5173 (dev) or 3000 (preview)                        │
│  API Base: http://localhost:3000                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  Backend API (Vercel Functions via Vercel CLI)             │
│  Port: 3000                                                 │
│  ML Service: http://localhost:8000                          │
│  Firebase: neurolearn-tutor-app (remote, via admin SDK)    │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   [Firestore]   [ML Service]   [Gen AI]
   (Remote)      (Local 8000)   (Remote)
```

## Prerequisites

- Node.js 18+ (frontend + backend)
- Python 3.9+ (ML service)
- Firebase CLI (`npm install -g firebase-tools`)
- Vercel CLI (`npm install -g vercel`)

## Step 1: Start Backend API (Vercel Local Dev)

```bash
cd neurolearn-api
npm run serve
# Listens on http://localhost:3000
```

The API will automatically proxy requests to:
- Local ML service at http://127.0.0.1:8000
- Remote Firebase Firestore
- Remote Google Generative AI

## Step 2: Start ML Service (Python FastAPI)

In a new terminal:

```bash
cd neurolearn-ml
pip install -r requirements.txt
python main.py
# Listens on http://127.0.0.1:8000
```

The ML service will:
- Accept handwriting images at POST /analyze
- Return dyslexia risk scores
- Post results back to http://127.0.0.1:3000/api/webhook/ml-result (backend)

## Step 3: Start Frontend Dev Server

In a new terminal:

```bash
cd neurolearn
npm install
npm run dev
# Listens on http://localhost:5173
```

Open http://localhost:5173 in your browser.

## Configuration

### Frontend (neurolearn/.env.local)
```
VITE_FIREBASE_API_KEY=... (set)
VITE_FIREBASE_PROJECT_ID=neurolearn-tutor-app
VITE_VERCEL_API_URL=http://127.0.0.1:3000
VITE_GENAI_API_KEY=... (set)
```

### Backend (neurolearn-api/.env.local)
```
FIREBASE_SERVICE_ACCOUNT_JSON=... (Firebase admin SDK credentials)
ML_SERVICE_URL=http://127.0.0.1:8000
ML_WEBHOOK_SECRET=... (set)
DEV_MODE=true
LOCAL_API_URL=http://127.0.0.1:3000
```

### ML Service (neurolearn-ml/.env)
```
VERCEL_WEBHOOK_URL=http://127.0.0.1:3000/api/webhook/ml-result
ML_WEBHOOK_SECRET=... (must match backend)
```

## Testing the Flow

1. Go to http://localhost:5173
2. Sign up / log in
3. Student: Click "Start Exercise" → trace a letter → submit
   - Frontend calls API at http://localhost:3000
   - Backend receives image, forwards to ML service at http://localhost:8000
   - ML service analyzes and posts results back to backend webhook
   - Backend stores analysisResults in Firebase
4. Check browser console for any errors
5. Check ML service terminal for analysis logs

## Troubleshooting

### Frontend can't reach backend
- Verify backend is running: `curl http://localhost:3000/api` (should return 404 or error, not connection refused)
- Check VITE_VERCEL_API_URL in neurolearn/.env.local

### Backend can't reach ML service
- Verify ML is running: `curl http://localhost:8000/docs` (should show Swagger UI)
- Check ML_SERVICE_URL in neurolearn-api/.env.local

### ML service crashes
- Check requirements.txt is installed: `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.9+)
- Look for tf-lite or cv2 build errors in terminal

### Firebase auth fails
- Verify FIREBASE_* vars in .env files match active Firebase project
- Check browser console for auth errors
- Confirm Google OAuth is configured in Firebase Console

## Next Steps (when ready to deploy)

1. Push to GitHub: `git add . && git commit -m "local dev setup complete"`
2. Deploy backend: `cd neurolearn-api && npm run deploy`
3. Deploy frontend: `cd neurolearn && npm run deploy`
4. Update VITE_VERCEL_API_URL to production URL after deployment

## Stopping Services

- Frontend: Ctrl+C in dev terminal
- Backend: Ctrl+C in Vercel CLI terminal
- ML: Ctrl+C in Python terminal
