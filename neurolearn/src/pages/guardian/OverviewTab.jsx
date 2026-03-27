import { useEffect, useMemo, useState } from 'react';
import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { db } from '@/services/firebase';
import useStudentData from '@/hooks/useStudentData';
import useCurrentUser from '@/hooks/useCurrentUser';
import WeeklyScoreCard from '@/components/dashboard/WeeklyScoreCard';
import TrendLine from '@/components/charts/TrendLine';
import { PenTool, Target, RotateCcw, TrendingUp, SlidersHorizontal } from 'lucide-react';

/* Demo data removed — using real analysis trends */

const EMOTION_EMOJI = {
  happy: '🙂',
  sad: '😢',
  angry: '😠',
  fearful: '😨',
  disgusted: '🤢',
  surprised: '😮',
  neutral: '😐',
};

export default function OverviewTab({ studentId }) {
  const { user } = useCurrentUser();
  const { sessions, analysisResults, behaviourSnapshots, summary, loading } = useStudentData(studentId);
  const [studentDocRef, setStudentDocRef] = useState(null);
  const [practiceConfig, setPracticeConfig] = useState({ difficulty: 'medium', focusLetters: [] });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [pendingDifficulty, setPendingDifficulty] = useState('medium');
  const [savingConfig, setSavingConfig] = useState(false);
  const [configError, setConfigError] = useState(null);
  const [configToast, setConfigToast] = useState('');

  useEffect(() => {
    if (!studentId) return;
    let cancelled = false;

    const loadPracticeConfig = async () => {
      try {
        const directRef = doc(db, 'students', studentId);
        const directSnap = await getDoc(directRef);

        if (directSnap.exists()) {
          const data = directSnap.data() || {};
          if (!cancelled) {
            setStudentDocRef(directRef);
            const difficulty = (data.practiceConfig?.difficulty || 'medium').toLowerCase();
            setPracticeConfig({
              difficulty,
              focusLetters: data.practiceConfig?.focusLetters || [],
            });
            setPendingDifficulty(difficulty);
          }
          return;
        }

        const byUidQ = query(
          collection(db, 'students'),
          where('uid', '==', studentId),
          limit(1)
        );
        const byUidSnap = await getDocs(byUidQ);
        if (!byUidSnap.empty && !cancelled) {
          const matchDoc = byUidSnap.docs[0];
          const data = matchDoc.data() || {};
          setStudentDocRef(matchDoc.ref);
          const difficulty = (data.practiceConfig?.difficulty || 'medium').toLowerCase();
          setPracticeConfig({
            difficulty,
            focusLetters: data.practiceConfig?.focusLetters || [],
          });
          setPendingDifficulty(difficulty);
        }
      } catch (err) {
        console.error('Failed to load practice config:', err.message);
      }
    };

    loadPracticeConfig();

    return () => {
      cancelled = true;
    };
  }, [studentId]);

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
        week: r.analyzedAt?.toDate ? r.analyzedAt.toDate().toLocaleDateString() : '',
        value: r.scores?.overallDyslexiaRisk || 0
      }));
  }, [summary, analysisResults]);

  const focusInsights = useMemo(() => {
    const byLetter = {};

    analysisResults.forEach((result) => {
      const letter = String(result.letter || '').toLowerCase();
      if (!letter) return;

      const risk = result.scores?.overallDyslexiaRisk ?? result.overallRisk ?? 0;
      const reversals = result.indicators?.reversals?.length || 0;
      const emotion = String(result.emotionAtSubmit || 'neutral').toLowerCase();

      if (!byLetter[letter]) {
        byLetter[letter] = {
          letter,
          totalRisk: 0,
          count: 0,
          reversals: 0,
          emotions: {},
        };
      }

      byLetter[letter].totalRisk += risk;
      byLetter[letter].count += 1;
      byLetter[letter].reversals += reversals;
      byLetter[letter].emotions[emotion] = (byLetter[letter].emotions[emotion] || 0) + 1;
    });

    const ranked = Object.values(byLetter)
      .map((item) => {
        const dominantEmotion = Object.entries(item.emotions)
          .sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
        return {
          letter: item.letter,
          avgRisk: item.count > 0 ? item.totalRisk / item.count : 0,
          reversals: item.reversals,
          dominantEmotion,
          samples: item.count,
        };
      })
      .sort((a, b) => b.avgRisk - a.avgRisk);

    const focusLetters = ranked
      .filter((item) => item.avgRisk >= 0.35 || item.reversals > 0)
      .slice(0, 4);

    return focusLetters.length > 0 ? focusLetters : ranked.slice(0, 3);
  }, [analysisResults]);

  const highRiskLetters = useMemo(() => {
    const seen = new Set();
    analysisResults.forEach((result) => {
      const letter = String(result.letter || '').toLowerCase();
      if (!letter) return;

      const normalizedRisk = String(result.riskLevel || result.risk_level || '').toLowerCase();
      const riskScore = result.scores?.overallDyslexiaRisk;
      const isHighByScore = typeof riskScore === 'number' && riskScore >= 0.7;

      if (normalizedRisk === 'high' || isHighByScore) {
        seen.add(letter);
      }
    });

    return Array.from(seen);
  }, [analysisResults]);

  const handleSavePracticeConfig = async () => {
    if (!studentDocRef || savingConfig) return;
    setSavingConfig(true);
    setConfigError(null);
    try {
      const nextConfig = {
        difficulty: pendingDifficulty,
        focusLetters: highRiskLetters.length > 0
          ? highRiskLetters
          : focusInsights.map((i) => i.letter),
        setBy: user?.uid || 'guardian',
        setAt: serverTimestamp(),
      };

      await updateDoc(studentDocRef, { practiceConfig: nextConfig });
      setPracticeConfig({
        difficulty: nextConfig.difficulty,
        focusLetters: nextConfig.focusLetters,
      });
      setShowAdjustModal(false);
      setConfigToast('Difficulty updated - takes effect next session');
      setTimeout(() => setConfigToast(''), 2500);
    } catch (err) {
      setConfigError('Could not save difficulty. Please try again.');
    } finally {
      setSavingConfig(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {configToast && (
        <div className="alert alert-success">
          <span>{configToast}</span>
        </div>
      )}

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
              <h3 className="font-semibold text-foreground">Focus Letters</h3>
              <p className="text-sm text-muted-foreground">
                Current practice difficulty: <span className="font-medium capitalize">{practiceConfig.difficulty}</span>
              </p>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={() => setShowAdjustModal(true)}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Adjust Practice Level
            </button>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Often {EMOTION_EMOJI[item.dominantEmotion] || '😐'} {item.dominantEmotion}
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

      {showAdjustModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg">Adjust Practice Difficulty</h3>
            <p className="py-2 text-sm text-muted-foreground">
              The next student exercise will use this level and focus letters: {focusInsights.map((i) => i.letter).join(', ') || 'none yet'}.
            </p>

            <div className="grid grid-cols-1 gap-2 mt-2">
              {[
                { key: 'easy', title: 'Easy', detail: 'Simpler letters, more time' },
                { key: 'medium', title: 'Medium', detail: 'Standard diagnostic letters' },
                { key: 'hard', title: 'Hard', detail: 'Reversal pairs, challenge pace' },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    pendingDifficulty === option.key
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/40'
                  }`}
                  onClick={() => setPendingDifficulty(option.key)}
                  disabled={savingConfig}
                >
                  <p className="font-semibold text-foreground">{option.title}</p>
                  <p className="text-sm text-muted-foreground">{option.detail}</p>
                </button>
              ))}
            </div>

            {configError && <p className="text-sm text-error mt-3">{configError}</p>}

            <div className="modal-action">
              <button
                type="button"
                className="btn"
                onClick={() => setShowAdjustModal(false)}
                disabled={savingConfig}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSavePracticeConfig}
                disabled={savingConfig}
              >
                {savingConfig ? 'Saving...' : 'Save Difficulty'}
              </button>
            </div>
          </div>
          <button type="button" className="modal-backdrop" onClick={() => !savingConfig && setShowAdjustModal(false)} aria-label="Close" />
        </div>
      )}
    </div>
  );
}
