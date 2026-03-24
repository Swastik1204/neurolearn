# NeuroLearn — Project Setup Guide

Welcome to NeuroLearn! This project consists of three main modules that work together to provide a comprehensive dyslexia screening and support platform.

## Project Structure
- **/neurolearn**: The main frontend application (React + Vite + Firebase).
- **/neurolearn-api**: The backend service (Vercel Serverless Functions + Firebase Admin).
- **/neurolearn-ml**: The machine learning service (FastAPI + Python + Scikit-Learn).

---

## 1. Prerequisites
Before you begin, ensure you have the following installed:
- **Node.js**: v18 or later ([download](https://nodejs.org/))
- **Python**: v3.9 or later ([download](https://www.python.org/))
- **Git**: Latest version
- **Firebase CLI**: `npm install -g firebase-tools`
- **Vercel CLI**: `npm install -g vercel`

---

## 2. Machine Learning Service Setup (`/neurolearn-ml`)
This service handles the forensic analysis of handwriting samples.

1. **Navigate to the directory**:
   ```bash
   cd neurolearn-ml
   ```
2. **Setup Virtual Environment (Recommended)**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
4. **Firebase Service Account**:
   - Obtain a Service Account JSON file from the Firebase Console (Project Settings > Service Accounts).
   - Save it as `firebase_service_account.json` inside the `neurolearn-ml` folder.
5. **Run the Service**:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

---

## 3. Backend API Setup (`/neurolearn-api`)
This service handles lesson generation and acts as an orchestrator.

1. **Navigate to the directory**:
   ```bash
   cd neurolearn-api
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment Variables**:
   - Create a `.env.local` file with the following:
   ```env
   FIREBASE_SERVICE_ACCOUNT_JSON='{"your": "service_account_json_here"}'
   GOOGLE_GENAI_API_KEY=your_google_gemini_key
   ML_SERVICE_URL=http://localhost:8000
   ML_WEBHOOK_SECRET=your_random_secret_string
   ```
4. **Run the Service**:
   ```bash
   vercel dev
   ```

---

## 4. Frontend Application Setup (`/neurolearn`)
The user-facing dashboard for Students, Guardians, and Teachers.

1. **Navigate to the directory**:
   ```bash
   cd neurolearn
   ```
2. **Install Dependencies**:
   ```bash
   npm install
   ```
3. **Environment Variables**:
   - Create a `.env.local` file (copy from `.env.example` if available):
   ```env
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   VITE_GENAI_API_KEY=...
   VITE_VERCEL_API_URL=http://localhost:3000
   ```
4. **Build and Run**:
   ```bash
   npm run dev
   ```

---

## 5. Firebase Configuration
To get features like Auth, Firestore, and Storage working:
1. **Enable Services**: In the Firebase Console, enable Authentication (Email/Password & Google), Firestore Database, and Storage.
2. **Deploy Rules**:
   ```bash
   cd neurolearn
   firebase deploy --only firestore:rules
   ```
3. **CORS for Storage** (Required for ML service downloads):
   - You must set CORS on your Firebase Storage bucket. See the `set_cors.py` utility in `neurolearn-ml` (if available) or use the `gsutil` command.

---

## Running Everything Together
For full functionality in local development, you should have three terminal windows running:
1. `uvicorn main:app` (ML Service)
2. `vercel dev` (API Service)
3. `npm run dev` (Frontend App)

Happy Coding!
