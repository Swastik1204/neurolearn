import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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
        <div className="card bg-base-100 border border-border shadow-sm">
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

      <div className="card bg-base-100 border border-border shadow-sm">
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

      <div className="card bg-base-100 border border-border shadow-sm">
        <div className="card-body">
          <h3 className="font-semibold text-foreground mb-2">Progress Trend</h3>
          {timeline.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No sessions recorded yet. Ask the student to complete a writing exercise.
            </div>
          ) : (
            <div style={{ minHeight: '280px' }}>
              <ResponsiveContainer width="100%" minHeight={280}>
                <LineChart data={timeline} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E1D5" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6B6B80' }} stroke="#E2E1D5" />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 11, fill: '#6B6B80' }} stroke="#E2E1D5" />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="writingMotor" name="Writing strength" stroke={profileColor.writingMotor} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="letterConsistency" name="Letter consistency" stroke={profileColor.letterConsistency} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="strokeConfidence" name="Pen confidence" stroke={profileColor.strokeConfidence} strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="reversalRisk" name="Reversal pressure" stroke={profileColor.reversalRisk} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-border shadow-sm">
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
                  <p className="text-sm text-muted-foreground">
                    Letter form: {Math.round(Number(payload.averageScores?.letterFormScore || 0))}/100
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card bg-base-100 border border-border shadow-sm">
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
