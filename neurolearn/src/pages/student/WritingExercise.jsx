import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/services/firebase';
import useCurrentUser from '@/hooks/useCurrentUser';
import WritingCanvas from '@/components/canvas/WritingCanvas';
import TextToSpeech from '@/components/TextToSpeech';
import FocusMode from '@/components/FocusMode';
import { analyzeHandwriting } from '@/services/api';
import mlService from '../../services/mlService';
import { BookOpen, ArrowLeft, ChevronRight } from 'lucide-react';

const DEFAULT_LETTERS = ['b', 'd', 'p', 'q', 'g', 'y', 'f', 'h', 'n', 'm'];

export default function WritingExercise() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [prompts] = useState(() => {
    if (location.state?.words && location.state.words.length > 0) {
      return location.state.words.map(w => w[0].toUpperCase());
    }
    return DEFAULT_LETTERS.map(l => l.toUpperCase());
  });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const [wordTimings, setWordTimings] = useState([]);
  const startTimeRef = useRef(null);

  const [isAnalysing, setIsAnalysing] = useState(false);
  const [letterFeedback, setLetterFeedback] = useState(null);
  const [letterResults, setLetterResults] = useState([]);

  // Initialization if any (mlService handled)
  useEffect(() => {
    mlService.initialize();
  }, []);

  const currentWord = prompts[currentIndex];
  const isLastWord = currentIndex === prompts.length - 1;
  const progress = ((currentIndex) / prompts.length) * 100;

  const handleSubmit = async ({ imageBlob, strokeData, strokeMetadata }) => {
    // Calculate time for this word
    const endTime = Date.now();
    const duration = startTimeRef.current ? endTime - startTimeRef.current : 0;
    setWordTimings((prev) => [...prev, { word: currentWord, durationMs: duration }]);

    setIsAnalysing(true);

    try {
      // Capture canvas DataURL
      const canvas = document.querySelector('canvas');
      const imageBase64 = canvas ? canvas.toDataURL('image/png') : null;
      const studentId = user?.uid || 'anonymous';

      // Save handwriting sample to Firestore
      const sampleDoc = await addDoc(collection(db, 'handwritingSamples'), {
        studentId,
        sessionId,
        capturedAt: serverTimestamp(),
        imageBase64,
        promptLetter: currentWord,
        strokeMetadata: {
          ...strokeMetadata,
          currentLetter: currentWord,
          exerciseType: 'single_letter'
        },
        analysisStatus: 'pending',
        analysisResult: {},
      });

      // API call with 2s timeout logic for feedback
      const apiPromise = analyzeHandwriting({
        sampleId: sampleDoc.id,
        imageBase64,
        studentId,
        letter: currentWord.toLowerCase(),
        strokeMetadata,
      });

      // We wait for the API but also have a fallback for the UI
      let result = null;
      try {
        // Race the API against a 2.5s timeout for feedback purposes
        result = await Promise.race([
          apiPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500))
        ]);
      } catch (e) {
        console.log('API feedback timeout or error, showing pending...');
      }

      setIsAnalysing(false);
      
      const feedback = result ? {
        risk_level: result.risk_level,
        letter: currentWord,
        note: result.letter_specific?.note || ""
      } : {
        risk_level: 'pending',
        letter: currentWord,
        note: "Analysis in progress..."
      };

      setLetterFeedback(feedback);
      setLetterResults(prev => [...prev, feedback]);

      // Wait 2 seconds for feedback display, then move on
      setTimeout(() => {
        setLetterFeedback(null);
        if (isLastWord) {
          finishSession(duration);
        } else {
          setCurrentIndex((prev) => prev + 1);
          startTimeRef.current = null;
        }
      }, 2000);

    } catch (error) {
      console.error('Submission failed:', error.message);
      setIsAnalysing(false);
      // Fallback: move on anyway
      if (isLastWord) finishSession(duration);
      else setCurrentIndex(prev => prev + 1);
    }
  };

  const finishSession = async (lastDuration) => {
    try {
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
        exerciseMode: 'single_letter'
      });
    } catch (err) {
      console.error('Session save failed:', err.message);
    }
    navigate('/student/complete', { state: { letterResults: [...letterResults] } });
  };

  // Start timer on first interaction with a new word
  const handleCanvasInteraction = () => {
    if (!startTimeRef.current && !isAnalysing && !letterFeedback) {
      startTimeRef.current = Date.now();
    }
  };

  const exerciseContent = (
    <div className="w-full relative" onPointerDown={handleCanvasInteraction}>
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
              fontSize: '160px', 
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
        <FocusMode>
          {exerciseContent}
        </FocusMode>
      </main>
    </div>
  );
}
