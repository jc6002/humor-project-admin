'use client';
import { useState, useEffect } from 'react';
import { callEntityApi, type LlmModelRow, type LlmProviderRow } from './admin-types';

type Props = {
  initialProviders: LlmProviderRow[];
  initialModels: LlmModelRow[];
  onToast: (msg: string, isErr?: boolean) => void;
  onRefresh: () => void;
};

export function ModelsProvidersWorkspace({
  initialProviders,
  initialModels,
  onToast,
  onRefresh,
}: Props) {
  const [providers, setProviders] = useState<LlmProviderRow[]>(initialProviders);
  const [models, setModels] = useState<LlmModelRow[]>(initialModels);
  const [busy, setBusy] = useState(false);

  useEffect(() => setProviders(initialProviders), [initialProviders]);
  useEffect(() => setModels(initialModels), [initialModels]);

  // Provider CRUD state
  const [provSlug, setProvSlug] = useState('');
  const [provName, setProvName] = useState('');
  const [provUrl, setProvUrl] = useState('');
  const [provProtocol, setProvProtocol] = useState('openai_responses');
  const [provKeyEnv, setProvKeyEnv] = useState('OPENAI_API_KEY');
  const [editProvId, setEditProvId] = useState<string | null>(null);
  const [editProvName, setEditProvName] = useState('');
  const [editProvUrl, setEditProvUrl] = useState('');
  const [editProvProtocol, setEditProvProtocol] = useState('');
  const [editProvKeyEnv, setEditProvKeyEnv] = useState('');

  // Model CRUD state
  const [modProvider, setModProvider] = useState('openai');
  const [modName, setModName] = useState('GPT');
  const [modApiId, setModApiId] = useState('');
  const [modMaxTokens, setModMaxTokens] = useState('600');
  const [editModId, setEditModId] = useState<string | null>(null);
  const [editModProvider, setEditModProvider] = useState('');
  const [editModName, setEditModName] = useState('');
  const [editModApiId, setEditModApiId] = useState('');
  const [editModMaxTokens, setEditModMaxTokens] = useState('600');

  async function handleAddProvider(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await callEntityApi('POST', {
        entity: 'llm_providers',
        slug: provSlug,
        name: provName,
        api_base_url: provUrl,
        protocol: provProtocol,
        api_key_env: provKeyEnv,
      });
      if (res.row) setProviders((prev) => [...prev, res.row]);
      setProvSlug('');
      setProvName('');
      setProvUrl('');
      onToast(`✓ Added LLM provider "${res.row?.name ?? provName}".`);
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProvider(id: string) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'llm_providers',
        id,
        name: editProvName,
        api_base_url: editProvUrl,
        protocol: editProvProtocol,
        api_key_env: editProvKeyEnv,
      });
      if (res.row) setProviders((prev) => prev.map((p) => (p.id === id ? res.row : p)));
      setEditProvId(null);
      onToast('✓ Updated LLM provider.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleProvider(p: LlmProviderRow) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'llm_providers',
        id: p.id,
        is_enabled: !p.is_enabled,
      });
      if (res.row) setProviders((prev) => prev.map((x) => (x.id === p.id ? res.row : x)));
      onToast(`✓ ${!p.is_enabled ? 'Enabled' : 'Disabled'} provider ${p.name}.`);
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteProvider(id: string) {
    setBusy(true);
    try {
      await callEntityApi('DELETE', { entity: 'llm_providers', id });
      setProviders((prev) => prev.filter((p) => p.id !== id));
      onToast('✓ Deleted LLM provider.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddModel(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await callEntityApi('POST', {
        entity: 'llm_models',
        provider: modProvider,
        name: modName,
        api_model: modApiId,
        max_output_tokens: Number(modMaxTokens) || 600,
      });
      if (res.row) setModels((prev) => [res.row, ...prev]);
      setModApiId('');
      onToast(`✓ Registered LLM model "${modApiId}"!`);
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveModel(id: string) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'llm_models',
        id,
        provider: editModProvider,
        name: editModName,
        api_model: editModApiId,
        max_output_tokens: Number(editModMaxTokens) || 600,
      });
      if (res.row) setModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...res.row } : m)));
      setEditModId(null);
      onToast('✓ Updated LLM model configuration.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleModel(m: LlmModelRow) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'llm_models',
        id: m.id,
        is_enabled: !m.is_enabled,
      });
      if (res.row) setModels((prev) => prev.map((x) => (x.id === m.id ? { ...x, ...res.row } : x)));
      onToast(`✓ ${!m.is_enabled ? 'Enabled' : 'Paused'} model ${m.api_model}.`);
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteModel(id: string) {
    setBusy(true);
    try {
      await callEntityApi('DELETE', { entity: 'llm_models', id });
      setModels((prev) => prev.filter((m) => m.id !== id));
      onToast('✓ Deleted LLM model from database.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-section">
      {/* RUBRIC: CREATE / READ / UPDATE / DELETE LLM PROVIDERS */}
      <div className="admin-panel-box" id="section-providers">
        <div>
          <p className="eyebrow">CREATE · READ · UPDATE · DELETE LLM PROVIDERS (public.llm_providers)</p>
          <h3>Registered LLM Providers ({providers.length})</h3>
        </div>

        <form className="admin-form-grid" onSubmit={handleAddProvider}>
          <input
            className="custom-topic-input"
            placeholder="Provider slug (e.g., openai, gemini, anthropic)"
            value={provSlug}
            onChange={(e) => setProvSlug(e.target.value)}
            required
          />
          <input
            className="custom-topic-input"
            placeholder="Display Name (e.g., Anthropic)"
            value={provName}
            onChange={(e) => setProvName(e.target.value)}
            required
          />
          <input
            className="custom-topic-input"
            placeholder="API Base URL (https://…)"
            value={provUrl}
            onChange={(e) => setProvUrl(e.target.value)}
            required
          />
          <select
            className="custom-topic-input"
            value={provProtocol}
            onChange={(e) => setProvProtocol(e.target.value)}
          >
            <option value="openai_responses">openai_responses</option>
            <option value="gemini_generate_content">gemini_generate_content</option>
            <option value="openai_chat_completions">openai_chat_completions</option>
            <option value="anthropic_messages">anthropic_messages</option>
          </select>
          <input
            className="custom-topic-input"
            placeholder="API Key Env Var (e.g., ANTHROPIC_API_KEY)"
            value={provKeyEnv}
            onChange={(e) => setProvKeyEnv(e.target.value)}
            required
          />
          <button type="submit" className="button" disabled={busy}>
            + Add Provider
          </button>
        </form>

        <div className="table-scroll">
          <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
            <thead>
              <tr>
                <th style={{ width: 170 }}>PROVIDER &amp; SLUG</th>
                <th>API ENDPOINT &amp; PROTOCOL</th>
                <th style={{ width: 170 }}>KEY ENV VAR</th>
                <th style={{ width: 115 }}>STATUS</th>
                <th style={{ width: 185 }}>UPDATE / DELETE</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
                const isEditing = editProvId === p.id;
                return (
                  <tr key={p.id} style={isEditing ? { background: '#1c2416' } : undefined}>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ padding: '6px 9px', fontSize: 13 }}
                          value={editProvName}
                          onChange={(e) => setEditProvName(e.target.value)}
                        />
                      ) : (
                        <>
                          <strong>{p.name}</strong>
                          <br />
                          <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                            {p.slug}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <input
                            className="custom-topic-input"
                            style={{ width: '100%', padding: '6px 9px', fontSize: 12 }}
                            value={editProvUrl}
                            onChange={(e) => setEditProvUrl(e.target.value)}
                          />
                          <input
                            className="custom-topic-input"
                            style={{ width: '100%', padding: '6px 9px', fontSize: 12 }}
                            value={editProvProtocol}
                            onChange={(e) => setEditProvProtocol(e.target.value)}
                          />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#dce3d5' }}>
                            {p.api_base_url}
                          </div>
                          <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                            protocol: {p.protocol}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ padding: '6px 9px', fontSize: 12 }}
                          value={editProvKeyEnv}
                          onChange={(e) => setEditProvKeyEnv(e.target.value)}
                        />
                      ) : (
                        <span className="status-pill">{p.api_key_env}</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-pill ${p.is_enabled ? 'pill-superadmin' : ''}`}
                        onClick={() => handleToggleProvider(p)}
                        disabled={busy}
                      >
                        {p.is_enabled ? 'Enabled ✓' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="button button-small"
                            disabled={busy}
                            onClick={() => handleSaveProvider(p.id)}
                          >
                            💾 Save
                          </button>
                          <button type="button" className="topic-chip" onClick={() => setEditProvId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="topic-chip"
                            onClick={() => {
                              setEditProvId(p.id);
                              setEditProvName(p.name);
                              setEditProvUrl(p.api_base_url);
                              setEditProvProtocol(p.protocol);
                              setEditProvKeyEnv(p.api_key_env);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="topic-chip chip-danger"
                            disabled={busy}
                            onClick={() => handleDeleteProvider(p.id)}
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

      {/* RUBRIC: CREATE / READ / UPDATE / DELETE LLM MODELS */}
      <div className="admin-panel-box" id="section-models">
        <div>
          <p className="eyebrow">CREATE · READ · UPDATE · DELETE LLM MODELS (public.arena_models)</p>
          <h3>Competing &amp; Configured LLM Models ({models.length})</h3>
        </div>

        <form className="admin-form-grid" onSubmit={handleAddModel}>
          <select
            className="custom-topic-input"
            value={modProvider}
            onChange={(e) => {
              const p = e.target.value;
              setModProvider(p);
              if (p === 'gemini') setModName('Gemini');
              else if (p === 'openai') setModName('GPT');
            }}
          >
            {providers.length > 0 ? (
              providers.map((p) => (
                <option key={p.id} value={p.slug}>
                  Provider: {p.name} ({p.slug})
                </option>
              ))
            ) : (
              <>
                <option value="openai">Provider: OpenAI (openai)</option>
                <option value="gemini">Provider: Google Gemini (gemini)</option>
              </>
            )}
          </select>
          <input
            className="custom-topic-input"
            placeholder="Family Label (e.g., GPT or Gemini)"
            value={modName}
            onChange={(e) => setModName(e.target.value)}
            required
          />
          <input
            className="custom-topic-input"
            placeholder="API Model ID (e.g., gemini-3-flash-preview)"
            value={modApiId}
            onChange={(e) => setModApiId(e.target.value)}
            required
          />
          <input
            type="number"
            min={100}
            max={8000}
            className="custom-topic-input"
            placeholder="Max Output Tokens (e.g., 600)"
            value={modMaxTokens}
            onChange={(e) => setModMaxTokens(e.target.value)}
            required
          />
          <button type="submit" className="button" disabled={busy}>
            + Add LLM Model
          </button>
        </form>

        <div className="table-scroll">
          <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
            <thead>
              <tr>
                <th>FAMILY &amp; PROVIDER</th>
                <th>API MODEL IDENTIFIER</th>
                <th>LIVE ELO &amp; W/L/T/GROAN</th>
                <th>MAX TOKENS</th>
                <th>POOL STATUS</th>
                <th style={{ width: 185 }}>UPDATE / DELETE</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const isEditing = editModId === m.id;
                return (
                  <tr key={m.id} style={isEditing ? { background: '#1c2416' } : undefined}>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'grid', gap: 6 }}>
                          <input
                            className="custom-topic-input"
                            style={{ padding: '6px 9px', fontSize: 12 }}
                            value={editModName}
                            onChange={(e) => setEditModName(e.target.value)}
                            placeholder="Family"
                          />
                          <input
                            className="custom-topic-input"
                            style={{ padding: '6px 9px', fontSize: 12 }}
                            value={editModProvider}
                            onChange={(e) => setEditModProvider(e.target.value)}
                            placeholder="Provider slug"
                          />
                        </div>
                      ) : (
                        <>
                          <strong>{m.name}</strong>
                          <br />
                          <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                            {m.provider}
                          </small>
                        </>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ width: '100%', padding: '6px 9px', fontSize: 13 }}
                          value={editModApiId}
                          onChange={(e) => setEditModApiId(e.target.value)}
                        />
                      ) : (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{m.api_model}</span>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 18 }}>
                        {Math.round(m.rating)}
                      </strong>
                      <br />
                      <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                        {m.wins}W / {m.losses}L / {m.ties}T · {m.bad} groans
                      </small>
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          className="custom-topic-input"
                          style={{ width: 95, padding: '6px 9px', fontSize: 12 }}
                          value={editModMaxTokens}
                          onChange={(e) => setEditModMaxTokens(e.target.value)}
                        />
                      ) : (
                        <span className="record">{m.max_output_tokens ?? 600}</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-pill ${m.is_enabled !== false ? 'pill-superadmin' : ''}`}
                        onClick={() => handleToggleModel(m)}
                        disabled={busy}
                      >
                        {m.is_enabled !== false ? 'Enabled ✓' : 'Paused'}
                      </button>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="button button-small"
                            disabled={busy}
                            onClick={() => handleSaveModel(m.id)}
                          >
                            💾 Save
                          </button>
                          <button type="button" className="topic-chip" onClick={() => setEditModId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="topic-chip"
                            onClick={() => {
                              setEditModId(m.id);
                              setEditModProvider(m.provider);
                              setEditModName(m.name);
                              setEditModApiId(m.api_model);
                              setEditModMaxTokens(String(m.max_output_tokens ?? 600));
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="topic-chip chip-danger"
                            disabled={busy}
                            onClick={() => handleDeleteModel(m.id)}
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
