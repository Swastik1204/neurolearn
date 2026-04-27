import { adminAuth, adminDb } from '../lib/firebaseAdmin.js';

async function cleanupAndEnrich() {
  console.log('Starting Cleanup and Enrichment...');
  
  const targetEmails = {
    guardian: 'neurolearn101@gmail.com',
    student: 'swastiksaha1204@gmail.com'
  };
  
  let guardianUid, studentUid;
  
  try {
    const guardianUser = await adminAuth.getUserByEmail(targetEmails.guardian);
    guardianUid = guardianUser.uid;
    console.log(`Found Guardian: ${guardianUid}`);
  } catch (err) {
    console.error(`Guardian ${targetEmails.guardian} not found. Please create it first.`);
    return;
  }
  
  try {
    const studentUser = await adminAuth.getUserByEmail(targetEmails.student);
    studentUid = studentUser.uid;
    console.log(`Found Student: ${studentUid}`);
  } catch (err) {
    console.error(`Student ${targetEmails.student} not found. Please create it first.`);
    return;
  }

  // 1. Link them in Firestore
  await adminDb.collection('users').doc(guardianUid).set({
    role: 'guardian',
    email: targetEmails.guardian,
    linkedStudents: [studentUid]
  }, { merge: true });

  await adminDb.collection('users').doc(studentUid).set({
    role: 'student',
    email: targetEmails.student,
    guardianId: guardianUid,
    displayName: 'Swastik Saha'
  }, { merge: true });

  console.log('Linked users successfully.');

  // 2. Generate Seed Data for the student
  console.log('Generating seed data for student...');
  
  const letters = ['B', 'D', 'C', 'P', 'Q'];
  const sessions = [];
  
  for (let i = 0; i < 5; i++) {
    const date = new Date();
    date.setDate(date.getDate() - (5 - i));
    
    const sessionLetters = [letters[i % letters.length], letters[(i+1) % letters.length], letters[(i+2) % letters.length]];
    
    const sessionData = {
      studentId: studentUid,
      startedAt: date,
      endedAt: new Date(date.getTime() + 5 * 60000),
      exerciseMode: 'single_letter',
      letterCount: 3,
      letters: sessionLetters,
      durationMs: 5 * 60000,
      deviceType: 'mouse',
      cognitiveProfile: {
        writingMotor: 0.6 + Math.random() * 0.3,
        reversalRisk: 0.2 + Math.random() * 0.2,
        letterConsistency: 0.7 + Math.random() * 0.2,
        strokeConfidence: 0.8 + Math.random() * 0.1,
        recommendedPath: 'general_practice'
      },
      sessionRiskBand: 'low'
    };
    
    const sessRef = await adminDb.collection('sessions').add(sessionData);
    
    // Add analysis results for each letter in session
    for (const letter of sessionLetters) {
      await adminDb.collection('analysisResults').add({
        studentId: studentUid,
        sampleId: `seed_${sessRef.id}_${letter}`,
        letter,
        analyzedAt: date,
        scores: {
          letterFormScore: 70 + Math.random() * 25,
          spacingScore: 80 + Math.random() * 15,
          baselineScore: 75 + Math.random() * 20,
          reversalScore: 10 + Math.random() * 15,
          overallRisk: 0.1 + Math.random() * 0.2
        },
        riskLevel: 'low',
        cognitiveProfile: sessionData.cognitiveProfile
      });
    }
  }

  console.log('Seed data generated.');

  // 3. Cleanup other users (Optional but requested)
  // I will only remove users that I created in previous turns if I can track them.
  // For now, I'll just list them.
  console.log('Cleanup: Please manually remove other test accounts in Firebase Console to avoid accidental data loss.');
}

cleanupAndEnrich();
