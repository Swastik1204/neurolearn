function pick(list, fallback = '') {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  return list[Math.floor(Math.random() * list.length)] ?? fallback;
}

function capitalize(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeTopic(topic) {
  const raw = String(topic || '').trim();
  return raw || 'reading';
}

function normalizeDifficulty(difficulty) {
  const allowed = ['easy', 'medium', 'hard'];
  const level = String(difficulty || 'easy').toLowerCase();
  return allowed.includes(level) ? level : 'easy';
}

function relatedWords(topic) {
  const baseWords = [
    'sound', 'letter', 'trace', 'read', 'write', 'focus', 'shape', 'story',
  ];

  const themedWords = {
    reading: ['book', 'page', 'word', 'sound', 'blend', 'line', 'story'],
    phonics: ['sound', 'blend', 'vowel', 'consonant', 'syllable', 'word', 'read'],
    spelling: ['letter', 'pattern', 'chunk', 'word', 'sound', 'copy', 'write'],
    handwriting: ['stroke', 'curve', 'line', 'spacing', 'baseline', 'trace', 'grip'],
    writing: ['sentence', 'word', 'spacing', 'punctuation', 'line', 'idea', 'draft'],
  };

  const topicRoot = String(topic || 'reading')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 10) || 'reading';

  const fallbackTopicTokens = String(topic || '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .map((part) => part.trim())
    .filter((part, idx, arr) => part.length > 2 && arr.indexOf(part) === idx);

  const pool = [
    ...(themedWords[topicRoot] || []),
    ...fallbackTopicTokens,
    topicRoot,
    ...baseWords,
  ].filter((word, idx, arr) => word && arr.indexOf(word) === idx);
  const selected = [];

  while (selected.length < 6 && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    const [item] = pool.splice(index, 1);
    if (item && !selected.includes(item)) selected.push(item);
  }

  return selected;
}

/**
 * Generate a personalized lesson for a neurodivergent child.
 * @param {string} topic - The topic or word to teach
 * @param {string} difficulty - 'easy' | 'medium' | 'hard'
 * @param {string} childName - Child's first name for personalisation
 */
export async function generateLesson(topic, difficulty = 'easy', childName = 'there') {
  const safeTopic = normalizeTopic(topic);
  const safeDifficulty = normalizeDifficulty(difficulty);
  const safeName = String(childName || 'there').trim() || 'there';

  const starter = pick([
    `Nice work, ${safeName}! Today we practice ${safeTopic}.`,
    `${safeName}, you are doing great with ${safeTopic} today.`,
    `Great energy, ${safeName}. Let us explore ${safeTopic}.`,
  ]);

  const core = pick([
    `Say the sound slowly, then write it with calm strokes.`,
    `Read the word once, then trace each letter with care.`,
    `Tap each sound with your finger before writing it.`,
  ]);

  const coachingByDifficulty = {
    easy: [
      'Keep each letter big and clear on one line.',
      'Take your time and smile after each try.',
    ],
    medium: [
      'Try smooth spacing between letters and steady pressure.',
      'Read, trace, and write once more without rushing.',
    ],
    hard: [
      'Challenge round: write it from memory, then check shape.',
      'Focus on rhythm, spacing, and clean letter turns.',
    ],
  };

  const activity = pick([
    `Activity: Build ${safeTopic} with letter cards, then read it aloud three times.`,
    `Activity: Write ${safeTopic} in sand or rice for a fun texture drill.`,
    `Activity: Do a quick color trace of ${safeTopic}, then copy it once.`,
  ]);

  const words = relatedWords(safeTopic);
  const content = [
    starter,
    core,
    pick(coachingByDifficulty[safeDifficulty]),
    activity,
    `[WORDS: ${words.join(', ')}]`,
  ];

  return content.join(' ');
}

/**
 * Generate a weekly progress summary for a guardian.
 * @param {object} weekData - { childName, sessionsCompleted, avgScore, topIndicators }
 */
export async function generateWeeklyReport(weekData) {
  const {
    childName,
    sessionsCompleted,
    avgScore,
    topIndicators,
    strongestMetric,
    weakestMetric,
    highestPressureLetters,
    practicedLetters,
    recentInterpretations,
  } = weekData;
  const safeName = String(childName || 'your child').trim() || 'your child';
  const safeSessions = Number.isFinite(Number(sessionsCompleted)) ? Number(sessionsCompleted) : 0;
  const safeScore = Number.isFinite(Number(avgScore)) ? Math.round(Number(avgScore)) : 0;
  const supportLetters = highestPressureLetters?.join(', ') || 'a few focus letters';
  const practiced = practicedLetters?.join(', ') || 'multiple letters';
  const strongMetric = strongestMetric
    ? `${strongestMetric[0]} (${Math.round(strongestMetric[1] * 100)}%)`
    : 'steady effort';
  const weakMetric = weakestMetric
    ? `${weakestMetric[0]} (${Math.round(weakestMetric[1] * 100)}%)`
    : 'consistency';
  const insights = topIndicators?.join(', ') || 'general letter practice';
  const interpretationHint = recentInterpretations?.[0] ? String(recentInterpretations[0]).trim() : '';

  const paragraph1 = pick([
    `Your child, ${safeName}, completed ${safeSessions} sessions this week with an average score of ${safeScore}/100. A clear strength was ${strongMetric}, and we also noticed positive effort in ${practiced}.`,
    `${safeName} stayed engaged through ${safeSessions} sessions and reached an average of ${safeScore}/100. The strongest pattern was ${strongMetric}, with encouraging progress across ${practiced}.`,
    `Across ${safeSessions} sessions, ${safeName} showed steady momentum with an average score of ${safeScore}/100. We saw confidence in ${strongMetric} and good repetition on ${practiced}.`,
  ]);

  const paragraph2 = pick([
    `One gentle area to support is ${weakMetric}, especially around ${supportLetters}. Short daily practice with calm pacing can keep progress steady.`,
    `A useful next focus is ${weakMetric}. Giving extra attention to ${supportLetters} with slow, guided tracing should help strengthen control.`,
    `The next growth target is ${weakMetric}, with special care on ${supportLetters}. Small, frequent practice blocks can improve stability and confidence.`,
  ]);

  const paragraph3Intro = pick([
    `Parent tip: celebrate effort first, then refine one detail at a time. Activities:`,
    `Parent tip: keep sessions short, upbeat, and repeatable. Activities:`,
    `Parent tip: use the same warm routine each day for confidence. Activities:`,
  ]);

  const activityPool = [
    `1) Trace ${supportLetters} with finger-to-pencil transition for 5 minutes.`,
    `2) Read a short line aloud, then copy one key word neatly.`,
    `3) Use a color-coded baseline to keep letters anchored.`,
    `1) Build ${practiced} using magnetic letters, then write two of them.`,
    `2) Do a slow-write drill: say each sound before each stroke.`,
    `3) End with one proud sentence and circle the best-shaped letter.`,
    `1) Use sand-tracing for ${supportLetters}, then copy on paper once.`,
    `2) Practice spacing with finger gaps between words.`,
    `3) Replay one successful word three times to lock in form.`,
  ];

  const activitySet = pick([
    activityPool.slice(0, 3),
    activityPool.slice(3, 6),
    activityPool.slice(6, 9),
  ]);

  const optionalLine = interpretationHint
    ? ` Recent note: ${interpretationHint.replace(/\.+$/, '')}.`
    : '';

  return [
    `${paragraph1}${optionalLine}`,
    `${paragraph2} Key observation this week: ${insights}.`,
    `${paragraph3Intro} ${activitySet.join(' ')}`,
  ].join('\n\n');
}

/**
 * Generate a short 2-sentence interpretation of a specific letter result for parents.
 */
export async function generateHandwritingInterpretation(data) {
  const { letter, scores, letter_specific, studentName } = data;

  const safeLetter = capitalize(letter || 'this letter');
  const safeName = String(studentName || 'your child').trim() || 'your child';
  const form = Number(scores?.letterFormScore ?? 0);
  const spacing = Number(scores?.spacingScore ?? 0);
  const baseline = Number(scores?.baselineScore ?? 0);
  const reversal = Number(scores?.reversalScore ?? 0);
  const overall = Number(scores?.overallRisk ?? 0);

  const strongest = [
    ['letter form', form],
    ['spacing', spacing],
    ['baseline control', baseline],
  ].sort((a, b) => b[1] - a[1])[0]?.[0] || 'steady effort';

  const support = reversal >= 60
    ? 'reversal awareness'
    : [
      ['letter form', form],
      ['spacing', spacing],
      ['baseline control', baseline],
    ].sort((a, b) => a[1] - b[1])[0]?.[0] || 'consistency';

  const observation = pick([
    `${safeName} showed promising control on letter ${safeLetter}, with strongest results in ${strongest} and an overall risk score near ${overall.toFixed(2)}.`,
    `This attempt on ${safeLetter} highlights growing confidence in ${strongest}, while still leaving room to strengthen ${support}.`,
    `The ${safeLetter} sample shows good effort from ${safeName}, especially in ${strongest}, with a manageable support need in ${support}.`,
  ]);

  const specificHint = letter_specific?.note
    ? ` ${String(letter_specific.note).replace(/\.$/, '')}.`
    : '';

  const suggestion = pick([
    `Try one minute of slow air-writing for ${safeLetter}, then trace it on a guided line with light pressure.${specificHint}`,
    `Practice ${safeLetter} in sand first, then copy it three times on paper while saying each sound clearly.${specificHint}`,
    `Use a start-dot and end-dot for ${safeLetter} so stroke direction stays clear and consistent.${specificHint}`,
  ]);

  return `${observation} ${suggestion}`.trim();
}
