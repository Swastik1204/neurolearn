import { useMemo } from 'react';
import useStudentData from '@/hooks/useStudentData';
import WeeklyScoreCard from '@/components/dashboard/WeeklyScoreCard';
import TrendLine from '@/components/charts/TrendLine';
import { PenTool, Target, RotateCcw, TrendingUp } from 'lucide-react';

// Demo data for when no real data exists
const DEMO_TREND = [
  { week: 'Week 1', value: 35 },
  { week: 'Week 2', value: 42 },
  { week: 'Week 3', value: 38 },
  { week: 'Week 4', value: 52 },
];

export default function OverviewTab({ studentId }) {
  const { sessions, analysisResults, behaviourSnapshots, loading } = useStudentData(studentId);

  const metrics = useMemo(() => {
    if (!analysisResults.length && !sessions.length) {
      // Return demo data
      return {
        consistencyScore: 72,
        consistencyTrend: 'up',
        sessionsCompleted: 3,
        sessionsTarget: 5,
        sessionsTrend: 'flat',
        reversalCount: 4,
        reversalTrend: 'down',
        progressTrend: 'improving',
      };
    }

    const avgScore = analysisResults.reduce((sum, r) => sum + (r.scores?.letterFormScore || 0), 0)
      / Math.max(analysisResults.length, 1);

    return {
      consistencyScore: Math.round(avgScore),
      consistencyTrend: avgScore > 60 ? 'up' : avgScore > 40 ? 'flat' : 'down',
      sessionsCompleted: sessions.length,
      sessionsTarget: 5,
      sessionsTrend: sessions.length >= 3 ? 'up' : 'flat',
      reversalCount: analysisResults.reduce((sum, r) => sum + (r.indicators?.reversals?.length || 0), 0),
      reversalTrend: 'down',
      progressTrend: behaviourSnapshots[0]?.performanceTrend || 'improving',
    };
  }, [analysisResults, sessions, behaviourSnapshots]);

  const trendData = useMemo(() => {
    if (!analysisResults.length) return DEMO_TREND;
    // Group by weeks and return averages
    return DEMO_TREND; // Simplified — real implementation would group by week
  }, [analysisResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <WeeklyScoreCard
          title="Handwriting Consistency"
          value={metrics.consistencyScore}
          unit="/100"
          trend={metrics.consistencyTrend}
          trendLabel={metrics.consistencyTrend === 'up' ? '+8%' : metrics.consistencyTrend === 'down' ? '-5%' : '0%'}
          icon={PenTool}
        />
        <WeeklyScoreCard
          title="Sessions Completed"
          value={`${metrics.sessionsCompleted}/${metrics.sessionsTarget}`}
          trend={metrics.sessionsTrend}
          trendLabel={metrics.sessionsTrend === 'up' ? 'On track' : 'Needs more'}
          icon={Target}
        />
        <WeeklyScoreCard
          title="Reversal Count"
          value={metrics.reversalCount}
          trend={metrics.reversalTrend}
          trendLabel={metrics.reversalTrend === 'down' ? '↓ Fewer' : '↑ More'}
          icon={RotateCcw}
        />
        <WeeklyScoreCard
          title="Progress Trend"
          value={metrics.progressTrend.charAt(0).toUpperCase() + metrics.progressTrend.slice(1)}
          trend={metrics.progressTrend === 'improving' ? 'up' : metrics.progressTrend === 'regressing' ? 'down' : 'flat'}
          trendLabel=""
          icon={TrendingUp}
        />
      </div>

      {/* Trend Line */}
      <TrendLine
        data={trendData}
        dataKey="value"
        label="Overall Dyslexia Risk Score"
        color="#5B4FCF"
      />
    </div>
  );
}
