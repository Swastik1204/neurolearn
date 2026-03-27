import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function ScoreBar({ data = [], dataKey = 'score', label = 'Scores', color = '#5B4FCF' }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm min-w-0">
      <h3 className="font-semibold text-foreground mb-4">{label}</h3>
      <div className="w-full min-w-0" style={{ minHeight: '160px' }}>
        <ResponsiveContainer width="100%" minHeight={160}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E1D5" />
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
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #E2E1D5',
                borderRadius: '8px',
                fontSize: 13,
              }}
            />
            <Bar
              dataKey={dataKey}
              fill={color}
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
