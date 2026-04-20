import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import useCurrentUser from '@/hooks/useCurrentUser';
import useEmotionDetection from '@/hooks/useEmotionDetection';
import WritingCanvas from '@/components/canvas/WritingCanvas';
import TextToSpeech from '@/components/TextToSpeech';
import { analyzeHandwriting } from '@/services/api';
import mlService from '../../services/mlService';
import { BookOpen, ArrowLeft } from 'lucide-react';

const EXERCISE_LENGTH = 2;
const DEFAULT_LETTERS = ['b', 'd'];
const DEFAULT_PROMPTS = DEFAULT_LETTERS.map((letter) => letter.toUpperCase());
const ANALYSIS_TIMEOUT_MS = 2500;

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
    cameraReady,
    modelsLoading,
  } = useEmotionDetection();

  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const sessionStartedAtRef = useRef(new Date());
  const [wordTimings, setWordTimings] = useState([]);
  const startTimeRef = useRef(null);
  const submitInFlightRef = useRef(false);

  const letterResultsRef = useRef([]);
  const [, setLetterResults] = useState([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [letterFeedback, setLetterFeedback] = useState(null);

  const resolvePrompts = useCallback(() => {
    if (location.state?.words?.length > 0) {
      return location.state.words
        .map((word) => word?.[0]?.toUpperCase())
        .filter(Boolean)
        .slice(0, EXERCISE_LENGTH);
    }

    return DEFAULT_PROMPTS;
  }, [location.state?.words]);

  // Initialization if any (mlService handled)
  useEffect(() => {
    mlService.initialize();
  }, []);

  useEffect(() => {
    const nextPrompts = resolvePrompts();
    setPrompts(nextPrompts.length > 0 ? nextPrompts : DEFAULT_PROMPTS);
    setCurrentIndex(0);
  }, [resolvePrompts]);

  const currentWord = prompts[currentIndex];
  const isLastWord = currentIndex === prompts.length - 1;
  const progress = prompts.length > 0 ? ((currentIndex) / prompts.length) * 100 : 0;

  useEffect(() => {
    if (!currentWord || isAnalysing || letterFeedback) {
      return;
    }

    startTimeRef.current = Date.now();
  }, [currentWord, isAnalysing, letterFeedback]);

  const finishSession = useCallback(async (lastDuration) => {
    try {
      const totalDuration = wordTimings.reduce((sum, w) => sum + w.durationMs, 0) + lastDuration;
      await addDoc(collection(db, 'sessions'), {
        studentId: user?.uid || 'anonymous',
        startedAt: sessionStartedAtRef.current,
        endedAt: new Date(),
        exerciseMode: 'single_letter',
        letterCount: prompts.length,
        durationMs: totalDuration,
        deviceType: navigator.maxTouchPoints > 0 ? 'touch' : 'mouse',
      });
    } catch (err) {
      console.error('Session save failed:', err.message);
    }
    navigate('/student/complete', { state: { letterResults: letterResultsRef.current } });
  }, [navigate, prompts.length, user?.uid, wordTimings]);

  const handleSubmit = useCallback(async ({ strokeData, strokeMetadata = {}, submitMeta = {} } = {}) => {
    if (submitInFlightRef.current || !currentWord) return;
    
    // CRITICAL: Validate that there's actual content before submitting
    // For auto-submit, check if canvas has any strokes
    if (!strokeData || strokeData.length === 0) {
      // For auto-submit without stroke data, check the canvas directly
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some((byte, idx) => {
          // Skip alpha channel, check RGB values differ from background white (#FAFAF7 ≈ 250,250,247)
          return (idx % 4 !== 3) && Math.abs(byte - [250, 250, 247][idx % 3]) > 5;
        });
        
        if (!hasContent && submitMeta.autoSubmitted) {
          console.log('Auto-submit blocked: Canvas is empty');
          return;
        }
      }
    }

    submitInFlightRef.current = true;

    const endTime = Date.now();
    const duration = startTimeRef.current ? endTime - startTimeRef.current : 0;
    setWordTimings((prev) => [...prev, { word: currentWord, durationMs: duration }]);

    setIsAnalysing(true);

    try {
      const canvas = document.querySelector('canvas');
      const imageBase64 = canvas ? canvas.toDataURL('image/png') : null;
      const studentId = user?.uid || 'anonymous';

      const mergedStrokeMetadata = {
        ...strokeMetadata,
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
      });

      let result = null;
      try {
        result = await Promise.race([
          apiPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ANALYSIS_TIMEOUT_MS))
        ]);
      } catch {
        // Keep the student flow moving while async analysis finishes server-side.
      }

      setIsAnalysing(false);

      const feedback = result ? {
        risk_level: result.risk_level,
        letter: currentWord,
        note: result.letter_specific?.note || '',
        timeUp: !!submitMeta.timeUp,
      } : {
        risk_level: 'pending',
        letter: currentWord,
        note: 'Analysis in progress...',
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
        }
      }, 2000);
    } catch (error) {
      console.error('Submission failed:', error.message);
      setIsAnalysing(false);
      if (isLastWord) finishSession(duration);
      else {
        setCurrentIndex((prev) => prev + 1);
      }
    } finally {
      submitInFlightRef.current = false;
    }
  }, [currentWord, finishSession, isLastWord, sessionId, user?.uid]);

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
          <span className="badge badge-outline">Simple practice</span>
          <span className="badge badge-ghost">2 letters only</span>
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
            {`Letter ${currentIndex + 1} of ${prompts.length || EXERCISE_LENGTH}`}
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
        {exerciseContent}
      </main>
    </div>
  );
}
