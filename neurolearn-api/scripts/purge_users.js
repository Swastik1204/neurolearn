import { adminAuth, adminDb } from '../lib/firebaseAdmin.js';

async function purgeTemporaryUsers() {
  const keepEmails = ['neurolearn101@gmail.com', 'swastiksaha1204@gmail.com'];
  console.log('Purging temporary users...');

  try {
    const listUsers = await adminAuth.listUsers();
    const usersToDelete = listUsers.users.filter(u => !keepEmails.includes(u.email));
    
    if (usersToDelete.length === 0) {
      console.log('No temporary users found.');
      return;
    }

    console.log(`Deleting ${usersToDelete.length} users...`);
    
    for (const user of usersToDelete) {
      // 1. Delete Firestore data
      await adminDb.collection('users').doc(user.uid).delete();
      
      // 2. Delete Auth account
      await adminAuth.deleteUser(user.uid);
      console.log(`Deleted: ${user.email} (${user.uid})`);
    }

    console.log('Purge complete.');
  } catch (err) {
    console.error('Purge failed:', err.message);
  }
}

purgeTemporaryUsers();
