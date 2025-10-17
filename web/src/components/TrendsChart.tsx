import type { FC } from 'react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type TrendsChartProps = {
  data: Array<{ date: string; value: number }>;
};

export const TrendsChart: FC<TrendsChartProps> = ({ data }) => (
  <section>
    <h2>Google Trends (Mock)</h2>
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={[...data].reverse()}>
        <XAxis dataKey="date" hide />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke="#16a34a" strokeWidth={2} dot />
      </LineChart>
    </ResponsiveContainer>
  </section>
);
