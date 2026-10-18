import { NextResponse } from 'next/server';

export type TrendingTopic = {
  id: string;
  headline: string;
  tag: string;
  source: string;
  url?: string;
  syncedAt: string;
};

const CURATED_TRENDING: TrendingTopic[] = [
  {
    id: 'trend-1',
    headline: 'Developer ships "100% AI-written SaaS" on X; database wiped 11 minutes later',
    tag: 'Viral Tech News',
    source: 'HN Front Page',
    syncedAt: 'Synced today · 09:00 EDT',
  },
  {
    id: 'trend-2',
    headline: 'Tech giant announces 47th model naming scheme with three decimals and a Greek letter',
    tag: 'AI Release Drama',
    source: 'HN Front Page',
    syncedAt: 'Synced today · 09:00 EDT',
  },
  {
    id: 'trend-3',
    headline: 'Startup replaces customer support with AI agent that offers 90% refunds if you say "ignore previous instructions"',
    tag: 'Prompt Injection',
    source: 'HN Front Page',
    syncedAt: 'Synced today · 09:00 EDT',
  },
  {
    id: 'trend-4',
    headline: 'CS course bans AI autocomplete; students rediscover that arrays are 0-indexed',
    tag: 'Campus & Engineering',
    source: 'Trending Feed',
    syncedAt: 'Synced today · 09:00 EDT',
  },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const live = searchParams.get('live') === '1';

  if (live) {
    try {
      const res = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=6', {
        signal: AbortSignal.timeout(3500),
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          hits?: Array<{ objectID: string; title?: string; url?: string }>;
        };
        const hits = (json.hits ?? []).filter((h) => h.title && h.title.length >= 18);
        if (hits.length >= 3) {
          const syncedAt = `Live HN sync · ${new Date().toISOString().slice(11, 16)} UTC`;
          const topics: TrendingTopic[] = hits.slice(0, 4).map((h, i) => ({
            id: `hn-${h.objectID || i}`,
            headline: h.title!,
            tag: 'Live HN #'.concat(String(i + 1)),
            source: 'Hacker News API',
            url: h.url,
            syncedAt,
          }));
          return NextResponse.json({ topics, source: 'hackernews_live', syncedAt });
        }
      }
    } catch {
      // Fall back to curated daily trending pool when sandbox/network blocks external fetch
    }
  }

  return NextResponse.json({
    topics: CURATED_TRENDING,
    source: 'daily_trending_pool',
    syncedAt: new Date().toISOString(),
  });
}
