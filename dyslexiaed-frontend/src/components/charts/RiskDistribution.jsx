import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

const RISK_COLORS = {
  low: '#28A77A',
  medium: '#F4A728',
  high: '#DC3545',
};

export default function RiskDistribution({ data = [] }) {
  // data: [{ name: 'Low Risk', value: 5 }, { name: 'Medium Risk', value: 3 }, { name: 'High Risk', value: 2 }]
  const colors = [RISK_COLORS.low, RISK_COLORS.medium, RISK_COLORS.high];

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <h3 className="font-semibold text-foreground mb-4">Risk Level Distribution</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#FFFFFF',
                border: '1px solid #E2E1D5',
                borderRadius: '8px',
                fontSize: 13,
              }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: '#6B6B80' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
