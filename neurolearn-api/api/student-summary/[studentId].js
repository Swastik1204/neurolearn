import { setCors } from '../../lib/cors.js';
import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyToken, getUserRole } from '../../lib/auth.js';

function asDate(value) {
  if (!value) return new Date(0);
  if (value?.toDate) return value.toDate();
  return new Date(value);
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
      scores: {
        ...r.scores,
        overallRisk: r.scores?.overallRisk ?? r.overallRisk ?? 0
      }
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
    const sessions = sessionSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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
        analysisResult: sample.analysisResult || analysisBySampleId[sample.id] || null,
      }))
      .sort((a, b) => asDate(b.capturedAt) - asDate(a.capturedAt))
      .slice(0, 20);

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
