import { Link, useLocation } from 'react-router-dom';
import { PartyPopper, Home, RotateCcw } from 'lucide-react';
import Disclaimer from '@/components/Disclaimer';

const pathSuggestion = {
  reversal_reinforcement: 'Focus activity: try tracing B and D side by side to feel the difference.',
  motor_development: 'Focus activity: practice slow, careful strokes — quality over speed.',
  consistency_building: 'Focus activity: repeat the same letter 5 times in a row to build muscle memory.',
  confidence_pacing: 'Focus activity: take your time — there is absolutely no rush.',
};

const bandLabel = {
  low: { text: 'Great progress! 🌟', cls: 'bg-success/10 text-success border-success/30' },
  moderate: { text: 'Building skills 👍', cls: 'bg-warning/10 text-warning border-warning/30' },
  high: { text: 'Needs support 💪', cls: 'bg-destructive/10 text-destructive border-destructive/30' },
};

const riskCard = {
  low: 'bg-success/5 border-success/20',
  medium: 'bg-warning/5 border-warning/20',
  high: 'bg-destructive/5 border-destructive/20',
  pending: 'bg-muted/30 border-muted',
};

const riskDot = {
  low: 'bg-success',
  medium: 'bg-warning',
  high: 'bg-destructive',
  pending: 'bg-muted-foreground',
};

const riskLabel = {
  low: 'Great form',
  medium: 'Keep practising',
  high: 'Keep working on this',
  pending: 'Pending analysis',
};

const clamp01 = (v, fb = 0.5) => {
  const n = Number(v);
  return Number.isNaN(n) ? fb : Math.min(1, Math.max(0, n));
};

const pct = (v, fb = 50) => Math.round(clamp01(v, fb / 100) * 100);

const firstSentence = (text = '') => {
  const t = String(text || '').trim();
  if (!t) return '';
  const m = t.match(/[^.!?]+[.!?]?/);
  return m?.[0]?.trim() || t;
};

function averageProfiles(results = []) {
  const valid = results.filter((r) => r?.cognitiveProfile);
  if (!valid.length) return null;
  const keys = ['writingMotor', 'reversalRisk', 'letterConsistency', 'strokeConfidence'];
  const totals = keys.reduce((acc, k) => { acc[k] = 0; return acc; }, {});
  valid.forEach((r) => keys.forEach((k) => { totals[k] += clamp01(r.cognitiveProfile[k], 0.5); }));
  return keys.reduce((acc, k) => { acc[k] = totals[k] / valid.length; return acc; }, {});
}

function sessionBand(results = []) {
  const bands = results.map((r) => r?.cognitiveProfile?.riskBand).filter(Boolean);
  if (!bands.length) return 'moderate';
  const severity = { low: 1, moderate: 2, high: 3 };
  const counts = bands.reduce((acc, b) => { acc[b] = (acc[b] || 0) + 1; return acc; }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1] || (severity[b[0]] || 0) - (severity[a[0]] || 0))[0][0];
}

function sessionRecommendedPath(results = []) {
  const paths = results.map((r) => r?.cognitiveProfile?.recommendedPath).filter(Boolean);
  if (!paths.length) return 'consistency_building';
  const counts = paths.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {});
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export default function ExerciseComplete() {
  const location = useLocation();
  const { letterResults = [] } = location.state || {};

  const avgProfile = averageProfiles(letterResults);
  const band = sessionBand(letterResults);
  const recommendedPath = sessionRecommendedPath(letterResults);
  const { text: bandText, cls: bandCls } = bandLabel[band] || bandLabel.moderate;

  const sessionDims = avgProfile
    ? [
        { key: 'writingMotor', label: 'Writing strength', value: pct(avgProfile.writingMotor) },
        { key: 'letterConsistency', label: 'Letter consistency', value: pct(avgProfile.letterConsistency) },
        { key: 'strokeConfidence', label: 'Pen confidence', value: pct(avgProfile.strokeConfidence) },
        { key: 'letterAccuracy', label: 'Letter accuracy', value: pct(1 - clamp01(avgProfile.reversalRisk)) },
      ]
    : [];

  const now = new Date();
  const dateStr = now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="min-h-screen bg-background student-view py-10 px-4">
      <div className="max-w-xl mx-auto animate-fade-in space-y-6">

        {/* ── Header ── */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-full gradient-accent flex items-center justify-center mx-auto mb-4 shadow-lg animate-scale-in">
            <PartyPopper className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-1">Well done! 🎉</h1>
          <p className="text-muted-foreground text-sm">
            You traced {letterResults.length} letter{letterResults.length !== 1 ? 's' : ''} today.
          </p>
          <p className="text-xs text-muted-foreground mt-1">{dateStr}</p>
        </div>

        {/* ── Per-letter cards ── */}
        {letterResults.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-semibold text-foreground">Your letters</h2>
            {letterResults.map((res, idx) => {
              const rl = String(res.risk_level || 'pending').toLowerCase();
              const interpretation = firstSentence(res.geminiInterpretation) || res.note || 'Great effort. Keep building skills.';
              return (
                <div key={idx} className={`rounded-xl border-2 p-4 flex items-start gap-4 ${riskCard[rl] || riskCard.pending}`}>
                  <div className="flex-shrink-0 flex flex-col items-center gap-2">
                    <span
                      className="text-4xl font-bold text-foreground"
                      style={{ fontFamily: '"OpenDyslexic", sans-serif' }}
                    >
                      {res.letter || '?'}
                    </span>
                    <span className={`w-3 h-3 rounded-full ${riskDot[rl] || riskDot.pending}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-foreground">{riskLabel[rl] || 'Pending'}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{interpretation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Session profile ── */}
        {sessionDims.length > 0 && (
          <div className="card bg-base-100 border border-border shadow-sm">
            <div className="card-body">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-foreground">Session profile</h2>
                <span className={`text-xs px-3 py-1 rounded-full border font-semibold ${bandCls}`}>
                  {bandText}
                </span>
              </div>
              <div className="space-y-3">
                {sessionDims.map((dim) => (
                  <div key={dim.key}>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{dim.label}</span>
                      <span>{dim.value}%</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-700"
                        style={{ width: `${dim.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              {recommendedPath && (
                <p className="text-xs text-muted-foreground mt-4 italic">
                  {pathSuggestion[recommendedPath] || pathSuggestion.consistency_building}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Empty fallback ── */}
        {letterResults.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-muted-foreground text-sm">
            Check the guardian dashboard in a few minutes for your full results.
          </div>
        )}

        {/* ── Actions ── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/student/exercise"
            className="flex items-center justify-center gap-2 flex-1 px-6 py-3 rounded-xl gradient-primary text-white font-semibold hover:opacity-90 transition-all shadow-md"
          >
            <RotateCcw className="w-4 h-4" />
            Practice Again
          </Link>
          <Link
            to="/student"
            className="flex items-center justify-center gap-2 flex-1 px-6 py-3 rounded-xl border-2 border-border bg-card text-foreground font-semibold hover:bg-muted transition-all"
          >
            <Home className="w-4 h-4" />
            Go Home
          </Link>
        </div>

        <Disclaimer />
      </div>
    </div>
  );
}
