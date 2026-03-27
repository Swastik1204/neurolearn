# Quick Start: Run NeuroLearn Locally

## TL;DR - Get Running in 3 Steps

### 1. Start Backend API
```bash
cd neurolearn-api
npm run serve
# Listens on http://localhost:3000
```

### 2. Start ML Service (new terminal)
```bash
cd neurolearn-ml
pip install -r requirements.txt  # Run once
python main.py
# Listens on http://localhost:8000
```

### 3. Start Frontend (new terminal)
```bash
cd neurolearn
npm install  # Run once
npm run dev
# Opens http://localhost:5173 automatically
```

---

## Or Use Auto-Startup Script

**Windows:**
```bash
START_LOCAL_DEV.bat
```

**macOS/Linux:**
```bash
chmod +x start-local-dev.sh
./start-local-dev.sh
```

---

## What's Running?

| Service | Port | Purpose |
|---------|------|---------|
| Frontend (React) | 5173 | Web UI |
| Backend API | 3000 | Express/Vercel functions |
| ML Service | 8000 | Handwriting analysis |
| Firestore | Remote | Database (Firebase) |

---

## Test It

1. Open http://localhost:5173
2. Sign up with test account
3. Student: Start exercise → trace a letter → submit
4. Should analyze and store in Firestore
5. Guardian: View analytics dashboard

---

## Troubleshooting

**Frontend can't reach backend?**
```
curl http://localhost:3000  
# Should fail with a route error, not connection refused
```

**ML service won't start?**
```bash
# Check Python version
python --version  # Needs 3.9+

# Reinstall deps
pip install --upgrade -r requirements.txt
```

**Firebase auth failing?**
- Check `.env.local` files have Firebase keys
- Confirm internet connection (Firebase is cloud-hosted)

---

## When Ready to Deploy

1. **Test locally first** (you are here now)
2. **Push to GitHub:** `git add . && git commit -m "local dev working"`
3. **Deploy backend:** See `neurolearn-api/README.md`
4. **Deploy frontend:** See `neurolearn/README.md`

See `LOCAL_DEV_SETUP.md` for detailed architecture & config docs.
