import { Volume2 } from 'lucide-react';
import { useState, useCallback } from 'react';

export default function TextToSpeech({ text, className = '' }) {
  const [speaking, setSpeaking] = useState(false);

  const speak = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.85;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }
  }, [text]);

  return (
    <button
      onClick={speak}
      className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border border-border bg-card hover:bg-muted transition-all ${speaking ? 'text-primary animate-pulse-gentle' : 'text-muted-foreground hover:text-foreground'} ${className}`}
      aria-label={`Read aloud: ${text}`}
      title="Click to hear this word"
    >
      <Volume2 className="w-5 h-5" />
    </button>
  );
}
