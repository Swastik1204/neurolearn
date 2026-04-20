import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, getUserRole } from '../lib/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const role = await getUserRole(decoded.uid);
    if (!['guardian', 'teacher'].includes(role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (role === 'teacher') {
      const studentsSnap = await adminDb.collection('users')
        .where('role', '==', 'student')
        .get();

      const students = studentsSnap.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      return res.status(200).json({ students });
    }

    const guardianSnap = await adminDb.collection('users').doc(decoded.uid).get();
    if (!guardianSnap.exists) {
      return res.status(404).json({ error: 'Guardian profile not found' });
    }

    const guardianData = guardianSnap.data() || {};
    const linkedStudentIds = Array.isArray(guardianData.linkedStudentIds)
      ? guardianData.linkedStudentIds
      : [];

    const students = [];
    for (const studentId of linkedStudentIds) {
      const studentSnap = await adminDb.collection('users').doc(studentId).get();
      if (studentSnap.exists) {
        students.push({ id: studentSnap.id, ...studentSnap.data() });
      }
    }

    return res.status(200).json({ students, linkedStudentIds });
  } catch (error) {
    console.error('linked-students error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}