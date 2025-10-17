import { useEffect, useState } from 'react';

export function useApi<T>(url: string, fallback: T) {
  const [data, setData] = useState<T>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = (await res.json()) as T;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        console.error('api error', err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Unknown error');
          setData(fallback);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [url, fallback]);

  return { data, loading, error };
}
