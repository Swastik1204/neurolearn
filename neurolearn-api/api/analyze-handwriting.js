import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, auditLog } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://neurolearn-tutor-app.web.app');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-ML-Secret');
    return res.status(200).end();
  }
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
    // NOTE: ML_SERVICE_URL was removed as per cleanup request. 
    // Analysis is now primarily handled via stored Base64 for async processing.

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
