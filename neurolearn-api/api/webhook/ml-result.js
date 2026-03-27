import { setCors } from '../../lib/cors.js';
import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyMLSecret } from '../../lib/auth.js';
import { FieldValue } from 'firebase-admin/firestore';

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

    const { 
      sample_id, 
      student_id, 
      letter, 
      scores, 
      indicators, 
      letter_specific, 
      overall_risk, 
      risk_level,
      rawFeatures 
    } = req.body;

    if (!sample_id || !scores) {
      return res.status(400).json({ error: 'Missing required fields: sample_id, scores' });
    }

    // Write analysis result
    // Standardize fields for Guardian Dashboard
    const normalizedScores = {
      ...scores,
      overallDyslexiaRisk: scores?.overallDyslexiaRisk || scores?.overallRisk || overall_risk || 0,
    };

    const resultData = {
      sampleId: sample_id,
      studentId: student_id,
      letter: letter || '',
      scores: normalizedScores,
      letterSpecific: letter_specific || {},
      indicators: indicators || { reversals: [] },
      overallRisk: overall_risk || 0,
      riskLevel: risk_level || 'low',
      analyzedAt: FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(), // Fallback for old code
      rawFeatures: rawFeatures || {},
      geminiInterpretation: null // filled next
    };

    const resultRef = await adminDb.collection('analysisResults').add(resultData);

    // Update sample status
    await adminDb.collection('handwritingSamples').doc(sample_id).update({
      analysisStatus: 'complete',
      analysisResult: {
        resultId: resultRef.id,
        overallRisk: overall_risk || 0,
        riskLevel: risk_level || 'low'
      },
    });

    // Trigger AI interpretation
    try {
      const { generateHandwritingInterpretation } = await import('../../lib/genAI.js');
      const interpretation = await generateHandwritingInterpretation({ letter, scores: normalizedScores, letter_specific, studentName: 'Student' });
      if (interpretation) {
        await resultRef.update({ geminiInterpretation: interpretation });
      }
    } catch (aiErr) {
      console.error('AI Interpretation failed:', aiErr.message);
    }

    return res.status(200).json({
      success: true,
      resultId: resultRef.id,
    });
  } catch (error) {
    console.error('ml-result webhook error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
