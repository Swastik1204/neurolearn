import { useMemo } from 'react';
import useStudentData from '@/hooks/useStudentData';
import WeeklyScoreCard from '@/components/dashboard/WeeklyScoreCard';
import TrendLine from '@/components/charts/TrendLine';
import { PenTool, Target, RotateCcw, TrendingUp } from 'lucide-react';

/* Demo data removed — using real analysis trends */

export default function OverviewTab({ studentId }) {
  const { sessions, analysisResults, behaviourSnapshots, summary, loading } = useStudentData(studentId);

  const metrics = useMemo(() => {
    if (summary?.stats) {
      const { consistencyScore, totalReversals, sessionsCompleted } = summary.stats;
      
      const lastTwo = analysisResults.slice(0, 2);
      let consistencyTrend = 'flat';
      let trendLabel = 'Stable';
      if (lastTwo.length === 2) {
        const current = lastTwo[0].scores?.letterFormScore || 0;
        const previous = lastTwo[1].scores?.letterFormScore || 0;
        const trendPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
        consistencyTrend = trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'flat';
        trendLabel = trendPct !== 0 ? `${trendPct > 0 ? '+' : ''}${trendPct}%` : 'Stable';
      }

      return {
        consistencyScore,
        consistencyTrend,
        trendLabel,
        sessionsCompleted,
        sessionsTarget: 5,
        sessionsTrend: sessionsCompleted >= 3 ? 'up' : 'flat',
        reversalCount: totalReversals,
        reversalTrend: 'down',
        progressTrend: behaviourSnapshots[0]?.performanceTrend || 'improving',
      };
    }

    if (!analysisResults.length) {
      return {
        consistencyScore: 0,
        consistencyTrend: 'flat',
        trendLabel: 'No data',
        sessionsCompleted: sessions.length,
        sessionsTarget: 5,
        sessionsTrend: 'flat',
        reversalCount: 0,
        reversalTrend: 'flat',
        progressTrend: 'pending',
      };
    }

    const avgScore = analysisResults.reduce((sum, r) => sum + (r.scores?.letterFormScore || 0), 0)
      / analysisResults.length;

    const lastTwo = analysisResults.slice(0, 2);
    let consistencyTrend = 'flat';
    let trendLabel = 'Stable';
    if (lastTwo.length === 2) {
      const current = lastTwo[0].scores?.letterFormScore || 0;
      const previous = lastTwo[1].scores?.letterFormScore || 0;
      const trendPct = previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0;
      consistencyTrend = trendPct > 5 ? 'up' : trendPct < -5 ? 'down' : 'flat';
      trendLabel = trendPct !== 0 ? `${trendPct > 0 ? '+' : ''}${trendPct}%` : 'Stable';
    }

    return {
      consistencyScore: Math.round(avgScore),
      consistencyTrend,
      trendLabel,
      sessionsCompleted: sessions.length,
      sessionsTarget: 5,
      sessionsTrend: sessions.length >= 3 ? 'up' : 'flat',
      reversalCount: analysisResults.reduce((sum, r) => sum + (r.indicators?.reversals?.length || 0), 0),
      reversalTrend: 'down',
      progressTrend: behaviourSnapshots[0]?.performanceTrend || 'stable',
    };
  }, [analysisResults, sessions, behaviourSnapshots, summary]);

  const trendData = useMemo(() => {
    if (summary?.stats?.trendData?.length > 0) {
      return summary.stats.trendData;
    }
    // Build from results if API summary missing
    return analysisResults
      .slice()
      .reverse()
      .map(r => ({
        date: r.analyzedAt?.toDate ? r.analyzedAt.toDate().toLocaleDateString() : '',
        value: r.scores?.overallDyslexiaRisk || 0
      }));
  }, [summary, analysisResults]);

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
          trendLabel={metrics.trendLabel}
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
