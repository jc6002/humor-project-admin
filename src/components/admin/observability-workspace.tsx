'use client';
import { useState, Fragment } from 'react';
import type { GenerationRequestRow, LlmModelRow, LlmResponseRow } from './admin-types';

type Props = {
  models: LlmModelRow[];
  angleBreakdown: {
    angle: string;
    total: number;
    gptWins: number;
    geminiWins: number;
    ties: number;
    groans: number;
  }[];
  generationRequests: GenerationRequestRow[];
  llmResponses: LlmResponseRow[];
};

export function ObservabilityWorkspace({
  models,
  angleBreakdown,
  generationRequests,
  llmResponses,
}: Props) {
  const [reqSearch, setReqSearch] = useState('');
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);
  const [respSearch, setRespSearch] = useState('');
  const [respProviderFilter, setRespProviderFilter] = useState<string>('ALL');
  const [expandedRespId, setExpandedRespId] = useState<string | null>(null);

  const gptWins = models.filter((m) => m.name === 'GPT').reduce((acc, m) => acc + (m.wins ?? 0), 0);
  const geminiWins = models.filter((m) => m.name === 'Gemini').reduce((acc, m) => acc + (m.wins ?? 0), 0);
  const totalModelWins = gptWins + geminiWins;
  const gptWinPct = totalModelWins > 0 ? Math.round((gptWins / totalModelWins) * 100) : 50;

  const filteredRequests = generationRequests.filter(
    (r) =>
      r.requester_email.toLowerCase().includes(reqSearch.toLowerCase()) ||
      r.target.toLowerCase().includes(reqSearch.toLowerCase()) ||
      r.angle.toLowerCase().includes(reqSearch.toLowerCase()) ||
      r.context.toLowerCase().includes(reqSearch.toLowerCase()) ||
      r.prompt_chain_name.toLowerCase().includes(reqSearch.toLowerCase()) ||
      String(r.request_id ?? '').toLowerCase().includes(reqSearch.toLowerCase())
  );

  const filteredResponses = llmResponses.filter((r) => {
    if (respProviderFilter !== 'ALL' && r.provider.toLowerCase() !== respProviderFilter.toLowerCase()) {
      return false;
    }
    const q = respSearch.toLowerCase();
    if (!q) return true;
    return (
      r.model.toLowerCase().includes(q) ||
      r.provider.toLowerCase().includes(q) ||
      (r.parsed_setup ?? '').toLowerCase().includes(q) ||
      (r.parsed_punchline ?? '').toLowerCase().includes(q) ||
      (r.prompt_chain_name ?? '').toLowerCase().includes(q) ||
      (r.parsed_cliche_to_avoid ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="admin-section">
      {/* HEAD-TO-HEAD & ANGLE ANALYTICS */}
      <div className="analytics-strip">
        <div className="admin-panel-box">
          <div>
            <p className="eyebrow" style={{ marginBottom: 6 }}>
              HEAD-TO-HEAD WIN SHARE (GPT VS. GEMINI)
            </p>
            <h3>Decisive Crowd Preference Split</h3>
          </div>
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
              COMEDY ANGLE PERFORMANCE
            </p>
            <h3>Top Humor Scenarios ({angleBreakdown.length})</h3>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {angleBreakdown.slice(0, 6).map((a) => (
              <span className="status-pill" key={a.angle}>
                {a.angle}: {a.total}v (GPT {a.gptWins} / Gem {a.geminiWins})
              </span>
            ))}
            {angleBreakdown.length === 0 && <span className="meta-label">No votes recorded yet.</span>}
          </div>
        </div>
      </div>

      {/* RUBRIC: READ GENERATION REQUESTS */}
      <div className="admin-panel-box" id="section-gen-requests">
        <div className="custom-topic-header">
          <div>
            <p className="eyebrow">READ GENERATION REQUESTS (public.arena_battles)</p>
            <h3>Battle &amp; Prompt Generation Requests ({filteredRequests.length})</h3>
          </div>
          <input
            className="custom-topic-input"
            style={{ maxWidth: 340 }}
            placeholder="Filter by requester, topic, prompt chain, or request ID…"
            value={reqSearch}
            onChange={(e) => setReqSearch(e.target.value)}
          />
        </div>
        <div className="table-scroll">
          <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
            <thead>
              <tr>
                <th style={{ width: 155 }}>CREATED</th>
                <th style={{ width: 185 }}>REQUESTER &amp; REQ ID</th>
                <th style={{ width: 170 }}>PROMPT CHAIN</th>
                <th>SCENARIO / PREMISE</th>
                <th style={{ width: 115 }}>STATUS</th>
                <th style={{ width: 120 }}>INSPECT</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((r) => {
                const expanded = expandedReqId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td>
                        <strong>{r.requester_email}</strong>
                        <br />
                        <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          req: {String(r.request_id ?? r.id).slice(0, 12)}…
                        </small>
                      </td>
                      <td>
                        <span className="status-pill">{r.prompt_chain_name}</span>
                      </td>
                      <td>
                        <span className="target-tag" style={{ marginRight: 8 }}>
                          {r.target}
                        </span>
                        <small style={{ color: 'var(--muted)' }}>{r.angle}</small>
                        {r.context && (
                          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#cfd6c6' }}>“{r.context}”</p>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-pill ${
                            r.status === 'failed' ? 'chip-danger' : r.status === 'ready' ? 'pill-superadmin' : ''
                          }`}
                        >
                          {r.status}
                        </span>
                        {r.error_code && (
                          <small style={{ display: 'block', color: '#ff8e7a', marginTop: 4 }}>{r.error_code}</small>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="topic-chip"
                          onClick={() => setExpandedReqId(expanded ? null : r.id)}
                        >
                          {expanded ? 'Hide Prompt' : '👁 Prompt'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr style={{ background: '#131711' }}>
                        <td colSpan={6}>
                          <div style={{ display: 'grid', gap: 8 }}>
                            <span className="eyebrow" style={{ marginBottom: 0 }}>
                              COMPILED PROMPT SENT TO PROVIDERS · REQUEST {r.request_id}
                            </span>
                            <pre
                              style={{
                                margin: 0,
                                padding: 14,
                                background: '#0e110c',
                                border: '1px solid var(--line)',
                                borderRadius: 6,
                                fontSize: 12,
                                whiteSpace: 'pre-wrap',
                                overflowWrap: 'anywhere',
                                color: '#dce4d2',
                              }}
                            >
                              {r.prompt}
                            </pre>
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

      {/* RUBRIC: READ LLM RESPONSES */}
      <div className="admin-panel-box" id="section-llm-responses">
        <div className="custom-topic-header">
          <div>
            <p className="eyebrow">READ LLM RESPONSES (public.llm_responses)</p>
            <h3>Raw LLM Response &amp; Token Observability Stream ({filteredResponses.length})</h3>
          </div>
          <div className="premise-badges">
            {(['ALL', 'openai', 'gemini'] as const).map((prov) => (
              <button
                key={prov}
                type="button"
                className={`topic-chip ${respProviderFilter === prov ? 'chip-active' : ''}`}
                onClick={() => setRespProviderFilter(prov)}
              >
                {prov === 'ALL' ? 'All Providers' : prov}
              </button>
            ))}
            <input
              className="custom-topic-input"
              style={{ maxWidth: 280 }}
              placeholder="Search model, CoT, or punchline…"
              value={respSearch}
              onChange={(e) => setRespSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
            <thead>
              <tr>
                <th style={{ width: 150 }}>TIMESTAMP</th>
                <th style={{ width: 175 }}>PROVIDER / MODEL</th>
                <th style={{ width: 135 }}>LATENCY &amp; HTTP</th>
                <th style={{ width: 155 }}>TOKENS (IN / OUT)</th>
                <th>MICRO-COT &amp; PARSED OUTPUT</th>
                <th style={{ width: 125 }}>RAW TRACE</th>
              </tr>
            </thead>
            <tbody>
              {filteredResponses.map((r) => {
                const expanded = expandedRespId === r.id;
                return (
                  <Fragment key={r.id}>
                    <tr>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td>
                        <strong>{r.provider.toUpperCase()}</strong>
                        <br />
                        <small style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                          {r.model}
                        </small>
                        {r.prompt_chain_name && (
                          <div style={{ marginTop: 5 }}>
                            <span className="status-pill">{r.prompt_chain_name}</span>
                          </div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        <span
                          className={`status-pill ${r.status === 'error' ? 'chip-danger' : 'pill-superadmin'}`}
                        >
                          {r.http_status ?? (r.status === 'success' ? 200 : 'ERR')} · {r.status}
                        </span>
                        <br />
                        <small style={{ color: 'var(--muted)', display: 'inline-block', marginTop: 6 }}>
                          {r.latency_ms ? `${r.latency_ms} ms` : '—'}
                        </small>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                        <div>In: {r.input_tokens ?? '—'}</div>
                        <div>Out: {r.output_tokens ?? '—'}</div>
                        {(r.reasoning_tokens ?? 0) > 0 && (
                          <small style={{ color: 'var(--green)' }}>Thought: {r.reasoning_tokens}</small>
                        )}
                      </td>
                      <td>
                        {r.status === 'error' ? (
                          <span style={{ color: '#ff8e7a' }}>Error: {r.error_message || 'Provider error'}</span>
                        ) : (
                          <>
                            {(r.parsed_cliche_to_avoid || r.parsed_comic_twist) && (
                              <small style={{ color: '#9ab082', display: 'block', marginBottom: 4 }}>
                                {r.parsed_cliche_to_avoid ? `Avoided: “${r.parsed_cliche_to_avoid}” ` : ''}
                                {r.parsed_comic_twist ? `· Twist: “${r.parsed_comic_twist}”` : ''}
                              </small>
                            )}
                            <p style={{ margin: '0 0 4px', fontSize: 13, color: '#cfd6c6' }}>{r.parsed_setup}</p>
                            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: '#fff' }}>
                              {r.parsed_punchline}
                            </p>
                          </>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="topic-chip"
                          onClick={() => setExpandedRespId(expanded ? null : r.id)}
                        >
                          {expanded ? 'Hide JSON' : '👁 Raw JSON'}
                        </button>
                      </td>
                    </tr>
                    {expanded && (
                      <tr style={{ background: '#131711' }}>
                        <td colSpan={6}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                            <div>
                              <span className="eyebrow" style={{ marginBottom: 6, display: 'block' }}>
                                RAW PROVIDER RESPONSE PAYLOAD
                              </span>
                              <pre
                                style={{
                                  margin: 0,
                                  padding: 12,
                                  background: '#0e110c',
                                  border: '1px solid var(--line)',
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  whiteSpace: 'pre-wrap',
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {r.raw_response_text || JSON.stringify(r.usage, null, 2)}
                              </pre>
                            </div>
                            <div>
                              <span className="eyebrow" style={{ marginBottom: 6, display: 'block' }}>
                                PROMPT INPUT &amp; USAGE METADATA
                              </span>
                              <pre
                                style={{
                                  margin: 0,
                                  padding: 12,
                                  background: '#0e110c',
                                  border: '1px solid var(--line)',
                                  borderRadius: 6,
                                  fontSize: 11.5,
                                  maxHeight: 220,
                                  overflowY: 'auto',
                                  whiteSpace: 'pre-wrap',
                                  overflowWrap: 'anywhere',
                                }}
                              >
                                {`Provider Request ID: ${r.provider_request_id ?? '—'}\nUsage: ${JSON.stringify(
                                  r.usage ?? {}
                                )}\n\n${r.prompt_text}`}
                              </pre>
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
    </div>
  );
}
