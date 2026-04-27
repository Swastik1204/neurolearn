import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export default function ScoreBar({ data = [], dataKey = 'score', label = 'Scores', color = '#5B4FCF' }) {
  return (
    <div className="chart-card rounded-xl border border-border p-5 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-foreground">{label}</h3>
        <span className="text-[11px] text-muted-foreground font-semibold">Updated now</span>
      </div>
      <div className="w-full min-w-0 chart-grid-bg p-2" style={{ minHeight: '180px' }}>
        <ResponsiveContainer width="100%" minHeight={170}>
          <BarChart data={data} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="4 4" stroke="#E2E1D5" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: '#6B6B80' }}
              stroke="#E2E1D5"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: '#6B6B80' }}
              stroke="#E2E1D5"
            />
            <Tooltip
              cursor={{ fill: 'rgba(91,79,207,0.08)' }}
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #E2E1D5',
                borderRadius: '10px',
                boxShadow: '0 10px 20px rgba(26,26,46,0.08)',
                fontSize: 13,
              }}
            />
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
              isAnimationActive
              animationDuration={850}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
