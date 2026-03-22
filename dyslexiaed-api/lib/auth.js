import { adminAuth, adminDb } from './firebaseAdmin.js';

/**
 * Verify Firebase ID token from Authorization header.
 * Returns the decoded token or null if invalid.
 */
export async function verifyToken(req) {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.split('Bearer ')[1];
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

/**
 * Get user role from Firestore.
 */
export async function getUserRole(uid) {
  const userDoc = await adminDb.collection('users').doc(uid).get();
  return userDoc.exists ? userDoc.data().role : null;
}

/**
 * Verify the request is from the ML service (shared secret).
 */
export function verifyMLSecret(req) {
  const secret = req.headers['x-ml-secret'];
  return secret && secret === process.env.ML_WEBHOOK_SECRET;
}

/**
 * Write an audit log entry.
 */
export async function auditLog(action, { requestedBy, studentId, metadata = {} }) {
  await adminDb.collection('auditLog').add({
    action,
    requestedBy,
    studentId,
    metadata,
    timestamp: new Date(),
  });
}
