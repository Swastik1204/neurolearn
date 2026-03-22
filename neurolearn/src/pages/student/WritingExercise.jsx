import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { storage, db } from '@/services/firebase';
import useCurrentUser from '@/hooks/useCurrentUser';
import WritingCanvas from '@/components/canvas/WritingCanvas';
import TextToSpeech from '@/components/TextToSpeech';
import FocusMode from '@/components/FocusMode';
import { analyzeHandwriting } from '@/services/api';
import { BookOpen, ArrowLeft, ChevronRight } from 'lucide-react';

const PROMPTS = ['bed', 'dog', 'was', 'saw', 'pat', 'tap', 'no', 'on', 'bid', 'dib'];

export default function WritingExercise() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const [wordTimings, setWordTimings] = useState([]);
  const startTimeRef = useRef(null);

  const currentWord = PROMPTS[currentIndex];
  const isLastWord = currentIndex === PROMPTS.length - 1;
  const progress = ((currentIndex) / PROMPTS.length) * 100;

  const handleSubmit = async ({ imageBlob, strokeData, strokeMetadata }) => {
    // Calculate time for this word
    const endTime = Date.now();
    const duration = startTimeRef.current ? endTime - startTimeRef.current : 0;

    setWordTimings((prev) => [...prev, { word: currentWord, durationMs: duration }]);

    try {
      // Upload PNG to Firebase Storage
      const studentId = user?.uid || 'anonymous';
      const timestamp = Date.now();
      const storageRef = ref(storage, `handwriting/${studentId}/${sessionId}/${timestamp}.png`);
      await uploadBytes(storageRef, imageBlob);
      const imageUrl = await getDownloadURL(storageRef);

      // Save handwriting sample to Firestore
      const sampleDoc = await addDoc(collection(db, 'handwritingSamples'), {
        studentId,
        sessionId,
        capturedAt: serverTimestamp(),
        imageUrl,
        promptWord: currentWord,
        strokeMetadata,
        analysisStatus: 'pending',
        analysisResult: {},
      });

      // POST to API for analysis
      try {
        await analyzeHandwriting({
          sampleId: sampleDoc.id,
          imageUrl,
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
          wordCount: PROMPTS.length,
        });
      } catch (err) {
        console.error('Session save failed:', err.message);
      }
      navigate('/student/complete');
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
      <div className="text-center mb-6">
        <p className="text-lg text-muted-foreground mb-2">Write this word:</p>
        <div className="flex items-center justify-center gap-4">
          <span className="text-5xl font-bold text-foreground tracking-wide">
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
            <span className="font-semibold text-foreground">Writing Practice</span>
          </div>
          <div className="text-sm text-muted-foreground font-medium">
            {currentIndex + 1} / {PROMPTS.length}
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
