import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function TrendLine({ data = [], dataKey = 'value', label = 'Score', color = '#5B4FCF' }) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <h3 className="font-semibold text-foreground mb-4">{label} — 4 Week Trend</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E1D5" />
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
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #E2E1D5',
                borderRadius: '8px',
                fontSize: 13,
              }}
            />
            <Line
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={3}
              dot={{ fill: color, r: 5, strokeWidth: 2 }}
              activeDot={{ r: 7, fill: color }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
