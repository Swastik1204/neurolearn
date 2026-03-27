import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, auditLog } from '../lib/auth.js';
import { FieldValue } from 'firebase-admin/firestore';

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    finalize: () => clearTimeout(timer),
  };
}

function normalizeScores(scores = {}, overallRisk = 0) {
  return {
    ...scores,
    overallRisk: scores?.overallRisk ?? overallRisk,
    overallDyslexiaRisk: scores?.overallDyslexiaRisk ?? scores?.overallRisk ?? overallRisk,
  };
}

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

    const {
      sampleId,
      imageBase64,
      studentId,
      strokeMetadata,
      emotionAtSubmit,
      emotionConfidence,
    } = req.body;

    if (!sampleId || !imageBase64 || !studentId) {
      return res.status(400).json({ error: 'Missing required fields: sampleId, imageBase64, studentId' });
    }

    // Update sample status to processing and store imageBase64
    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'processing',
      imageBase64,
      emotionAtSubmit: emotionAtSubmit || null,
      emotionConfidence: typeof emotionConfidence === 'number' ? emotionConfidence : null,
    });

    const configuredUrl = process.env.ML_SERVICE_URL?.trim();
    const mlUrls = ['http://127.0.0.1:8000', 'http://localhost:8000', configuredUrl]
      .filter(Boolean)
      .filter((url, idx, arr) => arr.indexOf(url) === idx);

    let mlData = null;
    let mlError = null;
    let usedMlUrl = null;

    for (const mlServiceUrl of mlUrls) {
      const timeout = withTimeout(10000);
      try {
        const response = await fetch(`${mlServiceUrl}/analyze`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'bypass-tunnel-reminder': 'true'
          },
          signal: timeout.signal,
          body: JSON.stringify({
            image_base64: imageBase64,
            letter: strokeMetadata?.currentLetter || '',
            sample_id: sampleId,
            student_id: studentId,
            stroke_metadata: strokeMetadata || {},
          }),
        });
        if (!response.ok) {
          console.error(`ML service returned error from ${mlServiceUrl}:`, response.status);
          mlError = new Error(`ML ${response.status}`);
          continue;
        }

        mlData = await response.json();
        usedMlUrl = mlServiceUrl;
        break;
      } catch (err) {
        mlError = err;
        console.error(`ML service unavailable at ${mlServiceUrl}:`, err.message);
      } finally {
        timeout.finalize();
      }
    }

    if (!mlData) {
      await adminDb.collection('handwritingSamples').doc(sampleId).update({
        analysisStatus: 'pending',
      });

      await auditLog('analyze_handwriting_pending', {
        requestedBy: decoded.uid,
        studentId,
        metadata: { sampleId, mlError: mlError?.message || 'unknown' },
      });

      return res.status(202).json({
        sampleId,
        risk_level: 'pending',
        overall_risk: 0,
        letter_specific: { note: 'Analysis in progress...' },
      });
    }

    const normalizedScores = normalizeScores(mlData.scores, mlData.overall_risk || 0);
    const analysisDoc = {
      sampleId,
      studentId,
      letter: mlData.letter || strokeMetadata?.currentLetter || '',
      analyzedAt: FieldValue.serverTimestamp(),
      createdAt: new Date().toISOString(),
      scores: normalizedScores,
      indicators: mlData.indicators || { reversals: [] },
      letterSpecific: mlData.letter_specific || {},
      overallRisk: mlData.overall_risk || normalizedScores.overallRisk || 0,
      riskLevel: mlData.risk_level || 'low',
      rawFeatures: mlData.rawFeatures || {},
      emotionAtSubmit: emotionAtSubmit || null,
      emotionConfidence: typeof emotionConfidence === 'number' ? emotionConfidence : null,
      geminiInterpretation: null,
    };

    const resultRef = await adminDb.collection('analysisResults').add(analysisDoc);

    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'complete',
      analysisResult: {
        resultId: resultRef.id,
        overallRisk: analysisDoc.overallRisk,
        riskLevel: analysisDoc.riskLevel,
      },
    });

    // Audit log (no PII)
    await auditLog('analyze_handwriting', {
      requestedBy: decoded.uid,
      studentId,
      metadata: { sampleId, resultId: resultRef.id, mlUrl: usedMlUrl },
    });

    return res.status(200).json({
      sample_id: sampleId,
      student_id: studentId,
      letter: analysisDoc.letter,
      scores: normalizedScores,
      indicators: analysisDoc.indicators,
      letter_specific: analysisDoc.letterSpecific,
      overall_risk: analysisDoc.overallRisk,
      risk_level: analysisDoc.riskLevel,
      emotion_at_submit: analysisDoc.emotionAtSubmit,
      emotion_confidence: analysisDoc.emotionConfidence,
      result_id: resultRef.id,
    });
  } catch (error) {
    console.error('analyze-handwriting error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
