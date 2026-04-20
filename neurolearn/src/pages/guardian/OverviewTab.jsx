import { useMemo } from 'react';
import useStudentData from '@/hooks/useStudentData';
import WeeklyScoreCard from '@/components/dashboard/WeeklyScoreCard';
import TrendLine from '@/components/charts/TrendLine';
import { PenTool, Target, RotateCcw, TrendingUp } from 'lucide-react';

/* Demo data removed — using real analysis trends */

export default function OverviewTab({ studentId }) {
  const { sessions, analysisResults, summary, loading } = useStudentData(studentId);

  const metrics = useMemo(() => {
    const latest = analysisResults[0] || null;
    const previous = analysisResults[1] || null;
    const latestScores = latest?.scores || {};
    const previousScores = previous?.scores || {};
    const latestRisk = latestScores.overallRisk ?? 0;
    const previousRisk = previousScores.overallRisk ?? latestRisk;
    const latestLetterForm = latestScores.letterFormScore || 0;
    const previousLetterForm = previousScores.letterFormScore || latestLetterForm;
    const latestReversal = latestScores.reversalScore || 0;
    const previousReversal = previousScores.reversalScore || latestReversal;

    const scoreTrend = (current, prior, invert = false) => {
      if (typeof prior !== 'number') return 'flat';
      if (invert) {
        if (current < prior) return 'up';
        if (current > prior) return 'down';
        return 'flat';
      }
      if (current > prior) return 'up';
      if (current < prior) return 'down';
      return 'flat';
    };

    return {
      letterFormScore: Math.round(latestLetterForm),
      letterFormTrend: scoreTrend(latestLetterForm, previousLetterForm),
      reversalScore: Math.round(latestReversal),
      reversalTrend: scoreTrend(latestReversal, previousReversal, true),
      overallRisk: Math.round((latestRisk || 0) * 100),
      overallRiskTrend: scoreTrend(latestRisk, previousRisk, true),
      sessionsCompleted: sessions.length,
      sessionsTarget: 5,
      sessionsTrend: sessions.length >= 3 ? 'up' : 'flat',
      trendLabel: latest ? 'Latest sample' : 'No data',
    };
  }, [analysisResults, sessions]);

  const trendData = useMemo(() => {
    if (summary?.stats?.trendData?.length > 0) {
      return summary.stats.trendData;
    }
    // Build from results if API summary missing
    return analysisResults
      .slice()
      .reverse()
      .map(r => ({
        week: r.analyzedAt?.toDate ? r.analyzedAt.toDate().toLocaleDateString() : '',
        value: r.scores?.overallRisk || 0
      }));
  }, [summary, analysisResults]);

  const focusInsights = useMemo(() => {
    const byLetter = {};

    analysisResults.forEach((result) => {
      const letter = String(result.letter || '').toLowerCase();
      if (!letter) return;

      const risk = result.scores?.overallRisk ?? 0;
      const reversals = result.indicators?.reversals?.length || 0;

      if (!byLetter[letter]) {
        byLetter[letter] = {
          letter,
          totalRisk: 0,
          count: 0,
          reversals: 0,
        };
      }

      byLetter[letter].totalRisk += risk;
      byLetter[letter].count += 1;
      byLetter[letter].reversals += reversals;
    });

    const ranked = Object.values(byLetter)
      .map((item) => {
        return {
          letter: item.letter,
          avgRisk: item.count > 0 ? item.totalRisk / item.count : 0,
          reversals: item.reversals,
          samples: item.count,
        };
      })
      .sort((a, b) => b.avgRisk - a.avgRisk);

    const focusLetters = ranked
      .filter((item) => item.avgRisk >= 0.35 || item.reversals > 0)
      .slice(0, 4);

    return focusLetters.length > 0 ? focusLetters : ranked.slice(0, 3);
  }, [analysisResults]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <WeeklyScoreCard
          title="Letter Form"
          value={metrics.letterFormScore}
          unit="/100"
          trend={metrics.letterFormTrend}
          trendLabel={metrics.trendLabel}
          icon={PenTool}
        />
        <WeeklyScoreCard
          title="Reversal Score"
          value={metrics.reversalScore}
          unit="/100"
          trend={metrics.reversalTrend}
          trendLabel="Lower is better"
          icon={RotateCcw}
        />
        <WeeklyScoreCard
          title="Overall Risk"
          value={metrics.overallRisk}
          unit="%"
          trend={metrics.overallRiskTrend}
          trendLabel="Lower is better"
          icon={TrendingUp}
        />
        <WeeklyScoreCard
          title="Sessions Completed"
          value={`${metrics.sessionsCompleted}/${metrics.sessionsTarget}`}
          trend={metrics.sessionsTrend}
          trendLabel={metrics.sessionsTrend === 'up' ? 'On track' : 'Needs more'}
          icon={Target}
        />
      </div>

      {/* Trend Line */}
      <div style={{ minHeight: '200px' }}>
        <TrendLine
          data={trendData}
          dataKey="value"
          label="Overall Dyslexia Risk Score"
          color="#5B4FCF"
        />
      </div>

      <div className="card bg-base-100 border border-border shadow-sm">
        <div className="card-body gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">Focus Letter Insights</h3>
              <p className="text-sm text-muted-foreground">
                Based on recent analysis results for this selected student.
              </p>
            </div>
          </div>

          {focusInsights.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {focusInsights.map((item) => (
                <div key={item.letter} className="rounded-lg border border-border p-3 bg-base-100">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground uppercase">{item.letter}</span>
                    <span className="badge badge-warning">High risk</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Risk {(item.avgRisk * 100).toFixed(0)}% over {item.samples} sample{item.samples === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
              No focus letters yet. Keep practicing to generate adaptive recommendations.
            </div>
          )}
        </div>
      </div>

      <div className="stats stats-vertical lg:stats-horizontal shadow border border-border w-full bg-base-100">
        <div className="stat">
          <div className="stat-title">Total Samples</div>
          <div className="stat-value text-primary">{analysisResults.length}</div>
          <div className="stat-desc">Used in current trend</div>
        </div>
        <div className="stat">
          <div className="stat-title">Linked Sessions</div>
          <div className="stat-value text-accent">{sessions.length}</div>
          <div className="stat-desc">Recent activity loaded</div>
        </div>
      </div>
    </div>
  );
}
