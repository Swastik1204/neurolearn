import { setCors } from '../../lib/cors.js';
import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyMLSecret } from '../../lib/auth.js';
import { generateHandwritingInterpretation } from '../../lib/genAI.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('[webhook/ml-result] Called with method:', req.method);
  console.log('[webhook/ml-result] Secret match:',
    req.headers['x-ml-secret'] === process.env.ML_WEBHOOK_SECRET);
  console.log('[webhook/ml-result] Body keys:', Object.keys(req.body || {}));

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
    const docRef = await adminDb.collection('analysisResults').add({
      sampleId,
      studentId,
      letter: letter || '',
      analyzedAt: new Date(),
      createdAt: new Date().toISOString(), // Step 5 requirement
      scores: {
        letterFormScore: scores.letterFormScore || 0,
        spacingScore: scores.spacingScore || 0,
        baselineScore: scores.baselineScore || 0,
        reversalScore: scores.reversalScore || 0,
        overallRisk: scores.overallRisk || 0, // Step 5 requirement
        overallDyslexiaRisk: scores.overallRisk || 0, // Keep for dashboard compatibility
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
    console.log('[webhook/ml-result] analysisResults doc written:', docRef.id);

    // Generate AI interpretation
    let interpretation = "";
    try {
      interpretation = await generateHandwritingInterpretation({
        letter: letter || 'unknown',
        scores: scores,
        letter_specific: letter_specific,
        studentName
      });
      // Update the result doc with the interpretation
      await docRef.update({ geminiInterpretation: interpretation });
      console.log('[webhook/ml-result] Gemini interpretation generated');
    } catch (aiErr) {
      console.error('Interpretation failed:', aiErr.message);
    }

    // Update sample status
    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'complete',
      analysisResult: {
        resultId: docRef.id,
        overallRisk: scores.overallRisk || 0,
        letter: letter || '',
        aiInterpretation: interpretation
      },
    });

    return res.status(200).json({
      success: true,
      resultId: docRef.id,
    });
  } catch (error) {
    console.error('ml-result webhook error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
