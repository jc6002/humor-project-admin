'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

type GenerationRow = {
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
};

type Props = {
  adminUser: { id: string; email: string };
  initialData: {
    summary: {
      totalUsers: number;
      superadmins: number;
      totalBattles: number;
      totalGenerations: number;
      totalAiJokes?: number;
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
    generations: GenerationRow[];
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
  const [tab, setTab] = useState<'all' | 'media' | 'analytics' | 'users' | 'votes'>('all');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Reactive list of Arena AI jokes (public.arena_generations)
  const [generations, setGenerations] = useState<GenerationRow[]>(initialData.generations);

  useEffect(() => {
    setGenerations(initialData.generations);
  }, [initialData.generations]);

  // Create AI Media state
  const [createMode, setCreateMode] = useState<'generate_battle' | 'manual_generation'>('generate_battle');
  const [newTarget, setNewTarget] = useState('AI Agents');
  const [newAngle, setNewAngle] = useState('Coding disasters');
  const [newContext, setNewContext] = useState('Columbia CS students debugging a Next.js hydration error at 3 AM');
  const [manualSetup, setManualSetup] = useState('');
  const [manualPunchline, setManualPunchline] = useState('');
  const [manualTarget, setManualTarget] = useState('Custom Topic');
  const [manualAngle, setManualAngle] = useState('Admin curated');
  const [manualModel, setManualModel] = useState<'Gemini' | 'GPT'>('Gemini');

  // Inline row edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSetup, setEditSetup] = useState('');
  const [editPunchline, setEditPunchline] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editAngle, setEditAngle] = useState('');
  const [editStatus, setEditStatus] = useState('ready');

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [mediaSearch, setMediaSearch] = useState('');

  const { summary, models, angleBreakdown, profiles, votes } = initialData;

  function showToast(msg: string, isErr = false) {
    if (isErr) {
      setError(msg);
      setNotice('');
    } else {
      setNotice(msg);
      setError('');
    }
  }

  async function handleCreateMedia(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (createMode === 'generate_battle') {
        const res = await adminApi('POST', {
          mode: 'generate_battle',
          target: newTarget,
          angle: newAngle,
          context: newContext,
        });
        if (Array.isArray(res.generations) && res.generations.length > 0) {
          setGenerations((prev) => [...res.generations, ...prev]);
        }
        showToast('✓ Generated a fresh GPT vs. Gemini battle and saved both AI jokes to arena_generations!');
      } else {
        const res = await adminApi('POST', {
          mode: 'manual_generation',
          setup: manualSetup,
          punchline: manualPunchline,
          target: manualTarget,
          angle: manualAngle,
          modelName: manualModel,
        });
        if (Array.isArray(res.generations) && res.generations.length > 0) {
          setGenerations((prev) => [...res.generations, ...prev]);
        }
        setManualSetup('');
        setManualPunchline('');
        showToast('✓ Created new AI joke in arena_generations!');
      }
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  function startEditGen(g: GenerationRow) {
    setEditingId(g.id);
    setEditSetup(g.setup);
    setEditPunchline(g.punchline);
    setEditTarget(g.target);
    setEditAngle(g.angle);
    setEditStatus(g.status);
  }

  async function handleSaveInlineEdit() {
    if (editingId === null) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminApi('PATCH', {
        id: editingId,
        setup: editSetup,
        punchline: editPunchline,
        target: editTarget,
        angle: editAngle,
        status: editStatus,
      });
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === editingId
            ? {
                ...g,
                setup: editSetup.trim(),
                punchline: editPunchline.trim(),
                target: editTarget.trim() || g.target,
                angle: editAngle.trim() || g.angle,
                status: editStatus,
              }
            : g
        )
      );
      setEditingId(null);
      showToast('✓ Updated AI joke in arena_generations.');
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await adminApi('DELETE', { id });
      setGenerations((prev) => prev.filter((g) => g.id !== id));
      if (editingId === id) setEditingId(null);
      showToast('✓ Deleted AI joke from arena_generations.');
      router.refresh();
    } catch (err) {
      showToast((err as Error).message, true);
    } finally {
      setDeletingId(null);
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
      g.angle.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      g.model_name.toLowerCase().includes(mediaSearch.toLowerCase())
  );

  const gptWins = models.filter((m) => m.name === 'GPT').reduce((acc, m) => acc + (m.wins ?? 0), 0);
  const geminiWins = models.filter((m) => m.name === 'Gemini').reduce((acc, m) => acc + (m.wins ?? 0), 0);
  const totalModelWins = gptWins + geminiWins;
  const gptWinPct = totalModelWins > 0 ? Math.round((gptWins / totalModelWins) * 100) : 50;

  return (
    <div className="admin-shell">
      {/* FLOATING TOAST BANNER SO FEEDBACK IS ALWAYS VISIBLE AT ANY SCROLL POSITION */}
      {(notice || error) && (
        <div
          role="status"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            maxWidth: 460,
            padding: '14px 20px',
            borderRadius: 8,
            border: error ? '1px solid #a14d3a' : '1px solid var(--green)',
            background: error ? '#2d1a16' : '#1b2612',
            color: error ? '#ffd4c9' : 'var(--green)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          <span style={{ flex: 1 }}>{error || notice}</span>
          <button
            type="button"
            className="text-button"
            style={{ color: 'inherit', fontWeight: 700 }}
            onClick={() => {
              setNotice('');
              setError('');
            }}
          >
            ✕
          </button>
        </div>
      )}

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
          <strong>{generations.length}</strong>
          <small>{summary.totalBattles} arena battles in database</small>
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
          className={`admin-tab ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
        >
          All Sections (Full Overview)
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'media' ? 'active' : ''}`}
          onClick={() => setTab('media')}
        >
          1 · AI Media CRUD ({generations.length} Jokes)
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'analytics' ? 'active' : ''}`}
          onClick={() => setTab('analytics')}
        >
          2 · Creative Data Analytics
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

      {/* SECTION 1: CREATE / READ / UPDATE / DELETE AI GENERATED MEDIA */}
      {(tab === 'all' || tab === 'media') && (
        <div className="admin-section">
          {/* CREATE FORM */}
          <form className="admin-panel-box" onSubmit={handleCreateMedia}>
            <div className="custom-topic-header">
              <div>
                <p className="eyebrow">CREATE AI GENERATED MEDIA (public.arena_generations)</p>
                <h3>Generate Live GPT vs. Gemini Battle or Insert Custom Joke</h3>
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
                  Manual Joke Entry
                </button>
              </div>
            </div>

            {createMode === 'generate_battle' ? (
              <div className="admin-form-grid">
                <input
                  className="custom-topic-input"
                  placeholder="Topic (e.g., AI Agents, Vibe Coders, Custom Topic)"
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
                  {busy ? 'Generating with GPT & Gemini…' : '+ Create Live AI Battle →'}
                </button>
              </div>
            ) : (
              <div className="admin-form-grid">
                <select
                  className="custom-topic-input"
                  value={manualModel}
                  onChange={(e) => setManualModel(e.target.value as 'Gemini' | 'GPT')}
                >
                  <option value="Gemini">Model: Gemini</option>
                  <option value="GPT">Model: GPT</option>
                </select>
                <input
                  className="custom-topic-input"
                  placeholder="Topic (e.g., AI Agents, Custom Topic)"
                  value={manualTarget}
                  onChange={(e) => setManualTarget(e.target.value)}
                  required
                />
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
                <button type="submit" className="button" disabled={busy}>
                  + Insert AI Joke →
                </button>
              </div>
            )}
          </form>

          {/* UNIFIED ARENA AI GENERATIONS TABLE (READ / INLINE UPDATE / DELETE ON EVERY JOKE) */}
          <div className="admin-panel-box">
            <div className="custom-topic-header">
              <div>
                <p className="eyebrow">READ · UPDATE · DELETE AI GENERATED MEDIA (public.arena_generations)</p>
                <h3>All AI Generated Jokes ({filteredGenerations.length})</h3>
              </div>
              <input
                className="custom-topic-input"
                style={{ maxWidth: 360 }}
                placeholder="Search jokes by setup, punchline, model, or topic…"
                value={mediaSearch}
                onChange={(e) => setMediaSearch(e.target.value)}
              />
            </div>
            <div className="table-scroll">
              <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
                <thead>
                  <tr>
                    <th style={{ width: 150 }}>MODEL</th>
                    <th style={{ width: 170 }}>TOPIC / ANGLE</th>
                    <th>JOKE (SETUP &amp; PUNCHLINE)</th>
                    <th style={{ width: 110 }}>STATUS</th>
                    <th style={{ width: 190 }}>UPDATE / DELETE</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGenerations.map((g) => {
                    const isEditing = editingId === g.id;
                    const isDeleting = deletingId === g.id;
                    return (
                      <tr key={g.id} style={isEditing ? { background: '#1c2416' } : undefined}>
                        <td>
                          <strong>{g.model_name}</strong>
                          <br />
                          <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                            {g.model_version}
                          </small>
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'grid', gap: 6 }}>
                              <input
                                className="custom-topic-input"
                                style={{ minWidth: 120, padding: '6px 9px', fontSize: 12 }}
                                value={editTarget}
                                onChange={(e) => setEditTarget(e.target.value)}
                                placeholder="Topic"
                              />
                              <input
                                className="custom-topic-input"
                                style={{ minWidth: 120, padding: '6px 9px', fontSize: 12 }}
                                value={editAngle}
                                onChange={(e) => setEditAngle(e.target.value)}
                                placeholder="Angle"
                              />
                            </div>
                          ) : (
                            <>
                              <span className="target-tag">{g.target}</span>
                              <br />
                              <small style={{ color: 'var(--muted)', display: 'inline-block', marginTop: 6 }}>
                                {g.angle}
                              </small>
                            </>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'grid', gap: 8 }}>
                              <input
                                className="custom-topic-input"
                                style={{ width: '100%', padding: '8px 10px', fontSize: 13 }}
                                value={editSetup}
                                onChange={(e) => setEditSetup(e.target.value)}
                                placeholder="Joke setup"
                              />
                              <input
                                className="custom-topic-input"
                                style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontWeight: 600 }}
                                value={editPunchline}
                                onChange={(e) => setEditPunchline(e.target.value)}
                                placeholder="Joke punchline"
                              />
                            </div>
                          ) : (
                            <>
                              <p style={{ margin: '0 0 6px', color: '#cfd6c6', lineHeight: 1.5 }}>{g.setup}</p>
                              <p style={{ margin: 0, color: '#ffffff', fontWeight: 700, lineHeight: 1.5 }}>
                                {g.punchline}
                              </p>
                              {g.context && (
                                <small style={{ color: '#8f9e82', display: 'block', marginTop: 6 }}>
                                  Scenario: “{g.context}”
                                </small>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <select
                              className="custom-topic-input"
                              style={{ minWidth: 90, padding: '6px 8px', fontSize: 12 }}
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                            >
                              <option value="ready">ready</option>
                              <option value="closed">closed</option>
                              <option value="failed">failed</option>
                            </select>
                          ) : (
                            <>
                              <span className="status-pill">{g.status}</span>
                              <br />
                              <small style={{ color: 'var(--muted)', display: 'inline-block', marginTop: 6 }}>
                                {g.votes} votes
                              </small>
                            </>
                          )}
                        </td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="button button-small"
                                disabled={busy}
                                onClick={handleSaveInlineEdit}
                              >
                                💾 Save
                              </button>
                              <button
                                type="button"
                                className="topic-chip"
                                disabled={busy}
                                onClick={() => setEditingId(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="topic-chip"
                                onClick={() => startEditGen(g)}
                                disabled={busy}
                              >
                                ✏️ Edit Joke
                              </button>
                              <button
                                type="button"
                                className="topic-chip chip-danger"
                                onClick={() => handleDelete(g.id)}
                                disabled={busy}
                              >
                                {isDeleting ? 'Deleting…' : '🗑 Delete'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: CREATIVE DATA ANALYTICS */}
      {(tab === 'all' || tab === 'analytics') && (
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

      {/* SECTION 3: READ USERS / PROFILES */}
      {(tab === 'all' || tab === 'users') && (
        <div className="admin-panel-box">
          <div className="custom-topic-header">
            <div>
              <p className="eyebrow">READ USERS &amp; PROFILES (public.profiles)</p>
              <h3>Registered Accounts &amp; Superadmin Roles ({filteredProfiles.length})</h3>
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

      {/* SECTION 4: READ UPVOTES / DOWNVOTES / RATINGS */}
      {(tab === 'all' || tab === 'votes') && (
        <div className="admin-panel-box">
          <p className="eyebrow">READ UPVOTES / DOWNVOTES / RATINGS (arena_votes &amp; arena_rating_events)</p>
          <h3>Chronological Human Vote &amp; Elo Rating Ledger ({votes.length})</h3>
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
                          <span
                            className={`elo-delta ${
                              v.left_delta > 0 ? 'delta-pos' : v.left_delta < 0 ? 'delta-neg' : 'delta-neutral'
                            }`}
                          >
                            ({v.left_delta > 0 ? `+${v.left_delta}` : v.left_delta === 0 ? '±0' : v.left_delta})
                          </span>
                        )}
                        <br />
                        <small>{v.left_punchline.slice(0, 90)}…</small>
                      </td>
                      <td>
                        <strong>{v.right_model}</strong>{' '}
                        {v.right_delta !== null && (
                          <span
                            className={`elo-delta ${
                              v.right_delta > 0 ? 'delta-pos' : v.right_delta < 0 ? 'delta-neg' : 'delta-neutral'
                            }`}
                          >
                            ({v.right_delta > 0 ? `+${v.right_delta}` : v.right_delta === 0 ? '±0' : v.right_delta})
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
