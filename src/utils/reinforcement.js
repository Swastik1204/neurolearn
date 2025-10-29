import { analyseStrokeEmotion } from './emotionAnalysis.js'

export async function calculateAdaptation({ strokes, performance, emotionState }) {
  const insights = await analyseStrokeEmotion(strokes)

  const difficultyDelta = insights.frustration > 0.6 ? -1 : performance.accuracy > 0.7 ? 1 : 0
  const nextMode =
    insights.frustration > 0.6
      ? 'colouring'
      : emotionState.mood === 'joyful'
        ? 'story'
        : 'drawing'

  return {
    ...insights,
    difficultyDelta,
    nextMode,
    prompt:
      difficultyDelta < 0
        ? 'Let’s invite a gentle break with soft colours and breathing prompts.'
        : 'Awesome progress! Try a slightly tighter curve challenge.',
  }
}

export function buildFirestorePayload({ userId, adaptation, strokes }) {
  // Structure Firestore document; adjust collection names to your data model.
  return {
    path: `users/${userId}/sessions`,
    data: {
      createdAt: new Date().toISOString(),
      adaptation,
      strokes,
    },
  }
}
