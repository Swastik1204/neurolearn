const DEFAULT_STORY = {
  title: 'The Curvy Letter C Adventure',
  story:
    'Sunny the Seahorse loves drawing the letter C. Let\'s help Sunny trace smooth curves under the rainbow reef.',
  activities: [
    { id: 'trace', prompt: 'Trace the letter C three times with a big rainbow swirl.', mode: 'drawing' },
    { id: 'sensory', prompt: 'Colour the coral that curves like the letter C.', mode: 'colouring' },
    { id: 'story', prompt: 'Tell a short story about a creature whose name starts with C.', mode: 'storytelling' },
  ],
}

const DEFAULT_UPCOMING = [
  { id: 'warmup', focus: 'Gentle wrist warm-ups', mode: 'movement' },
  { id: 'multi-sensory', focus: 'Colourful phonics card for C', mode: 'flashcard' },
  { id: 'challenge', focus: 'C vs G comparison practice', mode: 'contrast' },
]

/**
 * Generates a text prompt for the selected LLM provider.
 * Plug in Gemini, OpenAI, or HuggingFace by replacing the fetch block below.
 */
async function callGenerativeApi({ prompt, provider = 'openai', apiKey }) {
  if (!apiKey) {
    console.warn('[genAI] Missing API key. Returning fallback lesson.')
    return DEFAULT_STORY
  }

  const baseUrl =
    provider === 'openai'
      ? 'https://api.openai.com/v1/responses'
      : provider === 'gemini'
        ? 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent'
        : 'https://api-inference.huggingface.co/models/gpt2'

  const headers = {
    'Content-Type': 'application/json',
    Authorization: provider === 'gemini' ? undefined : `Bearer ${apiKey}`,
  }

  const body =
    provider === 'gemini'
      ? {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          safetySettings: [],
        }
      : {
          model: provider === 'openai' ? 'gpt-4.1-mini' : undefined,
          input: prompt,
        }

  const response = await fetch(`${baseUrl}?key=${provider === 'gemini' ? apiKey : ''}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error('Generative API call failed')
  }

  await response.json()
  // TODO: Parse model-specific schema into the lesson format below.
  return DEFAULT_STORY
}

export async function generateAdaptiveLesson({ user, emotionState, performance }) {
  const apiKey = import.meta.env.VITE_GENAI_API_KEY
  const provider = import.meta.env.VITE_GENAI_PROVIDER || 'openai'

  const prompt = `Generate a playful literacy exercise for a ${user?.age || 7}-year-old child.
  The learner struggles with ${performance?.target || 'curved letters'} and currently feels ${emotionState?.mood || 'curious'}.
  Suggest a very short story + three varied activities (drawing, colouring, storytelling) that emphasise gentle success.`

  try {
    const lesson = await callGenerativeApi({ prompt, provider, apiKey })
    return {
      lesson,
      upcomingLessons: DEFAULT_UPCOMING,
    }
  } catch (error) {
    console.error('[genAI] Falling back to default template', error)
    return {
      lesson: DEFAULT_STORY,
      upcomingLessons: DEFAULT_UPCOMING,
    }
  }
}

export async function generateAlphabetVisual(letter) {
  // Placeholder for Replicate or image generation pipeline.
  console.info('[genAI] Request to generate visual for letter:', letter)
  return { url: null }
}
