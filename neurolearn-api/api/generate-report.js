import { setCors } from '../lib/cors.js';
import { adminDb } from '../lib/firebaseAdmin.js';
import { verifyToken, getUserRole, auditLog } from '../lib/auth.js';
import { generateWeeklyReport } from '../lib/genAI.js';

export default async function handler(req, res) {
  setCors(res);
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

    // Fetch student info
    const studentSnap = await adminDb.collection('students')
      .where('uid', '==', studentId).get();
    const studentName = studentSnap.docs[0]?.data()?.displayName || 'your child';

    // Fetch last 7 days of analysis results
    const weekStart = weekStartDate ? new Date(weekStartDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const analysisSnap = await adminDb.collection('analysisResults')
      .where('studentId', '==', studentId)
      .where('analyzedAt', '>=', weekStart)
      .orderBy('analyzedAt', 'desc')
      .get();
    const analysisResults = analysisSnap.docs.map(d => d.data());

    // Fetch sessions
    const sessionsSnap = await adminDb.collection('sessions')
      .where('studentId', '==', studentId)
      .where('startedAt', '>=', weekStart)
      .orderBy('startedAt', 'desc')
      .get();
    const sessions = sessionsSnap.docs.map(d => d.data());

    // Fetch behaviour snapshot
    const behavSnap = await adminDb.collection('behaviourSnapshots')
      .where('studentId', '==', studentId)
      .orderBy('weekStartDate', 'desc')
      .limit(1)
      .get();
    const behaviour = behavSnap.docs[0]?.data() || {};

    // Prepare data for Gemini
    const avgScore = analysisResults.length > 0 
      ? analysisResults.reduce((sum, r) => sum + (100 - (r.scores?.overallDyslexiaRisk || 0) * 100), 0) / analysisResults.length 
      : 80; // default passing if no data
      
    const topIndicators = analysisResults
      .flatMap(r => r.indicators?.reversals?.map(rev => `'${rev.char}' reversal`) || [])
      .slice(0, 3);

    const weekData = {
      childName: studentName,
      sessionsCompleted: sessions.length,
      avgScore: Math.round(avgScore),
      topIndicators: topIndicators.length > 0 ? topIndicators : null,
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
    const reportRef = await adminDb.collection('reports').add({
      studentId,
      guardianId: decoded.uid,
      generatedAt: new Date(),
      weekStartDate: weekStart.toISOString().split('T')[0],
      narrativeSummary: narrative,
      handwritingHighlights: analysisResults.length > 0
        ? `${analysisResults.length} samples analyzed this week.`
        : 'No new samples this week.',
      recommendedActivities: activities,
      pdfUrl: '',
    });

    await auditLog('generate_report', {
      requestedBy: decoded.uid,
      studentId,
      metadata: { reportId: reportRef.id },
    });

    return res.status(200).json({
      reportId: reportRef.id,
      narrative,
      weekStartDate: weekStart.toISOString().split('T')[0],
      narrativeSummary: narrative,
      handwritingHighlights: `${analysisResults.length} samples analyzed.`,
      recommendedActivities: activities,
    });
  } catch (error) {
    console.error('generate-report error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
