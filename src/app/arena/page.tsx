import { ArenaNav, ArenaFooter } from '@/components/arena-nav';
import { BattleClient } from '@/components/battle-client';
import { createClient } from '@/lib/supabase/server';
import { hasSupabaseEnv } from '@/lib/supabase/env';
import { generationConfigured } from '@/lib/arena/providers';
import { UUID } from '@/lib/arena/server';

export const dynamic = 'force-dynamic';

export default async function Arena({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; topic?: string }>;
}) {
  const { id, topic } = await searchParams;

  const db = hasSupabaseEnv() ? await createClient() : null;
  const user = db ? (await db.auth.getUser()).data.user : null;
  const q = user && db ? await db.rpc('arena_quota') : null;
  const b =
    user && db
      ? await db.rpc('arena_battle', { p_id: id && UUID.test(id) ? id : null, p_skip: null })
      : null;

  return (
    <div className="site-shell">
      <ArenaNav />
      <main>
        <div className="page-heading">
          <p className="eyebrow">BLIND ROAST ARENA · GPT VS GEMINI</p>
          <h1>Two models. One blind taste test.</h1>
          <p>
            Topics and model positions are randomized automatically—or pick a live trending headline or custom challenge below.
          </p>
        </div>
        <BattleClient
          signedIn={!!user}
          configured={generationConfigured()}
          initialQuota={q?.data ?? null}
          initialBattle={b?.data ?? null}
          initialTopic={topic}
          available={!user || Boolean(q && !q.error)}
        />
      </main>
      <ArenaFooter />
    </div>
  );
}
