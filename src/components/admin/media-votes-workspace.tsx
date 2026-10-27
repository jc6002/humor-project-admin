'use client';
import { useState, useEffect, Fragment } from 'react';
import type { GenerationRow } from './admin-types';

type VoteLedgerRow = {
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
};

type Props = {
  initialGenerations: GenerationRow[];
  votes: VoteLedgerRow[];
  onToast: (msg: string, isErr?: boolean) => void;
  onRefresh: () => void;
};

async function mediaApi(method: 'POST' | 'PATCH' | 'DELETE', body: unknown) {
  const res = await fetch('/api/admin/media', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Media request failed.');
  return data;
}

export function MediaVotesWorkspace({ initialGenerations, votes, onToast, onRefresh }: Props) {
  const [generations, setGenerations] = useState<GenerationRow[]>(initialGenerations);
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [mediaSearch, setMediaSearch] = useState('');

  useEffect(() => setGenerations(initialGenerations), [initialGenerations]);

  // Create state
  const [createMode, setCreateMode] = useState<'generate_battle' | 'manual_generation'>('generate_battle');
  const [newTarget, setNewTarget] = useState('AI Agents');
  const [newAngle, setNewAngle] = useState('Coding disasters');
  const [newContext, setNewContext] = useState('Columbia CS students debugging a Next.js hydration error at 3 AM');
  const [manualSetup, setManualSetup] = useState('');
  const [manualPunchline, setManualPunchline] = useState('');
  const [manualTarget, setManualTarget] = useState('Custom Topic');
  const [manualModel, setManualModel] = useState<'Gemini' | 'GPT'>('Gemini');

  // Inline Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSetup, setEditSetup] = useState('');
  const [editPunchline, setEditPunchline] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editAngle, setEditAngle] = useState('');
  const [editStatus, setEditStatus] = useState('ready');

  async function handleCreateMedia(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (createMode === 'generate_battle') {
        const res = await mediaApi('POST', {
          mode: 'generate_battle',
          target: newTarget,
          angle: newAngle,
          context: newContext,
        });
        if (Array.isArray(res.generations)) {
          setGenerations((prev) => [...res.generations, ...prev]);
        }
        onToast('✓ Generated a fresh GPT vs. Gemini battle and logged LLM observability traces!');
      } else {
        const res = await mediaApi('POST', {
          mode: 'manual_generation',
          setup: manualSetup,
          punchline: manualPunchline,
          target: manualTarget,
          angle: 'Admin curated',
          modelName: manualModel,
        });
        if (Array.isArray(res.generations)) {
          setGenerations((prev) => [...res.generations, ...prev]);
        }
        setManualSetup('');
        setManualPunchline('');
        onToast('✓ Created new AI joke in arena_generations!');
      }
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveInlineEdit() {
    if (!editingId) return;
    setBusy(true);
    try {
      await mediaApi('PATCH', {
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
      onToast('✓ Updated AI-generated joke.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setBusy(true);
    try {
      await mediaApi('DELETE', { id });
      setGenerations((prev) => prev.filter((g) => g.id !== id));
      if (editingId === id) setEditingId(null);
      if (viewingId === id) setViewingId(null);
      onToast('✓ Deleted AI-generated joke.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setDeletingId(null);
      setBusy(false);
    }
  }

  const filteredGenerations = generations.filter(
    (g) =>
      g.setup.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      g.punchline.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      g.target.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      g.angle.toLowerCase().includes(mediaSearch.toLowerCase()) ||
      g.model_name.toLowerCase().includes(mediaSearch.toLowerCase())
  );

  return (
    <div className="admin-section">
      {/* CREATE AI MEDIA */}
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
              placeholder="Topic (e.g., AI Agents, Vibe Coders)"
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
              placeholder="Scenario / Premise"
              value={newContext}
              onChange={(e) => setNewContext(e.target.value)}
              required
            />
            <button type="submit" className="button" disabled={busy}>
              {busy ? 'Generating…' : '+ Create Live AI Battle →'}
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
              placeholder="Topic"
              value={manualTarget}
              onChange={(e) => setManualTarget(e.target.value)}
              required
            />
            <input
              className="custom-topic-input"
              placeholder="Joke Setup"
              value={manualSetup}
              onChange={(e) => setManualSetup(e.target.value)}
              required
            />
            <input
              className="custom-topic-input"
              placeholder="Joke Punchline"
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

      {/* RUBRIC: READ / VIEW AI GENERATED MEDIA */}
      <div className="admin-panel-box" id="section-media">
        <div className="custom-topic-header">
          <div>
            <p className="eyebrow">READ · VIEW · UPDATE · DELETE AI GENERATED MEDIA (public.arena_generations)</p>
            <h3>AI Generated Jokes ({filteredGenerations.length})</h3>
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
                <th style={{ width: 170 }}>TOPIC / CHAIN</th>
                <th>JOKE (SETUP &amp; PUNCHLINE)</th>
                <th style={{ width: 110 }}>STATUS</th>
                <th style={{ width: 250 }}>VIEW / UPDATE / DELETE</th>
              </tr>
            </thead>
            <tbody>
              {filteredGenerations.map((g) => {
                const isEditing = editingId === g.id;
                const isViewing = viewingId === g.id;
                const isDeleting = deletingId === g.id;
                return (
                  <Fragment key={g.id}>
                    <tr style={isEditing ? { background: '#1c2416' } : undefined}>
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
                              style={{ padding: '6px 9px', fontSize: 12 }}
                              value={editTarget}
                              onChange={(e) => setEditTarget(e.target.value)}
                            />
                            <input
                              className="custom-topic-input"
                              style={{ padding: '6px 9px', fontSize: 12 }}
                              value={editAngle}
                              onChange={(e) => setEditAngle(e.target.value)}
                            />
                          </div>
                        ) : (
                          <>
                            <span className="target-tag">{g.target}</span>
                            <br />
                            <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4 }}>
                              {g.angle}
                            </small>
                            {g.prompt_chain_name && (
                              <span className="status-pill" style={{ display: 'inline-block', marginTop: 4 }}>
                                {g.prompt_chain_name}
                              </span>
                            )}
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
                            />
                            <input
                              className="custom-topic-input"
                              style={{ width: '100%', padding: '8px 10px', fontSize: 13, fontWeight: 600 }}
                              value={editPunchline}
                              onChange={(e) => setEditPunchline(e.target.value)}
                            />
                          </div>
                        ) : (
                          <>
                            <p style={{ margin: '0 0 6px', color: '#cfd6c6', lineHeight: 1.5 }}>{g.setup}</p>
                            <p style={{ margin: 0, color: '#ffffff', fontWeight: 700, lineHeight: 1.5 }}>
                              {g.punchline}
                            </p>
                          </>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select
                            className="custom-topic-input"
                            style={{ padding: '6px 8px', fontSize: 12 }}
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
                            <button type="button" className="topic-chip" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              className={`topic-chip ${isViewing ? 'chip-active' : ''}`}
                              onClick={() => setViewingId(isViewing ? null : g.id)}
                            >
                              👁 View
                            </button>
                            <button
                              type="button"
                              className="topic-chip"
                              onClick={() => {
                                setEditingId(g.id);
                                setEditSetup(g.setup);
                                setEditPunchline(g.punchline);
                                setEditTarget(g.target);
                                setEditAngle(g.angle);
                                setEditStatus(g.status);
                              }}
                              disabled={busy}
                            >
                              ✏️ Edit
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
                    {isViewing && (
                      <tr style={{ background: '#131711' }}>
                        <td colSpan={5}>
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                              gap: 12,
                              fontSize: 12.5,
                            }}
                          >
                            <div>
                              <span className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
                                GENERATION &amp; BATTLE IDS
                              </span>
                              <div style={{ fontFamily: 'var(--font-mono)' }}>Gen: {g.id}</div>
                              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
                                Battle: {g.battle_id}
                              </div>
                            </div>
                            <div>
                              <span className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
                                PROMPT CHAIN &amp; LATENCY
                              </span>
                              <div>Chain: {g.prompt_chain_name ?? 'Late-Night Stand-Up Roast'}</div>
                              <div style={{ color: 'var(--muted)' }}>
                                Latency: {g.latency_ms ? `${g.latency_ms} ms` : '—'} · Created:{' '}
                                {g.created_at ? new Date(g.created_at).toLocaleString() : '—'}
                              </div>
                            </div>
                            <div>
                              <span className="eyebrow" style={{ marginBottom: 4, display: 'block' }}>
                                MICRO-COT &amp; PREMISE
                              </span>
                              <div>Avoided cliché: {g.cliche_to_avoid || '—'}</div>
                              <div>Planned twist: {g.comic_twist || '—'}</div>
                              {g.context && <div style={{ color: 'var(--muted)' }}>Premise: “{g.context}”</div>}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* READ VOTES & RATINGS */}
      <div className="admin-panel-box" id="section-votes">
        <p className="eyebrow">READ UPVOTES / DOWNVOTES / RATINGS (arena_votes &amp; arena_rating_events)</p>
        <h3>Chronological Human Vote &amp; Elo Rating Ledger ({votes.length})</h3>
        <div className="table-scroll">
          <table className="ranking-table">
            <thead>
              <tr>
                <th>TIME</th>
                <th>VOTER</th>
                <th>TOPIC</th>
                <th>VERDICT</th>
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
    </div>
  );
}
