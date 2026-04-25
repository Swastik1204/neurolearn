import { initializeApp, cert, applicationDefault, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function parseServiceAccount(rawValue) {
  if (!rawValue) return null;

  const candidates = [
    rawValue,
    rawValue.trim().replace(/^"|"$/g, '').replace(/\\n/g, '\n').replace(/\\"/g, '"'),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object') {
        return {
          ...parsed,
          private_key: typeof parsed.private_key === 'string'
            ? parsed.private_key.replace(/\\n/g, '\n')
            : parsed.private_key,
        };
      }
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

function loadServiceAccountFromFile(filePath) {
  if (!filePath || !existsSync(filePath)) return null;

  try {
    return parseServiceAccount(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function buildCredential(serviceAccount) {
  try {
    return cert(serviceAccount);
  } catch (error) {
    console.warn('Invalid Firebase service account credentials:', error.message);
    return null;
  }
}

function getApp() {
  if (getApps().length) return getApps()[0];

  const serviceAccount =
    parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    || loadServiceAccountFromFile(process.env.FIREBASE_SERVICE_ACCOUNT_FILE)
    || loadServiceAccountFromFile(path.resolve(moduleDir, '../../neurolearn-ml/firebase_service_account.json'));

  if (serviceAccount?.project_id && serviceAccount?.client_email && serviceAccount?.private_key) {
    const credential = buildCredential(serviceAccount);
    if (credential) {
      return initializeApp({
        credential,
      });
    }
  }

  return initializeApp({
    credential: applicationDefault(),
  });
}

const app = getApp();
export const adminDb = getFirestore(app);
export const adminAuth = getAuth(app);
export const adminStorage = getStorage(app);
export default app;
