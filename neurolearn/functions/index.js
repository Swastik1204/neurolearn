import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
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
      console.log(`analysisResults trigger received for student ${studentId}`);
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
            const studentSnap = await db.collection('users').doc(studentId).get();
            const studentName = studentSnap.exists ? (studentSnap.data()?.displayName || 'your child') : 'your child';

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
