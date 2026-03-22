import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();
const db = getFirestore();

/**
 * Trigger: When a new analysisResult document is created.
 * Recalculates the behaviourSnapshot for the student's current week.
 */
export const onAnalysisComplete = onDocumentCreated(
  'analysisResults/{resultId}',
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { studentId } = data;
    if (!studentId) return;

    try {
      // Get current week start (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      monday.setHours(0, 0, 0, 0);
      const weekStartDate = monday.toISOString().split('T')[0];

      // Fetch all analysis results for this week
      const weekResults = await db.collection('analysisResults')
        .where('studentId', '==', studentId)
        .where('analyzedAt', '>=', monday)
        .get();

      // Need at least 5 samples to compute a snapshot
      if (weekResults.size < 5) return;

      // Fetch sessions for this week
      const weekSessions = await db.collection('sessions')
        .where('studentId', '==', studentId)
        .where('startedAt', '>=', monday)
        .get();

      const sessions = weekSessions.docs.map(d => d.data());
      const results = weekResults.docs.map(d => d.data());

      // Calculate metrics
      const avgSessionDuration = sessions.reduce((sum, s) => sum + (s.durationMs || 0), 0)
        / Math.max(sessions.length, 1);

      const tasksAttempted = sessions.length;
      const tasksCompleted = sessions.filter(s => (s.completionRate || 0) >= 0.9).length;

      // Error rate by day
      const errorByDay = [0, 0, 0, 0, 0, 0, 0];
      sessions.forEach(s => {
        const d = s.startedAt?.toDate?.() || new Date();
        const dayIdx = (d.getDay() + 6) % 7;
        errorByDay[dayIdx] += s.errorCorrectionCount || 0;
      });

      // Detect focus drop: if last 3 sessions have decreasing completion rates
      let focusDrop = false;
      if (sessions.length >= 3) {
        const recentRates = sessions.slice(0, 3).map(s => s.completionRate || 0);
        focusDrop = recentRates[0] < recentRates[1] && recentRates[1] < recentRates[2];
      }

      // Determine trend by comparing to previous week
      const prevMonday = new Date(monday);
      prevMonday.setDate(prevMonday.getDate() - 7);

      const prevSnapshot = await db.collection('behaviourSnapshots')
        .where('studentId', '==', studentId)
        .where('weekStartDate', '==', prevMonday.toISOString().split('T')[0])
        .limit(1)
        .get();

      let performanceTrend = 'plateau';
      if (prevSnapshot.docs.length > 0) {
        const prevCompleted = prevSnapshot.docs[0].data().tasksCompleted || 0;
        if (tasksCompleted > prevCompleted + 1) performanceTrend = 'improving';
        else if (tasksCompleted < prevCompleted - 1) performanceTrend = 'regressing';
      }

      // Upsert behaviour snapshot
      const snapshotQuery = await db.collection('behaviourSnapshots')
        .where('studentId', '==', studentId)
        .where('weekStartDate', '==', weekStartDate)
        .limit(1)
        .get();

      const snapshotData = {
        studentId,
        weekStartDate,
        avgSessionDuration,
        tasksAttempted,
        tasksCompleted,
        errorRateByDay: errorByDay,
        focusDrop,
        performanceTrend,
        updatedAt: FieldValue.serverTimestamp(),
      };

      if (snapshotQuery.docs.length > 0) {
        await snapshotQuery.docs[0].ref.update(snapshotData);
      } else {
        await db.collection('behaviourSnapshots').add({
          ...snapshotData,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      console.log(`Updated behaviour snapshot for student ${studentId}, week ${weekStartDate}`);
    } catch (error) {
      console.error('onAnalysisComplete error:', error);
    }
  }
);

/**
 * Scheduled function: Runs every Monday at 08:00 IST (02:30 UTC).
 * Reminds guardians to generate this week's report.
 */
export const weeklyReportReminder = onSchedule(
  {
    schedule: '30 2 * * 1', // Monday 02:30 UTC = 08:00 IST
    timeZone: 'Asia/Kolkata',
  },
  async () => {
    try {
      // Get all guardians
      const guardiansSnap = await db.collection('users')
        .where('role', '==', 'guardian')
        .get();

      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      const weekStartStr = weekStart.toISOString().split('T')[0];

      for (const guardianDoc of guardiansSnap.docs) {
        const guardian = guardianDoc.data();
        const studentIds = guardian.linkedStudentIds || [];

        for (const studentId of studentIds) {
          // Check if report already generated this week
          const reportCheck = await db.collection('reports')
            .where('guardianId', '==', guardianDoc.id)
            .where('studentId', '==', studentId)
            .where('weekStartDate', '==', weekStartStr)
            .limit(1)
            .get();

          if (reportCheck.empty) {
            // Get student name
            const studentSnap = await db.collection('students')
              .where('uid', '==', studentId)
              .limit(1)
              .get();
            const studentName = studentSnap.docs[0]?.data()?.displayName || 'your child';

            // Send FCM notification (if guardian has a device token)
            // In a full implementation, you'd store FCM tokens in the user doc
            console.log(
              `Reminder: Guardian ${guardianDoc.id} needs to generate report for ${studentName} (${studentId})`
            );

            // Try to send FCM push notification
            try {
              const messaging = getMessaging();
              if (guardian.fcmToken) {
                await messaging.send({
                  token: guardian.fcmToken,
                  notification: {
                    title: "This week's report is ready!",
                    body: `View ${studentName}'s weekly progress report on NeuroLearn.`,
                  },
                });
              }
            } catch (fcmError) {
              // FCM might not be set up yet — non-fatal
              console.log('FCM not available:', fcmError.message);
            }
          }
        }
      }
    } catch (error) {
      console.error('weeklyReportReminder error:', error);
    }
  }
);
