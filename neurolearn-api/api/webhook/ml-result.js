import { setCors } from '../../lib/cors.js';
import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyMLSecret } from '../../lib/auth.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify shared secret
    if (!verifyMLSecret(req)) {
      return res.status(401).json({ error: 'Invalid ML secret' });
    }

    const { sampleId, scores, indicators, rawFeatures } = req.body;

    if (!sampleId || !scores) {
      return res.status(400).json({ error: 'Missing required fields: sampleId, scores' });
    }

    // Get the sample to find the studentId
    const sampleDoc = await adminDb.collection('handwritingSamples').doc(sampleId).get();
    if (!sampleDoc.exists) {
      return res.status(404).json({ error: 'Sample not found' });
    }
    const studentId = sampleDoc.data().studentId;

    // Write analysis result
    const resultRef = await adminDb.collection('analysisResults').add({
      sampleId,
      studentId,
      analyzedAt: new Date(),
      scores: {
        letterFormScore: scores.letter_form_score || 0,
        spacingScore: scores.spacing_score || 0,
        baselineScore: scores.baseline_score || 0,
        reversalScore: scores.reversal_score || 0,
        overallDyslexiaRisk: scores.overallRisk || scores.overall_dyslexia_risk || 0,
      },
      indicators: {
        reversals: indicators?.reversals || [],
        omissions: indicators?.omissions || [],
        substitutions: indicators?.substitutions || [],
        sequencing: indicators?.sequencing_errors || [],
      },
      rawFeatures: rawFeatures || {},
    });

    // Update sample status
    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'complete',
      analysisResult: {
        resultId: resultRef.id,
        overallRisk: scores.overall_dyslexia_risk || 0,
      },
    });

    return res.status(200).json({
      success: true,
      resultId: resultRef.id,
    });
  } catch (error) {
    console.error('ml-result webhook error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
