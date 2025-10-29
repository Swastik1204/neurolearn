import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { getStorage, ref, uploadString } from 'firebase/storage'
import { app } from './config.js'

const db = getFirestore(app)
const storage = getStorage(app)

export async function createUserProfile(userId, payload) {
  const docRef = doc(db, 'users', userId)
  await setDoc(docRef, {
    createdAt: serverTimestamp(),
    preferences: {},
    ...payload,
  })
}

export async function fetchUserProfile(userId) {
  const docRef = doc(db, 'users', userId)
  const snapshot = await getDoc(docRef)
  return snapshot.data()
}

export async function saveEmotionLog(userId, emotion) {
  const logRef = collection(db, 'users', userId, 'emotionLogs')
  await addDoc(logRef, {
    ...emotion,
    createdAt: serverTimestamp(),
  })
}

export async function listEmotionLogs(userId) {
  const logRef = collection(db, 'users', userId, 'emotionLogs')
  const q = query(logRef, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
}

export async function saveDrawing({ userId, dataUrl, metadata }) {
  const storageRef = ref(storage, `users/${userId}/drawings/${Date.now()}.png`)
  await uploadString(storageRef, dataUrl, 'data_url', metadata)
  return storageRef.fullPath
}

export async function logAdaptation({ userId, adaptation }) {
  const collectionRef = collection(db, 'users', userId, 'adaptations')
  await addDoc(collectionRef, {
    createdAt: serverTimestamp(),
    ...adaptation,
  })
}

export async function updateLessonProgress({ userId, lessonId, payload }) {
  const lessonRef = doc(db, 'users', userId, 'lessons', lessonId)
  await updateDoc(lessonRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  })
}

export { db, storage }
