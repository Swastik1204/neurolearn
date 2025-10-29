import { getFunctions, httpsCallable } from 'firebase/functions'
import { getStorage, listAll, ref } from 'firebase/storage'
import { app } from './config.js'

const functions = getFunctions(app)
const storage = getStorage(app)

export async function callLessonPlanner(payload) {
  const planner = httpsCallable(functions, 'generateLessonPlan')
  const result = await planner(payload)
  return result.data
}

export async function listHostedModels(prefix = 'models/') {
  const listRef = ref(storage, prefix)
  const result = await listAll(listRef)
  return result.items.map((item) => item.fullPath)
}

export async function fetchModelMetadata(modelPath) {
  // Extend this to pull manifest JSON alongside TensorFlow.js weights.
  return { modelPath, lastUpdated: new Date().toISOString() }
}
