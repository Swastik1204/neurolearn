import { Link, useLocation } from 'react-router-dom';
import { PartyPopper, Home, RotateCcw, Star } from 'lucide-react';

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

const normalizeBand = (riskLevel = '') => {
  const raw = String(riskLevel || '').toLowerCase();
  if (raw === 'high') return 'high';
  if (raw === 'medium') return 'moderate';
  if (raw === 'low') return 'low';
  return 'moderate';
};

const profileFromAverages = (rows = []) => {
  if (!rows.length) {
    return {
      writingMotor: 0.5,
      reversalRisk: 0.5,
      letterConsistency: 0.5,
      strokeConfidence: 0.5,
      recommendedPath: 'consistency_building',
    };
  }

  const totals = rows.reduce((acc, profile) => {
    acc.writingMotor += clamp01(profile?.writingMotor, 0.5);
    acc.reversalRisk += clamp01(profile?.reversalRisk, 0.5);
    acc.letterConsistency += clamp01(profile?.letterConsistency, 0.5);
    acc.strokeConfidence += clamp01(profile?.strokeConfidence, 0.5);
    return acc;
  }, { writingMotor: 0, reversalRisk: 0, letterConsistency: 0, strokeConfidence: 0 });

  const avg = {
    writingMotor: totals.writingMotor / rows.length,
    reversalRisk: totals.reversalRisk / rows.length,
    letterConsistency: totals.letterConsistency / rows.length,
    strokeConfidence: totals.strokeConfidence / rows.length,
  };

  if (
    avg.reversalRisk >= avg.writingMotor &&
    avg.reversalRisk >= avg.letterConsistency &&
    avg.reversalRisk >= avg.strokeConfidence
  ) {
    return { ...avg, recommendedPath: 'reversal_reinforcement' };
  }

  const lowest = [
    ['writingMotor', avg.writingMotor],
    ['letterConsistency', avg.letterConsistency],
    ['strokeConfidence', avg.strokeConfidence],
  ].sort((a, b) => a[1] - b[1])[0][0];

  if (lowest === 'writingMotor') return { ...avg, recommendedPath: 'motor_development' };
  if (lowest === 'letterConsistency') return { ...avg, recommendedPath: 'consistency_building' };
  return { ...avg, recommendedPath: 'confidence_pacing' };
};

const pathSuggestion = {
  reversal_reinforcement: 'Focus activity: try tracing B and D side by side',
  motor_development: 'Focus activity: practice slow careful strokes',
  consistency_building: 'Focus activity: repeat the same letter 5 times in a row',
  confidence_pacing: 'Focus activity: take your time - there is no rush',
};

const bandBadge = {
  low: { label: 'Great progress', className: 'bg-success/10 text-success border-success/20' },
  moderate: { label: 'Building skills', className: 'bg-warning/10 text-warning border-warning/20' },
  high: { label: 'Needs support', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export default function ExerciseComplete() {
  const location = useLocation();
  const { letterResults = [] } = location.state || {};

  const profileRows = letterResults.map((item) => item?.cognitiveProfile).filter(Boolean);
  const sessionProfile = profileFromAverages(profileRows);
  const sessionBand = (() => {
    if (!letterResults.length) return 'moderate';
    const severity = { low: 1, moderate: 2, high: 3 };
    const counts = letterResults.reduce((acc, result) => {
      const band = normalizeBand(result?.risk_level);
      acc[band] = (acc[band] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return (severity[b[0]] || 0) - (severity[a[0]] || 0);
    })[0][0];
  })();
  const sessionDate = new Date().toLocaleString();

  const dims = [
    { label: 'Writing strength', value: Math.round(clamp01(sessionProfile.writingMotor, 0.5) * 100) },
    { label: 'Letter consistency', value: Math.round(clamp01(sessionProfile.letterConsistency, 0.5) * 100) },
    { label: 'Pen confidence', value: Math.round(clamp01(sessionProfile.strokeConfidence, 0.5) * 100) },
    { label: 'Letter accuracy', value: Math.round(clamp01(1 - sessionProfile.reversalRisk, 0.5) * 100) },
  ];

  return (
    <div className="min-h-screen bg-background student-view flex items-center justify-center py-12 px-6">
      <div className="text-center animate-fade-in max-w-3xl w-full">
        <div className="w-24 h-24 rounded-full gradient-accent flex items-center justify-center mx-auto mb-6 shadow-xl animate-scale-in">
          <PartyPopper className="w-12 h-12 text-white" />
        </div>

        <h1 className="text-4xl font-bold text-foreground mb-2">Great job! 🎉</h1>
        <p className="text-lg text-muted-foreground mb-2 leading-relaxed max-w-xl mx-auto">
          {`Well done! You traced ${letterResults.length} letters today.`}
        </p>
        <p className="text-sm text-muted-foreground mb-10">Session completed on {sessionDate}</p>

        {letterResults.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {letterResults.map((res, idx) => (
              <div 
                key={idx} 
                className={`p-5 rounded-2xl border-2 text-left flex items-center gap-5 transition-all hover:shadow-md ${
                  res.risk_level === 'low' ? 'bg-success/5 border-success/20' :
                  res.risk_level === 'medium' ? 'bg-warning/5 border-warning/20' :
                  res.risk_level === 'high' ? 'bg-destructive/5 border-destructive/20' :
                  'bg-muted/30 border-muted'
                }`}
              >
                <div 
                  className={`text-5xl font-bold select-none ${
                    res.risk_level === 'low' ? 'text-success' :
                    res.risk_level === 'medium' ? 'text-warning' :
                    res.risk_level === 'high' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}
                  style={{ fontFamily: '"OpenDyslexic", sans-serif' }}
                >
                  {res.letter}
                </div>
                <div className="flex-1 min-w-0">
                  <h5 className={`font-bold text-sm uppercase tracking-wider ${
                    res.risk_level === 'low' ? 'text-success' :
                    res.risk_level === 'medium' ? 'text-warning' :
                    res.risk_level === 'high' ? 'text-destructive' :
                    'text-muted-foreground'
                  }`}>
                    {res.risk_level === 'low' ? 'Great form' : 
                     res.risk_level === 'medium' ? 'Building skills' : 
                     res.risk_level === 'high' ? 'Practice opportunity' : 'Pending'}
                  </h5>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1 italic">
                    {firstSentence(res.geminiInterpretation || '') || res.note || 'Keep practicing - you are improving.'}
                  </p>
                </div>
              </div>
            ))}
            </div>

            <div className="mb-10 p-6 bg-card border border-border rounded-2xl text-left">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground">Session Profile Summary</h3>
                <span className={`px-3 py-1 rounded-full border text-xs font-semibold ${bandBadge[sessionBand].className}`}>
                  {bandBadge[sessionBand].label}
                </span>
              </div>

              <div className="space-y-3 mb-5">
                {dims.map((dim) => (
                  <div key={dim.label}>
                    <div className="flex items-center justify-between text-sm font-medium text-foreground mb-1">
                      <span>{dim.label}</span>
                      <span>{dim.value}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${dim.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <h4 className="font-semibold text-primary mb-1">Suggested next activity</h4>
                <p className="text-sm text-foreground/90">
                  {pathSuggestion[sessionProfile.recommendedPath] || pathSuggestion.consistency_building}
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="mb-10 p-6 bg-muted/30 rounded-2xl border-2 border-dashed border-muted shadow-inner animate-slide-up">
            <p className="text-muted-foreground font-medium italic">
              Check the guardian dashboard in a few minutes for full results.
            </p>
          </div>
        )}

        <div className="mb-8 p-4 rounded-xl border border-border bg-card text-left">
          <p className="text-xs text-muted-foreground">
            NeuroLearn provides screening insights to support learning. It is not a medical assessment.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            For a full evaluation, speak with an educational specialist.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/student/exercise"
            className="flex items-center gap-2 px-8 py-4 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-all shadow-md hover:shadow-lg text-lg"
          >
            <RotateCcw className="w-5 h-5" />
            Practice Again
          </Link>

          <Link
            to="/student"
            className="flex items-center gap-2 px-8 py-4 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:bg-muted transition-all text-lg"
          >
            <Home className="w-5 h-5" />
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
