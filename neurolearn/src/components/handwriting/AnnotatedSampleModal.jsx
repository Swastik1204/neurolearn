import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

const clamp01 = (value, fallback = 0.5) => {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(1, Math.max(0, num));
};

const splitInterpretation = (value) => {
  const text = String(value || '').trim();
  if (!text) return [];
  return text
    .split(/(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
};

const profileMetrics = (profile = {}) => [
  { key: 'writingMotor', label: 'Writing strength', value: Math.round(clamp01(profile.writingMotor) * 100) },
  { key: 'letterConsistency', label: 'Letter consistency', value: Math.round(clamp01(profile.letterConsistency) * 100) },
  { key: 'strokeConfidence', label: 'Pen confidence', value: Math.round(clamp01(profile.strokeConfidence) * 100) },
  { key: 'letterAccuracy', label: 'Letter accuracy', value: Math.round(clamp01(1 - clamp01(profile.reversalRisk)) * 100) },
];

export default function AnnotatedSampleModal({ sample, analysisResult, onClose, onRetry }) {
  const canvasRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    if (!(sample?.imageBase64 || sample?.imageUrl) || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      setImageLoaded(true);
    };

    img.src = sample.imageBase64 || sample.imageUrl;
  }, [sample]);

  if (!sample) return null;

  const scores = analysisResult?.scores || {};
  const profile = analysisResult?.cognitiveProfile || analysisResult?.cognitive_profile || null;
  const interpretation =
    analysisResult?.geminiInterpretation ||
    analysisResult?.gemini_interpretation ||
    analysisResult?.letterSpecific?.interpretation ||
    '';
  const interpretationLines = splitInterpretation(interpretation);

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-xl shadow-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card rounded-t-xl z-10">
          <div>
            <h2 className="font-bold text-lg text-foreground">Handwriting Sample Detail</h2>
            <p className="text-sm text-muted-foreground">Letter: {sample.promptLetter || sample.letter || '?'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-border overflow-hidden bg-[#FAFAF7]">
            <canvas ref={canvasRef} className="w-full" style={{ display: imageLoaded ? 'block' : 'none' }} />
            {!imageLoaded && (
              <div className="h-40 flex items-center justify-center text-muted-foreground">Loading image...</div>
            )}
          </div>

          {analysisResult ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border border-border p-3 bg-base-100">
                  <div className="text-xs text-muted-foreground">Letter Form</div>
                  <div className="text-lg font-semibold text-foreground">{Math.round(Number(scores.letterFormScore || 0))}/100</div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-base-100">
                  <div className="text-xs text-muted-foreground">Spacing</div>
                  <div className="text-lg font-semibold text-foreground">{Math.round(Number(scores.spacingScore || 0))}/100</div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-base-100">
                  <div className="text-xs text-muted-foreground">Baseline</div>
                  <div className="text-lg font-semibold text-foreground">{Math.round(Number(scores.baselineScore || 0))}/100</div>
                </div>
                <div className="rounded-lg border border-border p-3 bg-base-100">
                  <div className="text-xs text-muted-foreground">Reversal</div>
                  <div className="text-lg font-semibold text-foreground">{Math.round(Number(scores.reversalScore || 0))}/100</div>
                </div>
              </div>

              <div className="rounded-xl border border-border p-4 bg-base-100">
                <h4 className="font-semibold text-foreground mb-3">Interpretation</h4>
                {interpretationLines.length > 0 ? (
                  <p className="text-sm text-foreground leading-relaxed">{interpretationLines[0]}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No interpretation available yet.</p>
                )}
              </div>

              {profile && (
                <div className="rounded-xl border border-border p-4 bg-base-100 space-y-3">
                  <h4 className="font-semibold text-foreground">Profile Snapshot</h4>
                  {profileMetrics(profile).map((item) => (
                    <div key={item.key}>
                      <div className="flex items-center justify-between text-sm text-foreground mb-1">
                        <span>{item.label}</span>
                        <span>{item.value}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${item.value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              {sample.analysisStatus === 'processing' ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <p className="text-muted-foreground font-medium">Analysis is processing...</p>
                  {onRetry && (
                    <button
                      type="button"
                      onClick={handleRetry}
                      disabled={isRetrying}
                      className="btn btn-sm btn-outline"
                    >
                      {isRetrying ? 'Checking...' : 'Check Status'}
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Analysis not yet available for this sample.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
