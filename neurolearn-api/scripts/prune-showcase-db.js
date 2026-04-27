import { adminDb } from '../lib/firebaseAdmin.js';

const KEEP_GUARDIAN_UID = 'KAuiVkJmDJVXM3Tb8dtpDipwbpn2';
const KEEP_STUDENT_UIDS = [
  'kY7At75BbxW2teRWktCMxWR9mNm2',
  'kNpnMIBdrab3xv6RYAE9eb1A8cj1',
];

const KEEP_USER_UIDS = [KEEP_GUARDIAN_UID, ...KEEP_STUDENT_UIDS];

function shouldDryRun() {
  return String(process.env.DRY_RUN || '').toLowerCase() === '1'
    || String(process.env.DRY_RUN || '').toLowerCase() === 'true';
}

async function deleteDocRefs(docRefs, dryRun) {
  if (!docRefs.length) return 0;
  if (dryRun) return docRefs.length;

  let deleted = 0;
  for (let i = 0; i < docRefs.length; i += 400) {
    const chunk = docRefs.slice(i, i + 400);
    const batch = adminDb.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

async function pruneUsers(dryRun) {
  const snap = await adminDb.collection('users').get();
  const toDelete = snap.docs
    .filter((doc) => !KEEP_USER_UIDS.includes(doc.id))
    .map((doc) => doc.ref);

  const deleted = await deleteDocRefs(toDelete, dryRun);
  return { scanned: snap.size, deleted };
}

async function pruneByStudent(collectionName, dryRun) {
  const snap = await adminDb.collection(collectionName).get();
  const toDelete = snap.docs
    .filter((doc) => !KEEP_STUDENT_UIDS.includes(String(doc.data()?.studentId || '')))
    .map((doc) => doc.ref);

  const deleted = await deleteDocRefs(toDelete, dryRun);
  return { scanned: snap.size, deleted };
}

async function pruneReports(dryRun) {
  const snap = await adminDb.collection('reports').get();
  const toDelete = snap.docs
    .filter((doc) => {
      const data = doc.data() || {};
      const studentOk = KEEP_STUDENT_UIDS.includes(String(data.studentId || ''));
      const guardianOk = String(data.guardianId || '') === KEEP_GUARDIAN_UID;
      return !(studentOk && guardianOk);
    })
    .map((doc) => doc.ref);

  const deleted = await deleteDocRefs(toDelete, dryRun);
  return { scanned: snap.size, deleted };
}

async function main() {
  const dryRun = shouldDryRun();
  console.log(`Starting prune-showcase-db (dryRun=${dryRun})...`);

  const userStats = await pruneUsers(dryRun);
  const sessionStats = await pruneByStudent('sessions', dryRun);
  const analysisStats = await pruneByStudent('analysisResults', dryRun);
  const sampleStats = await pruneByStudent('handwritingSamples', dryRun);
  const screeningStats = await pruneByStudent('screeningResults', dryRun);
  const reportStats = await pruneReports(dryRun);

  console.log('Prune summary:');
  console.log(`users: scanned=${userStats.scanned}, deleted=${userStats.deleted}`);
  console.log(`sessions: scanned=${sessionStats.scanned}, deleted=${sessionStats.deleted}`);
  console.log(`analysisResults: scanned=${analysisStats.scanned}, deleted=${analysisStats.deleted}`);
  console.log(`handwritingSamples: scanned=${sampleStats.scanned}, deleted=${sampleStats.deleted}`);
  console.log(`screeningResults: scanned=${screeningStats.scanned}, deleted=${screeningStats.deleted}`);
  console.log(`reports: scanned=${reportStats.scanned}, deleted=${reportStats.deleted}`);
  console.log('prune-showcase-db completed.');
}

main().catch((error) => {
  console.error('prune-showcase-db failed:', error);
  process.exitCode = 1;
});
