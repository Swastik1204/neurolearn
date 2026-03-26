import { setCors } from '../../lib/cors.js';
import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyMLSecret } from '../../lib/auth.js';
import { generateHandwritingInterpretation } from '../../lib/genAI.js';

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
    // Verify shared secret
    if (!verifyMLSecret(req)) {
      return res.status(401).json({ error: 'Invalid ML secret' });
    }

    const { sampleId, letter, scores, indicators, letter_specific, rawFeatures } = req.body;

    if (!sampleId || !scores) {
      return res.status(400).json({ error: 'Missing required fields: sampleId, scores' });
    }

    // Get the sample to find the studentId
    const sampleDoc = await adminDb.collection('handwritingSamples').doc(sampleId).get();
    if (!sampleDoc.exists) {
      return res.status(404).json({ error: 'Sample not found' });
    }
    const studentId = sampleDoc.data().studentId;

    // Fetch student info for Gemini context
    const studentUserSnap = await adminDb.collection('users').doc(studentId).get();
    const studentName = studentUserSnap.exists ? (studentUserSnap.data().displayName || 'Student') : 'Student';

    // Write analysis result
    const resultRef = await adminDb.collection('analysisResults').add({
      sampleId,
      studentId,
      letter: letter || '',
      analyzedAt: new Date(),
      scores: {
        letterFormScore: scores.letterFormScore || 0,
        spacingScore: scores.spacingScore || 0,
        baselineScore: scores.baselineScore || 0,
        reversalScore: scores.reversalScore || 0,
        overallDyslexiaRisk: scores.overallRisk || 0,
      },
      indicators: {
        reversals: indicators?.reversals || [],
        omissions: indicators?.omissions || [],
        substitutions: indicators?.substitutions || [],
        sequencing: indicators?.sequencing_errors || [],
      },
      letter_specific: letter_specific || {},
      rawFeatures: rawFeatures || {},
    });

    // Generate AI interpretation (non-blocking for the immediate 200 response if possible, but we'll do it here for stability)
    let aiInterpretation = "";
    try {
      aiInterpretation = await generateHandwritingInterpretation({
        letter: letter || 'unknown',
        scores: scores,
        letter_specific: letter_specific,
        studentName
      });
      // Update the result doc with the interpretation
      await resultRef.update({ geminiInterpretation: aiInterpretation });
    } catch (aiErr) {
      console.error('Interpretation failed:', aiErr.message);
    }

    // Update sample status
    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'complete',
      analysisResult: {
        resultId: resultRef.id,
        overallRisk: scores.overallRisk || 0,
        letter: letter || '',
        aiInterpretation: aiInterpretation
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
