'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  adminUser: { id: string; email: string };
  initialData: {
    summary: {
      totalUsers: number;
      superadmins: number;
      totalBattles: number;
      totalGenerations: number;
      totalAiJokes: number;
      totalVotes: number;
      decisiveRate: number;
      groanRate: number;
      tieRate: number;
      avgLatencyMs: number;
    };
    models: any[];
    angleBreakdown: {
      angle: string;
      total: number;
      gptWins: number;
      geminiWins: number;
      ties: number;
      groans: number;
    }[];
    profiles: {
      id: string;
      email: string;
      first_name: string;
      last_name: string;
      is_superadmin: boolean;
      battles_created: number;
      votes_cast: number;
      created_at: string;
    }[];
    generations: {
      id: string;
      battle_id: string;
      model_name: string;
      model_version: string;
      target: string;
      angle: string;
      context: string;
      status: string;
      votes: number;
      setup: string;
      punchline: string;
      latency_ms: number | null;
      created_at: string | null;
    }[];
    aiJokes: {
      id: number;
      setup: string;
      punchline: string;
      category: string;
      author: string;
      created_at: string;
    }[];
    votes: {
      id: string;
      created_at: string;
      voter_email: string;
      battle_id: string;
      target: string;
      angle: string;
      choice: 'left' | 'right' | 'tie' | 'bad';
      left_model: string;
      right_model: string;
      left_punchline: string;
      right_punchline: string;
      left_delta: number | null;
      right_delta: number | null;
    }[];
  };
};

async function adminApi(method: 'POST' | 'PATCH' | 'DELETE', body: unknown) {
  const res = await fetch('/api/admin/media', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Admin request failed.');
  return data;
}

export function AdminDashboard({ adminUser, initialData }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<'analytics' | 'media' | 'users' | 'votes'>('analytics');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Create AI Media state
  const [createMode, setCreateMode] = useState<'generate_battle' | 'manual_generation'>('generate_battle');
  const [newTarget, setNewTarget] = useState('Custom Topic');
  const [newAngle, setNewAngle] = useState('Admin challenge');
  const [newContext, setNewContext] = useState('Columbia CS students debugging a Next.js hydration error at 3 AM');
  const [manualSetup, setManualSetup] = useState('');
  const [manualPunchline, setManualPunchline] = useState('');
  const [manualCategory, setManualCategory] = useState('AI Roast');
  const [manualAuthor, setManualAuthor] = useState('GPT-5.6 / Gemini 3 Flash');

  // Edit state
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editingTable, setEditingTable] = useState<'arena_generations' | 'ai_jokes'>('arena_generations');
  const [editSetup, setEditSetup] = useState('');
  const [editPunchline, setEditPunchline] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editAngle, setEditAngle] = useState('');
  const [editStatus, setEditStatus] = useState('ready');

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [mediaSearch, setMediaSearch] = useState('');

  const { summary, models, angleBreakdown, profiles, generations, aiJokes, votes } = initialData;

  async function handleCreateMedia(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (createMode === 'generate_battle') {
        await adminApi('POST', {
          mode: 'generate_battle',
          target: newTarget,
          angle: newAngle,
          context: newContext,
        });
        setNotice('Generated a fresh GPT vs. Gemini battle and saved both AI jokes to the database!');
      } else {
        await adminApi('POST', {
          mode: 'manual_generation',
          setup: manualSetup,
          punchline: manualPunchline,
          category: manualCategory,
          author: manualAuthor,
        });
        setManualSetup('');
        setManualPunchline('');
        setNotice('Created new AI joke entry in the database!');
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEditGen(g: Props['initialData']['generations'][number]) {
    setEditingId(g.id);
    setEditingTable('arena_generations');
    setEditSetup(g.setup);
    setEditPunchline(g.punchline);
    setEditTarget(g.target);
    setEditAngle(g.angle);
    setEditStatus(g.status);
  }

  function startEditAiJoke(j: Props['initialData']['aiJokes'][number]) {
    setEditingId(j.id);
    setEditingTable('ai_jokes');
    setEditSetup(j.setup);
    setEditPunchline(j.punchline);
    setEditTarget(j.category);
    setEditAngle(j.author);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editingId === null) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (editingTable === 'arena_generations') {
        await adminApi('PATCH', {
          table: 'arena_generations',
          id: editingId,
          setup: editSetup,
          punchline: editPunchline,
          target: editTarget,
          angle: editAngle,
          status: editStatus,
        });
      } else {
        await adminApi('PATCH', {
          table: 'ai_jokes',
          id: editingId,
          setup: editSetup,
          punchline: editPunchline,
          category: editTarget,
          author: editAngle,
        });
      }
      setEditingId(null);
      setNotice('Updated AI-generated media record.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(table: 'arena_generations' | 'ai_jokes', id: string | number) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminApi('DELETE', { table, id });
      setNotice('Deleted record from the database.');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const filteredProfiles = profiles.filter(
    (p) =>
      p.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      p.id.toLowerCase().includes(userSearch.toLowerCase()) ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredGenerations = generations.filter(
    (g) =>
      g.setup.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      g.punchline.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      g.target.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      g.model_name.toLowerCase().includes(mediaSearch.toLowerCase())
  );

  const gptWins = models.filter((m) => m.name === 'GPT').reduce((acc, m) => acc + (m.wins ?? 0), 0);
  const geminiWins = models.filter((m) => m.name === 'Gemini').reduce((acc, m) => acc + (m.wins ?? 0), 0);
  const totalModelWins = gptWins + geminiWins;
  const gptWinPct = totalModelWins > 0 ? Math.round((gptWins / totalModelWins) * 100) : 50;

  return (
    <div className="admin-shell">
      <div className="arena-statusbar">
        <div className="status-left">
          <span className="live-dot" />
          <span>SUPERADMIN CONTROL CENTER · VERIFIED (profiles.is_superadmin == TRUE)</span>
        </div>
        <div className="status-quota">
          <span>Signed in as</span>
          <strong>{adminUser.email}</strong>
        </div>
      </div>

      {/* HERO KPI STRIP */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span className="eyebrow">USERS &amp; PROFILES</span>
          <strong>{summary.totalUsers}</strong>
          <small>{summary.superadmins} superadmin(s) active</small>
        </div>
        <div className="admin-kpi-card">
          <span className="eyebrow">AI GENERATED JOKES</span>
          <strong>{summary.totalGenerations + summary.totalAiJokes}</strong>
          <small>
            {summary.totalGenerations} arena outputs · {summary.totalAiJokes} lab jokes
          </small>
        </div>
        <div className="admin-kpi-card">
          <span className="eyebrow">VOTES &amp; RATINGS</span>
          <strong>{summary.totalVotes}</strong>
          <small>{summary.decisiveRate}% decisive · {summary.tieRate}% ties</small>
        </div>
        <div className="admin-kpi-card">
          <span className="eyebrow">CROWD GROAN RATE</span>
          <strong>{summary.groanRate}%</strong>
          <small>&ldquo;Both missed&rdquo; downvotes · {summary.avgLatencyMs}ms avg latency</small>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          className={`admin-tab ${tab === 'analytics' ? 'active' : ''}`}
          onClick={() => setTab('analytics')}
        >
          1 · Creative Data Analytics
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'media' ? 'active' : ''}`}
          onClick={() => setTab('media')}
        >
          2 · AI Media CRUD ({generations.length + aiJokes.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'users' ? 'active' : ''}`}
          onClick={() => setTab('users')}
        >
          3 · Users &amp; Profiles ({profiles.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'votes' ? 'active' : ''}`}
          onClick={() => setTab('votes')}
        >
          4 · Upvotes / Downvotes / Elo ({votes.length})
        </button>
      </div>

      {notice && <p className="success-message">{notice}</p>}
      {error && <p className="error-message">{error}</p>}

      {/* TAB 1: CREATIVE ANALYTICS */}
      {tab === 'analytics' && (
        <div className="admin-section">
          <div className="admin-panel-box">
            <p className="eyebrow">HEAD-TO-HEAD WIN SHARE (GPT VS. GEMINI)</p>
            <h3>Decisive Crowd Preference Split</h3>
            <div className="win-share-bar">
              <div className="win-share-gpt" style={{ width: `${gptWinPct}%` }}>
                GPT ({gptWins}W · {gptWinPct}%)
              </div>
              <div className="win-share-gemini" style={{ width: `${100 - gptWinPct}%` }}>
                Gemini ({geminiWins}W · {100 - gptWinPct}%)
              </div>
            </div>
          </div>

          <div className="admin-panel-box">
            <div>
              <p className="eyebrow" style={{ marginBottom: 6 }}>
                LIVE MODEL LEADERBOARD &amp; DOWNVOTE LEDGER
              </p>
              <h3>Elo Ratings, Win/Loss &amp; Groan Ledger</h3>
            </div>
            <div className="table-scroll">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>MODEL</th>
                    <th>VERSION</th>
                    <th>LIVE ELO</th>
                    <th>UPVOTES (WINS)</th>
                    <th>LOSSES</th>
                    <th>TIES</th>
                    <th>DOWNVOTES (&ldquo;BOTH MISSED&rdquo;)</th>
                    <th>BATTLES</th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong>{m.name}</strong>
                      </td>
                      <td>{m.api_model}</td>
                      <td className="elo">{Math.round(m.rating)}</td>
                      <td>{m.wins}</td>
                      <td>{m.losses}</td>
                      <td>{m.ties}</td>
                      <td>{m.bad}</td>
                      <td>{m.wins + m.losses + m.ties}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-panel-box">
            <p className="eyebrow">COMEDY ANGLE PERFORMANCE MATRIX</p>
            <h3>Which humor topics land vs. groan?</h3>
            <div className="table-scroll">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>HUMOR ANGLE</th>
                    <th>TOTAL VOTES</th>
                    <th>GPT WINS</th>
                    <th>GEMINI WINS</th>
                    <th>TIES</th>
                    <th>GROAN RATE (&ldquo;BOTH MISSED&rdquo;)</th>
                  </tr>
                </thead>
                <tbody>
                  {angleBreakdown.map((a) => (
                    <tr key={a.angle}>
                      <td>
                        <strong>{a.angle}</strong>
                      </td>
                      <td>{a.total}</td>
                      <td>{a.gptWins}</td>
                      <td>{a.geminiWins}</td>
                      <td>{a.ties}</td>
                      <td>
                        <span className="status-pill">
                          {a.total > 0 ? Math.round((a.groans / a.total) * 100) : 0}% ({a.groans})
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREATE / READ / UPDATE / DELETE AI GENERATED MEDIA */}
      {tab === 'media' && (
        <div className="admin-section">
          {/* CREATE FORM */}
          <form className="admin-panel-box" onSubmit={handleCreateMedia}>
            <div className="custom-topic-header">
              <div>
                <p className="eyebrow">CREATE AI GENERATED MEDIA</p>
                <h3>Generate Live Model Pair or Insert Curated AI Joke</h3>
              </div>
              <div className="premise-badges">
                <button
                  type="button"
                  className={`topic-chip ${createMode === 'generate_battle' ? 'chip-active' : ''}`}
                  onClick={() => setCreateMode('generate_battle')}
                >
                  Live LLM Generation (GPT + Gemini)
                </button>
                <button
                  type="button"
                  className={`topic-chip ${createMode === 'manual_generation' ? 'chip-active' : ''}`}
                  onClick={() => setCreateMode('manual_generation')}
                >
                  Direct DB Entry (ai_jokes)
                </button>
              </div>
            </div>

            {createMode === 'generate_battle' ? (
              <div className="admin-form-grid">
                <input
                  className="custom-topic-input"
                  placeholder="Target (e.g., Custom Topic, Claude, Vibe Coders)"
                  value={newTarget}
                  onChange={(e) => setNewTarget(e.target.value)}
                  required
                />
                <input
                  className="custom-topic-input"
                  placeholder="Comedy Angle (e.g., Coding disasters)"
                  value={newAngle}
                  onChange={(e) => setNewAngle(e.target.value)}
                  required
                />
                <input
                  className="custom-topic-input"
                  placeholder="Scenario / Premise for both models to roast"
                  value={newContext}
                  onChange={(e) => setNewContext(e.target.value)}
                  required
                />
                <button type="submit" className="button" disabled={busy}>
                  {busy ? 'Generating with GPT & Gemini…' : 'Create Live AI Battle →'}
                </button>
              </div>
            ) : (
              <div className="admin-form-grid">
                <input
                  className="custom-topic-input"
                  placeholder="Joke Setup (1 crisp sentence)"
                  value={manualSetup}
                  onChange={(e) => setManualSetup(e.target.value)}
                  required
                />
                <input
                  className="custom-topic-input"
                  placeholder="Joke Punchline (twist on last words)"
                  value={manualPunchline}
                  onChange={(e) => setManualPunchline(e.target.value)}
                  required
                />
                <input
                  className="custom-topic-input"
                  placeholder="Category (e.g., LLM, AI Agents)"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value)}
                  required
                />
                <button type="submit" className="button" disabled={busy}>
                  Insert AI Joke →
                </button>
              </div>
            )}
          </form>

          {/* INLINE EDIT MODAL / BOX */}
          {editingId !== null && (
            <form className="admin-panel-box edit-highlight" onSubmit={handleSaveEdit}>
              <p className="eyebrow">UPDATE AI GENERATED MEDIA ({editingTable})</p>
              <div className="admin-form-grid">
                <input
                  className="custom-topic-input"
                  value={editSetup}
                  onChange={(e) => setEditSetup(e.target.value)}
                  placeholder="Setup"
                  required
                />
                <input
                  className="custom-topic-input"
                  value={editPunchline}
                  onChange={(e) => setEditPunchline(e.target.value)}
                  placeholder="Punchline"
                  required
                />
                <input
                  className="custom-topic-input"
                  value={editTarget}
                  onChange={(e) => setEditTarget(e.target.value)}
                  placeholder={editingTable === 'arena_generations' ? 'Target' : 'Category'}
                />
                <input
                  className="custom-topic-input"
                  value={editAngle}
                  onChange={(e) => setEditAngle(e.target.value)}
                  placeholder={editingTable === 'arena_generations' ? 'Angle' : 'Author'}
                />
              </div>
              <div className="post-vote-actions" style={{ marginTop: 12 }}>
                <button type="submit" className="button" disabled={busy}>
                  Save Changes
                </button>
                <button type="button" className="button button-outline" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* SEARCH & READ / UPDATE / DELETE TABLE */}
          <div className="admin-panel-box">
            <div className="custom-topic-header">
              <h3>Arena AI Generations ({filteredGenerations.length})</h3>
              <input
                className="custom-topic-input"
                style={{ maxWidth: 340 }}
                placeholder="Search jokes by setup, punchline, model, or topic…"
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
              />
            </div>
            <div className="table-scroll">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>MODEL</th>
                    <th>TOPIC / ANGLE</th>
                    <th>SETUP &amp; PUNCHLINE</th>
                    <th>VOTES / STATUS</th>
                    <th>ACTIONS (UPDATE / DELETE)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGenerations.map((g) => (
                    <tr key={g.id}>
                      <td>
                        <strong>{g.model_name}</strong>
                        <br />
                        <small>{g.model_version}</small>
                      </td>
                      <td>
                        <span className="target-tag">{g.target}</span>
                        <br />
                        <small>{g.angle}</small>
                      </td>
                      <td>
                        <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{g.setup}</p>
                        <p style={{ margin: 0, color: '#ffffff', fontWeight: 700 }}>{g.punchline}</p>
                        {g.context && <small style={{ color: '#a5b29c' }}>Premise: {g.context}</small>}
                      </td>
                      <td>
                        <span className="status-pill">{g.status}</span>
                        <br />
                        <small>{g.votes} votes</small>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="topic-chip"
                            onClick={() => startEditGen(g)}
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="topic-chip chip-danger"
                            onClick={() => handleDelete('arena_generations', g.id)}
                            disabled={busy}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin-panel-box">
            <h3>AI Joke Lab Catalog — public.ai_jokes ({aiJokes.length})</h3>
            <div className="table-scroll">
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>CATEGORY / AUTHOR</th>
                    <th>SETUP &amp; PUNCHLINE</th>
                    <th>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {aiJokes.map((j) => (
                    <tr key={j.id}>
                      <td>#{j.id}</td>
                      <td>
                        <strong>{j.category}</strong>
                        <br />
                        <small>{j.author}</small>
                      </td>
                      <td>
                        <p style={{ margin: '0 0 6px', fontWeight: 600 }}>{j.setup}</p>
                        <p style={{ margin: 0, color: '#ffffff', fontWeight: 700 }}>{j.punchline}</p>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button type="button" className="topic-chip" onClick={() => startEditAiJoke(j)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="topic-chip chip-danger"
                            onClick={() => handleDelete('ai_jokes', j.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: READ USERS / PROFILES */}
      {tab === 'users' && (
        <div className="admin-panel-box">
          <div className="custom-topic-header">
            <div>
              <p className="eyebrow">READ USERS &amp; PROFILES (public.profiles)</p>
              <h3>Registered Accounts &amp; Superadmin Roles</h3>
            </div>
            <input
              className="custom-topic-input"
              style={{ maxWidth: 340 }}
              placeholder="Filter users by email, name, or UUID…"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
          <div className="table-scroll">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>EMAIL</th>
                  <th>NAME</th>
                  <th>ROLE (is_superadmin)</th>
                  <th>BATTLES GENERATED</th>
                  <th>VOTES CAST</th>
                  <th>JOINED</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.email}</strong>
                      <br />
                      <small>{p.id}</small>
                    </td>
                    <td>{[p.first_name, p.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td>
                      <span className={`status-pill ${p.is_superadmin ? 'pill-superadmin' : ''}`}>
                        {p.is_superadmin ? '★ SUPERADMIN (TRUE)' : 'Standard User (FALSE)'}
                      </span>
                    </td>
                    <td>{p.battles_created}</td>
                    <td>{p.votes_cast}</td>
                    <td>{new Date(p.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: READ UPVOTES / DOWNVOTES / RATINGS */}
      {tab === 'votes' && (
        <div className="admin-panel-box">
          <p className="eyebrow">READ UPVOTES / DOWNVOTES / RATINGS (arena_votes &amp; arena_rating_events)</p>
          <h3>Chronological Human Vote &amp; Elo Rating Ledger</h3>
          <div className="table-scroll">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>VOTER</th>
                  <th>TOPIC</th>
                  <th>VERDICT (UPVOTE / DOWNVOTE)</th>
                  <th>LEFT MODEL &amp; ELO DELTA</th>
                  <th>RIGHT MODEL &amp; ELO DELTA</th>
                </tr>
              </thead>
              <tbody>
                {votes.map((v) => {
                  const verdictLabel =
                    v.choice === 'left'
                      ? `👍 Upvoted ${v.left_model} (Left)`
                      : v.choice === 'right'
                        ? `👍 Upvoted ${v.right_model} (Right)`
                        : v.choice === 'tie'
                          ? '🤝 Tie (Both Funny)'
                          : '👎 Downvoted Both ("Both missed")';
                  return (
                    <tr key={v.id}>
                      <td>{new Date(v.created_at).toLocaleString()}</td>
                      <td>{v.voter_email}</td>
                      <td>
                        <strong>{v.target}</strong>
                        <br />
                        <small>{v.angle}</small>
                      </td>
                      <td>
                        <span className="status-pill">{verdictLabel}</span>
                      </td>
                      <td>
                        <strong>{v.left_model}</strong>{' '}
                        {v.left_delta !== null && (
                          <span className={`elo-delta ${v.left_delta >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                            ({v.left_delta >= 0 ? `+${v.left_delta}` : v.left_delta})
                          </span>
                        )}
                        <br />
                        <small>{v.left_punchline.slice(0, 90)}…</small>
                      </td>
                      <td>
                        <strong>{v.right_model}</strong>{' '}
                        {v.right_delta !== null && (
                          <span className={`elo-delta ${v.right_delta >= 0 ? 'delta-pos' : 'delta-neg'}`}>
                            ({v.right_delta >= 0 ? `+${v.right_delta}` : v.right_delta})
                          </span>
                        )}
                        <br />
                        <small>{v.right_punchline.slice(0, 90)}…</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
