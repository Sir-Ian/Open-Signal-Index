import type { FC } from 'react';

const COLORS = ['#f1f5f9', '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8'];

type CalendarHeatmapProps = {
  data: Array<{ day: string; hits: number }>;
};

export const CalendarHeatmap: FC<CalendarHeatmapProps> = ({ data }) => {
  const max = Math.max(1, ...data.map((d) => d.hits));
  return (
    <section>
      <h2>Activity Heatmap</h2>
      <div className="heatmap-grid">
        {data.map((entry) => {
          const intensity = Math.min(COLORS.length - 1, Math.floor((entry.hits / max) * (COLORS.length - 1)));
          return (
            <div
              key={entry.day}
              className="heatmap-cell"
              style={{ backgroundColor: COLORS[intensity] }}
              title={`${entry.day}: ${entry.hits} posts`}
            >
              <span>{entry.day.slice(5)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
};
