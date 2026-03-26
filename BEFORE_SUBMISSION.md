# Before final submission checklist

## 1. Revert Firestore rules
Replace neurolearn/firestore.rules with secure version:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && request.auth.uid == userId;
      allow delete: if false;
    }
    match /students/{studentId} {
      allow read, write: if request.auth != null;
    }
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
    }
    match /handwritingSamples/{sampleId} {
      allow read, write: if request.auth != null;
    }
    match /analysisResults/{resultId} {
      allow read, write: if request.auth != null;
    }
    match /behaviourSnapshots/{snapshotId} {
      allow read, write: if request.auth != null;
    }
    match /reports/{reportId} {
      allow read, write: if request.auth != null;
    }
    match /assignments/{assignmentId} {
      allow read, write: if request.auth != null;
    }
    match /auditLog/{logId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}

Then run: npm run deploy:rules

## 2. Verify ML_WEBHOOK_SECRET matches in both .env files
## 3. Verify VITE_GENAI_API_KEY is not expired
## 4. Start uvicorn before demo:
##    cd neurolearn-ml
##    python -m uvicorn main:app --host 0.0.0.0 --port 8000
