import useStudentData from '@/hooks/useStudentData';
import BehaviourHeatmap from '@/components/dashboard/BehaviourHeatmap';
import ScoreBar from '@/components/charts/ScoreBar';
import { AlertTriangle } from 'lucide-react';

export default function BehaviourTab({ studentId }) {
  const { sessions, behaviourSnapshots, loading } = useStudentData(studentId);

  // Build heatmap data from sessions
  const heatmapData = sessions.map((s) => {
    const dt = s.startedAt?.toDate ? s.startedAt.toDate() : new Date();
    return {
      day: (dt.getDay() + 6) % 7, // Mon=0 ... Sun=6
      hour: dt.getHours(),
      count: 1,
    };
  });

  // Build error correction data by day
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const errorByDay = dayNames.map((name) => ({ name, score: 0 }));
  sessions.forEach((s) => {
    const dt = s.startedAt?.toDate ? s.startedAt.toDate() : new Date();
    const dayIndex = (dt.getDay() + 6) % 7;
    errorByDay[dayIndex].score += s.errorCorrectionCount || 0;
  });

  const latestSnapshot = behaviourSnapshots[0];
  const focusDrop = latestSnapshot?.focusDrop || false;
  const performanceTrend = latestSnapshot?.performanceTrend || 'stable';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Focus Drop Alert */}
      {focusDrop && (
        <div className="alert alert-warning">
          <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <p className="font-semibold text-foreground text-sm">Focus drop detected</p>
            <p className="text-xs text-muted-foreground">
              Session data suggests reduced focus this week. Consider shorter sessions with breaks.
            </p>
          </div>
        </div>
      )}

      {/* Session Heatmap */}
      <BehaviourHeatmap data={heatmapData} />

      {/* Error Corrections by Day */}
      <div style={{ minHeight: '200px' }}>
        <ScoreBar
          data={errorByDay}
          dataKey="score"
          label="Error Corrections by Day"
          color="#F4A728"
        />
      </div>

      {/* Session Stats */}
      {latestSnapshot && (
        <div className="card bg-base-100 border border-border shadow-sm">
          <div className="card-body">
          <h3 className="font-semibold text-foreground mb-4">This Week's Summary</h3>
          <div className="stats stats-vertical md:stats-horizontal border border-border bg-base-100">
            <div className="stat text-center">
              <div className="stat-value text-foreground">
                {latestSnapshot.tasksAttempted || 0}
              </div>
              <div className="stat-title">Tasks Attempted</div>
            </div>
            <div className="stat text-center">
              <div className="stat-value text-foreground">
                {latestSnapshot.tasksCompleted || 0}
              </div>
              <div className="stat-title">Tasks Completed</div>
            </div>
            <div className="stat text-center">
              <div className="stat-value text-foreground">
                {latestSnapshot.avgSessionDuration ? `${Math.round(latestSnapshot.avgSessionDuration / 60000)}m` : '—'}
              </div>
              <div className="stat-title">Avg Session</div>
            </div>
            <div className="stat text-center">
              <div className={`stat-value ${
                latestSnapshot.performanceTrend === 'improving' ? 'text-success' :
                latestSnapshot.performanceTrend === 'regressing' ? 'text-destructive' : 'text-foreground'
              }`}>
                {latestSnapshot.performanceTrend?.charAt(0).toUpperCase() + latestSnapshot.performanceTrend?.slice(1) || '—'}
              </div>
              <div className="stat-title">Trend</div>
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
