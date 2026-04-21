import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, getUserRole } from '../lib/auth.js';
import { generateWeeklyReport } from '../lib/genAI.js';
import { FieldValue } from 'firebase-admin/firestore';

const DEFAULT_PROFILE = {
  writingMotor: 0.5,
  reversalRisk: 0.5,
  letterConsistency: 0.5,
  strokeConfidence: 0.5,
};

function toIsoDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return null;
}

function mapReportDoc(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    reportId: doc.id,
    ...data,
    generatedAtISO: data.generatedAtISO || toIsoDate(data.generatedAt),
  };
}

function asDate(value) {
  if (!value) return new Date(0);
  if (value?.toDate) return value.toDate();
  return new Date(value);
}

function clamp01(value, fallback = 0.5) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(1, Math.max(0, num));
}

function normalizeProfile(profile = {}) {
  if (!profile || typeof profile !== 'object') return { ...DEFAULT_PROFILE };
  return {
    writingMotor: clamp01(profile.writingMotor),
    reversalRisk: clamp01(profile.reversalRisk),
    letterConsistency: clamp01(profile.letterConsistency),
    strokeConfidence: clamp01(profile.strokeConfidence),
  };
}

function normalizeLetter(value) {
  const raw = String(value || '').trim();
  if (!raw) return '?';
  return raw[0].toUpperCase();
}

function metricScores(profile) {
  return [
    ['writing strength', clamp01(profile.writingMotor)],
    ['letter consistency', clamp01(profile.letterConsistency)],
    ['pen confidence', clamp01(profile.strokeConfidence)],
    ['letter accuracy', clamp01(1 - clamp01(profile.reversalRisk))],
  ];
}

function getWeakestMetric(profile) {
  return metricScores(profile).sort((a, b) => a[1] - b[1])[0];
}

function getStrongestMetric(profile) {
  return metricScores(profile).sort((a, b) => b[1] - a[1])[0];
}

function averageProfile(items = []) {
  if (!items.length) return { ...DEFAULT_PROFILE };
  const sum = items.reduce((acc, item) => {
    acc.writingMotor += clamp01(item.writingMotor);
    acc.reversalRisk += clamp01(item.reversalRisk);
    acc.letterConsistency += clamp01(item.letterConsistency);
    acc.strokeConfidence += clamp01(item.strokeConfidence);
    return acc;
  }, { writingMotor: 0, reversalRisk: 0, letterConsistency: 0, strokeConfidence: 0 });

  return {
    writingMotor: sum.writingMotor / items.length,
    reversalRisk: sum.reversalRisk / items.length,
    letterConsistency: sum.letterConsistency / items.length,
    strokeConfidence: sum.strokeConfidence / items.length,
  };
}

function extractActivitiesFromNarrative(text = '') {
  const lines = String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const list = lines
    .filter((line) => /^([0-9]+\.|-|\*)\s+/.test(line))
    .map((line) => line.replace(/^([0-9]+\.|-|\*)\s+/, '').trim())
    .filter((line) => line.length > 8)
    .slice(0, 3);

  if (list.length) return list;

  return String(text || '')
    .split(/\d+[\.)]\s+/)
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 8)
    .slice(0, 3);
}

function buildLetterBreakdown(results = []) {
  const letterMap = results.reduce((acc, item) => {
    const letter = normalizeLetter(item.letter);
    if (!acc[letter]) {
      acc[letter] = { count: 0, reversalRiskTotal: 0, formTotal: 0 };
    }
    acc[letter].count += 1;
    acc[letter].reversalRiskTotal += clamp01(item.cognitiveProfile?.reversalRisk, clamp01(item.scores?.overallRisk, 0.5));
    acc[letter].formTotal += Number(item.scores?.letterFormScore || 0);
    return acc;
  }, {});

  return Object.entries(letterMap)
    .map(([letter, data]) => ({
      letter,
      count: data.count,
      reversalRisk: data.reversalRiskTotal / Math.max(data.count, 1),
      letterForm: data.formTotal / Math.max(data.count, 1),
    }))
    .sort((a, b) => b.reversalRisk - a.reversalRisk);
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

    const { studentId, weekStartDate, forceRegenerate = false } = req.body;
    if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

    const guardianSnap = await adminDb.collection('users').doc(decoded.uid).get();
    const guardianData = guardianSnap.exists ? (guardianSnap.data() || {}) : {};
    const linkedStudentIds = guardianData.linkedStudentIds || [];
    if (!linkedStudentIds.includes(studentId)) {
      return res.status(403).json({ error: 'Guardian not linked to this student' });
    }

    const studentSnap = await adminDb.collection('users').doc(studentId).get();
    const studentName = studentSnap.exists ? (studentSnap.data()?.displayName || 'your child') : 'your child';

    // Fetch last 7 days of analysis results
    const weekStart = weekStartDate ? new Date(weekStartDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekKey = weekStart.toISOString().split('T')[0];

    if (!forceRegenerate) {
      // Single-field query + in-memory filter avoids requiring a composite index.
      const existingSnap = await adminDb.collection('reports')
        .where('studentId', '==', studentId)
        .get();

      const existing = existingSnap.docs
        .map(mapReportDoc)
        .filter((r) => r.guardianId === decoded.uid && r.weekStartDate === weekKey)
        .sort((a, b) => asDate(b.generatedAtISO || b.generatedAt) - asDate(a.generatedAtISO || a.generatedAt));

      if (existing.length > 0) {
        return res.status(200).json(existing[0]);
      }
    }

    const analysisSnap = await adminDb.collection('analysisResults')
      .where('studentId', '==', studentId)
      .get();
    const analysisResults = analysisSnap.docs
      .map((d) => {
        const data = d.data() || {};
        return {
          ...data,
          letter: normalizeLetter(data.letter),
          cognitiveProfile: normalizeProfile(data.cognitiveProfile),
        };
      })
      .filter((r) => asDate(r.analyzedAt) >= weekStart)
      .sort((a, b) => asDate(b.analyzedAt) - asDate(a.analyzedAt));

    const sessionsSnap = await adminDb.collection('sessions')
      .where('studentId', '==', studentId)
      .get();
    const sessions = sessionsSnap.docs
      .map(d => d.data())
      .filter((s) => asDate(s.startedAt) >= weekStart)
      .sort((a, b) => asDate(b.startedAt) - asDate(a.startedAt));

    // Prepare data for Gemini
    const avgScore = analysisResults.length > 0 
      ? analysisResults.reduce((sum, r) => sum + (100 - (r.scores?.overallRisk || 0) * 100), 0) / analysisResults.length 
      : 80; // default passing if no data

    const weeklyProfiles = analysisResults.map((row) => normalizeProfile(row.cognitiveProfile));
    const overallProfile = averageProfile(weeklyProfiles);
    const weakest = getWeakestMetric(overallProfile);
    const strongest = getStrongestMetric(overallProfile);

    const topIndicators = analysisResults
      .flatMap((r) => r.indicators?.reversals?.map((rev) => rev?.char || rev?.type || 'reversal marker') || [])
      .filter(Boolean)
      .slice(0, 5);

    const letterBreakdown = buildLetterBreakdown(analysisResults);
    const highestPressureLetters = letterBreakdown
      .slice(0, 3)
      .map((item) => `${item.letter} (${Math.round(item.reversalRisk * 100)}%)`);

    const recentInterpretations = analysisResults
      .map((result) => String(result.geminiInterpretation || '').trim())
      .filter(Boolean)
      .slice(0, 2);

    const practicedLetters = [...new Set(analysisResults.map((row) => normalizeLetter(row.letter)).filter((letter) => letter !== '?'))]
      .slice(0, 8);

    const weekData = {
      childName: studentName,
      sessionsCompleted: sessions.length,
      avgScore: Math.round(avgScore),
      topIndicators: topIndicators.length > 0 ? topIndicators : null,
      strongestMetric: strongest,
      weakestMetric: weakest,
      highestPressureLetters,
      practicedLetters,
      recentInterpretations,
    };

    let narrative;
    try {
      narrative = await generateWeeklyReport(weekData);
    } catch (aiError) {
      console.error('Gemini API error:', aiError.message);
      // Fallback narrative
      narrative = `This week, ${studentName} participated in writing exercises and showed continued engagement with the platform. We're collecting more data to provide detailed insights.\n\nAs your child continues to practice, we'll be able to identify specific areas for improvement and track progress more accurately.\n\nHere are some activities to try at home: 1) Practice tracing letters with a finger in sand, 2) Read together for 10 minutes using a ruler to track lines, 3) Play letter-matching games with flashcards.`;
    }

    const activities = extractActivitiesFromNarrative(narrative);

    const handwritingHighlights = analysisResults.length > 0
      ? [
          `${analysisResults.length} handwriting sample${analysisResults.length === 1 ? '' : 's'} analysed this week.`,
          `Strongest area: ${strongest[0]} (${Math.round(strongest[1] * 100)}%).`,
          `Main support focus: ${weakest[0]} (${Math.round(weakest[1] * 100)}%).`,
          highestPressureLetters.length > 0 ? `Most challenging letters: ${highestPressureLetters.join(', ')}.` : null,
        ]
          .filter(Boolean)
          .join(' ')
      : 'No new handwriting samples this week.';

    // Save report to Firestore
    const reportPayload = {
      studentId,
      guardianId: decoded.uid,
      generatedAt: FieldValue.serverTimestamp(),
      weekStartDate: weekKey,
      narrativeSummary: narrative,
      handwritingHighlights,
      recommendedActivities: activities,
    };
    const reportRef = await adminDb.collection('reports').add(reportPayload);
    const savedReport = await reportRef.get();

    const response = mapReportDoc(savedReport);
    response.handwritingHighlights = handwritingHighlights;
    response.recommendedActivities = activities;

    return res.status(200).json(response);
  } catch (error) {
    console.error('generate-report error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
