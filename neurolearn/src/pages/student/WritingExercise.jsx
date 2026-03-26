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

  const [localRiskScore, setLocalRiskScore] = useState(null);
  const [localRiskLevel, setLocalRiskLevel] = useState(null);
  const [submitFeedback, setSubmitFeedback] = useState("");

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

    try {
      // Local analysis is now server-only (asynchronous)
      const localResult = await mlService.analyzeHandwriting(null); // canvas not needed for mock
      if (localResult) {
        setLocalRiskScore(localResult.riskScore);
        setLocalRiskLevel(localResult.riskLevel);
      }
      
      const encouragements = [
        "Great job! Keep writing! 🌟",
        "Wonderful! You're doing amazing! ⭐",
        "Excellent work! Keep it up! 🎉",
        "Fantastic effort! 💪",
        "You're a star! Well done! 🌈",
      ];
      setSubmitFeedback(encouragements[Math.floor(Math.random() * encouragements.length)]);
      // Convert canvas to Base64 PNG instead of uploading to Storage
      // The imageBlob is already captured by the canvas, but we want the DataURL for easy transfer
      const canvas = document.querySelector('canvas');
      const imageBase64 = canvas ? canvas.toDataURL('image/png') : null;

      const studentId = user?.uid || 'anonymous';
      
      // Save handwriting sample to Firestore with Base64 data
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

      // POST to API for analysis with Base64 data
      try {
        await analyzeHandwriting({
          sampleId: sampleDoc.id,
          imageBase64,
          studentId,
          strokeMetadata,
        });
      } catch (apiError) {
        // Don't block the student if API is unavailable
        console.error('API call failed (non-blocking):', apiError.message);
      }
    } catch (error) {
      console.error('Upload failed:', error.message);
    }

    // Move to next word or complete
    if (isLastWord) {
      // Save session to Firestore
      try {
        const totalDuration = wordTimings.reduce((sum, w) => sum + w.durationMs, 0) + duration;
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
      navigate('/student/complete', { 
        state: { 
          score: localRiskScore ?? null, 
          level: localRiskLevel ?? 'Pending server analysis'
        } 
      });
    } else {
      setCurrentIndex((prev) => prev + 1);
      startTimeRef.current = null;
    }
  };

  // Start timer on first interaction with a new word
  const handleCanvasInteraction = () => {
    if (!startTimeRef.current) {
      startTimeRef.current = Date.now();
    }
  };

  const exerciseContent = (
    <div className="w-full" onPointerDown={handleCanvasInteraction}>
      {/* Prompt */}
      <div className="text-center mb-10">
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
        prompt={currentWord}
        onSubmit={handleSubmit}
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
