import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    : undefined;

  return initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : undefined,
  });
}

const app = getApp();
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export default app;
