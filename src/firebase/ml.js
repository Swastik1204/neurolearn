import { getFunctions, httpsCallable } from 'firebase/functions'
import { getStorage, listAll, ref } from 'firebase/storage'
import { app } from './config.js'
import logger from '../debug/logger.js'

const log = logger.create('ml')

const functions = getFunctions(app)
const storage = getStorage(app)

export async function callLessonPlanner(payload) {
  log.info('Calling lesson planner cloud function', payload)
  const planner = httpsCallable(functions, 'generateLessonPlan')
  const result = await planner(payload)
  log.debug('Lesson planner result', result.data)
  return result.data
}

export async function listHostedModels(prefix = 'models/') {
  log.debug('Listing hosted models', prefix)
  const listRef = ref(storage, prefix)
  const result = await listAll(listRef)
  const paths = result.items.map((item) => item.fullPath)
  log.debug('Found', paths.length, 'models')
  return paths
}

export async function fetchModelMetadata(modelPath) {
  log.debug('fetchModelMetadata', modelPath)
  // Extend this to pull manifest JSON alongside TensorFlow.js weights.
  return { modelPath, lastUpdated: new Date().toISOString() }
}
