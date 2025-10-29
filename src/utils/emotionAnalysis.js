import * as tf from '@tensorflow/tfjs'

let cachedModel

export async function loadEmotionModel(modelUrl = '/models/stroke-emotion/model.json') {
  if (cachedModel) return cachedModel
  try {
    cachedModel = await tf.loadLayersModel(modelUrl)
    return cachedModel
  } catch (error) {
    console.error('[emotionAnalysis] Failed to load TensorFlow.js model', error)
    return null
  }
}

function normaliseStroke(stroke) {
  const times = stroke.map((point) => point.time)
  const duration = Math.max(times[times.length - 1] - times[0], 1)
  const velocities = stroke.slice(1).map((point, index) => {
    const prev = stroke[index]
    const distance = Math.hypot(point.x - prev.x, point.y - prev.y)
    const deltaTime = Math.max(point.time - prev.time, 1)
    return distance / deltaTime
  })

  const avgVelocity = velocities.reduce((sum, value) => sum + value, 0) / Math.max(velocities.length, 1)

  return [
    stroke.length,
    duration,
    avgVelocity,
    Math.max(...velocities, 0),
  ]
}

export async function analyseStrokeEmotion(strokes) {
  if (!strokes || strokes.length === 0) {
    return {
      frustration: 0.2,
      confidence: 0.6,
      recommendation: 'Encourage gentle tracing with a calming breath.',
    }
  }

  const model = await loadEmotionModel()
  const features = strokes.map(normaliseStroke)
  const tensor = tf.tensor2d(features)

  try {
    if (!model) throw new Error('Model missing')
    const prediction = model.predict(tensor)
    const data = await prediction.data()
    const [frustration = 0.2, confidence = 0.6] = data

    return {
      frustration,
      confidence,
      recommendation:
        frustration > 0.6
          ? 'Switch to a colouring activity with warm colours to reduce frustration.'
          : 'Great job! Introduce a slightly trickier curve challenge.',
    }
  } catch (error) {
    console.warn('[emotionAnalysis] Falling back to heuristic scoring', error)
    const fallback = features.reduce(
      (acc, [, duration, avgVelocity]) => {
        return {
          frustration: acc.frustration + duration / 2000,
          confidence: acc.confidence + (avgVelocity > 0.3 ? 0.1 : -0.05),
        }
      },
      { frustration: 0.2, confidence: 0.6 },
    )
    return {
      frustration: Math.min(fallback.frustration, 1),
      confidence: Math.max(Math.min(fallback.confidence, 1), 0),
      recommendation: 'Adaptive heuristic used. Connect the TensorFlow model for richer insights.',
    }
  } finally {
    tensor.dispose()
  }
}
