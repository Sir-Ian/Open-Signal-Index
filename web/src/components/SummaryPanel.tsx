import type { FC } from 'react';

type SummaryPanelProps = {
  summary: string;
  keywords: string[];
};

export const SummaryPanel: FC<SummaryPanelProps> = ({ summary, keywords }) => {
  const highlight = (text: string) => {
    if (!keywords.length) return text;
    const pattern = new RegExp(`(${keywords.join('|')})`, 'gi');
    return text.split(pattern).map((part, idx) =>
      keywords.some((kw) => kw.toLowerCase() === part.toLowerCase()) ? (
        <mark key={idx}>{part}</mark>
      ) : (
        <span key={idx}>{part}</span>
      ),
    );
  };

  return (
    <section className="summary-panel">
      <h2>Daily Summary</h2>
      <p>{highlight(summary)}</p>
    </section>
  );
};
