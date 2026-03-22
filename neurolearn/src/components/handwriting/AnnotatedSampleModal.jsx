import { useEffect, useRef, useState } from 'react';
import { X, AlertTriangle, CheckCircle } from 'lucide-react';
import ScoreBar from '@/components/charts/ScoreBar';

export default function AnnotatedSampleModal({ sample, analysisResult, onClose }) {
  const canvasRef = useRef(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!sample?.imageUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Draw annotations if analysis result exists
      if (analysisResult?.indicators) {
        const { reversals = [], omissions = [] } = analysisResult.indicators;

        // Draw reversal bounding boxes (red)
        reversals.forEach(({ position, char }) => {
          if (position !== undefined) {
            const x = (position / 10) * img.width;
            const boxWidth = img.width / 10;
            ctx.strokeStyle = '#DC3545';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, 0, boxWidth, img.height);

            // Label
            ctx.fillStyle = '#DC3545';
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(`↔ ${char || '?'}`, x + 4, 16);
          }
        });

        // Draw omission markers (amber)
        omissions.forEach(({ position }) => {
          if (position !== undefined) {
            const x = (position / 10) * img.width;
            const boxWidth = img.width / 10;
            ctx.strokeStyle = '#F4A728';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(x, 0, boxWidth, img.height);
            ctx.setLineDash([]);
          }
        });
      }

      setImageLoaded(true);
    };

    img.src = sample.imageUrl;
  }, [sample, analysisResult]);

  if (!sample) return null;

  const scores = analysisResult?.scores || {};
  const indicators = analysisResult?.indicators || {};

  const scoreData = [
    { name: 'Letter Form', score: scores.letterFormScore || 0 },
    { name: 'Spacing', score: scores.spacingScore || 0 },
    { name: 'Baseline', score: scores.baselineScore || 0 },
    { name: 'Reversals', score: 100 - (scores.reversalScore || 0) }, // Invert for display
  ];

  const reversalCount = indicators.reversals?.length || 0;
  const omissionCount = indicators.omissions?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-card rounded-xl shadow-2xl border border-border max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border sticky top-0 bg-card rounded-t-xl z-10">
          <div>
            <h2 className="font-bold text-lg text-foreground">Handwriting Analysis</h2>
            {sample.promptWord && (
              <p className="text-sm text-muted-foreground">Word: "{sample.promptWord}"</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* Annotated Image */}
          <div className="rounded-xl border border-border overflow-hidden bg-[#FAFAF7]">
            <canvas
              ref={canvasRef}
              className="w-full"
              style={{ display: imageLoaded ? 'block' : 'none' }}
            />
            {!imageLoaded && (
              <div className="h-40 flex items-center justify-center text-muted-foreground">
                Loading image...
              </div>
            )}
          </div>

          {/* Indicator Summary */}
          {analysisResult && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  reversalCount > 0 ? 'bg-destructive/5 border border-destructive/20' : 'bg-success/5 border border-success/20'
                }`}>
                  {reversalCount > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold text-foreground">{reversalCount} reversal{reversalCount !== 1 ? 's' : ''}</div>
                    <div className="text-xs text-muted-foreground">d/b, p/q type swaps</div>
                  </div>
                </div>

                <div className={`p-4 rounded-lg flex items-center gap-3 ${
                  omissionCount > 0 ? 'bg-warning/5 border border-warning/20' : 'bg-success/5 border border-success/20'
                }`}>
                  {omissionCount > 0 ? (
                    <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-success flex-shrink-0" />
                  )}
                  <div>
                    <div className="font-semibold text-foreground">{omissionCount} omission{omissionCount !== 1 ? 's' : ''}</div>
                    <div className="text-xs text-muted-foreground">Missing strokes</div>
                  </div>
                </div>
              </div>

              {/* Score breakdown */}
              <ScoreBar data={scoreData} label="Score Breakdown" color="#5B4FCF" />

              {/* Detailed indicators list */}
              {indicators.reversals?.length > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold text-sm mb-2 text-foreground">Reversal Details</h4>
                  <ul className="space-y-1">
                    {indicators.reversals.map((r, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive flex-shrink-0" />
                        '{r.char}' reversal detected (confidence: {Math.round((r.confidence || 0) * 100)}%)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risk Score */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <span className="text-sm font-medium text-foreground">Overall Dyslexia Risk</span>
                <span className={`text-lg font-bold ${
                  (scores.overallDyslexiaRisk || 0) > 0.6 ? 'text-destructive' :
                  (scores.overallDyslexiaRisk || 0) > 0.3 ? 'text-warning' : 'text-success'
                }`}>
                  {Math.round((scores.overallDyslexiaRisk || 0) * 100)}%
                </span>
              </div>
            </>
          )}

          {!analysisResult && (
            <div className="text-center py-6 text-muted-foreground">
              <p>Analysis not yet available for this sample.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
