# Local Development Verification Checklist

Run through this checklist to verify your local setup is working correctly before testing features.

## Pre-Flight Checks

- [ ] Node.js 18+ installed: `node --version`
- [ ] Python 3.9+ installed: `python --version`
- [ ] Firebase CLI installed: `firebase --version`
- [ ] Vercel CLI installed: `vercel --version`
- [ ] All 3 `.env.local` files present:
  - [ ] `neurolearn/.env.local`
  - [ ] `neurolearn-api/.env.local`
  - [ ] `neurolearn-ml/.env`

## Dependencies Installed

- [ ] Frontend: `cd neurolearn && npm install`
- [ ] Backend: `cd neurolearn-api && npm install`
- [ ] ML: `cd neurolearn-ml && pip install -r requirements.txt`

## Services Running

### Backend API (Port 3000)
```bash
cd neurolearn-api && npm run serve
```

Verify in browser:
- [ ] `http://localhost:3000` returns a 404 or some error (not connection refused)
- [ ] Terminal shows "Ready on http://127.0.0.1:3000"

### ML Service (Port 8000)
```bash
cd neurolearn-ml && python main.py
```

Verify in browser:
- [ ] `http://localhost:8000/docs` shows Swagger UI
- [ ] Terminal shows "Uvicorn running on http://127.0.0.1:8000"

### Frontend Dev Server (Port 5173)
```bash
cd neurolearn && npm run dev
```

Verify in browser:
- [ ] `http://localhost:5173` loads the NeuroLearn app
- [ ] Terminal shows "Local: http://localhost:5173"
- [ ] Network tab shows API calls going to `http://localhost:3000/api/*`

## End-to-End Test

1. [ ] Open http://localhost:5173
2. [ ] Create a test account (sign up)
3. [ ] Navigate to Student Home
4. [ ] Click "Start Tracing Exercise"
5. [ ] Trace a letter on the canvas
6. [ ] Click "Submit"
7. [ ] Observe:
   - [ ] Canvas shows "Analysing..." spinner
   - [ ] ML service terminal shows analysis log
   - [ ] After 2-3 seconds, feedback appears (risk level)
   - [ ] Letter can advance to next one
8. [ ] Complete 3 letters
9. [ ] Navigate to Guardian dashboard
10. [ ] Check:
    - [ ] Student appears in list
    - [ ] Analysis results show up
    - [ ] Difficulty selector works
    - [ ] Report generation available (if 3+ samples)

## Database Connectivity

- [ ] Firestore is reachable from frontend (check Network tab for `/firestore.googleapis.com`)
- [ ] Student data appears in Firestore Console under `neurolearn-tutor-app`
  - Check collections: `students`, `analysisResults`, `handwritingSamples`, `sessions`

## API Endpoint Verification

Test each locally using `curl` or Postman:

### Handwriting Analysis
```bash
curl -X POST http://localhost:3000/api/analyze-handwriting \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"sampleId": "test", "imageBase64": "...", "studentId": "...", "letter": "b"}'
```
Expected: 200 with `{ risk_level: "low|medium|high", ... }`

### Student Summary
```bash
curl http://localhost:3000/api/student-summary/<studentId> \
  -H "Authorization: Bearer <token>"
```
Expected: 200 with student stats

### Generate Report
```bash
curl -X POST http://localhost:3000/api/generate-report \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"studentId": "...", "forceRegenerate": false}'
```
Expected: 200 with generated report

## Known Issues & Fixes

### ML service crashes on startup
```
Error: ImportError: cannot import name 'cv2'
```
Fix: `pip install opencv-python`

### Backend can't reach ML service
```
Error: Connection refused localhost:8000
```
Fix: Ensure ML service is running: `python neurolearn-ml/main.py`

### Frontend blank page
```
Error: CORS or 404 errors
```
Fix: Check `VITE_VERCEL_API_URL` in `neurolearn/.env.local` is `http://127.0.0.1:3000`

### Firebase auth fails
```
Error: auth/network-request-failed
```
Fix: Check internet connection; Firebase is cloud-hosted (not local)

## Ready to Deploy?

Once all checks pass:
1. [ ] Commit changes: `git add . && git commit -m "local dev verified"`
2. [ ] Push to GitHub: `git push origin main`
3. [ ] See `neurolearn-api/README.md` for backend deployment
4. [ ] See `neurolearn/README.md` for frontend deployment
5. [ ] Update `VITE_VERCEL_API_URL` to production URL after deployment

---

**Last Updated:** March 28, 2026
**Local Dev Guides:** See `LOCAL_DEV_SETUP.md` and `QUICK_START.md`
