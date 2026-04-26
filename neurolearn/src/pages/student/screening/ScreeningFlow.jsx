import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import useCurrentUser from '@/hooks/useCurrentUser';
import WritingCanvas from '@/components/canvas/WritingCanvas';
import { analyzeHandwriting } from '@/services/api';

const VISUAL_QUESTIONS = [
  { target: 'b', options: ['d', 'b', 'p', 'q'], correct: 'b' },
  { target: 'd', options: ['b', 'd', 'q', 'p'], correct: 'd' },
  { target: 'p', options: ['q', 'b', 'p', 'd'], correct: 'p' },
  { target: 'q', options: ['p', 'q', 'd', 'b'], correct: 'q' },
  { target: 'n', options: ['u', 'm', 'n', 'h'], correct: 'n' },
  { target: 'u', options: ['n', 'u', 'm', 'v'], correct: 'u' },
  { target: 'b', options: ['p', 'd', 'q', 'b'], correct: 'b' },
  { target: 'd', options: ['d', 'b', 'p', 'q'], correct: 'd' },
  { target: 'was', options: ['saw', 'was', 'maw', 'waz'], correct: 'was' },
  { target: 'saw', options: ['was', 'saw', 'sow', 'sap'], correct: 'saw' },
  { target: 'no', options: ['on', 'no', 'mo', 'nu'], correct: 'no' },
  { target: 'on', options: ['no', 'on', 'om', 'an'], correct: 'on' },
];

const PHONOLOGY_QUESTIONS = [
  { question: 'Which word starts with the sound /b/?', options: ['dog', 'bed', 'cat'], correct: 'bed', category: 'initial_sounds' },
  { question: 'Which word starts with the sound /d/?', options: ['pig', 'sun', 'dig'], correct: 'dig', category: 'initial_sounds' },
  { question: 'Which word rhymes with CAT?', options: ['hat', 'dog', 'bin'], correct: 'hat', category: 'rhyming' },
  { question: 'Which word rhymes with PIG?', options: ['fan', 'big', 'top'], correct: 'big', category: 'rhyming' },
  { question: 'Which word has 3 sounds?', options: ['at', 'stop', 'sun'], correct: 'sun', category: 'phoneme_counting' },
  { question: 'Tap the word that sounds like it starts with /p/', options: ['ball', 'pen', 'door'], correct: 'pen', category: 'initial_sounds' },
  { question: 'Which word ends with the sound /t/?', options: ['sit', 'run', 'bed'], correct: 'sit', category: 'final_sounds' },
  { question: 'Which word rhymes with LOG?', options: ['pin', 'dog', 'hat'], correct: 'dog', category: 'rhyming' },
  { question: 'Which word starts with the same sound as BIG?', options: ['ball', 'dig', 'fig'], correct: 'ball', category: 'initial_sounds' },
  { question: 'Which word has the same middle sound as HIT?', options: ['hot', 'bit', 'hat'], correct: 'bit', category: 'final_sounds' },
];

const TRACE_LETTERS = ['B', 'D', 'p', 'q'];

const STEP_TITLES = [
  'Step 1 of 3 — Letter Recognition',
  'Step 2 of 3 — Letter Tracing',
  'Step 3 of 3 — Sound Awareness',
];

const RISK_PATH_HINT = {
  reversal_reinforcement: 'Gentle focus: reinforce similar letter orientation through side-by-side tracing.',
  phonological_reinforcement: 'Gentle focus: build sound awareness through rhyming and initial-sound games.',
  motor_development: 'Gentle focus: strengthen writing control with slower guided stroke practice.',
  confidence_pacing: 'Gentle focus: support confidence with calm pacing and short, successful attempts.',
  general_practice: 'Gentle focus: continue balanced everyday reading and writing practice.',
};

function clamp01(value, fallback = 0) {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.max(0, Math.min(1, num));
}

function avg(values = []) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function pairLabel(target, selected) {
  const t = String(target || '').toLowerCase();
  const s = String(selected || '').toLowerCase();
  if ((t === 'b' && s === 'd') || (t === 'd' && s === 'b')) return 'b/d';
  if ((t === 'p' && s === 'q') || (t === 'q' && s === 'p')) return 'p/q';
  if ((t === 'n' && s === 'u') || (t === 'u' && s === 'n')) return 'n/u';
  if ((t === 'was' && s === 'saw') || (t === 'saw' && s === 'was')) return 'was/saw';
  if ((t === 'no' && s === 'on') || (t === 'on' && s === 'no')) return 'no/on';
  return null;
}

function moduleBandFromAccuracy(accuracy) {
  if (accuracy < 0.5) return 'high';
  if (accuracy < 0.75) return 'moderate';
  return 'low';
}

function getOverallRiskBand(m1, m2, m3) {
  const bands = [
    moduleBandFromAccuracy(m1.accuracy),
    m2.overallRiskBand,
    moduleBandFromAccuracy(m3.accuracy),
  ];

  const highCount = bands.filter((b) => b === 'high').length;
  const moderateCount = bands.filter((b) => b === 'moderate').length;

  if (highCount >= 2) return 'high';
  if (highCount >= 1 || moderateCount >= 2) return 'moderate';
  return 'low';
}

function getRecommendedPath(m1, m2, m3) {
  const confusedPairs = m1.confusedPairs || [];
  const weakAreas = m3.weakAreas || [];
  const avgProfile = m2.avgCognitiveProfile || {};

  if ((confusedPairs.includes('b/d') || confusedPairs.includes('p/q')) && clamp01(avgProfile.reversalRisk, 0) > 0.5) {
    return 'reversal_reinforcement';
  }
  if (weakAreas.includes('initial_sounds') || weakAreas.includes('rhyming')) {
    return 'phonological_reinforcement';
  }
  if (clamp01(avgProfile.writingMotor, 1) < 0.4) {
    return 'motor_development';
  }
  if (clamp01(avgProfile.strokeConfidence, 1) < 0.4) {
    return 'confidence_pacing';
  }
  return 'general_practice';
}

function ProgressDots({ total, current }) {
  return (
    <div className="flex justify-center gap-2 mt-8">
      {Array.from({ length: total }).map((_, idx) => (
        <div
          key={idx}
          className={`w-3 h-3 rounded-full transition-all duration-300 ${
            idx === current ? 'bg-primary scale-125' : idx < current ? 'bg-primary/40' : 'bg-muted border border-border'
          }`}
        />
      ))}
    </div>
  );
}

function VisualDiscriminationModule({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState([]);
  const startTimeRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = performance.now();
  }, [index]);

  const current = VISUAL_QUESTIONS[index];

  const complete = (allRows) => {
    const correctAnswers = allRows.filter((row) => row.correct).length;
    const accuracy = correctAnswers / VISUAL_QUESTIONS.length;
    const avgReactionTimeMs = Math.round(avg(allRows.map((row) => row.reactionTimeMs)));

    const confused = [];
    allRows.forEach((row) => {
      if (row.correct) return;
      const label = pairLabel(row.target, row.selected);
      if (label && !confused.includes(label)) confused.push(label);
    });

    const targets = [...new Set(VISUAL_QUESTIONS.map((q) => q.target))];
    const letterAccuracy = targets.reduce((acc, target) => {
      const targetRows = allRows.filter((row) => row.target === target);
      const targetCorrect = targetRows.filter((row) => row.correct).length;
      acc[target] = targetRows.length ? targetCorrect / targetRows.length : 0;
      return acc;
    }, {});

    onComplete({
      module: 'visual_discrimination',
      totalQuestions: VISUAL_QUESTIONS.length,
      correctAnswers,
      accuracy,
      avgReactionTimeMs,
      confusedPairs: confused,
      letterAccuracy,
      byQuestion: allRows,
    });
  };

  const handleSelect = (selected, eventTimeStamp) => {
    const reactionTimeMs = Math.max(0, Math.round(eventTimeStamp - startTimeRef.current));
    const row = {
      questionIndex: index + 1,
      target: current.target,
      selected,
      correct: selected === current.correct,
      reactionTimeMs,
    };

    const nextRows = [...rows, row];
    setRows(nextRows);

    if (index === VISUAL_QUESTIONS.length - 1) {
      complete(nextRows);
      return;
    }

    setIndex((value) => value + 1);
  };

  return (
    <div className="bg-[#FAFAF7] rounded-3xl border border-border p-6">
      <p className="text-lg text-muted-foreground text-center mb-4">Find this letter:</p>

      <div className="text-center mb-8">
        <span
          className="font-bold text-foreground leading-none"
          style={{ fontFamily: '"OpenDyslexic", sans-serif', fontSize: '120px' }}
        >
          {current.target}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-xl mx-auto">
        {current.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={(event) => handleSelect(option, event.timeStamp)}
            className="rounded-2xl border border-border bg-card hover:bg-muted transition-all py-8 text-foreground font-bold"
            style={{ fontFamily: '"OpenDyslexic", sans-serif', fontSize: '80px' }}
          >
            {option}
          </button>
        ))}
      </div>

      <ProgressDots total={VISUAL_QUESTIONS.length} current={index} />
    </div>
  );
}

function LetterTracingModule({ onComplete }) {
  const { user } = useCurrentUser();
  const [index, setIndex] = useState(0);
  const [byLetter, setByLetter] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const currentLetter = TRACE_LETTERS[index];

  const finalize = (nextByLetter) => {
    const entries = TRACE_LETTERS.map((letter) => nextByLetter[letter]).filter(Boolean);

    const avgCognitiveProfile = {
      writingMotor: avg(entries.map((entry) => clamp01(entry.cognitiveProfile?.writingMotor, 0.5))),
      reversalRisk: avg(entries.map((entry) => clamp01(entry.cognitiveProfile?.reversalRisk, 0.5))),
      letterConsistency: avg(entries.map((entry) => clamp01(entry.cognitiveProfile?.letterConsistency, 0.5))),
      strokeConfidence: avg(entries.map((entry) => clamp01(entry.cognitiveProfile?.strokeConfidence, 0.5))),
    };

    const avgOverallRisk = avg(entries.map((entry) => clamp01(entry.scores?.overallRisk, 0.5)));

    let overallRiskBand = 'low';
    if (avgCognitiveProfile.reversalRisk > 0.65 || avgOverallRisk > 0.65) {
      overallRiskBand = 'high';
    } else if (avgCognitiveProfile.reversalRisk > 0.35 || avgOverallRisk > 0.35) {
      overallRiskBand = 'moderate';
    }

    onComplete({
      module: 'letter_tracing',
      lettersTraced: [...TRACE_LETTERS],
      byLetter: nextByLetter,
      avgCognitiveProfile,
      overallRiskBand,
    });
  };

  const handleSubmit = async ({ imageBlob, strokeMetadata }) => {
    if (!user?.uid || submitting) return;

    setSubmitting(true);
    setError('');

    try {
      const imageBase64 = await toDataURL(imageBlob);

      const sampleRef = await addDoc(collection(db, 'handwritingSamples'), {
        studentId: user.uid,
        capturedAt: serverTimestamp(),
        promptLetter: currentLetter,
        letter: currentLetter,
        strokeMetadata,
        analysisStatus: 'pending',
        analysisResult: {},
        source: 'screening',
        screeningModule: true,
      });

      const response = await analyzeHandwriting({
        sampleId: sampleRef.id,
        imageBase64,
        studentId: user.uid,
        letter: currentLetter,
        strokeMetadata,
      });

      const data = response?.data || {};

      const entry = {
        scores: data.scores || {},
        cognitiveProfile: data.cognitiveProfile || data.cognitive_profile || null,
        geminiInterpretation: data.geminiInterpretation || data.gemini_interpretation || null,
        strokeMetadata,
      };

      const nextByLetter = {
        ...byLetter,
        [currentLetter]: entry,
      };
      setByLetter(nextByLetter);

      if (index === TRACE_LETTERS.length - 1) {
        finalize(nextByLetter);
      } else {
        setIndex((value) => value + 1);
      }
    } catch (submitError) {
      console.error('Letter tracing screening failed:', submitError.message);
      setError('We could not process that trace. Please try this letter again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#FAFAF7] rounded-3xl border border-border p-6">
      <div className="text-center mb-6">
        <p className="text-lg text-muted-foreground mb-2">Trace this letter:</p>
        <span
          className="font-bold text-foreground leading-none"
          style={{ fontFamily: '"OpenDyslexic", sans-serif', fontSize: '160px' }}
        >
          {currentLetter}
        </span>
        <p className="text-sm text-muted-foreground mt-3">{`Letter ${index + 1} of ${TRACE_LETTERS.length}`}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/10 px-4 py-2 text-sm text-warning">
          {error}
        </div>
      )}

      <WritingCanvas
        key={currentLetter}
        prompt={currentLetter}
        onSubmit={handleSubmit}
        disabled={submitting}
      />

      {submitting && (
        <p className="text-center text-sm text-muted-foreground mt-4">Analysing your tracing...</p>
      )}
    </div>
  );
}

function PhonologicalModule({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [rows, setRows] = useState([]);
  const startTimeRef = useRef(0);

  useEffect(() => {
    startTimeRef.current = performance.now();
  }, [index]);

  const current = PHONOLOGY_QUESTIONS[index];

  const complete = (allRows) => {
    const correctAnswers = allRows.filter((row) => row.correct).length;
    const accuracy = correctAnswers / PHONOLOGY_QUESTIONS.length;
    const avgReactionTimeMs = Math.round(avg(allRows.map((row) => row.reactionTimeMs)));

    const categoryStats = allRows.reduce((acc, row) => {
      if (!acc[row.category]) {
        acc[row.category] = { total: 0, correct: 0 };
      }
      acc[row.category].total += 1;
      if (row.correct) {
        acc[row.category].correct += 1;
      }
      return acc;
    }, {});

    const weakAreas = Object.entries(categoryStats)
      .filter(([, stats]) => (stats.correct / stats.total) < 0.5)
      .map(([category]) => category);

    onComplete({
      module: 'phonological_awareness',
      totalQuestions: PHONOLOGY_QUESTIONS.length,
      correctAnswers,
      accuracy,
      avgReactionTimeMs,
      weakAreas,
      byQuestion: allRows,
    });
  };

  const handleSelect = (selected, eventTimeStamp) => {
    const reactionTimeMs = Math.max(0, Math.round(eventTimeStamp - startTimeRef.current));

    const row = {
      questionIndex: index + 1,
      questionText: current.question,
      selected,
      correct: selected === current.correct,
      reactionTimeMs,
      category: current.category,
    };

    const nextRows = [...rows, row];
    setRows(nextRows);

    if (index === PHONOLOGY_QUESTIONS.length - 1) {
      complete(nextRows);
      return;
    }

    setIndex((value) => value + 1);
  };

  return (
    <div className="bg-[#FAFAF7] rounded-3xl border border-border p-6">
      <p className="text-2xl text-foreground text-center mb-8" style={{ minHeight: '72px' }}>
        {current.question}
      </p>

      <div className="max-w-2xl mx-auto flex flex-col gap-4">
        {current.options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={(event) => handleSelect(option, event.timeStamp)}
            className="rounded-2xl border border-border bg-card hover:bg-muted transition-all py-6 px-4 text-foreground font-bold"
            style={{ fontFamily: '"OpenDyslexic", sans-serif', fontSize: '32px' }}
          >
            {option}
          </button>
        ))}
      </div>

      <ProgressDots total={PHONOLOGY_QUESTIONS.length} current={index} />
    </div>
  );
}

export default function ScreeningFlow() {
  const { user, loading: authLoading } = useCurrentUser();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [moduleResults, setModuleResults] = useState({
    visual: null,
    tracing: null,
    phonology: null,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const canRender = !authLoading && Boolean(user?.uid);

  const handleScreeningComplete = async (nextResults) => {
    if (!user?.uid) return;

    const module1 = nextResults.visual;
    const module2 = nextResults.tracing;
    const module3 = nextResults.phonology;

    const overallRiskBand = getOverallRiskBand(module1, module2, module3);
    const recommendedPath = getRecommendedPath(module1, module2, module3);

    const completedAt = new Date().toISOString();

    const baselineProfile = {
      screeningVersion: '1.0',
      completedAt,
      modulesCompleted: ['visual_discrimination', 'letter_tracing', 'phonological_awareness'],
      visualDiscrimination: {
        accuracy: module1.accuracy,
        avgReactionTimeMs: module1.avgReactionTimeMs,
        confusedPairs: module1.confusedPairs,
      },
      writingProfile: {
        avgCognitiveProfile: module2.avgCognitiveProfile,
        overallRiskBand: module2.overallRiskBand,
        byLetter: module2.byLetter,
      },
      phonologicalAwareness: {
        accuracy: module3.accuracy,
        avgReactionTimeMs: module3.avgReactionTimeMs,
        weakAreas: module3.weakAreas,
      },
      overallRiskBand,
      recommendedPath,
      recommendedPathHint: RISK_PATH_HINT[recommendedPath],
      isScreeningNotDiagnosis: true,
    };

    try {
      setSaving(true);
      setSaveError('');

      await setDoc(doc(db, 'users', user.uid), {
        screeningCompleted: true,
        baselineProfile,
      }, { merge: true });

      await addDoc(collection(db, 'screeningResults'), {
        studentId: user.uid,
        completedAt: serverTimestamp(),
        baselineProfile,
        moduleResults: {
          visualDiscrimination: module1,
          letterTracing: module2,
          phonologicalAwareness: module3,
        },
      });

      navigate('/student/screening/complete', { replace: true });
    } catch (error) {
      console.error('Failed to save screening:', error.message);
      setSaveError('We could not save your screening yet. Please try again in a moment.');
      setSaving(false);
    }
  };

  const onVisualComplete = (visual) => {
    setModuleResults((prev) => ({ ...prev, visual }));
    setStep(1);
  };

  const onTracingComplete = (tracing) => {
    setModuleResults((prev) => ({ ...prev, tracing }));
    setStep(2);
  };

  const onPhonologyComplete = async (phonology) => {
    const next = { ...moduleResults, phonology };
    setModuleResults(next);
    await handleScreeningComplete(next);
  };

  let screen = <PhonologicalModule onComplete={onPhonologyComplete} />;
  if (step === 0) {
    screen = <VisualDiscriminationModule onComplete={onVisualComplete} />;
  } else if (step === 1) {
    screen = <LetterTracingModule onComplete={onTracingComplete} />;
  }

  if (!canRender) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center student-view">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background student-view px-6 py-8">
      <main className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Let&apos;s do your first learning check-in</h1>
          <p className="text-muted-foreground text-lg">{STEP_TITLES[step]}</p>
        </div>

        {saveError && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center">
            {saveError}
          </div>
        )}

        {screen}

        {saving && (
          <div className="mt-6 text-center text-muted-foreground">
            Saving your learning profile...
          </div>
        )}
      </main>
    </div>
  );
}
