import { setCors } from '../../lib/cors.js';
import { adminDb, adminAuth, adminStorage } from '../../lib/firebaseAdmin.js';
import { verifyToken, getUserRole, auditLog } from '../../lib/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { uid } = req.query;

    // Only the user themselves or a guardian of the user can delete
    if (decoded.uid !== uid) {
      const role = await getUserRole(decoded.uid);
      if (role !== 'guardian') {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    // Audit log before deletion
    await auditLog('delete_user_data', {
      requestedBy: decoded.uid,
      studentId: uid,
      metadata: { action: 'full_deletion' },
    });

    // Delete all Firestore documents for this user/student
    const collections = [
      'sessions',
      'handwritingSamples',
      'analysisResults',
      'behaviourSnapshots',
      'reports',
      'assignments',
    ];

    for (const col of collections) {
      const snap = await adminDb.collection(col).where('studentId', '==', uid).get();
      const batch = adminDb.batch();
      snap.docs.forEach(doc => batch.delete(doc.ref));
      if (snap.docs.length > 0) await batch.commit();
    }

    // Delete user document
    const userDoc = adminDb.collection('users').doc(uid);
    if ((await userDoc.get()).exists) {
      await userDoc.delete();
    }

    // Delete student document
    const studentSnap = await adminDb.collection('students').where('uid', '==', uid).get();
    const studentBatch = adminDb.batch();
    studentSnap.docs.forEach(doc => studentBatch.delete(doc.ref));
    if (studentSnap.docs.length > 0) await studentBatch.commit();

    // Delete Firebase Storage files
    try {
      const bucket = adminStorage.bucket();
      const [files] = await bucket.getFiles({ prefix: `handwriting/${uid}/` });
      await Promise.all(files.map(f => f.delete()));
    } catch (storageError) {
      console.error('Storage deletion error (non-fatal):', storageError.message);
    }

    // Delete Firebase Auth user
    try {
      await adminAuth.deleteUser(uid);
    } catch (authError) {
      console.error('Auth deletion error:', authError.message);
    }

    return res.status(200).json({ deleted: true, uid });
  } catch (error) {
    console.error('delete user error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
