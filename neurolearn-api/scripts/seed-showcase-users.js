import { Timestamp } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '../lib/firebaseAdmin.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const TOTAL_DAYS = 45;
const SCREENING_FREQUENCY_DAYS = 7;

const USERS = {
  guardian: {
    uid: 'KAuiVkJmDJVXM3Tb8dtpDipwbpn2',
    email: 'neurolearn101@gmail.com',
    displayName: 'NeuroLearn Guardian',
  },
  students: [
    {
      uid: 'kY7At75BbxW2teRWktCMxWR9mNm2',
      email: 'swastiksaha1204@gmail.com',
      displayName: 'Swastik Saha',
      trajectory: 'fast',
      preferredLetters: ['b', 'd', 'p', 'q', 'a', 'c'],
    },
    {
      uid: 'kNpnMIBdrab3xv6RYAE9eb1A8cj1',
      email: 'ayushsrivastavamail@gmail.com',
      displayName: 'Ayush Srivastava',
      trajectory: 'slow',
      preferredLetters: ['b', 'd', 'm', 'n', 'u', 'p'],
    },
  ],
};

function dateFromDaysAgo(daysAgo) {
  return new Date(Date.now() - (daysAgo * DAY_MS));
}

function isoFromDaysAgo(daysAgo) {
  return dateFromDaysAgo(daysAgo).toISOString();
}

function tsFromDaysAgo(daysAgo) {
  return Timestamp.fromDate(dateFromDaysAgo(daysAgo));
}

function clamp(min, value, max) {
  return Math.max(min, Math.min(max, value));
}

function riskBand(risk) {
  if (risk > 0.65) return 'high';
  if (risk > 0.35) return 'moderate';
  return 'low';
}

function recommendedPath(profile) {
  const entries = [
    ['writingMotor', profile.writingMotor],
    ['reversalRisk', profile.reversalRisk],
    ['letterConsistency', profile.letterConsistency],
    ['strokeConfidence', profile.strokeConfidence],
  ];

  entries.sort((a, b) => a[1] - b[1]);
  const weakest = entries[0][0];

  if (weakest === 'reversalRisk') return 'reversal_reinforcement';
  if (weakest === 'writingMotor') return 'motor_development';
  if (weakest === 'strokeConfidence') return 'confidence_pacing';
  return 'consistency_building';
}

function profileFromRisk(risk, strokeBias = 0) {
  const reversalRisk = clamp(0.1, risk + 0.06, 0.95);
  const writingMotor = clamp(0.2, 1 - (risk + 0.12), 0.95);
  const letterConsistency = clamp(0.2, 1 - (risk + 0.08), 0.95);
  const strokeConfidence = clamp(0.2, 1 - (risk + 0.11) + strokeBias, 0.98);

  const profile = {
    writingMotor,
    reversalRisk,
    letterConsistency,
    strokeConfidence,
  };

  return {
    ...profile,
    riskBand: riskBand(risk),
    recommendedPath: recommendedPath(profile),
  };
}

function scoreFromRisk(risk) {
  return {
    letterFormScore: Math.round(clamp(25, (1 - risk) * 100 - 2, 98)),
    spacingScore: Math.round(clamp(20, (1 - (risk * 0.85)) * 100, 98)),
    baselineScore: Math.round(clamp(20, (1 - (risk * 0.82)) * 100 + 1, 98)),
    reversalScore: Math.round(clamp(8, risk * 100 + 3, 98)),
    overallRisk: Number(clamp(0.08, risk, 0.95).toFixed(3)),
  };
}

function emotionForRisk(risk, index) {
  if (risk >= 0.65) return index % 3 === 0 ? 'okay' : 'hard';
  if (risk >= 0.4) return index % 4 === 0 ? 'happy' : 'okay';
  return index % 5 === 0 ? 'okay' : 'happy';
}

function interpretationText(name, letter, risk) {
  if (risk > 0.65) {
    return `${name} is showing effort on ${letter.toUpperCase()}; keep practicing direction cues and slow tracing for steadier formation.`;
  }
  if (risk > 0.4) {
    return `${name} is building confidence on ${letter.toUpperCase()} with better spacing. Continue short, repeated guided strokes.`;
  }
  return `${name} is showing strong control on ${letter.toUpperCase()} with cleaner spacing and baseline stability. Keep this momentum.`;
}

function seriesForTrajectory(type) {
  const points = 16;
  const out = [];

  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    let risk;

    if (type === 'fast') {
      risk = 0.76 - (0.52 * t) + ((i % 3) * 0.008);
    } else {
      risk = 0.81 - (0.26 * t) + ((i % 4) * 0.01);
    }

    out.push(Number(clamp(0.18, risk, 0.9).toFixed(3)));
  }

  return out;
}

function screeningProfile(student, completedAtIso, nextDueIso, risk) {
  const profile = profileFromRisk(risk, student.trajectory === 'fast' ? 0.03 : -0.01);

  return {
    screeningVersion: '1.0',
    completedAt: completedAtIso,
    screeningFrequencyDays: SCREENING_FREQUENCY_DAYS,
    nextScreeningDueAt: nextDueIso,
    modulesCompleted: ['visual_discrimination', 'letter_tracing', 'phonological_awareness'],
    visualDiscrimination: {
      accuracy: Number(clamp(0.35, 1 - risk * 0.7, 0.95).toFixed(2)),
      avgReactionTimeMs: Math.round(clamp(900, 2100 - ((1 - risk) * 900), 2200)),
      confusedPairs: risk > 0.6 ? ['b/d', 'p/q'] : ['b/d'],
    },
    writingProfile: {
      avgCognitiveProfile: {
        writingMotor: profile.writingMotor,
        reversalRisk: profile.reversalRisk,
        letterConsistency: profile.letterConsistency,
        strokeConfidence: profile.strokeConfidence,
      },
      overallRiskBand: profile.riskBand,
      byLetter: {
        B: { scores: { overallRisk: Number(clamp(0.1, risk + 0.07, 0.95).toFixed(3)) } },
        D: { scores: { overallRisk: Number(clamp(0.1, risk + 0.09, 0.95).toFixed(3)) } },
        P: { scores: { overallRisk: Number(clamp(0.1, risk + 0.04, 0.95).toFixed(3)) } },
        Q: { scores: { overallRisk: Number(clamp(0.1, risk + 0.08, 0.95).toFixed(3)) } },
      },
    },
    phonologicalAwareness: {
      accuracy: Number(clamp(0.3, 1 - risk * 0.75, 0.95).toFixed(2)),
      avgReactionTimeMs: Math.round(clamp(900, 1950 - ((1 - risk) * 760), 2100)),
      weakAreas: risk > 0.58 ? ['initial_sounds', 'rhyming'] : ['rhyming'],
    },
    overallRiskBand: profile.riskBand,
    recommendedPath: profile.recommendedPath,
    recommendedPathHint: 'Weekly trend is for educational support only.',
    isScreeningNotDiagnosis: true,
  };
}

async function verifyAuthIdentity(uid, expectedEmail) {
  try {
    const user = await adminAuth.getUser(uid);
    if ((user.email || '').toLowerCase() !== expectedEmail.toLowerCase()) {
      console.warn(`Email mismatch for UID ${uid}: auth has ${user.email}, expected ${expectedEmail}`);
    }
    return { exists: true, authEmail: user.email || null };
  } catch (error) {
    console.warn(`Auth user not found for UID ${uid}:`, error.message);
    return { exists: false, authEmail: null };
  }
}

async function deleteWhereEquals(collectionName, field, value) {
  const snap = await adminDb.collection(collectionName).where(field, '==', value).get();
  if (snap.empty) return 0;

  let deleted = 0;
  const batch = adminDb.batch();
  snap.docs.forEach((doc) => {
    batch.delete(doc.ref);
    deleted++;
  });
  await batch.commit();
  return deleted;
}

async function removeExistingStudentTimeline(studentId) {
  const collections = ['sessions', 'analysisResults', 'handwritingSamples', 'screeningResults', 'reports'];
  let total = 0;

  for (const collectionName of collections) {
    total += await deleteWhereEquals(collectionName, 'studentId', studentId);
  }

  return total;
}

function makeWeeklyNarrative(studentName, currentRisk, prevRisk) {
  const trend = currentRisk < prevRisk - 0.02 ? 'improving' : currentRisk > prevRisk + 0.02 ? 'declining' : 'stable';
  const riskText = currentRisk > 0.65 ? 'high support need' : currentRisk > 0.35 ? 'moderate support need' : 'steady confidence';

  return {
    trend,
    text: `This week ${studentName} showed ${trend} handwriting consistency with ${riskText}. Focus remained on letter orientation, spacing, and calm stroke pacing.`,
  };
}

async function seedStudentData(student) {
  const riskSeries = seriesForTrajectory(student.trajectory);
  const dayOffsets = Array.from({ length: riskSeries.length }, (_, i) => TOTAL_DAYS - (i * 3));

  const screenings = [];
  for (let day = TOTAL_DAYS; day >= 0; day -= SCREENING_FREQUENCY_DAYS) {
    screenings.push(day);
  }

  const screeningDocs = screenings.map((daysAgo, idx) => {
    const nearestRisk = riskSeries[Math.min(idx * 2, riskSeries.length - 1)];
    const completedAt = isoFromDaysAgo(daysAgo);
    const nextDueDaysAgo = daysAgo - SCREENING_FREQUENCY_DAYS;
    const nextDueAt = nextDueDaysAgo > 0 ? isoFromDaysAgo(nextDueDaysAgo) : new Date(Date.now() + (SCREENING_FREQUENCY_DAYS * DAY_MS)).toISOString();
    return {
      id: `showcase_${student.uid}_screening_${idx + 1}`,
      completedAt,
      nextDueAt,
      risk: nearestRisk,
      profile: screeningProfile(student, completedAt, nextDueAt, nearestRisk),
    };
  });

  const latestScreening = screeningDocs[screeningDocs.length - 1];

  await adminDb.collection('users').doc(student.uid).set({
    role: 'student',
    uid: student.uid,
    email: student.email,
    displayName: student.displayName,
    guardianId: USERS.guardian.uid,
    linkedGuardianId: USERS.guardian.uid,
    screeningCompleted: true,
    screeningCompletedAt: latestScreening.completedAt,
    nextScreeningDueAt: latestScreening.nextDueAt,
    screeningSchedule: {
      frequencyDays: SCREENING_FREQUENCY_DAYS,
      lastCompletedAt: latestScreening.completedAt,
      nextDueAt: latestScreening.nextDueAt,
    },
    baselineProfile: latestScreening.profile,
    demoSeedMeta: {
      seededAt: new Date().toISOString(),
      windowDays: TOTAL_DAYS,
      trajectory: student.trajectory,
      source: 'showcase_seed_v1',
    },
    updatedAt: Timestamp.now(),
  }, { merge: false });

  for (let i = 0; i < screeningDocs.length; i++) {
    const entry = screeningDocs[i];
    await adminDb.collection('screeningResults').doc(entry.id).set({
      studentId: student.uid,
      completedAt: Timestamp.fromDate(new Date(entry.completedAt)),
      nextScreeningDueAt: entry.nextDueAt,
      screeningFrequencyDays: SCREENING_FREQUENCY_DAYS,
      baselineProfile: entry.profile,
      moduleResults: {
        visualDiscrimination: entry.profile.visualDiscrimination,
        letterTracing: {
          avgCognitiveProfile: entry.profile.writingProfile.avgCognitiveProfile,
          overallRiskBand: entry.profile.writingProfile.overallRiskBand,
          lettersTraced: ['B', 'D', 'P', 'Q'],
        },
        phonologicalAwareness: entry.profile.phonologicalAwareness,
      },
      source: 'showcase_seed_v1',
    });
  }

  for (let i = 0; i < riskSeries.length; i++) {
    const risk = riskSeries[i];
    const daysAgo = dayOffsets[i];
    const startedAt = tsFromDaysAgo(daysAgo);
    const endedAt = Timestamp.fromDate(new Date(startedAt.toDate().getTime() + (170000 + (i % 4) * 22000)));
    const letter = student.preferredLetters[i % student.preferredLetters.length];
    const emotion = emotionForRisk(risk, i);
    const scores = scoreFromRisk(risk);
    const profile = profileFromRisk(risk, student.trajectory === 'fast' ? 0.02 : -0.01);

    const sessionId = `showcase_${student.uid}_session_${String(i + 1).padStart(2, '0')}`;
    const sampleId = `showcase_${student.uid}_sample_${String(i + 1).padStart(2, '0')}`;
    const resultId = `showcase_${student.uid}_analysis_${String(i + 1).padStart(2, '0')}`;

    await adminDb.collection('sessions').doc(sessionId).set({
      studentId: student.uid,
      startedAt,
      endedAt,
      durationMs: endedAt.toMillis() - startedAt.toMillis(),
      letters: [
        letter.toUpperCase(),
        student.preferredLetters[(i + 1) % student.preferredLetters.length].toUpperCase(),
        student.preferredLetters[(i + 2) % student.preferredLetters.length].toUpperCase(),
      ],
      sessionRiskBand: riskBand(risk),
      cognitiveProfile: profile,
      exerciseMode: 'single_letter',
      letterCount: 3,
      source: 'showcase_seed_v1',
      deviceType: i % 2 === 0 ? 'touch' : 'mouse',
      emotionProfile: {
        happy: emotion === 'happy' ? 2 : 0,
        okay: emotion === 'okay' ? 2 : 1,
        hard: emotion === 'hard' ? 2 : 0,
      },
    });

    await adminDb.collection('handwritingSamples').doc(sampleId).set({
      studentId: student.uid,
      capturedAt: startedAt,
      promptLetter: letter,
      letter,
      source: 'exercise',
      analysisStatus: 'complete',
      emotionAtSubmit: emotion,
      analysisResult: {
        resultId,
        letter,
        scores,
        riskLevel: riskBand(risk),
        cognitiveProfile: profile,
        geminiInterpretation: interpretationText(student.displayName.split(' ')[0], letter, risk),
      },
    });

    await adminDb.collection('analysisResults').doc(resultId).set({
      studentId: student.uid,
      sampleId,
      letter,
      analyzedAt: endedAt,
      riskLevel: riskBand(risk),
      scores,
      indicators: {
        reversals: risk > 0.55 ? [{ char: letter, confidence: Number((risk - 0.03).toFixed(2)) }] : [],
        omissions: risk > 0.7 ? [{ position: 0, type: 'missing_strokes' }] : [],
        substitutions: [],
        sequencing_errors: risk > 0.68 ? [{ expected: letter, observed: student.preferredLetters[(i + 1) % student.preferredLetters.length] }] : [],
      },
      cognitiveProfile: profile,
      emotionAtSubmit: emotion,
      geminiInterpretation: interpretationText(student.displayName.split(' ')[0], letter, risk),
      letterSpecific: {
        note: risk > 0.6 ? 'Needs start-point reinforcement and slow direction control.' : 'Improving shape closure and spacing.',
      },
      source: 'showcase_seed_v1',
    });
  }

  for (let w = 0; w < 6; w++) {
    const startIndex = w * 2;
    const slice = riskSeries.slice(startIndex, startIndex + 3);
    if (!slice.length) continue;

    const currentRisk = slice[slice.length - 1];
    const previousRisk = riskSeries[Math.max(0, startIndex - 1)] ?? currentRisk;
    const weekSummary = makeWeeklyNarrative(student.displayName.split(' ')[0], currentRisk, previousRisk);
    const weekDaysAgo = Math.max(0, TOTAL_DAYS - (w * 7));

    await adminDb.collection('reports').doc(`showcase_${student.uid}_report_${w + 1}`).set({
      studentId: student.uid,
      guardianId: USERS.guardian.uid,
      generatedAt: tsFromDaysAgo(weekDaysAgo),
      generatedAtISO: isoFromDaysAgo(weekDaysAgo),
      weekStartDate: dateFromDaysAgo(weekDaysAgo + 6).toISOString().slice(0, 10),
      narrativeSummary: weekSummary.text,
      handwritingHighlights: `${slice.length} samples analysed for this week with focus on orientation, baseline, and spacing.`,
      recommendedActivities: currentRisk > 0.6
        ? [
          'Trace b/d and p/q pairs with directional arrows for 5 minutes.',
          'Do 3 slow-write rounds on ruled paper with finger-spacing checks.',
          'Read aloud 6 short CVC words and copy 2 with guided dots.',
        ]
        : [
          'Write 8 target letters in alternating colors to reinforce pattern memory.',
          'Read one short paragraph and copy one sentence with clean spacing.',
          'Practice smooth connected strokes for 4 minutes with metronome pacing.',
        ],
      trend: weekSummary.trend,
      overallProfile: profileFromRisk(currentRisk, student.trajectory === 'fast' ? 0.02 : -0.01),
      source: 'showcase_seed_v1',
    });
  }
}

async function main() {
  console.log('Starting targeted showcase seeding...');

  const guardianIdentity = await verifyAuthIdentity(USERS.guardian.uid, USERS.guardian.email);
  console.log(`Guardian detection: UID ${USERS.guardian.uid}, authExists=${guardianIdentity.exists}, authEmail=${guardianIdentity.authEmail || 'N/A'}`);

  for (const student of USERS.students) {
    const identity = await verifyAuthIdentity(student.uid, student.email);
    console.log(`Student detection: UID ${student.uid}, authExists=${identity.exists}, authEmail=${identity.authEmail || 'N/A'}`);
  }

  let removedCount = 0;
  for (const student of USERS.students) {
    removedCount += await removeExistingStudentTimeline(student.uid);
  }
  removedCount += await deleteWhereEquals('reports', 'guardianId', USERS.guardian.uid);

  console.log(`Removed existing seeded timeline docs: ${removedCount}`);

  await adminDb.collection('users').doc(USERS.guardian.uid).set({
    role: 'guardian',
    uid: USERS.guardian.uid,
    email: USERS.guardian.email,
    displayName: USERS.guardian.displayName,
    consentGiven: true,
    linkedStudentIds: USERS.students.map((s) => s.uid),
    linkedStudents: USERS.students.map((s) => s.uid),
    updatedAt: Timestamp.now(),
    demoSeedMeta: {
      seededAt: new Date().toISOString(),
      source: 'showcase_seed_v1',
      students: USERS.students.map((s) => s.uid),
    },
  }, { merge: false });

  for (const student of USERS.students) {
    await seedStudentData(student);
  }

  console.log('Showcase seeding complete.');
  console.log(`Guardian: ${USERS.guardian.email} -> [${USERS.guardian.uid}]`);
  USERS.students.forEach((student) => {
    console.log(`Student: ${student.email} -> [${student.uid}] trajectory=${student.trajectory}`);
  });
}

main().catch((error) => {
  console.error('Showcase seeding failed:', error);
  process.exitCode = 1;
});
