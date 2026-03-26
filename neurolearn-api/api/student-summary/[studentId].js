import { setCors } from '../../lib/cors.js';
import { adminDb } from '../../lib/firebaseAdmin.js';
import { verifyToken, getUserRole } from '../../lib/auth.js';

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
      const linkedIds = userDoc.data()?.linkedStudentIds || [];
      if (!linkedIds.includes(studentId)) {
        return res.status(403).json({ error: 'Not authorized for this student' });
      }
    }

    // Fetch behaviour snapshots (last 4 weeks)
    const behavSnap = await adminDb.collection('behaviourSnapshots')
      .where('studentId', '==', studentId)
      .orderBy('weekStartDate', 'desc')
      .limit(4)
      .get();
    const behaviourSnapshots = behavSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch analysis results (last 10)
    const analysisSnap = await adminDb.collection('analysisResults')
      .where('studentId', '==', studentId)
      .orderBy('analyzedAt', 'desc')
      .limit(10)
      .get();
    const analysisResults = analysisSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Fetch recent sessions
    const sessionSnap = await adminDb.collection('sessions')
      .where('studentId', '==', studentId)
      .orderBy('startedAt', 'desc')
      .limit(20)
      .get();
    const sessions = sessionSnap.docs.map(d => ({ id: d.id, ...d.data() }));

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
      acc[dateKey].sum += (result.scores?.overallDyslexiaRisk || 0);
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
      behaviourSnapshots,
      analysisResults,
      sessions,
      stats: {
        consistencyScore: Math.round(avgFormScore),
        totalReversals,
        sessionsCompleted: sessions.length,
        trendData,
      }
    });
  } catch (error) {
    console.error('student-summary error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
