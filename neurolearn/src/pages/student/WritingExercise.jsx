import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, getDoc, doc, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/services/firebase';
import useCurrentUser from '@/hooks/useCurrentUser';
import useEmotionDetection from '@/hooks/useEmotionDetection';
import WritingCanvas from '@/components/canvas/WritingCanvas';
import TextToSpeech from '@/components/TextToSpeech';
import { analyzeHandwriting } from '@/services/api';
import { ensureSessionsCollection } from '@/lib/utils';
import mlService from '../../services/mlService';
import { BookOpen, ArrowLeft, Timer } from 'lucide-react';

const DEFAULT_LETTERS = ['b', 'd', 'p', 'q', 'g', 'y', 'f', 'h', 'n', 'm'];
const DIFFICULTY_PRESETS = {
  easy: {
    letters: ['a', 'e', 'i', 'o', 'c', 'm', 'n', 's', 'u', 'w'],
    promptSize: '160px',
    apiTimeoutMs: 3500,
    paceLabel: 'Relaxed pace',
    timePerLetterMs: 8000,
  },
  medium: {
    letters: DEFAULT_LETTERS,
    promptSize: '120px',
    apiTimeoutMs: 2500,
    paceLabel: 'Standard pace',
    timePerLetterMs: 5000,
  },
  hard: {
    letters: ['b', 'd', 'p', 'q', 'b', 'd', 'p', 'q', 'g', 'y'],
    promptSize: '80px',
    apiTimeoutMs: 1500,
    paceLabel: 'Challenge pace',
    timePerLetterMs: 3000,
  },
};

const EMOTION_EMOJI = {
  happy: '🙂',
  sad: '😢',
  angry: '😠',
  fearful: '😨',
  disgusted: '🤢',
  surprised: '😮',
  neutral: '😐',
};

export default function WritingExercise() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    videoRef,
    dominantEmotion,
    emotionConfidence,
    modelReady,
    cameraReady,
    modelsLoading,
  } = useEmotionDetection(true);

  const [practiceConfig, setPracticeConfig] = useState({ difficulty: 'medium', focusLetters: [] });
  const [configLoading, setConfigLoading] = useState(true);
  const [prompts, setPrompts] = useState(DEFAULT_LETTERS.map((l) => l.toUpperCase()));

  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const [wordTimings, setWordTimings] = useState([]);
  const startTimeRef = useRef(null);
  const submitInFlightRef = useRef(false);
  const submitHandlerRef = useRef(null);

  const letterResultsRef = useRef([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [letterFeedback, setLetterFeedback] = useState(null);
  const [letterResults, setLetterResults] = useState([]);

  // Initialization if any (mlService handled)
  useEffect(() => {
    mlService.initialize();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setConfigLoading(false);
      return;
    }

    let cancelled = false;

    const loadPracticeConfig = async () => {
      try {
        let studentData = null;

        const directRef = doc(db, 'students', user.uid);
        const directSnap = await getDoc(directRef);
        if (directSnap.exists()) {
          studentData = directSnap.data();
        } else {
          const byUidQ = query(
            collection(db, 'students'),
            where('uid', '==', user.uid),
            limit(1)
          );
          const byUidSnap = await getDocs(byUidQ);
          if (!byUidSnap.empty) {
            studentData = byUidSnap.docs[0].data();
          }
        }

        const resolvedConfig = {
          difficulty: (studentData?.practiceConfig?.difficulty || 'medium').toLowerCase(),
          focusLetters: studentData?.practiceConfig?.focusLetters || [],
        };

        const nextDifficulty = DIFFICULTY_PRESETS[resolvedConfig.difficulty]
          ? resolvedConfig.difficulty
          : 'medium';

        let nextPrompts = [];
        if (location.state?.words?.length > 0) {
          nextPrompts = location.state.words.map((w) => w[0]?.toUpperCase()).filter(Boolean);
        } else {
          const preset = DIFFICULTY_PRESETS[nextDifficulty];
          const focusLetters = (resolvedConfig.focusLetters || []).map((l) => String(l).toLowerCase());
          const adaptiveLetters = nextDifficulty === 'hard' && focusLetters.length > 0
            ? [...focusLetters.slice(0, 4), ...preset.letters].slice(0, 10)
            : preset.letters;
          nextPrompts = adaptiveLetters.map((l) => l.toUpperCase());
        }

        if (!cancelled) {
          setPracticeConfig({ difficulty: nextDifficulty, focusLetters: resolvedConfig.focusLetters || [] });
          setPrompts(nextPrompts.length > 0 ? nextPrompts : DEFAULT_LETTERS.map((l) => l.toUpperCase()));
          setCurrentIndex(0);
          setConfigLoading(false);
        }
      } catch (err) {
        console.error('Failed to load practice config:', err.message);
        if (!cancelled) {
          setPracticeConfig({ difficulty: 'medium', focusLetters: [] });
          setPrompts(DEFAULT_LETTERS.map((l) => l.toUpperCase()));
          setConfigLoading(false);
        }
      }
    };

    loadPracticeConfig();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, location.state?.words]);

  const difficultyProfile = DIFFICULTY_PRESETS[practiceConfig.difficulty] || DIFFICULTY_PRESETS.medium;
  const difficultyLabel = `${practiceConfig.difficulty.charAt(0).toUpperCase()}${practiceConfig.difficulty.slice(1)}`;
  const currentWord = prompts[currentIndex];
  const isLastWord = currentIndex === prompts.length - 1;
  const progress = prompts.length > 0 ? ((currentIndex) / prompts.length) * 100 : 0;

  const handleSubmit = async ({ imageBlob, strokeData, strokeMetadata = {}, submitMeta = {} }) => {
    if (submitInFlightRef.current || !currentWord) return;
    submitInFlightRef.current = true;

    const endTime = Date.now();
    const duration = startTimeRef.current ? endTime - startTimeRef.current : difficultyProfile.timePerLetterMs;
    setWordTimings((prev) => [...prev, { word: currentWord, durationMs: duration }]);

    setIsAnalysing(true);

    try {
      const canvas = document.querySelector('canvas');
      const imageBase64 = canvas ? canvas.toDataURL('image/png') : null;
      const studentId = user?.uid || 'anonymous';

      const canCaptureEmotion = cameraReady && modelReady && !modelsLoading;
      const emotionAtSubmit = canCaptureEmotion && dominantEmotion ? dominantEmotion : null;
      const emotionConfidenceAtSubmit = canCaptureEmotion && typeof emotionConfidence === 'number'
        ? emotionConfidence
        : null;

      const mergedStrokeMetadata = {
        ...strokeMetadata,
        currentLetter: currentWord,
        exerciseType: 'single_letter',
        autoSubmitted: !!submitMeta.autoSubmitted,
        timeUp: !!submitMeta.timeUp,
        submitReason: submitMeta.submitReason || 'manual',
      };

      const sampleDoc = await addDoc(collection(db, 'handwritingSamples'), {
        studentId,
        sessionId,
        capturedAt: serverTimestamp(),
        imageBase64,
        promptLetter: currentWord,
        emotionAtSubmit,
        emotionConfidence: emotionConfidenceAtSubmit,
        strokeMetadata: mergedStrokeMetadata,
        analysisStatus: 'pending',
        analysisResult: {},
      });

      const apiPromise = analyzeHandwriting({
        sampleId: sampleDoc.id,
        imageBase64,
        studentId,
        letter: currentWord.toLowerCase(),
        strokeMetadata: mergedStrokeMetadata,
        emotionAtSubmit,
        emotionConfidence: emotionConfidenceAtSubmit,
      });

      let result = null;
      try {
        result = await Promise.race([
          apiPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), difficultyProfile.apiTimeoutMs))
        ]);
      } catch (_) {
        // Keep the student flow moving while async analysis finishes server-side.
      }

      setIsAnalysing(false);

      const feedback = result ? {
        risk_level: result.risk_level,
        letter: currentWord,
        note: result.letter_specific?.note || '',
        emotionAtSubmit,
        emotionConfidence: emotionConfidenceAtSubmit,
        timeUp: !!submitMeta.timeUp,
      } : {
        risk_level: 'pending',
        letter: currentWord,
        note: 'Analysis in progress...',
        emotionAtSubmit,
        emotionConfidence: emotionConfidenceAtSubmit,
        timeUp: !!submitMeta.timeUp,
      };

      setLetterFeedback(feedback);
      setLetterResults((prev) => {
        const next = [...prev, feedback];
        letterResultsRef.current = next;
        return next;
      });

      setTimeout(() => {
        setLetterFeedback(null);
        if (isLastWord) {
          finishSession(duration);
        } else {
          setCurrentIndex((prev) => prev + 1);
          startTimeRef.current = Date.now();
        }
      }, 2000);
    } catch (error) {
      console.error('Submission failed:', error.message);
      setIsAnalysing(false);
      if (isLastWord) finishSession(duration);
      else {
        setCurrentIndex((prev) => prev + 1);
        startTimeRef.current = Date.now();
      }
    } finally {
      submitInFlightRef.current = false;
    }
  };

  useEffect(() => {
    submitHandlerRef.current = handleSubmit;
  }, [handleSubmit]);

  useEffect(() => {
    if (configLoading || !currentWord || isAnalysing || letterFeedback) return;

    startTimeRef.current = Date.now();
    const timeoutId = setTimeout(() => {
      if (submitInFlightRef.current || isAnalysing || letterFeedback) return;
      submitHandlerRef.current?.({
        strokeMetadata: {
          timedOut: true,
          timeoutMs: difficultyProfile.timePerLetterMs,
        },
        submitMeta: {
          autoSubmitted: true,
          timeUp: true,
          submitReason: 'time_up',
        },
      });
    }, difficultyProfile.timePerLetterMs);

    return () => clearTimeout(timeoutId);
  }, [currentIndex, currentWord, configLoading, isAnalysing, letterFeedback, difficultyProfile.timePerLetterMs]);

  const finishSession = async (lastDuration) => {
    try {
      await ensureSessionsCollection(db);
      const totalDuration = wordTimings.reduce((sum, w) => sum + w.durationMs, 0) + lastDuration;
      await addDoc(collection(db, 'sessions'), {
        studentId: user?.uid || 'anonymous',
        startedAt: serverTimestamp(),
        endedAt: serverTimestamp(),
        exerciseType: 'writing',
        durationMs: totalDuration,
        completionRate: 1.0,
        errorCorrectionCount: 0,
        pauseEvents: [],
        deviceType: navigator.maxTouchPoints > 0 ? 'touch' : 'mouse',
        timeOfDay: new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening',
        letterCount: prompts.length,
        exerciseMode: 'single_letter',
        practiceDifficulty: practiceConfig.difficulty,
      });
    } catch (err) {
      console.error('Session save failed:', err.message);
    }
    navigate('/student/complete', { state: { letterResults: letterResultsRef.current } });
  };

  const exerciseContent = (
    <div className="w-full relative">
      {(modelsLoading || cameraReady) && (
        <div className="absolute right-2 top-2 z-30">
          <div className="h-[90px] w-[120px] overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            {modelsLoading ? (
              <div className="h-full w-full flex items-center justify-center">
                <span className="loading loading-spinner loading-sm text-primary" />
              </div>
            ) : (
              <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
            )}
          </div>
          {cameraReady && dominantEmotion && (
            <p className="mt-1 text-xs font-medium text-foreground text-right">
              {EMOTION_EMOJI[dominantEmotion] || '😐'} {dominantEmotion}
            </p>
          )}
        </div>
      )}

      {/* Analysing Spinner Overlay */}
      {isAnalysing && (
        <div className="absolute inset-0 z-40 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-2xl animate-fade-in">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="font-bold text-primary animate-pulse text-lg">Analysing...</p>
          </div>
        </div>
      )}

      {/* Feedback Overlay */}
      {letterFeedback && (
        <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-md flex items-center justify-center rounded-2xl animate-scale-in">
          <div className={`p-8 rounded-3xl border-4 text-center max-w-xs w-full shadow-2xl ${
            letterFeedback.risk_level === 'low' ? 'bg-success/10 border-success text-success' :
            letterFeedback.risk_level === 'medium' ? 'bg-warning/10 border-warning text-warning' :
            letterFeedback.risk_level === 'high' ? 'bg-destructive/10 border-destructive text-destructive' :
            'bg-muted border-muted text-muted-foreground'
          }`}>
            <span className="text-6xl mb-4 block animate-bounce">
              {letterFeedback.risk_level === 'low' ? '🌟' : 
               letterFeedback.risk_level === 'medium' ? '👍' : 
               letterFeedback.risk_level === 'high' ? '💪' : '⏳'}
            </span>
            <h3 className="text-2xl font-black mb-2">
              {letterFeedback.risk_level === 'low' ? `Great ${letterFeedback.letter}!` :
               letterFeedback.risk_level === 'medium' ? 'Good try!' :
               letterFeedback.risk_level === 'high' ? `Practice ${letterFeedback.letter} again` : 
               'Working...'}
            </h3>
            <p className="text-sm font-medium opacity-90">
              {letterFeedback.risk_level === 'low' ? 'Clean formation.' :
               letterFeedback.risk_level === 'medium' ? `Watch your ${letterFeedback.letter} shape.` :
               letterFeedback.note || "Analysis in progress..."
              }
            </p>
          </div>
        </div>
      )}

      {/* Prompt */}
      <div className="text-center mb-10">
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
          <span className="badge badge-outline">Difficulty: {difficultyLabel}</span>
          <span className="badge badge-ghost gap-1">
            <Timer className="w-3.5 h-3.5" />
            {`${difficultyProfile.paceLabel} · ${Math.round(difficultyProfile.timePerLetterMs / 1000)}s per letter`}
          </span>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          {prompts.map((_, idx) => (
            <div 
              key={idx}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'bg-primary scale-125' :
                idx < currentIndex ? 'bg-primary/40' : 'bg-muted border border-border'
              }`}
            />
          ))}
        </div>

        <p className="text-lg text-muted-foreground mb-4 font-medium italic">Trace this letter:</p>
        <div className="flex flex-col items-center justify-center gap-6">
          <span 
            className="font-bold text-foreground leading-none select-none"
            style={{ 
              fontSize: difficultyProfile.promptSize,
              fontFamily: '"OpenDyslexic", "Inter", sans-serif',
              textShadow: '2px 2px 0px rgba(0,0,0,0.05)'
            }}
          >
            {currentWord}
          </span>
          <TextToSpeech text={currentWord} />
        </div>
      </div>

      {/* Canvas */}
      <WritingCanvas
        key={currentIndex}
        prompt={currentWord}
        onSubmit={handleSubmit}
        disabled={isAnalysing || !!letterFeedback}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background student-view">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/student')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground">Letter Tracing</span>
          </div>
          <div className="text-sm text-muted-foreground font-medium bg-muted px-3 py-1 rounded-full">
            Letter {currentIndex + 1} of {prompts.length}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="w-full h-2 bg-muted">
        <div
          className="h-full gradient-primary transition-all duration-500 ease-out rounded-r-full"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Main */}
      <main className="max-w-3xl mx-auto px-6 py-10">
        {configLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="loading loading-spinner loading-md text-primary" />
          </div>
        ) : (
          exerciseContent
        )}
      </main>
    </div>
  );
}
