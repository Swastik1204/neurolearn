import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/services/firebase';
import useCurrentUser from '@/hooks/useCurrentUser';
import WritingCanvas from '@/components/canvas/WritingCanvas';
import TextToSpeech from '@/components/TextToSpeech';
import { analyzeHandwriting, updateEmotion } from '@/services/api';
import mlService from '../../services/mlService';
import { BookOpen, ArrowLeft, Heart, ArrowRight } from 'lucide-react';

const EXERCISE_LENGTH = 3;
const DEFAULT_LETTERS = ['b', 'd', 'c'];
const DEFAULT_PROMPTS = DEFAULT_LETTERS.map((letter) => letter.toUpperCase());
const ANALYSIS_TIMEOUT_MS = 2500;

const clamp01 = (value, fallback = 0) => {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(1, Math.max(0, num));
};

const firstSentence = (text = '') => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  const match = trimmed.match(/[^.!?]+[.!?]?/);
  return match?.[0]?.trim() || trimmed;
};

const normalizeBand = (value = '') => {
  const raw = String(value || '').toLowerCase();
  if (raw === 'medium') return 'moderate';
  if (raw === 'high' || raw === 'moderate' || raw === 'low') return raw;
  return null;
};

const bandFromRiskLevel = (riskLevel = '') => {
  const raw = String(riskLevel || '').toLowerCase();
  if (raw === 'high') return 'high';
  if (raw === 'medium') return 'moderate';
  if (raw === 'low') return 'low';
  return null;
};

const pickSessionRiskBand = (bands = []) => {
  if (!bands.length) return 'moderate';
  const severity = { low: 1, moderate: 2, high: 3 };
  const counts = bands.reduce((acc, band) => {
    acc[band] = (acc[band] || 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return (severity[b[0]] || 0) - (severity[a[0]] || 0);
  })[0][0];
};

const profileFromAverages = (averages = {}) => {
  const profile = {
    writingMotor: clamp01(averages.writingMotor, 0.5),
    reversalRisk: clamp01(averages.reversalRisk, 0.5),
    letterConsistency: clamp01(averages.letterConsistency, 0.5),
    strokeConfidence: clamp01(averages.strokeConfidence, 0.5),
  };

  if (
    profile.reversalRisk >= profile.writingMotor &&
    profile.reversalRisk >= profile.letterConsistency &&
    profile.reversalRisk >= profile.strokeConfidence
  ) {
    return { ...profile, recommendedPath: 'reversal_reinforcement' };
  }

  const lowest = [
    ['writingMotor', profile.writingMotor],
    ['letterConsistency', profile.letterConsistency],
    ['strokeConfidence', profile.strokeConfidence],
  ].sort((a, b) => a[1] - b[1])[0][0];

  if (lowest === 'writingMotor') return { ...profile, recommendedPath: 'motor_development' };
  if (lowest === 'letterConsistency') return { ...profile, recommendedPath: 'consistency_building' };
  return { ...profile, recommendedPath: 'confidence_pacing' };
};

export default function WritingExercise() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const sessionStartedAtRef = useRef(new Date());
  const [wordTimings, setWordTimings] = useState([]);
  const [sessionEmotions, setSessionEmotions] = useState([]);
  const startTimeRef = useRef(null);
  const submitInFlightRef = useRef(false);

  const letterResultsRef = useRef([]);
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [letterFeedback, setLetterFeedback] = useState(null);
  const [showEmotionCheck, setShowEmotionCheck] = useState(false);
  const [currentSampleId, setCurrentSampleId] = useState(null);
  const [currentDuration, setCurrentDuration] = useState(0);

  const resolvePrompts = useCallback(() => {
    if (location.state?.words?.length > 0) {
      return location.state.words
        .map((word) => word?.[0]?.toUpperCase())
        .filter(Boolean)
        .slice(0, EXERCISE_LENGTH);
    }
    return DEFAULT_PROMPTS;
  }, [location.state?.words]);

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
    if (!currentWord || isAnalysing || letterFeedback || showEmotionCheck) {
      return;
    }
    startTimeRef.current = Date.now();
  }, [currentWord, isAnalysing, letterFeedback, showEmotionCheck]);

  const finishSession = useCallback(async (lastDuration) => {
    try {
      const totalDuration = wordTimings.reduce((sum, w) => sum + w.durationMs, 0) + lastDuration;
      
      const emotionCounts = sessionEmotions.reduce((acc, emo) => {
        acc[emo] = (acc[emo] || 0) + 1;
        return acc;
      }, {});
      
      const letterResults = letterResultsRef.current || [];
      const profileRows = letterResults
        .map((result) => result?.cognitiveProfile)
        .filter(Boolean);

      let sessionProfile = null;
      if (profileRows.length > 0) {
        const profileTotals = profileRows.reduce((acc, profile) => {
          acc.writingMotor += clamp01(profile?.writingMotor, 0.5);
          acc.reversalRisk += clamp01(profile?.reversalRisk, 0.5);
          acc.letterConsistency += clamp01(profile?.letterConsistency, 0.5);
          acc.strokeConfidence += clamp01(profile?.strokeConfidence, 0.5);
          return acc;
        }, { writingMotor: 0, reversalRisk: 0, letterConsistency: 0, strokeConfidence: 0 });

        const averages = {
          writingMotor: profileTotals.writingMotor / profileRows.length,
          reversalRisk: profileTotals.reversalRisk / profileRows.length,
          letterConsistency: profileTotals.letterConsistency / profileRows.length,
          strokeConfidence: profileTotals.strokeConfidence / profileRows.length,
        };
        sessionProfile = profileFromAverages(averages);
      }

      const riskBands = letterResults
        .map((result) => normalizeBand(result?.cognitiveProfile?.riskBand || bandFromRiskLevel(result?.risk_level)))
        .filter(Boolean);
      const sessionRiskBand = pickSessionRiskBand(riskBands);
      const lettersTraced = letterResults
        .map((result) => String(result?.letter || '').trim().toUpperCase())
        .filter(Boolean);

      await addDoc(collection(db, 'sessions'), {
        studentId: user?.uid || 'anonymous',
        startedAt: sessionStartedAtRef.current,
        endedAt: new Date(),
        exerciseMode: 'single_letter',
        letterCount: prompts.length,
        letters: lettersTraced,
        durationMs: totalDuration,
        deviceType: navigator.maxTouchPoints > 0 ? 'touch' : 'mouse',
        cognitiveProfile: sessionProfile,
        sessionRiskBand,
        emotionProfile: emotionCounts,
      });
    } catch (err) {
      console.error('Session save failed:', err.message);
    }
    navigate('/student/complete', { state: { letterResults: letterResultsRef.current } });
  }, [navigate, prompts.length, user?.uid, wordTimings, sessionEmotions]);

  const handleEmotionSelect = useCallback(async (emotion) => {
    if (emotion) {
      setSessionEmotions(prev => [...prev, emotion]);
      // Update via API
      if (currentSampleId) {
        try {
          await updateEmotion({
            sampleId: currentSampleId,
            emotionAtSubmit: emotion
          });
        } catch (err) {
          console.error('Failed to update emotion via API:', err);
          // Fallback to direct Firestore update if API fails (as backup)
          try {
            await updateDoc(doc(db, 'handwritingSamples', currentSampleId), {
              emotionAtSubmit: emotion
            });
          } catch (fErr) {
            console.error('Firestore fallback also failed:', fErr);
          }
        }
      }
    }

    setShowEmotionCheck(false);
    if (isLastWord) {
      finishSession(currentDuration);
    } else {
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentSampleId, currentDuration, finishSession, isLastWord]);

  const handleSubmit = useCallback(async ({ strokeData, strokeMetadata = {}, submitMeta = {} } = {}) => {
    if (submitInFlightRef.current || !currentWord) return;
    
    if (!strokeData || strokeData.length === 0) {
      const canvas = document.querySelector('canvas');
      if (canvas) {
        const imageData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        const hasContent = imageData.data.some((byte, idx) => {
          return (idx % 4 !== 3) && Math.abs(byte - [250, 250, 247][idx % 3]) > 5;
        });
        if (!hasContent && submitMeta.autoSubmitted) return;
      }
    }

    submitInFlightRef.current = true;
    const endTime = Date.now();
    const duration = startTimeRef.current ? endTime - startTimeRef.current : 0;
    setCurrentDuration(duration);
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
      setCurrentSampleId(sampleDoc.id);

      const apiPromise = analyzeHandwriting({
        sampleId: sampleDoc.id,
        imageBase64,
        studentId,
        letter: currentWord,
        strokeMetadata: mergedStrokeMetadata,
      });

      let result = null;
      try {
        result = await Promise.race([
          apiPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ANALYSIS_TIMEOUT_MS))
        ]);
      } catch {
        // Handle promise race timeout or API error silently
      }

      setIsAnalysing(false);

      const apiData = result?.data || result || {};
      const interpretation = apiData.geminiInterpretation || apiData.gemini_interpretation || '';
      const cognitiveProfile = apiData.cognitiveProfile || apiData.cognitive_profile || null;

      const feedback = result ? {
        risk_level: apiData.risk_level || 'pending',
        letter: currentWord,
        note: apiData.letter_specific?.note || '',
        geminiInterpretation: interpretation,
        cognitiveProfile,
        timeUp: !!submitMeta.timeUp,
      } : {
        risk_level: 'pending',
        letter: currentWord,
        note: 'Analysis in progress...',
        geminiInterpretation: '',
        cognitiveProfile: null,
        timeUp: !!submitMeta.timeUp,
      };

      setLetterFeedback(feedback);
      letterResultsRef.current = [...letterResultsRef.current, feedback];
    } catch (error) {
      console.error('Submission failed:', error.message);
      setIsAnalysing(false);
      if (isLastWord) finishSession(duration);
      else setCurrentIndex((prev) => prev + 1);
    } finally {
      submitInFlightRef.current = false;
    }
  }, [currentWord, finishSession, isLastWord, sessionId, user?.uid]);

  const exerciseContent = (
    <div className="w-full relative">
      {/* Analysing Spinner Overlay */}
      {isAnalysing && (
        <div className="absolute inset-0 z-40 bg-background/60 backdrop-blur-md flex items-center justify-center rounded-2xl animate-fade-in">
          <div className="text-center premium-card p-12 animate-scale-in">
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
              <div className="absolute inset-0 bg-primary/5 rounded-full animate-pulse-gentle" />
            </div>
            <p className="font-black text-primary text-xl tracking-wide animate-shimmer bg-clip-text text-transparent">Analysing...</p>
          </div>
        </div>
      )}

      {/* Feedback Overlay */}
      {letterFeedback && (
        <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-md flex items-center justify-center rounded-2xl animate-fade-in px-4">
          {(() => {
            const profile = letterFeedback.cognitiveProfile || {};
            const letterAccuracy = Math.round(clamp01(1 - (profile.reversalRisk ?? 0.5), 0.5) * 100);
            const penConfidence = Math.round(clamp01(profile.strokeConfidence ?? 0.5, 0.5) * 100);
            const interpretationLine = firstSentence(letterFeedback.geminiInterpretation) || letterFeedback.note || 'Great effort. Keep building skills.';

            return (
              <div className={`p-8 premium-card text-center max-w-sm w-full animate-scale-in overflow-hidden relative ${
                letterFeedback.risk_level === 'low' ? 'border-success/30' :
                letterFeedback.risk_level === 'medium' ? 'border-warning/30' :
                letterFeedback.risk_level === 'high' ? 'border-destructive/30' :
                'border-muted'
              }`}>
                <div className={`absolute top-0 left-0 w-full h-1.5 ${
                  letterFeedback.risk_level === 'low' ? 'bg-success' :
                  letterFeedback.risk_level === 'medium' ? 'bg-warning' :
                  letterFeedback.risk_level === 'high' ? 'bg-destructive' :
                  'bg-muted'
                }`} />

                <span className="text-7xl mb-6 block animate-float">
                  {letterFeedback.risk_level === 'low' ? '🌟' : 
                   letterFeedback.risk_level === 'medium' ? '👍' : 
                   letterFeedback.risk_level === 'high' ? '💪' : '⏳'}
                </span>
                <h3 className="text-2xl font-black mb-2">
                  {letterFeedback.risk_level === 'low' ? `Great ${letterFeedback.letter}!` :
                  letterFeedback.risk_level === 'medium' ? 'Building skills!' :
                  letterFeedback.risk_level === 'high' ? `Keep working on ${letterFeedback.letter}` :
                   'Working...'}
                </h3>
                <p className="text-sm font-medium opacity-90 mb-6 line-clamp-2">
                  {interpretationLine}
                </p>

                <div className="space-y-4 text-left mb-8">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span>Letter accuracy</span>
                      <span>{letterAccuracy}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/40 overflow-hidden">
                      <div className="h-full bg-white" style={{ width: `${letterAccuracy}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold mb-1">
                      <span>Pen confidence</span>
                      <span>{penConfidence}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/40 overflow-hidden">
                      <div className="h-full bg-white" style={{ width: `${penConfidence}%` }} />
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => {
                    setLetterFeedback(null);
                    setShowEmotionCheck(true);
                  }}
                  className="w-full py-4 rounded-2xl bg-white text-foreground font-black text-lg flex items-center justify-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
                  style={{ color: 'inherit' }}
                >
                  Continue
                  <ArrowRight className="w-6 h-6" />
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* Emotion Check-in Overlay */}
      {showEmotionCheck && (
        <div className="absolute inset-0 z-40 bg-background/90 backdrop-blur-lg flex items-center justify-center rounded-2xl animate-fade-in px-4">
          <div className="text-center p-10 premium-card max-w-sm w-full animate-float">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <Heart className="w-8 h-8 text-primary animate-pulse-gentle" />
            </div>
            <h2 className="text-2xl font-black text-foreground mb-8">How did that feel?</h2>
            <div className="flex items-center justify-center gap-6">
              <button 
                onClick={() => handleEmotionSelect('happy')}
                className="group flex flex-col items-center gap-2 transition-transform hover:scale-125 active:scale-90"
              >
                <span className="text-7xl drop-shadow-lg">😊</span>
                <span className="text-sm font-bold text-success opacity-0 group-hover:opacity-100 transition-opacity">Happy</span>
              </button>
              <button 
                onClick={() => handleEmotionSelect('okay')}
                className="group flex flex-col items-center gap-2 transition-transform hover:scale-125 active:scale-90"
              >
                <span className="text-7xl drop-shadow-lg">😐</span>
                <span className="text-sm font-bold text-warning opacity-0 group-hover:opacity-100 transition-opacity">Okay</span>
              </button>
              <button 
                onClick={() => handleEmotionSelect('hard')}
                className="group flex flex-col items-center gap-2 transition-transform hover:scale-125 active:scale-90"
              >
                <span className="text-7xl drop-shadow-lg">😟</span>
                <span className="text-sm font-bold text-destructive opacity-0 group-hover:opacity-100 transition-opacity">Hard</span>
              </button>
            </div>
            
            {/* Skip Option */}
            <button 
              onClick={() => handleEmotionSelect(null)}
              className="mt-12 text-sm text-muted-foreground font-medium hover:text-foreground transition-all hover:tracking-widest"
            >
              Skip this part
            </button>
          </div>
        </div>
      )}

      {/* Prompt */}
      <div className="text-center mb-10">
        <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
          <span className="badge badge-outline">Simple practice</span>
          <span className="badge badge-ghost">3 letters only</span>
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
        disabled={isAnalysing || !!letterFeedback || showEmotionCheck}
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
