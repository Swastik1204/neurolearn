import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, auditLog } from '../lib/auth.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify auth
    const decoded = await verifyToken(req);
    if (!decoded) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { sampleId, imageBase64, studentId, strokeMetadata } = req.body;

    if (!sampleId || !imageBase64 || !studentId) {
      return res.status(400).json({ error: 'Missing required fields: sampleId, imageBase64, studentId' });
    }

    // Update sample status to processing and store imageBase64
    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'processing',
      imageBase64
    });

    // Enqueue analysis task
    const mlServiceUrl = process.env.ML_SERVICE_URL;
    if (mlServiceUrl) {
      try {
        const response = await fetch(`${mlServiceUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_base64: imageBase64,
            sample_id: sampleId,
            stroke_metadata: strokeMetadata || {},
          }),
        });

        if (!response.ok) {
          console.error('ML service returned error:', response.status);
        }
      } catch (mlError) {
        // ML service may be sleeping on free tier — mark as pending retry
        console.error('ML service unavailable:', mlError.message);
        await adminDb.collection('handwritingSamples').doc(sampleId).update({
          analysisStatus: 'pending',
        });
      }
    }

    // Audit log (no PII)
    await auditLog('analyze_handwriting', {
      requestedBy: decoded.uid,
      studentId,
      metadata: { sampleId },
    });

    return res.status(200).json({ queued: true, sampleId });
  } catch (error) {
    console.error('analyze-handwriting error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
