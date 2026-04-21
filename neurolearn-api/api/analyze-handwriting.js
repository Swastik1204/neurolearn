import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken } from '../lib/auth.js';
import { FieldValue } from 'firebase-admin/firestore';
import { generateHandwritingInterpretation } from '../lib/genAI.js';

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
    letterFormScore: Number(scores?.letterFormScore ?? 0),
    spacingScore: Number(scores?.spacingScore ?? 0),
    baselineScore: Number(scores?.baselineScore ?? 0),
    reversalScore: Number(scores?.reversalScore ?? 0),
    overallRisk: Number(scores?.overallRisk ?? overallRisk ?? 0),
  };
}

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(1, Math.max(0, num));
}

function normalizeLetter(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return 'unknown';
  return raw[0].toUpperCase();
}

function normalizeStrokeMetadata(strokeMetadata = {}, resolvedLetter = 'unknown') {
  const toOptionalNumber = (value) => {
    const num = Number(value);
    return Number.isNaN(num) ? undefined : num;
  };

  const pauseRatio = toOptionalNumber(strokeMetadata?.pauseRatio);
  const totalDurationMs = toOptionalNumber(strokeMetadata?.totalDurationMs ?? strokeMetadata?.totalDuration);
  const strokeCount = toOptionalNumber(strokeMetadata?.strokeCount);
  const avgStrokeSpeed = toOptionalNumber(strokeMetadata?.avgStrokeSpeed ?? strokeMetadata?.avgSpeed);
  const speedVariance = toOptionalNumber(strokeMetadata?.speedVariance);
  const hesitationBeforeStart = toOptionalNumber(strokeMetadata?.hesitationBeforeStart);

  return {
    ...strokeMetadata,
    currentLetter: normalizeLetter(strokeMetadata?.currentLetter || resolvedLetter),
    ...(pauseRatio !== undefined ? { pauseRatio } : {}),
    ...(totalDurationMs !== undefined ? { totalDurationMs } : {}),
    ...(strokeCount !== undefined ? { strokeCount } : {}),
    ...(avgStrokeSpeed !== undefined ? { avgStrokeSpeed } : {}),
    ...(speedVariance !== undefined ? { speedVariance } : {}),
    ...(hesitationBeforeStart !== undefined ? { hesitationBeforeStart } : {}),
  };
}

function computeCognitiveProfile(scores = {}, strokeMetadata = {}) {
  const letterFormScore = Number(scores?.letterFormScore ?? 0);
  const spacingScore = Number(scores?.spacingScore ?? 0);
  const baselineScore = Number(scores?.baselineScore ?? 0);
  const reversalScore = Number(scores?.reversalScore ?? 0);
  const overallRisk = clamp01(scores?.overallRisk ?? 0);

  const writingMotor = clamp01((letterFormScore + baselineScore) / 200);
  const reversalRisk = clamp01(reversalScore / 100);
  const letterConsistency = clamp01((spacingScore + baselineScore) / 200);
  const strokeConfidence = strokeMetadata?.pauseRatio !== undefined
    ? clamp01(1 - Number(strokeMetadata.pauseRatio || 0), 0.5)
    : 0.5;

  let riskBand = 'low';
  if (reversalRisk > 0.65 || overallRisk > 0.65) {
    riskBand = 'high';
  } else if (reversalRisk > 0.35 || overallRisk > 0.35) {
    riskBand = 'moderate';
  }

  let recommendedPath = 'consistency_building';
  if (reversalRisk >= writingMotor && reversalRisk >= letterConsistency && reversalRisk >= strokeConfidence) {
    recommendedPath = 'reversal_reinforcement';
  } else {
    const lowestEntry = [
      ['writingMotor', writingMotor],
      ['letterConsistency', letterConsistency],
      ['strokeConfidence', strokeConfidence],
    ].sort((a, b) => a[1] - b[1])[0];

    if (lowestEntry[0] === 'writingMotor') {
      recommendedPath = 'motor_development';
    } else if (lowestEntry[0] === 'letterConsistency') {
      recommendedPath = 'consistency_building';
    } else {
      recommendedPath = 'confidence_pacing';
    }
  }

  return {
    writingMotor,
    reversalRisk,
    letterConsistency,
    strokeConfidence,
    riskBand,
    recommendedPath,
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
      letter,
      strokeMetadata,
    } = req.body;

    if (!sampleId || !imageBase64 || !studentId) {
      return res.status(400).json({ error: 'Missing required fields: sampleId, imageBase64, studentId' });
    }

    const resolvedLetter = normalizeLetter(letter || strokeMetadata?.currentLetter);
    const normalizedStrokeMetadata = normalizeStrokeMetadata(strokeMetadata || {}, resolvedLetter);
    const mlLetter = resolvedLetter === 'unknown' ? '' : resolvedLetter.toLowerCase();

    // Update sample status to processing and store imageBase64
    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'processing',
      imageBase64,
      letter: resolvedLetter,
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
            letter: mlLetter,
            sample_id: sampleId,
            student_id: studentId,
            stroke_metadata: normalizedStrokeMetadata,
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

      return res.status(202).json({
        sampleId,
        letter: resolvedLetter,
        risk_level: 'pending',
        overall_risk: 0,
        letter_specific: { note: 'Analysis in progress...' },
      });
    }

    const normalizedScores = normalizeScores(mlData.scores, mlData.overall_risk || 0);
    const cognitiveProfile = computeCognitiveProfile(normalizedScores, normalizedStrokeMetadata);
    const analysisDoc = {
      sampleId,
      studentId,
      letter: resolvedLetter,
      analyzedAt: FieldValue.serverTimestamp(),
      scores: normalizedScores,
      indicators: mlData.indicators || { reversals: [] },
      letterSpecific: mlData.letter_specific || {},
      riskLevel: mlData.risk_level || 'low',
      cognitiveProfile,
      geminiInterpretation: null,
    };

    const resultRef = await adminDb.collection('analysisResults').add(analysisDoc);

    let geminiInterpretation = null;
    try {
      const studentSnap = await adminDb.collection('users').doc(studentId).get();
      const studentName = studentSnap.exists
        ? (studentSnap.data()?.displayName || 'the student')
        : 'the student';

      geminiInterpretation = await generateHandwritingInterpretation({
        letter: resolvedLetter,
        scores: normalizedScores,
        letter_specific: analysisDoc.letterSpecific,
        studentName,
      });

      await resultRef.update({ geminiInterpretation });
    } catch (geminiError) {
      console.error('Inline Gemini interpretation failed:', geminiError.message);
    }

    await adminDb.collection('handwritingSamples').doc(sampleId).update({
      analysisStatus: 'complete',
      letter: resolvedLetter,
      analysisResult: {
        resultId: resultRef.id,
        letter: resolvedLetter,
        scores: analysisDoc.scores,
        indicators: analysisDoc.indicators,
        letterSpecific: analysisDoc.letterSpecific,
        riskLevel: analysisDoc.riskLevel,
        cognitiveProfile,
        geminiInterpretation,
      },
    });

    return res.status(200).json({
      sample_id: sampleId,
      student_id: studentId,
      letter: resolvedLetter,
      scores: normalizedScores,
      indicators: analysisDoc.indicators,
      letter_specific: analysisDoc.letterSpecific,
      risk_level: analysisDoc.riskLevel,
      cognitive_profile: cognitiveProfile,
      cognitiveProfile,
      gemini_interpretation: geminiInterpretation,
      geminiInterpretation,
      result_id: resultRef.id,
    });
  } catch (error) {
    console.error('analyze-handwriting error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
