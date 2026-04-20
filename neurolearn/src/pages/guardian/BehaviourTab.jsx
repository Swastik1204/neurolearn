import useStudentData from '@/hooks/useStudentData';
import BehaviourHeatmap from '@/components/dashboard/BehaviourHeatmap';

export default function BehaviourTab({ studentId }) {
  const { sessions, loading } = useStudentData(studentId);

  // Build heatmap data from sessions
  const heatmapData = sessions.map((s) => {
    const dt = s.startedAt?.toDate ? s.startedAt.toDate() : new Date();
    return {
      day: (dt.getDay() + 6) % 7, // Mon=0 ... Sun=6
      hour: dt.getHours(),
      count: 1,
    };
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Session Heatmap */}
      <BehaviourHeatmap data={heatmapData} />

      <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
        Behaviour snapshots and error-correction tracking have been retired in the simplified schema.
      </div>
    </div>
  );
}
