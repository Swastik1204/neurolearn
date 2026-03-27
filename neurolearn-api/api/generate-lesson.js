import { setCors } from '../lib/cors.js';
import { verifyToken, getUserRole } from '../lib/auth.js';
import { generateLesson } from '../lib/genAI.js';

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const decoded = await verifyToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });

    const role = await getUserRole(decoded.uid);
    if (role !== 'student') return res.status(403).json({ error: 'Students only' });

    const { topic, difficulty, childName } = req.body;
    
    const fullText = await generateLesson(topic || 'reading', difficulty || 'easy', childName || 'Student');
    
    // Parse words from [WORDS: ...] format
    const wordsMatch = fullText.match(/\[WORDS:\s*([^\]]+)\]/i);
    const words = wordsMatch 
      ? wordsMatch[1].split(',').map(w => w.trim()).filter(w => w.length > 0)
      : [];
    
    // Remove the words marker from the lesson text
    const lesson = fullText.replace(/\[WORDS:\s*[^\]]+\]/i, '').trim();

    return res.status(200).json({ lesson, words });
  } catch (error) {
    console.error('generate-lesson error:', error.message);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
