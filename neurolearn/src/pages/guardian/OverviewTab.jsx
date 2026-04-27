import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import useStudentData from '@/hooks/useStudentData';
import { formatDate } from '@/utils/dateUtils';
import Disclaimer from '@/components/Disclaimer';

const pathLabel = {
  reversal_reinforcement: 'Focus path: letter reversal reinforcement',
  phonological_reinforcement: 'Focus path: phonological reinforcement',
  motor_development: 'Focus path: writing motor development',
  consistency_building: 'Focus path: consistency building',
  confidence_pacing: 'Focus path: confidence pacing',
  general_practice: 'Focus path: general daily practice',
};

const bandBadge = {
  low: 'badge-success',
  moderate: 'badge-warning',
  high: 'badge-error',
};

const profileColor = {
  writingMotor: '#2E8B57',
  letterConsistency: '#1F78D1',
  strokeConfidence: '#F4A728',
  reversalRisk: '#DC3545',
};

function trendDirection(timeline = []) {
  if (!Array.isArray(timeline) || timeline.length < 2) return 'stable';
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  const firstRisk = Number(first?.reversalRisk ?? 0.5);
  const lastRisk = Number(last?.reversalRisk ?? 0.5);
  if (lastRisk < firstRisk - 0.04) return 'improving';
  if (lastRisk > firstRisk + 0.04) return 'declining';
  return 'stable';
}

function chartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const rows = payload.filter(Boolean);
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
      {rows.map((row) => (
        <p key={row.dataKey} className="text-xs" style={{ color: row.color }}>
          {row.name}: {Math.round(Number(row.value || 0) * 100)}%
        </p>
      ))}
    </div>
  );
}

const clamp01 = (value, fallback = 0.5) => {
  const num = Number(value);
  if (Number.isNaN(num)) return fallback;
  return Math.min(1, Math.max(0, num));
};

function weakestDimension(profile = {}) {
  const dims = [
    { key: 'writingMotor', label: 'Writing strength', value: clamp01(profile.writingMotor) },
    { key: 'letterConsistency', label: 'Letter consistency', value: clamp01(profile.letterConsistency) },
    { key: 'strokeConfidence', label: 'Pen confidence', value: clamp01(profile.strokeConfidence) },
    { key: 'letterAccuracy', label: 'Letter accuracy', value: clamp01(1 - clamp01(profile.reversalRisk)) },
  ];
  return dims.sort((a, b) => a.value - b.value)[0];
}

function profileBars(profile = {}) {
  return [
    { key: 'writingMotor', label: 'Writing strength', value: Math.round(clamp01(profile.writingMotor) * 100) },
    { key: 'letterConsistency', label: 'Letter consistency', value: Math.round(clamp01(profile.letterConsistency) * 100) },
    { key: 'strokeConfidence', label: 'Pen confidence', value: Math.round(clamp01(profile.strokeConfidence) * 100) },
    { key: 'letterAccuracy', label: 'Letter accuracy', value: Math.round(clamp01(1 - clamp01(profile.reversalRisk)) * 100) },
  ];
}

function percent(value) {
  return `${Math.round(clamp01(value, 0) * 100)}%`;
}

function asDateString(value) {
  if (!value) return 'Unknown date';
  if (typeof value === 'string') return formatDate(value);
  if (typeof value.toDate === 'function') return formatDate(value.toDate().toISOString());
  if (value._seconds !== undefined) return formatDate(new Date(value._seconds * 1000).toISOString());
  if (value.seconds !== undefined) return formatDate(new Date(value.seconds * 1000).toISOString());
  const d = new Date(value);
  return isNaN(d.getTime()) ? 'Unknown date' : formatDate(d.toISOString());
}

export default function OverviewTab({ studentId }) {
  const { sessions = [], summary, loading } = useStudentData(studentId);

  const overallProfile = summary?.overallProfile || null;
  const screeningBaseline = summary?.screeningBaseline || null;
  const baselineProfile = screeningBaseline?.baselineProfile || null;
  const screeningSchedule = summary?.screeningSchedule || null;
  const timeline = (summary?.profileTimeline || []).map((item) => ({
    ...item,
    label: formatDate(item.date),
    writingMotor: clamp01(item.writingMotor),
    letterConsistency: clamp01(item.letterConsistency),
    strokeConfidence: clamp01(item.strokeConfidence),
    reversalRisk: clamp01(item.reversalRisk),
  }));
  const letterBreakdown = summary?.letterBreakdown || {};
  const recentSessions = sessions.slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {baselineProfile && (
        <div className="premium-card animate-slide-up">
          <div className="card-body">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-foreground">Baseline Screening</h3>
              <span className={`badge ${bandBadge[baselineProfile?.writingProfile?.overallRiskBand] || 'badge-warning'} badge-outline`}>
                {String(baselineProfile?.writingProfile?.overallRiskBand || 'moderate').toUpperCase()}
              </span>
            </div>

            <p className="text-sm text-muted-foreground">
              Initial screening completed on {asDateString(baselineProfile.completedAt || screeningBaseline.completedAt)}
            </p>

            <div className="grid grid-cols-1 gap-2 text-sm mt-2">
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Letter recognition accuracy</span>
                <span className="font-semibold text-foreground">{percent(baselineProfile?.visualDiscrimination?.accuracy)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Sound awareness accuracy</span>
                <span className="font-semibold text-foreground">{percent(baselineProfile?.phonologicalAwareness?.accuracy)}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-muted-foreground">Writing risk level</span>
                <span className={`badge ${bandBadge[baselineProfile?.writingProfile?.overallRiskBand] || 'badge-warning'} badge-outline`}>
                  {String(baselineProfile?.writingProfile?.overallRiskBand || 'moderate').toUpperCase()}
                </span>
              </div>

              {screeningSchedule?.nextDueAt && (
                <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                  <span className="text-muted-foreground">Next weekly check-in</span>
                  <span className="font-semibold text-foreground">{asDateString(screeningSchedule.nextDueAt)}</span>
                </div>
              )}
            </div>

            {(baselineProfile?.visualDiscrimination?.confusedPairs || []).length > 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                Letter pairs to watch: {(baselineProfile.visualDiscrimination.confusedPairs || []).join(', ')}
              </p>
            )}

            {(baselineProfile?.phonologicalAwareness?.weakAreas || []).length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Sound areas to develop: {(baselineProfile.phonologicalAwareness.weakAreas || []).join(', ')}
              </p>
            )}

            <p className="text-sm text-muted-foreground mt-2">
              {pathLabel[baselineProfile?.recommendedPath] || pathLabel.general_practice}
            </p>

            <Disclaimer />
          </div>
        </div>
      )}



      <div className="premium-card animate-slide-up" style={{ animationDelay: '100ms' }}>
        <div className="card-body">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-foreground">Overall Cognitive Profile</h3>
            {overallProfile ? (
              <span className={`badge ${bandBadge[overallProfile.riskBand] || 'badge-warning'} badge-outline`}>
                {String(overallProfile.riskBand || 'moderate').toUpperCase()}
              </span>
            ) : (
              <span className="badge badge-outline">ANALYSING...</span>
            )}
          </div>

          {overallProfile ? (
            <>
              <div className="space-y-3 mt-2">
                {profileBars(overallProfile).map((item) => (
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
              <p className="text-sm text-muted-foreground mt-3">
                {pathLabel[overallProfile.recommendedPath] || pathLabel.consistency_building}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground mt-2">Analysing recent handwriting samples...</p>
          )}
        </div>
      </div>

      <div className="premium-card animate-slide-up" style={{ animationDelay: '200ms' }}>
        <div className="card-body">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="font-semibold text-foreground">Progress Trend</h3>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-dot" />
              Live trend
            </span>
          </div>

          {timeline.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs px-2 py-1 rounded-full border border-border bg-muted/40 text-muted-foreground">
                Samples: {timeline.length}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full border ${trendDirection(timeline) === 'improving' ? 'text-success border-success/30 bg-success/10' : trendDirection(timeline) === 'declining' ? 'text-destructive border-destructive/30 bg-destructive/10' : 'text-warning border-warning/30 bg-warning/10'}`}>
                Trend: {trendDirection(timeline)}
              </span>
            </div>
          )}

          {timeline.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No sessions recorded yet. Ask the student to complete a writing exercise.
            </div>
          ) : (
            <div className="chart-grid-bg p-2" style={{ minHeight: '290px' }}>
              <ResponsiveContainer width="100%" minHeight={280}>
                <AreaChart data={timeline} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                  <defs>
                    <linearGradient id="colorMotor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={profileColor.writingMotor} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={profileColor.writingMotor} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConsistency" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={profileColor.letterConsistency} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={profileColor.letterConsistency} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={profileColor.strokeConfidence} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={profileColor.strokeConfidence} stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={profileColor.reversalRisk} stopOpacity={0.1}/>
                      <stop offset="95%" stopColor={profileColor.reversalRisk} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" stroke="#E2E1D5" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B6B80' }} stroke="#E2E1D5" axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: '#6B6B80' }} stroke="#E2E1D5" axisLine={false} tickLine={false} />
                  <Tooltip content={chartTooltip} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="writingMotor" name="Writing strength" stroke={profileColor.writingMotor} strokeWidth={2.5} fillOpacity={1} fill="url(#colorMotor)" isAnimationActive animationDuration={1200} />
                  <Area type="monotone" dataKey="letterConsistency" name="Letter consistency" stroke={profileColor.letterConsistency} strokeWidth={2.5} fillOpacity={1} fill="url(#colorConsistency)" isAnimationActive animationDuration={1200} />
                  <Area type="monotone" dataKey="strokeConfidence" name="Pen confidence" stroke={profileColor.strokeConfidence} strokeWidth={2.5} fillOpacity={1} fill="url(#colorConfidence)" isAnimationActive animationDuration={1200} />
                  <Area type="monotone" dataKey="reversalRisk" name="Reversal pressure" stroke={profileColor.reversalRisk} strokeWidth={2.5} fillOpacity={1} fill="url(#colorRisk)" isAnimationActive animationDuration={1200} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="premium-card animate-slide-up" style={{ animationDelay: '300ms' }}>
        <div className="card-body">
          <h3 className="font-semibold text-foreground mb-2">Letter Breakdown</h3>
          {Object.keys(letterBreakdown).length === 0 ? (
            <p className="text-sm text-muted-foreground">No letter-specific data yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(letterBreakdown).map(([letter, payload]) => (
                <div key={letter} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-foreground">{letter || '?'}</span>
                    <span className="text-xs text-muted-foreground">{payload.count} sample{payload.count === 1 ? '' : 's'}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reversal pressure: {Math.round(clamp01(payload.averageCognitiveProfile?.reversalRisk) * 100)}%
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    Letter form: {Math.round(Number(payload.averageScores?.letterFormScore || 0))}/100
                  </p>
                  
                  {payload.emotions && (
                    <div className="space-y-1.5 border-t border-border/50 pt-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Feeling during practice</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-4">😊</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-success" style={{ width: `${(payload.emotions.happy / payload.count) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-medium w-4 text-right">{payload.emotions.happy}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-4">😐</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-warning" style={{ width: `${(payload.emotions.okay / payload.count) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-medium w-4 text-right">{payload.emotions.okay}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs w-4">😟</span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-destructive" style={{ width: `${(payload.emotions.hard / payload.count) * 100}%` }} />
                        </div>
                        <span className="text-[10px] font-medium w-4 text-right">{payload.emotions.hard}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="premium-card animate-slide-up" style={{ animationDelay: '400ms' }}>
        <div className="card-body">
          <h3 className="font-semibold text-foreground mb-2">Recent Sessions</h3>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent sessions yet.</p>
          ) : (
            <div className="space-y-2">
              {recentSessions.map((session) => {
                const parseDate = (val) => {
                  if (!val) return new Date();
                  if (typeof val.toDate === 'function') return val.toDate();
                  if (val._seconds !== undefined) return new Date(val._seconds * 1000);
                  if (val.seconds !== undefined) return new Date(val.seconds * 1000);
                  const d = new Date(val);
                  return isNaN(d.getTime()) ? new Date() : d;
                };
                const started = parseDate(session.startedAt);
                const weak = session.cognitiveProfile ? weakestDimension(session.cognitiveProfile) : null;
                return (
                  <div key={session.id} className="rounded-lg border border-border p-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-foreground text-sm">
                        {started ? formatDate(started.toISOString()) : 'Unknown date'}
                      </p>
                      <p className="text-xs text-muted-foreground">Letters: {(session.letters || []).join(', ') || '?'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{session.durationMs ? `${Math.round(session.durationMs / 1000)}s` : 'n/a'}</p>
                      <span className={`badge ${bandBadge[session.sessionRiskBand] || 'badge-ghost'} badge-outline`}>
                        {(session.sessionRiskBand || 'moderate').toUpperCase()}
                      </span>
                      {weak && <p className="text-xs text-muted-foreground mt-1">Weakest: {weak.label}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}
