import { setCors } from '../../lib/cors.js';
import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyToken, getUserRole } from '../../lib/auth.js';

const DEFAULT_PROFILE = {
  writingMotor: 0.5,
  reversalRisk: 0.5,
  letterConsistency: 0.5,
  strokeConfidence: 0.5,
  riskBand: 'moderate',
  recommendedPath: 'consistency_building',
};

function asDate(value) {
  if (!value) return new Date(0);
  if (typeof value.toDate === 'function') return value.toDate();
  if (value._seconds !== undefined) return new Date(value._seconds * 1000);
  if (value.seconds !== undefined) return new Date(value.seconds * 1000);
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(1, Math.max(0, num));
}

function normalizeLetter(value) {
  const raw = String(value || '').trim();
  if (!raw) return '?';
  return raw[0].toUpperCase();
}

function profileFromScores(scores = {}) {
  const letterFormScore = Number(scores?.letterFormScore ?? 0);
  const spacingScore = Number(scores?.spacingScore ?? 0);
  const baselineScore = Number(scores?.baselineScore ?? 0);
  const reversalScore = Number(scores?.reversalScore ?? 0);
  const overallRisk = clamp01(scores?.overallRisk ?? 0);

  const writingMotor = clamp01((letterFormScore + baselineScore) / 200, 0.5);
  const reversalRisk = clamp01(reversalScore / 100, 0.5);
  const letterConsistency = clamp01((spacingScore + baselineScore) / 200, 0.5);
  const strokeConfidence = 0.5;

  let riskBand = 'low';
  if (reversalRisk > 0.65 || overallRisk > 0.65) riskBand = 'high';
  else if (reversalRisk > 0.35 || overallRisk > 0.35) riskBand = 'moderate';

  let recommendedPath = 'consistency_building';
  if (
    reversalRisk >= writingMotor &&
    reversalRisk >= letterConsistency &&
    reversalRisk >= strokeConfidence
  ) {
    recommendedPath = 'reversal_reinforcement';
  } else {
    const lowest = [
      ['writingMotor', writingMotor],
      ['letterConsistency', letterConsistency],
      ['strokeConfidence', strokeConfidence],
    ].sort((a, b) => a[1] - b[1])[0][0];

    if (lowest === 'writingMotor') recommendedPath = 'motor_development';
    else if (lowest === 'strokeConfidence') recommendedPath = 'confidence_pacing';
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

function normalizeProfile(profile = {}, fallbackScores = {}) {
  if (!profile || typeof profile !== 'object') {
    return profileFromScores(fallbackScores);
  }

  return {
    writingMotor: clamp01(profile?.writingMotor, 0.5),
    reversalRisk: clamp01(profile?.reversalRisk, 0.5),
    letterConsistency: clamp01(profile?.letterConsistency, 0.5),
    strokeConfidence: clamp01(profile?.strokeConfidence, 0.5),
    riskBand: String(profile?.riskBand || profileFromScores(fallbackScores).riskBand),
    recommendedPath: String(profile?.recommendedPath || profileFromScores(fallbackScores).recommendedPath),
  };
}

function averageProfiles(rows = []) {
  if (!rows.length) return { ...DEFAULT_PROFILE };

  const totals = rows.reduce((acc, profile) => {
    acc.writingMotor += clamp01(profile?.writingMotor, 0.5);
    acc.reversalRisk += clamp01(profile?.reversalRisk, 0.5);
    acc.letterConsistency += clamp01(profile?.letterConsistency, 0.5);
    acc.strokeConfidence += clamp01(profile?.strokeConfidence, 0.5);
    return acc;
  }, { writingMotor: 0, reversalRisk: 0, letterConsistency: 0, strokeConfidence: 0 });

  return {
    writingMotor: totals.writingMotor / rows.length,
    reversalRisk: totals.reversalRisk / rows.length,
    letterConsistency: totals.letterConsistency / rows.length,
    strokeConfidence: totals.strokeConfidence / rows.length,
  };
}

function mapReportDoc(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    reportId: doc.id,
    ...data,
    generatedAtISO: data.generatedAtISO || (data.generatedAt ? asDate(data.generatedAt).toISOString() : null),
  };
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const role = await getUserRole(decoded.uid);
    if (!['guardian', 'teacher'].includes(role)) {
      return res.status(403).json({ error: 'Guardian or Teacher only' });
    }

    const { studentId } = req.query;
    if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

    // If guardian, verify they have access to this student
    if (role === 'guardian') {
      const userDoc = await adminDb.collection('users').doc(decoded.uid).get();
      const userData = userDoc.data() || {};
      const linkedIds = userData.linkedStudentIds || [];
      const authorized = linkedIds.includes(studentId);

      if (!authorized) {
        return res.status(403).json({ error: 'Not authorized for this student' });
      }
    }

    // Fetch analysis results (last 10)
    const analysisSnap = await adminDb.collection('analysisResults')
      .where('studentId', '==', studentId)
      .limit(20) // Get more to sort manually if needed
      .get();
    
    let analysisResults = analysisSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    analysisResults = analysisResults.map(r => ({
      ...r,
      letter: normalizeLetter(r.letter),
      riskLevel: r.riskLevel || 'low',
      geminiInterpretation: r.geminiInterpretation || null,
      scores: {
        ...r.scores,
        overallRisk: r.scores?.overallRisk ?? r.overallRisk ?? 0
      },
      cognitiveProfile: normalizeProfile(r.cognitiveProfile, r.scores || {}),
    }));

    // Sort by date
    analysisResults.sort((a, b) => {
      const dateA = a.analyzedAt?.toDate ? a.analyzedAt.toDate() : new Date(a.analyzedAt || 0);
      const dateB = b.analyzedAt?.toDate ? b.analyzedAt.toDate() : new Date(b.analyzedAt || 0);
      return dateB - dateA;
    });

    analysisResults = analysisResults.slice(0, 10);

    const sessionSnap = await adminDb.collection('sessions')
      .where('studentId', '==', studentId)
      .orderBy('startedAt', 'desc')
      .limit(20)
      .get();
    const sessions = sessionSnap.docs.map(d => {
      const raw = d.data() || {};
      return {
        id: d.id,
        ...raw,
        letters: Array.isArray(raw.letters) ? raw.letters.map(normalizeLetter) : [],
        sessionRiskBand: raw.sessionRiskBand || null,
        cognitiveProfile: raw.cognitiveProfile ? normalizeProfile(raw.cognitiveProfile) : null,
      };
    });

    const reportSnap = await adminDb.collection('reports')
      .where('studentId', '==', studentId)
      .get();
    const reports = reportSnap.docs
      .map(mapReportDoc)
      .filter((report) => !role || report.guardianId === decoded.uid || role === 'teacher')
      .sort((a, b) => asDate(b.generatedAtISO || b.generatedAt) - asDate(a.generatedAtISO || a.generatedAt))
      .slice(0, 10);

    const sampleSnap = await adminDb.collection('handwritingSamples')
      .where('studentId', '==', studentId)
      .get();
    const handwritingSamples = sampleSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

    const analysisBySampleId = analysisResults.reduce((acc, result) => {
      if (result.sampleId) {
        acc[result.sampleId] = result;
      }
      return acc;
    }, {});

    const handwritingSamplesWithAnalysis = handwritingSamples
      .map((sample) => ({
        ...sample,
        letter: normalizeLetter(sample.letter || sample.promptLetter),
        analysisResult: sample.analysisResult || analysisBySampleId[sample.id] || null,
      }))
      .sort((a, b) => asDate(b.capturedAt) - asDate(a.capturedAt))
      .slice(0, 20);

    const profileTimeline = analysisResults
      .map((result) => {
        const analyzedDate = asDate(result.analyzedAt);
        const profile = normalizeProfile(result.cognitiveProfile, result.scores || {});
        return {
          date: analyzedDate.toISOString(),
          letter: normalizeLetter(result.letter),
          writingMotor: profile.writingMotor,
          reversalRisk: profile.reversalRisk,
          letterConsistency: profile.letterConsistency,
          strokeConfidence: profile.strokeConfidence,
          riskLevel: result.riskLevel || 'low',
          timestamp: analyzedDate.getTime(),
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const allProfiles = analysisResults.map((result) => normalizeProfile(result.cognitiveProfile, result.scores || {}));
    const averaged = averageProfiles(allProfiles);
    const latestProfile = allProfiles[0] || DEFAULT_PROFILE;
    const overallProfile = {
      writingMotor: averaged.writingMotor ?? DEFAULT_PROFILE.writingMotor,
      reversalRisk: averaged.reversalRisk ?? DEFAULT_PROFILE.reversalRisk,
      letterConsistency: averaged.letterConsistency ?? DEFAULT_PROFILE.letterConsistency,
      strokeConfidence: averaged.strokeConfidence ?? DEFAULT_PROFILE.strokeConfidence,
      riskBand: latestProfile.riskBand || DEFAULT_PROFILE.riskBand,
      recommendedPath: latestProfile.recommendedPath || DEFAULT_PROFILE.recommendedPath,
    };

    const letterBreakdown = analysisResults.reduce((acc, result) => {
      const letter = normalizeLetter(result.letter);
      if (!acc[letter]) {
        acc[letter] = {
          count: 0,
          totals: {
            letterFormScore: 0,
            spacingScore: 0,
            baselineScore: 0,
            reversalScore: 0,
            overallRisk: 0,
            writingMotor: 0,
            reversalRisk: 0,
            letterConsistency: 0,
            strokeConfidence: 0,
          },
        };
      }

      const profile = normalizeProfile(result.cognitiveProfile, result.scores || {});
      const target = acc[letter];
      target.count += 1;
      target.totals.letterFormScore += Number(result.scores?.letterFormScore ?? 0);
      target.totals.spacingScore += Number(result.scores?.spacingScore ?? 0);
      target.totals.baselineScore += Number(result.scores?.baselineScore ?? 0);
      target.totals.reversalScore += Number(result.scores?.reversalScore ?? 0);
      target.totals.overallRisk += Number(result.scores?.overallRisk ?? 0);
      target.totals.writingMotor += profile.writingMotor;
      target.totals.reversalRisk += profile.reversalRisk;
      target.totals.letterConsistency += profile.letterConsistency;
      target.totals.strokeConfidence += profile.strokeConfidence;
      return acc;
    }, {});

    const reducedLetterBreakdown = Object.fromEntries(
      Object.entries(letterBreakdown).map(([letter, payload]) => {
        const count = Math.max(payload.count, 1);
        return [
          letter,
          {
            count: payload.count,
            averageScores: {
              letterFormScore: payload.totals.letterFormScore / count,
              spacingScore: payload.totals.spacingScore / count,
              baselineScore: payload.totals.baselineScore / count,
              reversalScore: payload.totals.reversalScore / count,
              overallRisk: payload.totals.overallRisk / count,
            },
            averageCognitiveProfile: {
              writingMotor: payload.totals.writingMotor / count,
              reversalRisk: payload.totals.reversalRisk / count,
              letterConsistency: payload.totals.letterConsistency / count,
              strokeConfidence: payload.totals.strokeConfidence / count,
            },
          },
        ];
      })
    );

    // Aggregate stats for dashboard
    const avgFormScore = analysisResults.length > 0
      ? analysisResults.reduce((sum, r) => sum + (r.scores?.letterFormScore || 0), 0) / analysisResults.length
      : 0;

    const totalReversals = analysisResults.reduce((sum, r) => sum + (r.indicators?.reversals?.length || 0), 0);

    // Group analysis results by date for trend chart
    const trendGroups = analysisResults.reduce((acc, result) => {
      const date = result.analyzedAt?.toDate ? result.analyzedAt.toDate() : new Date();
      const dateKey = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (!acc[dateKey]) acc[dateKey] = { sum: 0, count: 0, timestamp: date.getTime() };
      const risk = result.scores?.overallRisk ?? 0;
      acc[dateKey].sum += risk;
      acc[dateKey].count += 1;
      return acc;
    }, {});

    const trendData = Object.entries(trendGroups)
      .map(([date, data]) => ({
        week: date,
        value: Math.round((data.sum / data.count) * 100),
        timestamp: data.timestamp
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return res.status(200).json({
      studentId,
      analysisResults,
      sessions,
      reports,
      handwritingSamples: handwritingSamplesWithAnalysis,
      profileTimeline,
      overallProfile,
      letterBreakdown: reducedLetterBreakdown,
      stats: {
        consistencyScore: Math.round(avgFormScore),
        totalReversals,
        sessionsCompleted: sessions.length,
        analysisResultsCount: analysisResults.length,
        reportsCount: reports.length,
        trendData,
      }
    });
  } catch (error) {
    console.error('student-summary error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
