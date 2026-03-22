import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.VITE_GENAI_API_KEY || process.env.GENAI_API_KEY; // Accommodate Vercel/Node environment variables
const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

/**
 * Generate a personalized lesson for a neurodivergent child.
 * @param {string} topic - The topic or word to teach
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @param {string} childName - Child's first name for personalisation
 */
export async function generateLesson(topic, difficulty = 'easy', childName = 'there') {
  const prompt = `You are a warm, encouraging teacher for children with dyslexia aged 6-12.
Create a short, fun lesson about the word or topic: "${topic}".
Difficulty level: ${difficulty}.
Address the child as ${childName}.
Rules:
- Use simple, short sentences (max 10 words each)
- Use lots of encouragement and positive language
- Include one fun activity suggestion at the end
- Never use the words "disability", "disorder", or "struggle"
- Format: 3-4 sentences of explanation, then one activity
Keep the total response under 120 words.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate a weekly progress summary for a guardian.
 * @param {object} weekData - { childName, sessionsCompleted, avgScore, topIndicators }
 */
export async function generateWeeklyReport(weekData) {
  const { childName, sessionsCompleted, avgScore, topIndicators } = weekData;
  const prompt = `You are a specialist educational psychologist writing a brief weekly
progress note for a parent of a child with dyslexia.
Child: ${childName}
Sessions this week: ${sessionsCompleted}
Average performance score: ${avgScore}/100
Key observations: ${topIndicators?.join(', ') || 'General writing practice'}

Write exactly 3 short paragraphs:
1. What went well this week (encouraging, specific)
2. One area to gently work on (never alarming, always hopeful)
3. Two practical activities to try at home

Rules: warm tone, plain language, no clinical jargon, under 150 words total,
second person ("Your child...").`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Analyse a handwriting description and return feedback.
 * @param {object} features - extracted handwriting feature object
 */
export async function analyzeHandwritingWithAI(features) {
  const prompt = `You are a specialist in children's handwriting and dyslexia.
Given these handwriting metrics from a child's writing session:
${JSON.stringify(features, null, 2)}

Provide a brief, warm, actionable summary (under 80 words) for a parent explaining:
- What the metrics suggest about the child's writing
- One specific encouragement
- One gentle tip to practice at home
Never use clinical or alarming language.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}
