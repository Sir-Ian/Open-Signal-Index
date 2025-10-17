import { Router } from 'itty-router';
import { createClient, Client } from '@libsql/client/web';

interface Env {
  BLUESKY_HANDLE: string;
  BLUESKY_APP_PASSWORD: string;
  LIBSQL_URL: string;
  LIBSQL_AUTH_TOKEN?: string;
  HARD_EXCLUDE_REGEX: string;
  TIMEZONE: string;
}

const router = Router();

function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

type PostRecord = {
  id: string;
  source: string;
  text: string;
  url: string;
  ts_utc: string;
  day_local: string;
  entities: string | null;
  topic: string | null;
  content_hash: string;
  ingested_at: string;
};

async function getClient(env: Env): Promise<Client> {
  if (!env.LIBSQL_URL) {
    throw new Error('LIBSQL_URL is not configured.');
  }

  return createClient({
    url: env.LIBSQL_URL,
    authToken: env.LIBSQL_AUTH_TOKEN,
  });
}

async function ensureSchema(client: Client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      text TEXT NOT NULL,
      url TEXT NOT NULL,
      ts_utc TEXT NOT NULL,
      day_local TEXT NOT NULL,
      entities TEXT,
      topic TEXT,
      content_hash TEXT NOT NULL,
      ingested_at TEXT NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      success INTEGER NOT NULL,
      counts_json TEXT NOT NULL
    );
  `);
}

async function digestText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type BlueskySession = {
  accessJwt: string;
};

async function createBlueskySession(env: Env): Promise<BlueskySession> {
  const res = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      identifier: env.BLUESKY_HANDLE,
      password: env.BLUESKY_APP_PASSWORD,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to create Bluesky session: ${res.status} ${detail}`);
  }

  return res.json<BlueskySession>();
}

type SearchPost = {
  uri: string;
  cid: string;
  record: {
    text: string;
    createdAt: string;
    facets?: Array<{ features?: Array<{ tag?: string }>; type: string }>;
  };
  author: {
    handle: string;
  };
};

type SearchResponse = {
  posts: SearchPost[];
};

function buildRegex(pattern: string): RegExp {
  return new RegExp(pattern);
}

function postUrl(post: SearchPost): string {
  const [_, __, did, rkey] = post.uri.split('/');
  return `https://bsky.app/profile/${post.author.handle}/post/${rkey}`;
}

function toLocalDay(isoDate: string, timeZone: string): string {
  const dt = new Date(isoDate);
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(dt);
  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '00';
  const day = parts.find((part) => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

async function fetchSearchPosts(session: BlueskySession) {
  const params = new URLSearchParams({
    limit: '50',
    sort: 'latest',
    q: 'ICE Chicago',
  });
  const res = await fetch(`https://bsky.social/xrpc/app.bsky.feed.searchPosts?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to search posts: ${res.status} ${detail}`);
  }

  return res.json<SearchResponse>();
}

async function fetchAuthorFeed(session: BlueskySession, actor: string) {
  const params = new URLSearchParams({
    limit: '30',
    actor,
  });
  const res = await fetch(`https://bsky.social/xrpc/app.bsky.feed.getAuthorFeed?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.accessJwt}`,
    },
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Failed to fetch author feed: ${res.status} ${detail}`);
  }

  const payload = await res.json<{ feed: Array<{ post: SearchPost }> }>();
  return payload.feed.map((item) => item.post);
}

async function ingestBluesky(env: Env, client: Client) {
  const session = await createBlueskySession(env);
  const regex = buildRegex(env.HARD_EXCLUDE_REGEX);
  const searchPayload = await fetchSearchPosts(session);
  const authorPosts = await fetchAuthorFeed(session, env.BLUESKY_HANDLE);
  const posts: PostRecord[] = [];

  const uniqueByUri = new Map<string, SearchPost>();
  for (const post of searchPayload.posts ?? []) {
    uniqueByUri.set(post.uri, post);
  }
  for (const post of authorPosts) {
    uniqueByUri.set(post.uri, post);
  }

  for (const post of uniqueByUri.values()) {
    if (!post.record?.text) continue;
    if (!regex.test(post.record.text)) continue;

    const hash = await digestText(post.record.text);
    const tsUtc = new Date(post.record.createdAt).toISOString();
    const dayLocal = toLocalDay(tsUtc, env.TIMEZONE);
    posts.push({
      id: post.uri,
      source: 'bluesky',
      text: post.record.text,
      url: postUrl(post),
      ts_utc: tsUtc,
      day_local: dayLocal,
      entities: post.record.facets ? JSON.stringify(post.record.facets) : null,
      topic: null,
      content_hash: hash,
      ingested_at: new Date().toISOString(),
    });
  }

  if (posts.length === 0) {
    return { inserted: 0, duplicates: 0 };
  }

  let inserted = 0;
  let duplicates = 0;

  for (const post of posts) {
    const existing = await client.execute({
      sql: 'SELECT 1 FROM posts WHERE content_hash = ? LIMIT 1',
      args: [post.content_hash],
    });

    if (existing.rows.length > 0) {
      duplicates += 1;
      continue;
    }

    await client.execute({
      sql: `INSERT INTO posts (id, source, text, url, ts_utc, day_local, entities, topic, content_hash, ingested_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      args: [
        post.id,
        post.source,
        post.text,
        post.url,
        post.ts_utc,
        post.day_local,
        post.entities,
        post.topic,
        post.content_hash,
        post.ingested_at,
      ],
    });
    inserted += 1;
  }

  return { inserted, duplicates };
}

router.get('/api/health', () => jsonResponse({ ok: true }));

router.get('/api/search', async (request, env: Env) => {
  const client = await getClient(env);
  await ensureSchema(client);
  const query = request.query?.q ? `%${request.query.q}%` : '%';
  const { rows } = await client.execute({
    sql: `SELECT id, source, text, url, ts_utc, day_local, entities, topic
          FROM posts
          WHERE text LIKE ?
          ORDER BY ts_utc DESC
          LIMIT 50`,
    args: [query],
  });
  return jsonResponse({ results: rows });
});

router.get('/api/daily', async (_req, env: Env) => {
  const client = await getClient(env);
  await ensureSchema(client);
  const { rows } = await client.execute({
    sql: `SELECT day_local as day, COUNT(*) as hits
          FROM posts
          GROUP BY day_local
          ORDER BY day_local DESC
          LIMIT 30`,
    args: [],
  });
  return jsonResponse({ days: rows });
});

router.get('/api/trends', async () => {
  const now = new Date();
  const mock = Array.from({ length: 7 }).map((_, idx) => ({
    date: new Date(now.getTime() - idx * 86400000).toISOString().slice(0, 10),
    value: Math.random() * 100,
  }));
  return jsonResponse({ timeline: mock });
});

async function handleScheduled(event: ScheduledController, env: Env, ctx: ExecutionContext) {
  const client = await getClient(env);
  await ensureSchema(client);
  const runId = crypto.randomUUID();
  const started = new Date().toISOString();
  try {
    const result = await ingestBluesky(env, client);
    const ended = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO runs (id, started_at, ended_at, success, counts_json)
            VALUES (?, ?, ?, ?, ?)` ,
      args: [runId, started, ended, 1, JSON.stringify(result)],
    });
  } catch (error) {
    const ended = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO runs (id, started_at, ended_at, success, counts_json)
            VALUES (?, ?, ?, ?, ?)` ,
      args: [runId, started, ended, 0, JSON.stringify({ error: `${error}` })],
    });
    console.error('ingest failed', error);
    throw error;
  }
}

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => router.handle(request, env, ctx),
  scheduled: handleScheduled,
};
