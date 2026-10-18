'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { Battle, Quota } from '@/lib/arena/types';

type TrendingTopic = {
  id: string;
  headline: string;
  tag: string;
  source: string;
  syncedAt: string;
};

const DEFAULT_TRENDING: TrendingTopic[] = [
  {
    id: 'trend-1',
    headline: 'Developer ships "100% AI-written SaaS" on X; database wiped 11 minutes later',
    tag: 'Viral Tech',
    source: 'HN Front Page',
    syncedAt: 'Synced today',
  },
  {
    id: 'trend-2',
    headline: 'Tech giant announces 47th model naming scheme with three decimals and a Greek letter',
    tag: 'AI Naming',
    source: 'HN Front Page',
    syncedAt: 'Synced today',
  },
  {
    id: 'trend-3',
    headline: 'Startup replaces support with AI agent that gives 90% refunds on "ignore previous instructions"',
    tag: 'Prompt Injection',
    source: 'HN Front Page',
    syncedAt: 'Synced today',
  },
  {
    id: 'trend-4',
    headline: 'CS course bans AI autocomplete; students rediscover that arrays are 0-indexed',
    tag: 'Campus Tech',
    source: 'Trending Feed',
    syncedAt: 'Synced today',
  },
];

type Props = {
  signedIn: boolean;
  configured: boolean;
  initialQuota: Quota | null;
  initialBattle: Battle | null;
  initialTopic?: string;
  available: boolean;
};

async function api(path: string, body?: unknown) {
  const response = await fetch(
    path,
    body
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { cache: 'no-store' }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? 'Please try again.');
  return data;
}

export function BattleClient({
  signedIn,
  configured,
  initialQuota,
  initialBattle,
  initialTopic,
  available,
}: Props) {
  const [battle, setBattle] = useState<Battle | null>(initialBattle);
  const [quota, setQuota] = useState<Quota | null>(initialQuota);
  const [busy, setBusy] = useState(false);
  const [syncingTrends, setSyncingTrends] = useState(false);
  const [trending, setTrending] = useState<TrendingTopic[]>(DEFAULT_TRENDING);
  const [trendSourceLabel, setTrendSourceLabel] = useState('Daily Scheduled Sync · HN & Tech Headlines');
  const [error, setError] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [skippedIds, setSkippedIds] = useState<string[]>([]);
  const autoStarted = useRef(false);
  const topicTriggered = useRef(false);

  useEffect(() => {
    setBattle(initialBattle);
  }, [initialBattle]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (signedIn && available) {
        api('/api/arena/quota')
          .then((data) => setQuota(data.quota))
          .catch(() => {});
      }
    }, 15000);
    return () => clearInterval(timer);
  }, [signedIn, available]);

  const nextBattle = useCallback(
    async (opts?: {
      skipCurrent?: boolean;
      forceNew?: boolean;
      customTopic?: string;
      isTrending?: boolean;
    }) => {
      if (!signedIn || !available) return;
      setBusy(true);
      setError('');
      const nextSkips =
        opts?.skipCurrent && battle?.id ? Array.from(new Set([...skippedIds, battle.id])) : skippedIds;
      if (opts?.skipCurrent && battle?.id) {
        setSkippedIds(nextSkips);
      }
      const requestId = crypto.randomUUID();
      try {
        const data = await api('/api/arena/generate', {
          requestId,
          skipIds: nextSkips,
          forceNew: Boolean(opts?.forceNew),
          customTopic: opts?.customTopic?.trim() || undefined,
          isTrending: Boolean(opts?.isTrending),
        });
        setBattle(data.battle);
        if (data.quota) setQuota(data.quota);
        if (opts?.customTopic && !opts?.isTrending) setCustomTopic('');
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [signedIn, available, battle, skippedIds]
  );

  useEffect(() => {
    if (signedIn && available && initialTopic && !topicTriggered.current) {
      topicTriggered.current = true;
      nextBattle({ skipCurrent: true, forceNew: true, customTopic: initialTopic, isTrending: true });
      return;
    }
    if (signedIn && available && !initialBattle && !autoStarted.current) {
      autoStarted.current = true;
      nextBattle();
    }
  }, [signedIn, available, initialBattle, initialTopic, nextBattle]);

  async function vote(choice: 'left' | 'right' | 'tie' | 'bad') {
    if (!battle) return;
    setBusy(true);
    setError('');
    try {
      const data = await api('/api/arena/vote', { id: battle.id, choice });
      setBattle(data.battle);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customTopic.trim() || busy) return;
    nextBattle({ skipCurrent: true, forceNew: true, customTopic: customTopic.trim() });
  }

  async function syncLiveHeadlines() {
    setSyncingTrends(true);
    try {
      const res = await fetch('/api/arena/trending?live=1', { cache: 'no-store' });
      const data = await res.json();
      if (Array.isArray(data.topics) && data.topics.length > 0) {
        setTrending(data.topics);
        setTrendSourceLabel(
          data.source === 'hackernews_live'
            ? `Synced live from Hacker News API (${data.syncedAt})`
            : 'Synced from Daily Trending Tech Pool'
        );
      }
    } catch {
      // keep existing topics
    } finally {
      setSyncingTrends(false);
    }
  }

  const ready = battle?.status === 'ready' && battle.left && battle.right;

  return (
    <div className="arena-stage">
      {signedIn && (
        <div className="challenge-panel">
          <form className="custom-topic-bar" onSubmit={handleCustomSubmit}>
            <span className="custom-topic-label">CUSTOM CHALLENGE</span>
            <input
              type="text"
              className="custom-topic-input"
              placeholder="Optional: type your own comedy prompt for GPT & Gemini (e.g., 'Columbia finals week at 4 AM')…"
              maxLength={240}
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              disabled={busy}
            />
            {quota && (
              <span className="meta-label" title="Hourly custom generation quota">
                {quota.remaining}/5 left
              </span>
            )}
            <button
              type="submit"
              className="button button-small"
              disabled={busy || !customTopic.trim() || !configured || (quota !== null && quota.remaining <= 0)}
            >
              Generate roast ↗
            </button>
          </form>

          <div className="trending-bar" aria-label="Trending Headlines Pool">
            <div className="trending-bar-header">
              <span className="custom-topic-label">
                <span className="live-dot" /> TRENDING TODAY · 1-CLICK HEADLINE ROAST
              </span>
              <div className="premise-badges">
                <span className="meta-label">{trendSourceLabel}</span>
                <button
                  type="button"
                  className="topic-chip"
                  disabled={syncingTrends || busy}
                  onClick={syncLiveHeadlines}
                >
                  {syncingTrends ? 'Syncing HN…' : '↻ Sync live headlines'}
                </button>
              </div>
            </div>
            <div className="trending-chips">
              {trending.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="trending-chip"
                  disabled={busy}
                  onClick={() =>
                    nextBattle({
                      skipCurrent: true,
                      forceNew: true,
                      customTopic: t.headline,
                      isTrending: true,
                    })
                  }
                >
                  <span className="trending-chip-tag">{t.tag}</span>
                  <span className="trending-chip-text">{t.headline}</span>
                  <span className="trending-chip-arrow">Roast ↗</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}

      {busy && (!ready || battle?.choice) ? (
        <div className="battle-empty" role="status">
          <span className="spinner" />
          <h2>Setting up the next blind roast…</h2>
          <p>
            {customTopic
              ? `GPT and Gemini are both writing a joke on "${customTopic}"…`
              : 'Loading the next anonymous GPT vs. Gemini matchup.'}
          </p>
        </div>
      ) : ready ? (
        <>
          <div className="battle-heading">
            <span className="target-tag">{battle.angle || 'Tech comedy'}</span>
            {battle.context && <span className="scenario-text">“{battle.context}”</span>}
            {battle.source && (
              <span className="status-pill" style={{ marginLeft: 'auto' }}>
                {battle.angle === 'Trending news roast'
                  ? 'Trending headline'
                  : battle.source === 'custom'
                    ? 'Custom topic'
                    : battle.source === 'fresh'
                      ? 'Freshly generated'
                      : 'Community pool'}
              </span>
            )}
          </div>

          <div className="battle-pair">
            {(['left', 'right'] as const).map((side, i) => {
              const joke = battle[side]!;
              const revealed = Boolean(battle.choice);
              const isWinner = battle.choice === side;
              const deltaNum = typeof joke.delta === 'number' ? Math.round(joke.delta) : null;
              const deltaText =
                deltaNum !== null
                  ? deltaNum > 0
                    ? `+${deltaNum}`
                    : deltaNum < 0
                      ? `${deltaNum}`
                      : '±0'
                  : null;
              const deltaClass =
                deltaNum === null || deltaNum === 0
                  ? 'delta-neutral'
                  : deltaNum > 0
                    ? 'delta-pos'
                    : 'delta-neg';

              return (
                <article key={side} className={`battle-card ${isWinner ? 'card-winner' : ''}`}>
                  <div className="roast-card-top">
                    <span className="model-label">
                      {revealed ? `${joke.model} (${i === 0 ? 'A' : 'B'})` : `COMEDIAN ${i === 0 ? 'A' : 'B'}`}
                    </span>
                    {revealed && isWinner && <span className="status-pill pill-superadmin">Winner ★</span>}
                    {revealed && !isWinner && battle.choice === 'tie' && (
                      <span className="status-pill">Tie</span>
                    )}
                    {revealed && !isWinner && battle.choice === 'bad' && (
                      <span className="status-pill">Missed</span>
                    )}
                  </div>
                  <p className="joke-setup">{joke.setup}</p>
                  <p className="joke-punchline">{joke.punchline}</p>
                  {revealed ? (
                    <div className="reveal">
                      <div>
                        <strong>{joke.model}</strong> · {Math.round(joke.rating ?? 1000)} Elo
                        {deltaText && (
                          <span className={`elo-delta ${deltaClass}`}> ({deltaText})</span>
                        )}
                      </div>
                      <small>{joke.version}</small>
                    </div>
                  ) : (
                    <button className="button" disabled={busy} onClick={() => vote(side)}>
                      {i === 0 ? 'A' : 'B'} is funnier
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          {battle.choice ? (
            <div className="post-vote-bar">
              <p className="success-message" role="status">
                {battle.choice === 'left'
                  ? `Vote recorded — Comedian A (${battle.left?.model}) won! Elo ratings updated.`
                  : battle.choice === 'right'
                    ? `Vote recorded — Comedian B (${battle.right?.model}) won! Elo ratings updated.`
                    : battle.choice === 'tie'
                      ? 'Vote recorded (Tie). Elo ratings updated!'
                      : 'Vote recorded (Both missed — no Elo points awarded).'}
              </p>
              <div className="post-vote-actions">
                <button className="button" disabled={busy} onClick={() => nextBattle({ skipCurrent: true })}>
                  Next battle →
                </button>
              </div>
            </div>
          ) : (
            <div className="secondary-votes">
              <button disabled={busy} onClick={() => vote('tie')}>
                It’s a tie
              </button>
              <button disabled={busy} onClick={() => vote('bad')}>
                Both missed
              </button>
              <button disabled={busy} onClick={() => nextBattle({ skipCurrent: true })}>
                Skip →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="battle-empty">
          <span className="versus">A / B</span>
          <h2>{!signedIn ? 'Good taste deserves a vote.' : 'Ready for the next matchup?'}</h2>
          <p>
            {!signedIn
              ? 'Sign in with Google to judge blind AI roasts and automatically trigger new GPT vs Gemini matchups.'
              : 'Click below to get a blind matchup between GPT and Gemini.'}
          </p>
          {!signedIn ? (
            <Link className="button" href="/auth/signin">
              Sign in with Google ↗
            </Link>
          ) : (
            <button className="button" onClick={() => nextBattle()} disabled={busy || !available}>
              Start battle →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
