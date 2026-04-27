import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken } from '../lib/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const { sampleId, emotionAtSubmit } = req.body;
    if (!sampleId || !emotionAtSubmit) {
      return res.status(400).json({ error: 'Missing sampleId or emotionAtSubmit' });
    }

    // Update handwritingSample
    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      emotionAtSubmit
    });

    // Update analysisResult if it exists
    const analysisSnap = await adminDb.collection('analysisResults')
      .where('sampleId', '==', sampleId)
      .limit(1)
      .get();

    if (!analysisSnap.empty) {
      const resultDoc = analysisSnap.docs[0];
      await resultDoc.ref.update({
        emotionAtSubmit
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Update emotion error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
