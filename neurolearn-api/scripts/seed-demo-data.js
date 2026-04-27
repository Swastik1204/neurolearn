import { Timestamp } from 'firebase-admin/firestore';
import { adminDb } from '../lib/firebaseAdmin.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SCREENING_FREQUENCY_DAYS = 7;

function dateFromOffset(daysFromNow) {
  return new Date(Date.now() + daysFromNow * DAY_MS);
}

function toIso(daysFromNow) {
  return dateFromOffset(daysFromNow).toISOString();
}

function ts(daysFromNow) {
  return Timestamp.fromDate(dateFromOffset(daysFromNow));
}

function baselineProfile({ completedOffsetDays, dueOffsetDays, overallRiskBand, recommendedPath, visualAccuracy, phonAccuracy, reversalRisk }) {
  return {
    screeningVersion: '1.0',
    completedAt: toIso(completedOffsetDays),
    screeningFrequencyDays: SCREENING_FREQUENCY_DAYS,
    nextScreeningDueAt: toIso(dueOffsetDays),
    modulesCompleted: ['visual_discrimination', 'letter_tracing', 'phonological_awareness'],
    visualDiscrimination: {
      accuracy: visualAccuracy,
      avgReactionTimeMs: 1750,
      confusedPairs: reversalRisk > 0.55 ? ['b/d', 'p/q'] : ['b/d'],
    },
    writingProfile: {
      avgCognitiveProfile: {
        writingMotor: Math.max(0.3, 1 - reversalRisk - 0.12),
        reversalRisk,
        letterConsistency: Math.max(0.35, 1 - reversalRisk - 0.08),
        strokeConfidence: Math.max(0.4, 1 - reversalRisk - 0.1),
      },
      overallRiskBand,
      byLetter: {
        B: { scores: { overallRisk: Math.min(0.9, reversalRisk + 0.08) } },
        D: { scores: { overallRisk: Math.min(0.9, reversalRisk + 0.1) } },
        p: { scores: { overallRisk: Math.min(0.9, reversalRisk + 0.05) } },
        q: { scores: { overallRisk: Math.min(0.9, reversalRisk + 0.09) } },
      },
    },
    phonologicalAwareness: {
      accuracy: phonAccuracy,
      avgReactionTimeMs: 1540,
      weakAreas: phonAccuracy < 0.6 ? ['initial_sounds', 'rhyming'] : ['rhyming'],
    },
    overallRiskBand,
    recommendedPath,
    recommendedPathHint: 'Weekly check-ins are scheduled to track progress over time.',
    isScreeningNotDiagnosis: true,
  };
}

function riskBand(overallRisk) {
  if (overallRisk > 0.65) return 'high';
  if (overallRisk > 0.35) return 'moderate';
  return 'low';
}

function buildCognitiveProfile(overallRisk, recommendedPath) {
  const reversalRisk = Math.max(0.15, Math.min(0.9, overallRisk + 0.05));
  const writingMotor = Math.max(0.25, 1 - overallRisk - 0.1);
  const letterConsistency = Math.max(0.3, 1 - overallRisk - 0.08);
  const strokeConfidence = Math.max(0.35, 1 - overallRisk - 0.12);

  return {
    writingMotor,
    reversalRisk,
    letterConsistency,
    strokeConfidence,
    riskBand: riskBand(overallRisk),
    recommendedPath,
  };
}

const demoGuardianId = process.env.DEMO_GUARDIAN_UID || 'demo_guardian_001';
const demoTeacherId = process.env.DEMO_TEACHER_UID || 'demo_teacher_001';

const demoStudents = [
  {
    id: process.env.DEMO_STUDENT_A_UID || 'demo_student_001',
    displayName: 'Aarav Demo',
    email: 'aarav.demo@neurolearn.local',
    completedOffsetDays: -5,
    dueOffsetDays: 2,
    overallRiskBand: 'moderate',
    recommendedPath: 'reversal_reinforcement',
    visualAccuracy: 0.67,
    phonAccuracy: 0.63,
    reversalRisk: 0.58,
    weeklyRiskTrend: [0.62, 0.56, 0.52, 0.47],
  },
  {
    id: process.env.DEMO_STUDENT_B_UID || 'demo_student_002',
    displayName: 'Maya Demo',
    email: 'maya.demo@neurolearn.local',
    completedOffsetDays: -8,
    dueOffsetDays: -1,
    overallRiskBand: 'high',
    recommendedPath: 'phonological_reinforcement',
    visualAccuracy: 0.49,
    phonAccuracy: 0.52,
    reversalRisk: 0.72,
    weeklyRiskTrend: [0.77, 0.71, 0.69, 0.66],
  },
];

async function seedUsers(batch, baselinesByStudent) {
  batch.set(adminDb.collection('users').doc(demoTeacherId), {
    role: 'teacher',
    displayName: 'Demo Teacher',
    email: 'teacher.demo@neurolearn.local',
    createdAt: ts(-90),
  }, { merge: true });

  batch.set(adminDb.collection('users').doc(demoGuardianId), {
    role: 'guardian',
    displayName: 'Demo Guardian',
    email: 'guardian.demo@neurolearn.local',
    linkedStudentIds: demoStudents.map((s) => s.id),
    consentGiven: true,
    createdAt: ts(-90),
  }, { merge: true });

  for (const student of demoStudents) {
    const baseline = baselinesByStudent[student.id];
    batch.set(adminDb.collection('users').doc(student.id), {
      role: 'student',
      displayName: student.displayName,
      email: student.email,
      createdAt: ts(-90),
      screeningCompleted: true,
      screeningCompletedAt: baseline.completedAt,
      nextScreeningDueAt: baseline.nextScreeningDueAt,
      screeningSchedule: {
        frequencyDays: SCREENING_FREQUENCY_DAYS,
        lastCompletedAt: baseline.completedAt,
        nextDueAt: baseline.nextScreeningDueAt,
      },
      baselineProfile: baseline,
    }, { merge: true });
  }
}

function seedScreenings(batch, baselinesByStudent) {
  for (const student of demoStudents) {
    const baseline = baselinesByStudent[student.id];
    const screeningDocId = `${student.id}_screening_weekly`;

    batch.set(adminDb.collection('screeningResults').doc(screeningDocId), {
      studentId: student.id,
      completedAt: Timestamp.fromDate(new Date(baseline.completedAt)),
      nextScreeningDueAt: baseline.nextScreeningDueAt,
      screeningFrequencyDays: SCREENING_FREQUENCY_DAYS,
      baselineProfile: baseline,
      moduleResults: {
        visualDiscrimination: {
          accuracy: baseline.visualDiscrimination.accuracy,
          avgReactionTimeMs: baseline.visualDiscrimination.avgReactionTimeMs,
          confusedPairs: baseline.visualDiscrimination.confusedPairs,
        },
        letterTracing: {
          avgCognitiveProfile: baseline.writingProfile.avgCognitiveProfile,
          overallRiskBand: baseline.writingProfile.overallRiskBand,
          lettersTraced: ['B', 'D', 'p', 'q'],
        },
        phonologicalAwareness: {
          accuracy: baseline.phonologicalAwareness.accuracy,
          avgReactionTimeMs: baseline.phonologicalAwareness.avgReactionTimeMs,
          weakAreas: baseline.phonologicalAwareness.weakAreas,
        },
      },
    }, { merge: true });
  }
}

function seedWeeklyPerformance(batch) {
  for (const student of demoStudents) {
    student.weeklyRiskTrend.forEach((overallRisk, index) => {
      const daysAgo = 21 - (index * 7);
      const startedAt = Timestamp.fromDate(dateFromOffset(-daysAgo));
      const endedAt = Timestamp.fromDate(dateFromOffset(-daysAgo + 0.003));
      const profile = buildCognitiveProfile(overallRisk, student.recommendedPath);

      const sessionId = `${student.id}_session_w${index + 1}`;
      const sampleId = `${student.id}_sample_w${index + 1}`;
      const analysisId = `${student.id}_analysis_w${index + 1}`;

      const scores = {
        letterFormScore: Math.round((1 - overallRisk) * 100),
        spacingScore: Math.round((1 - overallRisk * 0.85) * 100),
        baselineScore: Math.round((1 - overallRisk * 0.8) * 100),
        reversalScore: Math.round(overallRisk * 100),
        overallRisk: Number(overallRisk.toFixed(3)),
      };

      batch.set(adminDb.collection('sessions').doc(sessionId), {
        studentId: student.id,
        startedAt,
        endedAt,
        durationMs: 185000,
        letters: ['B', 'D', 'p', 'q'],
        sessionRiskBand: riskBand(overallRisk),
        cognitiveProfile: profile,
        source: 'demo_seed',
      }, { merge: true });

      batch.set(adminDb.collection('handwritingSamples').doc(sampleId), {
        studentId: student.id,
        capturedAt: startedAt,
        promptLetter: ['b', 'd', 'p', 'q'][index % 4],
        letter: ['b', 'd', 'p', 'q'][index % 4],
        analysisStatus: 'complete',
        source: 'exercise',
        analysisResult: {
          scores,
          riskLevel: riskBand(overallRisk),
          cognitiveProfile: profile,
        },
      }, { merge: true });

      batch.set(adminDb.collection('analysisResults').doc(analysisId), {
        studentId: student.id,
        sampleId,
        analyzedAt: endedAt,
        letter: ['b', 'd', 'p', 'q'][index % 4],
        riskLevel: riskBand(overallRisk),
        scores,
        indicators: {
          reversals: overallRisk > 0.55 ? [{ confidence: overallRisk, type: 'horizontal_symmetry' }] : [],
          baselineDrift: overallRisk > 0.5,
          sizingInconsistency: overallRisk > 0.45,
          spacingIrregularity: overallRisk > 0.5,
          omissionRisk: overallRisk > 0.6,
        },
        cognitiveProfile: profile,
        geminiInterpretation: overallRisk > 0.6
          ? 'Focus on slow tracing and letter orientation to strengthen stability.'
          : 'Great progress. Keep short and consistent writing practice sessions.',
      }, { merge: true });
    });
  }
}

function seedReports(batch) {
  for (const student of demoStudents) {
    const latestRisk = student.weeklyRiskTrend[student.weeklyRiskTrend.length - 1];
    const previousRisk = student.weeklyRiskTrend[student.weeklyRiskTrend.length - 2] ?? latestRisk;
    const trend = latestRisk < previousRisk ? 'improving' : latestRisk === previousRisk ? 'stable' : 'declining';

    const reportId = `${student.id}_weekly_report`;
    const generatedAt = ts(-1);

    batch.set(adminDb.collection('reports').doc(reportId), {
      studentId: student.id,
      guardianId: demoGuardianId,
      generatedAt,
      generatedAtISO: generatedAt.toDate().toISOString(),
      weekStartDate: dateFromOffset(-7).toISOString().slice(0, 10),
      trend,
      overallProfile: buildCognitiveProfile(latestRisk, student.recommendedPath),
      narrativeSummary:
        student.overallRiskBand === 'high'
          ? 'This week showed effort and progress, with continued need for support around letter orientation and sound mapping. Keep daily short practice blocks and celebrate small wins.'
          : 'This week showed steady gains in writing confidence and letter consistency. Continue guided tracing and playful sound activities to maintain momentum.',
      handwritingHighlights: [
        'Completed multiple writing sessions this week.',
        'Observed measurable movement in risk and consistency markers.',
      ],
      recommendedActivities: [
        '5 minutes of slow tracing for b/d and p/q each day.',
        'Short rhyming game before writing practice.',
        'Weekly screening check-in to monitor progress.',
      ],
    }, { merge: true });
  }
}

async function main() {
  const baselinesByStudent = Object.fromEntries(
    demoStudents.map((student) => [
      student.id,
      baselineProfile({
        completedOffsetDays: student.completedOffsetDays,
        dueOffsetDays: student.dueOffsetDays,
        overallRiskBand: student.overallRiskBand,
        recommendedPath: student.recommendedPath,
        visualAccuracy: student.visualAccuracy,
        phonAccuracy: student.phonAccuracy,
        reversalRisk: student.reversalRisk,
      }),
    ])
  );

  const batch = adminDb.batch();

  await seedUsers(batch, baselinesByStudent);
  seedScreenings(batch, baselinesByStudent);
  seedWeeklyPerformance(batch);
  seedReports(batch);

  await batch.commit();

  console.log('Demo data seeded successfully.');
  console.log(`Teacher UID: ${demoTeacherId}`);
  console.log(`Guardian UID: ${demoGuardianId}`);
  console.log(`Student UIDs: ${demoStudents.map((s) => s.id).join(', ')}`);
}

main().catch((error) => {
  console.error('Failed to seed demo data:', error);
  process.exitCode = 1;
});
