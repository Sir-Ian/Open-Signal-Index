# Open-Signal-Index

Prototype stack for collecting Bluesky safety chatter, layering Google Trends context, and presenting daily summaries.

## Project structure

```
api/   Cloudflare Worker for ingestion + API
jobs/  Background jobs (summaries, enrichments)
web/   Vite + React dashboard
```

## Getting started

```bash
npm install
npm install --workspace api
npm install --workspace web
npm run dev
```

- `npm run dev` launches the Vite dashboard on port `5173` and the Worker (via `wrangler dev`) on `8787`.
- Scheduled ingestion can be triggered locally by `wrangler dev --local --test-scheduled` or deployed as a cron.

## Configuration

| Variable | Description | Required |
| --- | --- | --- |
| `BLUESKY_HANDLE` | Bluesky handle for authenticated AppView access. | ✅ |
| `BLUESKY_APP_PASSWORD` | App password paired with the handle. | ✅ |
| `LIBSQL_URL` | libSQL connection string (e.g. Turso URL). | ✅ |
| `LIBSQL_AUTH_TOKEN` | libSQL auth token if required. | ⛔ |
| `LLM_PROVIDER` | Provider slug for summarization (`openai`, etc.). | ✅ |
| `LLM_API_KEY` | API key for selected LLM provider. | ⛔ |
| `TIMEZONE` | Olson timezone for bucketing daily metrics. | ✅ |
| `VERCEL_ORG_ID` | Optional when using `vercel --prod`. | ⛔ |
| `VERCEL_PROJECT_ID` | Optional when using `vercel --prod`. | ⛔ |
| `NETLIFY_AUTH_TOKEN` | Optional for `netlify deploy`. | ⛔ |

✅ = Required, ⛔ = Optional.

Update `.env` from `.env.example` before running locally. Secrets should be injected via platform tooling in production.

## API surface

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/health` | GET | Worker health check. |
| `/api/search` | GET | Returns most recent Bluesky posts (filtered + deduped). |
| `/api/daily` | GET | Daily aggregates of cached posts. |
| `/api/trends` | GET | Mock Google Trends timeline until real proxy ships. |

## Deployment

- `wrangler publish api/src/index.ts` deploys the Worker + cron schedule.
- `npm run build -w web` builds the dashboard for static hosting (Netlify/Vercel).
- `npm run deploy:all` builds the UI, publishes the Worker, and kicks off a Vercel production deploy (`vercel` CLI must be authenticated).

## Safety + ingestion notes

- Ingestion runs every 15 minutes via Cloudflare Cron Triggers.
- Bluesky results are filtered using the Chicago ICE regex defined in `Agent.md`.
- Posts are cached in libSQL with a content hash for dedupe and ingestion timestamps for auditing.
