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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Focus Drop Alert */}
      {focusDrop && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-warning/40 bg-warning/5">
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
      <ScoreBar
        data={errorByDay}
        dataKey="score"
        label="Error Corrections by Day"
        color="#F4A728"
      />

      {/* Session Stats */}
      {latestSnapshot && (
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">This Week's Summary</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {latestSnapshot.tasksAttempted || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Tasks Attempted</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {latestSnapshot.tasksCompleted || 0}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Tasks Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">
                {latestSnapshot.avgSessionDuration ? `${Math.round(latestSnapshot.avgSessionDuration / 60000)}m` : '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Avg Session</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${
                latestSnapshot.performanceTrend === 'improving' ? 'text-success' :
                latestSnapshot.performanceTrend === 'regressing' ? 'text-destructive' : 'text-foreground'
              }`}>
                {latestSnapshot.performanceTrend?.charAt(0).toUpperCase() + latestSnapshot.performanceTrend?.slice(1) || '—'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Trend</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
