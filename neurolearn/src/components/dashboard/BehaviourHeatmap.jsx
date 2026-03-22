const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Group hours into 6 buckets for readability
const HOUR_LABELS = ['12a', '4a', '8a', '12p', '4p', '8p'];
const HOUR_BUCKETS = [
  [0, 1, 2, 3],
  [4, 5, 6, 7],
  [8, 9, 10, 11],
  [12, 13, 14, 15],
  [16, 17, 18, 19],
  [20, 21, 22, 23],
];

function getColor(count, max) {
  if (count === 0) return '#F0EFE8';
  const intensity = Math.min(count / Math.max(max, 1), 1);
  if (intensity < 0.25) return '#D4CBFF';
  if (intensity < 0.5) return '#A89BEE';
  if (intensity < 0.75) return '#7B6DD8';
  return '#5B4FCF';
}

export default function BehaviourHeatmap({ data = [] }) {
  // Build grid: data should be array of { day: 0-6, hour: 0-23, count: number }
  const grid = {};
  let maxCount = 1;

  // Initialize
  DAYS.forEach((_, di) => {
    HOUR_BUCKETS.forEach((_, bi) => {
      const key = `${di}-${bi}`;
      grid[key] = 0;
    });
  });

  // Fill
  data.forEach(({ day, hour, count }) => {
    const bucketIndex = HOUR_BUCKETS.findIndex((b) => b.includes(hour));
    if (bucketIndex >= 0) {
      const key = `${day}-${bucketIndex}`;
      grid[key] = (grid[key] || 0) + count;
      maxCount = Math.max(maxCount, grid[key]);
    }
  });

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
      <h3 className="font-semibold text-foreground mb-4">Session Activity</h3>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${HOUR_BUCKETS.length * 40 + 50} ${DAYS.length * 30 + 30}`}
          className="w-full min-w-[300px]"
        >
          {/* Hour labels */}
          {HOUR_LABELS.map((label, i) => (
            <text
              key={`h-${i}`}
              x={50 + i * 40 + 15}
              y={14}
              textAnchor="middle"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {label}
            </text>
          ))}

          {/* Day rows */}
          {DAYS.map((day, di) => (
            <g key={day}>
              <text
                x={40}
                y={30 + di * 30 + 18}
                textAnchor="end"
                className="fill-muted-foreground"
                fontSize={11}
              >
                {day}
              </text>

              {HOUR_BUCKETS.map((_, bi) => {
                const count = grid[`${di}-${bi}`] || 0;
                return (
                  <rect
                    key={`${di}-${bi}`}
                    x={50 + bi * 40}
                    y={30 + di * 30}
                    width={34}
                    height={24}
                    rx={4}
                    fill={getColor(count, maxCount)}
                    className="transition-colors hover:opacity-80 cursor-pointer"
                  >
                    <title>{`${day} ${HOUR_LABELS[bi]}: ${count} session${count !== 1 ? 's' : ''}`}</title>
                  </rect>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
        <span>Less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((intensity, i) => (
          <div
            key={i}
            className="w-4 h-4 rounded"
            style={{ backgroundColor: getColor(intensity * maxCount, maxCount) }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
