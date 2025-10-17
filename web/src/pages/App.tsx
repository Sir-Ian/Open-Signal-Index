import { useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useApi } from '../hooks/useApi';
import { SummaryPanel } from '../components/SummaryPanel';
import { DailyChart } from '../components/DailyChart';
import { TrendsChart } from '../components/TrendsChart';
import { CalendarHeatmap } from '../components/CalendarHeatmap';

type DailyResponse = { days: Array<{ day: string; hits: number }> };
type SearchResponse = { results: Array<{ id: string; text: string; url: string; ts_utc: string }> };
type TrendsResponse = { timeline: Array<{ date: string; value: number }> };

const mockDaily: DailyResponse = {
  days: Array.from({ length: 14 }).map((_, idx) => ({
    day: dayjs().subtract(idx, 'day').format('YYYY-MM-DD'),
    hits: Math.floor(Math.random() * 10),
  })),
};

const mockSearch: SearchResponse = {
  results: Array.from({ length: 5 }).map((_, idx) => ({
    id: `mock-${idx}`,
    text: `Mock ICE update ${idx + 1}`,
    url: 'https://bsky.app/profile/example',
    ts_utc: dayjs().subtract(idx, 'hour').toISOString(),
  })),
};

const mockTrends: TrendsResponse = {
  timeline: Array.from({ length: 7 }).map((_, idx) => ({
    date: dayjs().subtract(idx, 'day').format('YYYY-MM-DD'),
    value: Math.floor(Math.random() * 100),
  })),
};

const keywordsSeed = ['ICE', 'Chicago'];

export default function App() {
  const [keywords, setKeywords] = useState(keywordsSeed.join(', '));
  const { data: daily } = useApi<DailyResponse>('/api/daily', mockDaily);
  const { data: search } = useApi<SearchResponse>('/api/search', mockSearch);
  const { data: trends } = useApi<TrendsResponse>(`/api/trends?keywords=${encodeURIComponent(keywords)}`, mockTrends);

  const keywordList = useMemo(
    () =>
      keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    [keywords],
  );

  return (
    <div className="app-shell">
      <header>
        <h1>Open Signal Index</h1>
        <form
          onSubmit={(evt) => {
            evt.preventDefault();
            const formData = new FormData(evt.currentTarget);
            const next = (formData.get('keywords') as string) ?? '';
            setKeywords(next);
          }}
        >
          <label htmlFor="keywords">Keywords</label>
          <input id="keywords" name="keywords" defaultValue={keywords} placeholder="ICE, Chicago" />
          <button type="submit">Fetch Trends</button>
        </form>
      </header>

      <main>
        <SummaryPanel summary="Awaiting summaries from ingestion pipeline." keywords={keywordList} />
        <div className="chart-grid">
          <DailyChart data={daily.days} />
          <TrendsChart data={trends.timeline} />
          <CalendarHeatmap data={daily.days} />
        </div>
        <section>
          <h2>Latest Posts</h2>
          <ul className="post-list">
            {search.results.map((post) => (
              <li key={post.id}>
                <a href={post.url} target="_blank" rel="noreferrer">
                  {post.text}
                </a>
                <time dateTime={post.ts_utc}>{dayjs(post.ts_utc).format('MMM D, HH:mm')}</time>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
