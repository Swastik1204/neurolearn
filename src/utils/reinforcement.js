import { analyseStrokeEmotion } from './emotionAnalysis.js'
import logger from '../debug/logger.js'

const log = logger.create('reinforcement')

export async function calculateAdaptation({ strokes, performance, emotionState }) {
  log.debug('calculateAdaptation', { strokeCount: strokes?.length, accuracy: performance?.accuracy, mood: emotionState?.mood })
  const insights = await analyseStrokeEmotion(strokes)

  const difficultyDelta = insights.frustration > 0.6 ? -1 : performance.accuracy > 0.7 ? 1 : 0
  const nextMode =
    insights.frustration > 0.6
      ? 'colouring'
      : emotionState.mood === 'joyful'
        ? 'story'
        : 'drawing'

  log.debug('Adaptation result', { difficultyDelta, nextMode, frustration: insights.frustration })

  return {
    ...insights,
    difficultyDelta,
    nextMode,
    prompt:
      difficultyDelta < 0
        ? 'Let\'s invite a gentle break with soft colours and breathing prompts.'
        : 'Awesome progress! Try a slightly tighter curve challenge.',
  }
}

export function buildFirestorePayload({ userId, adaptation, strokes }) {
  // Structure Firestore document; adjust collection names to your data model.
  log.debug('buildFirestorePayload', userId)
  return {
    path: `users/${userId}/sessions`,
    data: {
      createdAt: new Date().toISOString(),
      adaptation,
      strokes,
    },
  }
}
