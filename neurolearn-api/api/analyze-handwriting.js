import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, auditLog } from '../lib/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
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
    console.log('[analyze-handwriting] Received request for student:', studentId);
    console.log('[analyze-handwriting] imageBase64 length:', imageBase64?.length);
    const mlServiceUrl = process.env.ML_SERVICE_URL;
    console.log('[analyze-handwriting] ML_SERVICE_URL:', mlServiceUrl);

    await adminDb.collection('handwritingSamples').doc(sampleId).set({
      studentId,
      sessionId: req.body.sessionId || 'unknown_session',
      imageBase64,
      letter: req.body.strokeMetadata?.currentLetter || 'unknown',
      exerciseType: req.body.strokeMetadata?.exerciseType || 'single_letter',
      analysisStatus: 'processing',
      createdAt: new Date().toISOString()
    }, { merge: true });

    // Step 5.2: Ensure session exists
    const sessionId = req.body.sessionId || 'session_' + Date.now();
    await adminDb.collection('sessions').doc(sessionId).set({
      studentId,
      startedAt: req.body.strokeMetadata?.startedAt || new Date().toISOString(),
      exerciseType: req.body.strokeMetadata?.exerciseType || 'single_letter',
      letter: req.body.strokeMetadata?.currentLetter
    }, { merge: true });

    // Step 5.3: Audit Log
    await adminDb.collection('auditLog').add({
      action: 'handwriting_submitted',
      studentId,
      sampleId,
      timestamp: new Date().toISOString()
    });

    // Enqueue analysis task 
    if (!mlServiceUrl) {
      console.log('[analyze-handwriting] No ML_SERVICE_URL — writing pending result');
      await adminDb.collection('analysisResults').add({
        sampleId,
        studentId,
        letter: req.body.strokeMetadata?.currentLetter || 'unknown',
        analysisStatus: 'pending',
        scores: {
          letterFormScore: 0,
          spacingScore: 0,
          baselineScore: 0,
          reversalScore: 0,
          overallRisk: 0
        },
        letter_specific: {},
        geminiInterpretation: null,
        createdAt: new Date().toISOString()
      });
      return res.status(200).json({ 
        status: 'queued',
        message: 'ML service not available, result pending'
      });
    }

    console.log('[analyze-handwriting] Forwarding to ML service...');
    // (Existing ML call logic would go here if it was present, but it was removed in previous step.
    // I'll add the basic fetch call back if the URL exists)
    try {
      const response = await fetch(`${mlServiceUrl}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': process.env.ML_WEBHOOK_SECRET
        },
        body: JSON.stringify({
          sample_id: sampleId,
          image_base64: imageBase64,
          letter: req.body.strokeMetadata?.currentLetter || 'unknown'
        })
      });
      console.log('[analyze-handwriting] ML service response status:', response.status);
    } catch (err) {
      console.error('[analyze-handwriting] Forwarding failed:', err.message);
    }

    return res.status(200).json({ queued: true, sampleId });
  } catch (error) {
    console.error('analyze-handwriting error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
