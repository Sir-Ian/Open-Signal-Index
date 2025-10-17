import type { FC } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Dot } from 'recharts';

type DailyChartProps = {
  data: Array<{ day: string; hits: number }>;
};

export const DailyChart: FC<DailyChartProps> = ({ data }) => (
  <section>
    <h2>Daily Volume</h2>
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={[...data].reverse()}>
        <XAxis dataKey="day" hide />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Line type="monotone" dataKey="hits" stroke="#2563eb" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="hits"
          stroke="transparent"
          activeDot={<Dot r={6} stroke="#f97316" fill="#f97316" />}
        />
      </LineChart>
    </ResponsiveContainer>
  </section>
);
