import { setCors } from '../../lib/cors.js';
import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyToken, getUserRole } from '../../lib/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { sampleId } = req.query;
    if (!sampleId) return res.status(400).json({ error: 'Missing sampleId' });

    const sampleRef = adminDb.collection('handwritingSamples').doc(sampleId);
    const sampleSnap = await sampleRef.get();
    if (!sampleSnap.exists) return res.status(404).json({ error: 'Sample not found' });

    const sampleData = sampleSnap.data();
    const studentId = sampleData.studentId;
    const role = await getUserRole(decoded.uid);

    if (!['guardian', 'teacher', 'student'].includes(role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (role === 'student' && decoded.uid !== studentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    if (role === 'guardian') {
      const guardianDoc = await adminDb.collection('users').doc(decoded.uid).get();
      const guardianData = guardianDoc.exists ? guardianDoc.data() || {} : {};
      const linkedStudentIds = guardianData.linkedStudentIds || [];
      const authorized = linkedStudentIds.includes(studentId);

      if (!authorized) {
        return res.status(403).json({ error: 'Guardian not linked to this student' });
      }
    }

    const analysisSnap = await adminDb.collection('analysisResults')
      .where('sampleId', '==', sampleId)
      .get();

    const batch = adminDb.batch();
    analysisSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(sampleRef);
    await batch.commit();

    return res.status(200).json({
      deleted: true,
      sampleId,
      deletedAnalysisCount: analysisSnap.docs.length,
    });
  } catch (error) {
    console.error('delete handwriting sample error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
