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
import logger from '../debug/logger.js'

const log = logger.create('db')

const db = getFirestore(app)
const storage = getStorage(app)

export async function createUserProfile(userId, payload) {
  log.debug('createUserProfile', userId)
  const docRef = doc(db, 'users', userId)
  await setDoc(docRef, {
    createdAt: serverTimestamp(),
    preferences: {},
    ...payload,
  })
  log.info('User profile created', userId)
}

export async function fetchUserProfile(userId) {
  log.debug('fetchUserProfile', userId)
  const docRef = doc(db, 'users', userId)
  const snapshot = await getDoc(docRef)
  log.debug('fetchUserProfile result', snapshot.exists() ? 'found' : 'not found')
  return snapshot.data()
}

export async function saveEmotionLog(userId, emotion) {
  log.debug('saveEmotionLog', userId, emotion)
  const logRef = collection(db, 'users', userId, 'emotionLogs')
  await addDoc(logRef, {
    ...emotion,
    createdAt: serverTimestamp(),
  })
  log.info('Emotion log saved', userId)
}

export async function listEmotionLogs(userId) {
  log.debug('listEmotionLogs', userId)
  const logRef = collection(db, 'users', userId, 'emotionLogs')
  const q = query(logRef, orderBy('createdAt', 'desc'))
  const snapshot = await getDocs(q)
  const results = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
  log.debug('listEmotionLogs returned', results.length, 'entries')
  return results
}

export async function saveDrawing({ userId, dataUrl, metadata }) {
  log.debug('saveDrawing', userId)
  const storageRef = ref(storage, `users/${userId}/drawings/${Date.now()}.png`)
  await uploadString(storageRef, dataUrl, 'data_url', metadata)
  log.info('Drawing saved', storageRef.fullPath)
  return storageRef.fullPath
}

export async function logAdaptation({ userId, adaptation }) {
  log.debug('logAdaptation', userId, adaptation)
  const collectionRef = collection(db, 'users', userId, 'adaptations')
  await addDoc(collectionRef, {
    createdAt: serverTimestamp(),
    ...adaptation,
  })
  log.info('Adaptation logged', userId)
}

export async function updateLessonProgress({ userId, lessonId, payload }) {
  log.debug('updateLessonProgress', userId, lessonId, payload)
  const lessonRef = doc(db, 'users', userId, 'lessons', lessonId)
  await updateDoc(lessonRef, {
    ...payload,
    updatedAt: serverTimestamp(),
  })
  log.info('Lesson progress updated', userId, lessonId)
}

export async function saveAlphabetSession(sessionData) {
  log.debug('saveAlphabetSession', sessionData?.letter)
  const sessionRef = collection(db, 'sessions')
  await addDoc(sessionRef, {
    ...sessionData,
    timestamp: serverTimestamp(),
  })
  log.info('Alphabet session saved')
}

export async function uploadAlphabetCSV(userId, letter, csvContent) {
  log.debug('uploadAlphabetCSV', userId, letter)
  const sessionId = `session_${Date.now()}`
  const storageRef = ref(storage, `users/${userId}/letters/${letter}/${sessionId}.csv`)
  await uploadString(storageRef, csvContent, 'raw', {
    contentType: 'text/csv',
  })
  log.info('Alphabet CSV uploaded', storageRef.fullPath)
  return storageRef.fullPath
}

export { db, storage }
