'use client';
import { useState, useEffect } from 'react';
import {
  callEntityApi,
  type ComedyTermRow,
  type GenerationExampleRow,
  type PromptChainRow,
  type PromptChainStepRow,
} from './admin-types';

type Props = {
  initialChains: PromptChainRow[];
  steps: PromptChainStepRow[];
  initialTerms: ComedyTermRow[];
  initialExamples: GenerationExampleRow[];
  onToast: (msg: string, isErr?: boolean) => void;
  onRefresh: () => void;
};

export function PromptChainsWorkspace({
  initialChains,
  steps,
  initialTerms,
  initialExamples,
  onToast,
  onRefresh,
}: Props) {
  const [chains, setChains] = useState<PromptChainRow[]>(initialChains);
  const [terms, setTerms] = useState<ComedyTermRow[]>(initialTerms);
  const [examples, setExamples] = useState<GenerationExampleRow[]>(initialExamples);
  const [busy, setBusy] = useState(false);

  useEffect(() => setChains(initialChains), [initialChains]);
  useEffect(() => setTerms(initialTerms), [initialTerms]);
  useEffect(() => setExamples(initialExamples), [initialExamples]);

  // Terms create & inline edit state
  const [newTerm, setNewTerm] = useState('');
  const [newTermType, setNewTermType] = useState('banned_cliche');
  const [newTermRule, setNewTermRule] = useState('');
  const [editTermId, setEditTermId] = useState<string | null>(null);
  const [editTermText, setEditTermText] = useState('');
  const [editTermType, setEditTermType] = useState('banned_cliche');
  const [editTermRule, setEditTermRule] = useState('');

  // Examples create & inline edit state
  const [exChainId, setExChainId] = useState<string>('');
  const [exTopic, setExTopic] = useState('AI Agents');
  const [exAngle, setExAngle] = useState('Coding disasters');
  const [exPremise, setExPremise] = useState('');
  const [exSetup, setExSetup] = useState('');
  const [exPunchline, setExPunchline] = useState('');
  const [exWhy, setExWhy] = useState('');
  const [editExId, setEditExId] = useState<string | null>(null);
  const [editExTopic, setEditExTopic] = useState('');
  const [editExAngle, setEditExAngle] = useState('');
  const [editExSetup, setEditExSetup] = useState('');
  const [editExPunchline, setEditExPunchline] = useState('');
  const [editExWhy, setEditExWhy] = useState('');

  const totalMixWeight = chains
    .filter((c) => c.is_active)
    .reduce((acc, c) => acc + Math.max(0, Number(c.mix_weight) || 0), 0);

  async function handleSaveMix() {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'prompt_chain_mix',
        items: chains.map((c) => ({
          id: c.id,
          mix_weight: Number(c.mix_weight) || 0,
          is_active: c.is_active,
        })),
      });
      if (Array.isArray(res.rows)) setChains(res.rows);
      onToast('✓ Saved Prompt Chain Mix traffic allocation to database!');
      onRefresh();
    } catch (e) {
      onToast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddTerm(e: React.FormEvent) {
    e.preventDefault();
    if (!newTerm.trim()) return;
    setBusy(true);
    try {
      const res = await callEntityApi('POST', {
        entity: 'comedy_terms',
        term: newTerm,
        term_type: newTermType,
        definition_or_rule: newTermRule,
      });
      if (res.row) setTerms((prev) => [res.row, ...prev]);
      setNewTerm('');
      setNewTermRule('');
      onToast(`✓ Added term "${res.row?.term ?? newTerm}" to comedy_terms.`);
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTerm(id: string) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'comedy_terms',
        id,
        term: editTermText,
        term_type: editTermType,
        definition_or_rule: editTermRule,
      });
      if (res.row) setTerms((prev) => prev.map((t) => (t.id === id ? res.row : t)));
      setEditTermId(null);
      onToast('✓ Updated term in comedy_terms.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleTerm(t: ComedyTermRow) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'comedy_terms',
        id: t.id,
        is_active: !t.is_active,
      });
      if (res.row) setTerms((prev) => prev.map((x) => (x.id === t.id ? res.row : x)));
      onToast(`✓ Toggled term "${t.term}".`);
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteTerm(id: string) {
    setBusy(true);
    try {
      await callEntityApi('DELETE', { entity: 'comedy_terms', id });
      setTerms((prev) => prev.filter((t) => t.id !== id));
      onToast('✓ Deleted term from comedy_terms.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddExample(e: React.FormEvent) {
    e.preventDefault();
    if (!exSetup.trim() || !exPunchline.trim()) return;
    setBusy(true);
    try {
      const res = await callEntityApi('POST', {
        entity: 'ai_generation_examples',
        chain_id: exChainId || null,
        topic: exTopic,
        angle: exAngle,
        premise: exPremise,
        setup: exSetup,
        punchline: exPunchline,
        why_it_works: exWhy,
      });
      if (res.row) setExamples((prev) => [res.row, ...prev]);
      setExPremise('');
      setExSetup('');
      setExPunchline('');
      setExWhy('');
      onToast('✓ Added few-shot AI generation example!');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveExample(id: string) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'ai_generation_examples',
        id,
        topic: editExTopic,
        angle: editExAngle,
        setup: editExSetup,
        punchline: editExPunchline,
        why_it_works: editExWhy,
      });
      if (res.row) setExamples((prev) => prev.map((x) => (x.id === id ? res.row : x)));
      setEditExId(null);
      onToast('✓ Updated AI generation example.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteExample(id: string) {
    setBusy(true);
    try {
      await callEntityApi('DELETE', { entity: 'ai_generation_examples', id });
      setExamples((prev) => prev.filter((x) => x.id !== id));
      onToast('✓ Deleted AI generation example.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      {/* RUBRIC: READ / UPDATE PROMPT CHAIN MIX */}
      <div className="admin-panel-box" id="section-chain-mix">
        <div className="custom-topic-header">
          <div>
            <p className="eyebrow">READ / UPDATE PROMPT CHAIN MIX (public.prompt_chains.mix_weight)</p>
            <h3>Live Prompt Chain Traffic Mix</h3>
          </div>
          <div className="premise-badges">
            <button
              type="button"
              className="topic-chip"
              onClick={() =>
                setChains((prev) =>
                  prev.map((c) => ({ ...c, is_active: true, mix_weight: Math.round(100 / Math.max(1, prev.length)) }))
                )
              }
            >
              Equalize Weights
            </button>
            <button type="button" className="button button-small" disabled={busy || !chains.length} onClick={handleSaveMix}>
              💾 Save Prompt Chain Mix
            </button>
          </div>
        </div>

        {chains.length > 0 && (
          <div className="win-share-bar" style={{ height: 34 }}>
            {chains
              .filter((c) => c.is_active && c.mix_weight > 0)
              .map((c, idx) => {
                const pct = totalMixWeight > 0 ? Math.round((c.mix_weight / totalMixWeight) * 100) : 0;
                const colors = ['#243b30', '#2b3154', '#3d351e', '#3a2338'];
                return (
                  <div
                    key={c.id}
                    style={{
                      width: `${Math.max(10, pct)}%`,
                      background: colors[idx % colors.length],
                      color: '#eef5e4',
                      borderRight: '2px solid #101210',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 8px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {c.name} ({pct}%)
                  </div>
                );
              })}
          </div>
        )}

        <div style={{ display: 'grid', gap: 10 }}>
          {chains.map((c) => {
            const pct =
              c.is_active && totalMixWeight > 0 ? Math.round((c.mix_weight / totalMixWeight) * 100) : 0;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  flexWrap: 'wrap',
                  padding: '12px 16px',
                  border: '1px solid var(--line)',
                  borderRadius: 8,
                  background: '#141812',
                }}
              >
                <div style={{ minWidth: 230, flex: 1 }}>
                  <strong>{c.name}</strong>{' '}
                  <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>({c.slug})</small>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={c.is_active}
                    onChange={(e) =>
                      setChains((prev) =>
                        prev.map((x) => (x.id === c.id ? { ...x, is_active: e.target.checked } : x))
                      )
                    }
                  />
                  Active
                </label>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={c.mix_weight}
                  disabled={!c.is_active}
                  onChange={(e) =>
                    setChains((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, mix_weight: Number(e.target.value) } : x))
                    )
                  }
                  style={{ width: 160, accentColor: '#cbfb6d' }}
                />
                <input
                  type="number"
                  min={0}
                  max={1000}
                  className="custom-topic-input"
                  style={{ width: 82, minWidth: 82, padding: '6px 10px', textAlign: 'right' }}
                  value={c.mix_weight}
                  onChange={(e) =>
                    setChains((prev) =>
                      prev.map((x) => (x.id === c.id ? { ...x, mix_weight: Number(e.target.value) } : x))
                    )
                  }
                />
                <span className="status-pill pill-superadmin" style={{ minWidth: 68, textAlign: 'center' }}>
                  {pct}% share
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* RUBRIC: READ PROMPT CHAINS & READ PROMPT CHAIN STEPS */}
      <div className="admin-panel-box" id="section-prompt-chains">
        <div>
          <p className="eyebrow">
            READ PROMPT CHAINS &amp; READ PROMPT CHAIN STEPS (public.prompt_chains + public.prompt_chain_steps)
          </p>
          <h3>Prompt Chains ({chains.length}) &amp; Multi-Step Execution Pipelines ({steps.length} Steps)</h3>
        </div>
        <div id="section-chain-steps" style={{ display: 'grid', gap: 16 }}>
          {chains.map((c) => {
            const chainSteps = steps.filter((s) => s.chain_id === c.id);
            return (
              <div
                key={c.id}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: 9,
                  padding: 18,
                  background: '#151912',
                  display: 'grid',
                  gap: 12,
                }}
              >
                <div className="custom-topic-header">
                  <div>
                    <strong>{c.name}</strong>{' '}
                    <span className="status-pill" style={{ marginLeft: 8 }}>
                      {c.slug}
                    </span>
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--muted)' }}>{c.description}</p>
                  </div>
                  <span className={`status-pill ${c.is_active ? 'pill-superadmin' : ''}`}>
                    {c.is_active ? `Active · Weight ${c.mix_weight}` : 'Paused'}
                  </span>
                </div>
                <div style={{ fontSize: 12.5, color: '#b7c4a8', fontFamily: 'var(--font-mono)' }}>
                  Persona: “{c.persona_style}”
                </div>
                <div className="table-scroll">
                  <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>STEP #</th>
                        <th style={{ width: 210 }}>STEP NAME &amp; ROLE</th>
                        <th>INSTRUCTION TEMPLATE</th>
                        <th style={{ width: 150 }}>OUTPUT FIELD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chainSteps.map((s) => (
                        <tr key={s.id}>
                          <td className="rank-number">0{s.step_order}</td>
                          <td>
                            <strong>{s.step_name}</strong>
                            <br />
                            <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                              {s.step_role}
                            </small>
                          </td>
                          <td style={{ fontSize: 13, color: '#dce3d5' }}>{s.instruction_template}</td>
                          <td>
                            <span className="status-pill">{s.output_field || 'context'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RUBRIC: CREATE / READ / UPDATE / DELETE TERMS */}
      <div className="admin-panel-box" id="section-terms">
        <div>
          <p className="eyebrow">CREATE · READ · UPDATE · DELETE TERMS (public.comedy_terms)</p>
          <h3>Comedy Terms, Banned Clichés &amp; Glossary ({terms.length})</h3>
        </div>

        <form className="admin-form-grid" onSubmit={handleAddTerm}>
          <input
            className="custom-topic-input"
            placeholder="Term or phrase (e.g., 'context window' or 'synergy')"
            value={newTerm}
            onChange={(e) => setNewTerm(e.target.value)}
            required
          />
          <select
            className="custom-topic-input"
            value={newTermType}
            onChange={(e) => setNewTermType(e.target.value)}
          >
            <option value="banned_cliche">banned_cliche (Strictly Forbidden)</option>
            <option value="tech_glossary">tech_glossary (Tech Slang)</option>
            <option value="campus_slang">campus_slang (Campus Reference)</option>
            <option value="punchline_device">punchline_device (Craft Rule)</option>
          </select>
          <input
            className="custom-topic-input"
            placeholder="Definition or prompt rule…"
            value={newTermRule}
            onChange={(e) => setNewTermRule(e.target.value)}
            required
          />
          <button type="submit" className="button" disabled={busy}>
            + Add Term
          </button>
        </form>

        <div className="table-scroll">
          <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
            <thead>
              <tr>
                <th style={{ width: 200 }}>TERM</th>
                <th style={{ width: 170 }}>TYPE</th>
                <th>DEFINITION / PROMPT RULE</th>
                <th style={{ width: 110 }}>STATUS</th>
                <th style={{ width: 185 }}>UPDATE / DELETE</th>
              </tr>
            </thead>
            <tbody>
              {terms.map((t) => {
                const isEditing = editTermId === t.id;
                return (
                  <tr key={t.id} style={isEditing ? { background: '#1c2416' } : undefined}>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ padding: '6px 10px', fontSize: 13 }}
                          value={editTermText}
                          onChange={(e) => setEditTermText(e.target.value)}
                        />
                      ) : (
                        <strong>{t.term}</strong>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="custom-topic-input"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                          value={editTermType}
                          onChange={(e) => setEditTermType(e.target.value)}
                        >
                          <option value="banned_cliche">banned_cliche</option>
                          <option value="tech_glossary">tech_glossary</option>
                          <option value="campus_slang">campus_slang</option>
                          <option value="punchline_device">punchline_device</option>
                        </select>
                      ) : (
                        <span
                          className={`status-pill ${t.term_type === 'banned_cliche' ? 'chip-danger' : ''}`}
                        >
                          {t.term_type}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ width: '100%', padding: '6px 10px', fontSize: 13 }}
                          value={editTermRule}
                          onChange={(e) => setEditTermRule(e.target.value)}
                        />
                      ) : (
                        <span style={{ color: '#cfd6c6', fontSize: 13 }}>{t.definition_or_rule}</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-pill ${t.is_active ? 'pill-superadmin' : ''}`}
                        onClick={() => handleToggleTerm(t)}
                        disabled={busy}
                      >
                        {t.is_active ? 'Active ✓' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="button button-small"
                            disabled={busy}
                            onClick={() => handleSaveTerm(t.id)}
                          >
                            💾 Save
                          </button>
                          <button
                            type="button"
                            className="topic-chip"
                            onClick={() => setEditTermId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="topic-chip"
                            onClick={() => {
                              setEditTermId(t.id);
                              setEditTermText(t.term);
                              setEditTermType(t.term_type);
                              setEditTermRule(t.definition_or_rule);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="topic-chip chip-danger"
                            disabled={busy}
                            onClick={() => handleDeleteTerm(t.id)}
                          >
                            🗑 Delete
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

      {/* RUBRIC: CREATE / READ / UPDATE / DELETE AI GENERATION EXAMPLES */}
      <div className="admin-panel-box" id="section-examples">
        <div>
          <p className="eyebrow">
            CREATE · READ · UPDATE · DELETE AI GENERATION EXAMPLES (public.ai_generation_examples)
          </p>
          <h3>Few-Shot AI Generation Examples ({examples.length})</h3>
        </div>

        <form style={{ display: 'grid', gap: 10 }} onSubmit={handleAddExample}>
          <div className="admin-form-grid">
            <select
              className="custom-topic-input"
              value={exChainId}
              onChange={(e) => setExChainId(e.target.value)}
            >
              <option value="">Any Prompt Chain (Global)</option>
              {chains.map((c) => (
                <option key={c.id} value={c.id}>
                  Chain: {c.name}
                </option>
              ))}
            </select>
            <input
              className="custom-topic-input"
              placeholder="Topic (e.g., AI Agents)"
              value={exTopic}
              onChange={(e) => setExTopic(e.target.value)}
              required
            />
            <input
              className="custom-topic-input"
              placeholder="Angle (e.g., Coding disasters)"
              value={exAngle}
              onChange={(e) => setExAngle(e.target.value)}
              required
            />
            <input
              className="custom-topic-input"
              placeholder="Premise / Scenario"
              value={exPremise}
              onChange={(e) => setExPremise(e.target.value)}
            />
          </div>
          <div className="admin-form-grid">
            <input
              className="custom-topic-input"
              placeholder="Gold Example Setup (1 crisp sentence)"
              value={exSetup}
              onChange={(e) => setExSetup(e.target.value)}
              required
            />
            <input
              className="custom-topic-input"
              placeholder="Gold Example Punchline (final-word twist)"
              value={exPunchline}
              onChange={(e) => setExPunchline(e.target.value)}
              required
            />
            <input
              className="custom-topic-input"
              placeholder="Why it works (craft note)"
              value={exWhy}
              onChange={(e) => setExWhy(e.target.value)}
            />
            <button type="submit" className="button" disabled={busy}>
              + Add Example
            </button>
          </div>
        </form>

        <div className="table-scroll">
          <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
            <thead>
              <tr>
                <th style={{ width: 175 }}>TOPIC / ANGLE</th>
                <th>EXAMPLE SETUP &amp; PUNCHLINE</th>
                <th style={{ width: 220 }}>CRAFT NOTE</th>
                <th style={{ width: 185 }}>UPDATE / DELETE</th>
              </tr>
            </thead>
            <tbody>
              {examples.map((ex) => {
                const isEditing = editExId === ex.id;
                const chainName = chains.find((c) => c.id === ex.chain_id)?.name;
                return (
                  <tr key={ex.id} style={isEditing ? { background: '#1c2416' } : undefined}>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <input
                            className="custom-topic-input"
                            style={{ padding: '6px 9px', fontSize: 12 }}
                            value={editExTopic}
                            onChange={(e) => setEditExTopic(e.target.value)}
                          />
                          <input
                            className="custom-topic-input"
                            style={{ padding: '6px 9px', fontSize: 12 }}
                            value={editExAngle}
                            onChange={(e) => setEditExAngle(e.target.value)}
                          />
                        </div>
                      ) : (
                        <>
                          <span className="target-tag">{ex.topic}</span>
                          <br />
                          <small style={{ color: 'var(--muted)', display: 'block', marginTop: 5 }}>
                            {ex.angle}
                          </small>
                          {chainName && (
                            <span className="status-pill" style={{ display: 'inline-block', marginTop: 5 }}>
                              {chainName}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <input
                            className="custom-topic-input"
                            style={{ width: '100%', padding: '7px 10px', fontSize: 13 }}
                            value={editExSetup}
                            onChange={(e) => setEditExSetup(e.target.value)}
                          />
                          <input
                            className="custom-topic-input"
                            style={{ width: '100%', padding: '7px 10px', fontSize: 13, fontWeight: 600 }}
                            value={editExPunchline}
                            onChange={(e) => setEditExPunchline(e.target.value)}
                          />
                        </div>
                      ) : (
                        <>
                          <p style={{ margin: '0 0 5px', color: '#cfd6c6' }}>{ex.setup}</p>
                          <p style={{ margin: 0, color: '#fff', fontWeight: 700 }}>{ex.punchline}</p>
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ width: '100%', padding: '7px 10px', fontSize: 12 }}
                          value={editExWhy}
                          onChange={(e) => setEditExWhy(e.target.value)}
                        />
                      ) : (
                        <small style={{ color: '#9ab082' }}>{ex.why_it_works || '—'}</small>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="button button-small"
                            disabled={busy}
                            onClick={() => handleSaveExample(ex.id)}
                          >
                            💾 Save
                          </button>
                          <button type="button" className="topic-chip" onClick={() => setEditExId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="topic-chip"
                            onClick={() => {
                              setEditExId(ex.id);
                              setEditExTopic(ex.topic);
                              setEditExAngle(ex.angle);
                              setEditExSetup(ex.setup);
                              setEditExPunchline(ex.punchline);
                              setEditExWhy(ex.why_it_works);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="topic-chip chip-danger"
                            disabled={busy}
                            onClick={() => handleDeleteExample(ex.id)}
                          >
                            🗑 Delete
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
  );
}
