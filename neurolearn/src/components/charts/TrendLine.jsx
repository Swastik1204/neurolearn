import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function TrendLine({ data = [], dataKey = 'value', label = 'Score', color = '#5B4FCF' }) {
  return (
    <div className="chart-card rounded-xl border border-border p-5 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">{label} - 4 Week Trend</h3>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-live-dot" />
          Live
        </span>
      </div>
      <div className="w-full min-w-0 chart-grid-bg p-2" style={{ minHeight: '220px' }}>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" minHeight={210}>
            <AreaChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="trendAreaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.28} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="4 4" stroke="#E2E1D5" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 12, fill: '#6B6B80' }}
                stroke="#E2E1D5"
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 12, fill: '#6B6B80' }}
                stroke="#E2E1D5"
              />
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke="none"
                fillOpacity={1}
                fill="url(#trendAreaFill)"
                isAnimationActive
                animationDuration={900}
              />
              <Tooltip
                cursor={{ stroke: color, strokeWidth: 1.5, strokeDasharray: '3 3' }}
                contentStyle={{
                  background: '#FFFFFF',
                  border: '1px solid #E2E1D5',
                  borderRadius: '10px',
                  boxShadow: '0 10px 22px rgba(26,26,46,0.08)',
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={color}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={{ fill: color, r: 5, strokeWidth: 2 }}
                activeDot={{ r: 7, fill: color }}
                isAnimationActive
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-sm text-muted-foreground flex flex-col items-center justify-center gap-2" style={{ minHeight: '210px' }}>
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              📉
            </div>
            <p>No activity to display yet</p>
          </div>
        )}
      </div>
    </div>
  );
}
