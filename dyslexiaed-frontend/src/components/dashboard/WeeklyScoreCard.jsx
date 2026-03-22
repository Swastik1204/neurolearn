import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

const TREND_ICONS = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
};

const TREND_COLORS = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground',
};

export default function WeeklyScoreCard({ title, value, unit, trend, trendLabel, icon: Icon }) {
  const TrendIcon = TREND_ICONS[trend] || Minus;
  const trendColor = TREND_COLORS[trend] || 'text-muted-foreground';

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow animate-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          {Icon && <Icon className="w-5 h-5 text-primary" />}
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${trendColor}`}>
          <TrendIcon className="w-4 h-4" />
          <span>{trendLabel}</span>
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">
        {value}
        {unit && <span className="text-base font-normal text-muted-foreground ml-1">{unit}</span>}
      </div>
      <p className="text-sm text-muted-foreground mt-1">{title}</p>
    </div>
  );
}
