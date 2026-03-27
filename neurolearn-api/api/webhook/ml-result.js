import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyMLSecret } from '../../lib/auth.js';
import { generateHandwritingInterpretation } from '../../lib/genAI.js';

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

    const { sampleId, studentId, letter, scores, indicators, letterSpecific, overallRisk, riskLevel, rawFeatures } = req.body;

    if (!sampleId || !scores) {
      return res.status(400).json({ error: 'Missing required fields: sampleId, scores' });
    }

    // Write analysis result
    const resultRef = await adminDb.collection('analysisResults').add({
      sampleId,
      studentId: studentId || 'unknown',
      letter: letter || '',
      analyzedAt: new Date(),
      scores,
      indicators,
      letterSpecific: letterSpecific || {},
      overallRisk: overallRisk || 0,
      riskLevel: riskLevel || 'low',
      rawFeatures: rawFeatures || {},
      geminiInterpretation: null
    });

    // Update sample status
    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'complete',
      analysisResult: {
        resultId: resultRef.id,
        overallRisk: overallRisk || 0,
        riskLevel: riskLevel || 'low'
      },
    });

    // Generate AI interpretation asynchronously
    generateHandwritingInterpretation(studentId, req.body).then(interpretation => {
      if (interpretation) {
        adminDb.collection('analysisResults').doc(resultRef.id).update({
          geminiInterpretation: interpretation
        });
      }
    }).catch(err => console.error('Gemini interpretation failed:', err.message));

    return res.status(200).json({
      success: true,
      resultId: resultRef.id,
    });
  } catch (error) {
    console.error('ml-result webhook error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
