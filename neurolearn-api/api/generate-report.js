import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, getUserRole, auditLog } from '../lib/auth.js';
import { generateWeeklyReport, ensureSessionsCollectionBackend } from '../lib/genAI.js';
import { FieldValue } from 'firebase-admin/firestore';

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

    // Fetch student info
    const studentSnap = await adminDb.collection('students')
      .where('uid', '==', studentId).get();
    const studentName = studentSnap.docs[0]?.data()?.displayName || 'your child';

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
      .map(d => d.data())
      .filter((r) => asDate(r.analyzedAt) >= weekStart)
      .sort((a, b) => asDate(b.analyzedAt) - asDate(a.analyzedAt));

    // Ensure sessions collection exists then fetch sessions
    await ensureSessionsCollectionBackend(adminDb);
    const sessionsSnap = await adminDb.collection('sessions')
      .where('studentId', '==', studentId)
      .get();
    const sessions = sessionsSnap.docs
      .map(d => d.data())
      .filter((s) => asDate(s.startedAt) >= weekStart)
      .sort((a, b) => asDate(b.startedAt) - asDate(a.startedAt));

    // Fetch behaviour snapshot
    const behavSnap = await adminDb.collection('behaviourSnapshots')
      .where('studentId', '==', studentId)
      .get();
    const behaviour = behavSnap.docs
      .map((d) => d.data())
      .sort((a, b) => String(b.weekStartDate || '').localeCompare(String(a.weekStartDate || '')))[0] || {};

    // Prepare data for Gemini
    const avgScore = analysisResults.length > 0 
      ? analysisResults.reduce((sum, r) => sum + (100 - (r.scores?.overallDyslexiaRisk || 0) * 100), 0) / analysisResults.length 
      : 80; // default passing if no data
      
    const topIndicators = analysisResults
      .flatMap(r => r.indicators?.reversals?.map(rev => {
        const label = rev?.char || rev?.type || 'reversal marker';
        return `'${label}'`;
      }) || [])
      .slice(0, 3);

    const emotionCounts = analysisResults.reduce((acc, r) => {
      const key = (r.emotionAtSubmit || '').toLowerCase();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const emotionSummary = Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion, count]) => `${emotion} (${count})`)
      .join(', ');

    const weekData = {
      childName: studentName,
      sessionsCompleted: sessions.length,
      avgScore: Math.round(avgScore),
      topIndicators: topIndicators.length > 0 ? topIndicators : null,
      emotionSummary: emotionSummary || null,
    };

    let narrative;
    try {
      narrative = await generateWeeklyReport(weekData);
    } catch (aiError) {
      console.error('Gemini API error:', aiError.message);
      // Fallback narrative
      narrative = `This week, ${studentName} participated in writing exercises and showed continued engagement with the platform. We're collecting more data to provide detailed insights.\n\nAs your child continues to practice, we'll be able to identify specific areas for improvement and track progress more accurately.\n\nHere are some activities to try at home: 1) Practice tracing letters with a finger in sand, 2) Read together for 10 minutes using a ruler to track lines, 3) Play letter-matching games with flashcards.`;
    }

    // Extract recommended activities from the narrative (simple heuristic)
    const activities = narrative
      .split(/\d+[\.\)]\s+/)
      .slice(1)
      .map(a => a.trim())
      .filter(a => a.length > 10)
      .slice(0, 3);

    // Save report to Firestore
    const reportPayload = {
      studentId,
      guardianId: decoded.uid,
      generatedAt: FieldValue.serverTimestamp(),
      generatedAtISO: new Date().toISOString(),
      weekStartDate: weekKey,
      narrativeSummary: narrative,
      handwritingHighlights: analysisResults.length > 0
        ? `${analysisResults.length} samples analyzed this week.`
        : 'No new samples this week.',
      recommendedActivities: activities,
      pdfUrl: '',
    };
    const reportRef = await adminDb.collection('reports').add(reportPayload);
    const savedReport = await reportRef.get();

    await auditLog('generate_report', {
      requestedBy: decoded.uid,
      studentId,
      metadata: { reportId: reportRef.id },
    });

    return res.status(200).json(mapReportDoc(savedReport));
  } catch (error) {
    console.error('generate-report error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
