import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, getUserRole } from '../lib/auth.js';

function normalize(value = '') {
  return String(value).trim().toLowerCase();
}

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

    const term = normalize(req.query.q || '');
    if (!term) {
      return res.status(400).json({ error: 'Missing search query' });
    }

    const snap = await adminDb.collection('users')
      .where('role', '==', 'student')
      .get();

    const results = snap.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
      .filter((student) => {
        const name = normalize(student.displayName);
        const email = normalize(student.email);
        return name.includes(term) || email.includes(term);
      })
      .slice(0, 20)
      .map((student) => ({
        id: student.id,
        displayName: student.displayName || 'Student',
        email: student.email || '',
      }));

    return res.status(200).json({ results });
  } catch (error) {
    console.error('search-students error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}