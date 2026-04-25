import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, getUserRole } from '../lib/auth.js';
import { generateWeeklyReport } from '../lib/genAI.js';

function clamp01(v, fb = 0) {
  const n = Number(v);
  return Number.isNaN(n) ? fb : Math.min(1, Math.max(0, n));
}

function normalizeLetter(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw[0].toUpperCase();
}

function asDate(value) {
  if (!value) return new Date(0);
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const role = await getUserRole(decoded.uid);
    if (role !== 'guardian') return res.status(403).json({ error: 'Guardian only' });

    const { studentId, weekStartDate } = req.body;
    if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

    // Fetch student info from users collection
    const studentSnap = await adminDb.collection('users').doc(studentId).get();
    const studentName = studentSnap.exists
      ? (studentSnap.data()?.displayName || 'your child')
      : 'your child';

    // Fetch last 7 days of analysis results
    const weekStart = weekStartDate ? new Date(weekStartDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const analysisSnap = await adminDb.collection('analysisResults')
      .where('studentId', '==', studentId)
      .where('analyzedAt', '>=', weekStart)
      .orderBy('analyzedAt', 'desc')
      .get();
    const analysisResults = analysisSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Fetch sessions
    const sessionsSnap = await adminDb.collection('sessions')
      .where('studentId', '==', studentId)
      .where('startedAt', '>=', weekStart)
      .orderBy('startedAt', 'desc')
      .get();
    const sessions = sessionsSnap.docs.map((d) => d.data());

    // ── Per-letter reversal risk ──
    const letterGroups = analysisResults.reduce((acc, r) => {
      const letter = normalizeLetter(r.letter);
      if (!letter) return acc;
      if (!acc[letter]) acc[letter] = [];
      acc[letter].push(r);
      return acc;
    }, {});

    const avgReversalRiskByLetter = {};
    const lettersTraced = Object.keys(letterGroups);
    for (const [letter, rows] of Object.entries(letterGroups)) {
      const sum = rows.reduce(
        (s, r) => s + clamp01(r.cognitiveProfile?.reversalRisk ?? (r.scores?.reversalScore ?? 0) / 100),
        0
      );
      avgReversalRiskByLetter[letter] = Math.round((sum / rows.length) * 100) / 100;
    }

    // ── Overall dimension averages ──
    const dims = ['writingMotor', 'reversalRisk', 'letterConsistency', 'strokeConfidence'];
    const dimLabels = {
      writingMotor: 'writing motor',
      reversalRisk: 'letter reversals',
      letterConsistency: 'letter consistency',
      strokeConfidence: 'stroke confidence',
    };
    const dimTotals = { writingMotor: 0, reversalRisk: 0, letterConsistency: 0, strokeConfidence: 0 };
    let dimCount = 0;
    analysisResults.forEach((r) => {
      if (r.cognitiveProfile) {
        dims.forEach((d) => { dimTotals[d] += clamp01(r.cognitiveProfile[d], 0.5); });
        dimCount++;
      }
    });
    const avgDims = dimCount > 0
      ? dims.reduce((acc, d) => { acc[d] = dimTotals[d] / dimCount; return acc; }, {})
      : null;

    const sortedDims = avgDims ? [...dims].sort((a, b) => avgDims[a] - avgDims[b]) : [];
    const weakestDimension = sortedDims[0] || null;
    const strongestDimension = sortedDims[sortedDims.length - 1] || null;

    // ── Recommended path (most frequent) ──
    const pathCounts = analysisResults.reduce((acc, r) => {
      const p = r.cognitiveProfile?.recommendedPath;
      if (p) acc[p] = (acc[p] || 0) + 1;
      return acc;
    }, {});
    const recommendedPath = Object.entries(pathCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // ── Trend (first half vs second half risk) ──
    const sortedByDate = [...analysisResults].sort((a, b) => asDate(a.analyzedAt) - asDate(b.analyzedAt));
    let trend = 'stable';
    if (sortedByDate.length >= 4) {
      const half = Math.floor(sortedByDate.length / 2);
      const avgOld = sortedByDate.slice(0, half).reduce((s, r) => s + clamp01(r.scores?.overallRisk ?? 0), 0) / half;
      const avgNew = sortedByDate.slice(half).reduce((s, r) => s + clamp01(r.scores?.overallRisk ?? 0), 0) / (sortedByDate.length - half);
      if (avgNew < avgOld - 0.05) trend = 'improving';
      else if (avgNew > avgOld + 0.05) trend = 'declining';
    }

    // ── Context snippets for Gemini ──
    const recentInterpretations = analysisResults
      .slice(0, 3)
      .map((r) => r.geminiInterpretation)
      .filter(Boolean)
      .map((t) => String(t).split('.')[0].trim());

    const topIndicators = analysisResults
      .flatMap((r) => r.indicators?.reversals?.map((rev) => `'${rev.char || r.letter}' reversal`) || [])
      .slice(0, 3);

    const avgScore = analysisResults.length > 0
      ? analysisResults.reduce((sum, r) => sum + (100 - clamp01(r.scores?.overallRisk ?? 0) * 100), 0) / analysisResults.length
      : 80;

    // ── Build rich weekData for Gemini ──
    const weekData = {
      childName: studentName,
      totalSessions: sessions.length,
      sessionsCompleted: sessions.length,
      avgScore: Math.round(avgScore),
      lettersTraced,
      avgReversalRiskByLetter,
      weakestDimension: weakestDimension ? dimLabels[weakestDimension] : null,
      strongestMetric: strongestDimension ? [dimLabels[strongestDimension], avgDims?.[strongestDimension] ?? 0.5] : null,
      weakestMetric: weakestDimension ? [dimLabels[weakestDimension], avgDims?.[weakestDimension] ?? 0.5] : null,
      recommendedPath,
      trend,
      topIndicators,
      practicedLetters: lettersTraced,
      highestPressureLetters: Object.entries(avgReversalRiskByLetter)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([l]) => l),
      recentInterpretations,
    };

    let narrative;
    try {
      narrative = await generateWeeklyReport(weekData);
    } catch (aiError) {
      console.error('Gemini API error:', aiError.message);
      const letterList = lettersTraced.join(', ') || 'various letters';
      narrative = `This week, ${studentName} traced the letter${lettersTraced.length !== 1 ? 's' : ''} ${letterList} and showed continued engagement with the platform. We're collecting more data to provide deeper insights.\n\nAs ${studentName} continues to practice, we'll be able to track progress in writing strength, letter accuracy, and stroke confidence more precisely.\n\nHere are some activities to try at home: 1) Trace the tricky letters in sand or shaving cream. 2) Read together for 10 minutes using a ruler to track lines. 3) Practice the same letter 5 times in a row slowly.`;
    }

    // Extract recommended activities from the narrative
    const activities = narrative
      .split(/\d+[\.)]\s+/)
      .slice(1)
      .map((a) => a.trim())
      .filter((a) => a.length > 10)
      .slice(0, 3);

    // Save report to Firestore
    const reportRef = await adminDb.collection('reports').add({
      studentId,
      guardianId: decoded.uid,
      generatedAt: new Date(),
      generatedAtISO: new Date().toISOString(),
      weekStartDate: weekStart.toISOString().split('T')[0],
      narrativeSummary: narrative,
      handwritingHighlights: analysisResults.length > 0
        ? `${analysisResults.length} sample${analysisResults.length !== 1 ? 's' : ''} analysed this week.`
        : 'No new samples this week.',
      recommendedActivities: activities,
      trend,
      overallProfile: avgDims ? { ...avgDims } : null,
      pdfUrl: '',
    });


    return res.status(200).json({
      reportId: reportRef.id,
      narrative,
      weekStartDate: weekStart.toISOString().split('T')[0],
      narrativeSummary: narrative,
      handwritingHighlights: `${analysisResults.length} sample${analysisResults.length !== 1 ? 's' : ''} analysed.`,
      recommendedActivities: activities,
      trend,
      overallProfile: avgDims ? { ...avgDims } : null,
    });
  } catch (error) {
    console.error('generate-report error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
