'use client';
import { useState, useEffect } from 'react';
import { callEntityApi, type AllowedDomainRow, type WhitelistedEmailRow } from './admin-types';

type ProfileRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_superadmin: boolean;
  battles_created: number;
  votes_cast: number;
  created_at: string;
};

type Props = {
  profiles: ProfileRow[];
  initialDomains: AllowedDomainRow[];
  initialWhitelist: WhitelistedEmailRow[];
  onToast: (msg: string, isErr?: boolean) => void;
  onRefresh: () => void;
};

export function UsersAccessWorkspace({
  profiles,
  initialDomains,
  initialWhitelist,
  onToast,
  onRefresh,
}: Props) {
  const [domains, setDomains] = useState<AllowedDomainRow[]>(initialDomains);
  const [whitelist, setWhitelist] = useState<WhitelistedEmailRow[]>(initialWhitelist);
  const [userSearch, setUserSearch] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setDomains(initialDomains), [initialDomains]);
  useEffect(() => setWhitelist(initialWhitelist), [initialWhitelist]);

  // Allowed Signup Domains CRUD state
  const [newDomain, setNewDomain] = useState('');
  const [newDomainDesc, setNewDomainDesc] = useState('');
  const [editDomId, setEditDomId] = useState<string | null>(null);
  const [editDomText, setEditDomText] = useState('');
  const [editDomDesc, setEditDomDesc] = useState('');

  // Whitelisted Emails CRUD state
  const [newEmail, setNewEmail] = useState('');
  const [newEmailNote, setNewEmailNote] = useState('');
  const [newEmailAdmin, setNewEmailAdmin] = useState(false);
  const [editWlId, setEditWlId] = useState<string | null>(null);
  const [editWlEmail, setEditWlEmail] = useState('');
  const [editWlNote, setEditWlNote] = useState('');
  const [editWlAdmin, setEditWlAdmin] = useState(false);

  async function handleAddDomain(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await callEntityApi('POST', {
        entity: 'allowed_signup_domains',
        domain: newDomain,
        description: newDomainDesc,
      });
      if (res.row) setDomains((prev) => [res.row, ...prev]);
      setNewDomain('');
      setNewDomainDesc('');
      onToast(`✓ Added allowed signup domain "${res.row?.domain ?? newDomain}".`);
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveDomain(id: string) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'allowed_signup_domains',
        id,
        domain: editDomText,
        description: editDomDesc,
      });
      if (res.row) setDomains((prev) => prev.map((d) => (d.id === id ? res.row : d)));
      setEditDomId(null);
      onToast('✓ Updated allowed signup domain.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleDomain(d: AllowedDomainRow) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'allowed_signup_domains',
        id: d.id,
        is_active: !d.is_active,
      });
      if (res.row) setDomains((prev) => prev.map((x) => (x.id === d.id ? res.row : x)));
      onToast(`✓ ${!d.is_active ? 'Enabled' : 'Disabled'} domain ${d.domain}.`);
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteDomain(id: string) {
    setBusy(true);
    try {
      await callEntityApi('DELETE', { entity: 'allowed_signup_domains', id });
      setDomains((prev) => prev.filter((d) => d.id !== id));
      onToast('✓ Deleted allowed signup domain.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleAddWhitelist(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await callEntityApi('POST', {
        entity: 'whitelisted_emails',
        email: newEmail,
        note: newEmailNote,
        auto_superadmin: newEmailAdmin,
      });
      if (res.row) setWhitelist((prev) => [res.row, ...prev]);
      setNewEmail('');
      setNewEmailNote('');
      setNewEmailAdmin(false);
      onToast(`✓ Added whitelisted e-mail "${res.row?.email ?? newEmail}".`);
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveWhitelist(id: string) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'whitelisted_emails',
        id,
        email: editWlEmail,
        note: editWlNote,
        auto_superadmin: editWlAdmin,
      });
      if (res.row) setWhitelist((prev) => prev.map((w) => (w.id === id ? res.row : w)));
      setEditWlId(null);
      onToast('✓ Updated whitelisted e-mail address.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleWhitelist(w: WhitelistedEmailRow) {
    setBusy(true);
    try {
      const res = await callEntityApi('PATCH', {
        entity: 'whitelisted_emails',
        id: w.id,
        is_active: !w.is_active,
      });
      if (res.row) setWhitelist((prev) => prev.map((x) => (x.id === w.id ? res.row : x)));
      onToast(`✓ ${!w.is_active ? 'Enabled' : 'Disabled'} ${w.email}.`);
    } catch (err) {
      onToast((err as Error).message, true);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteWhitelist(id: string) {
    setBusy(true);
    try {
      await callEntityApi('DELETE', { entity: 'whitelisted_emails', id });
      setWhitelist((prev) => prev.filter((w) => w.id !== id));
      onToast('✓ Removed e-mail from whitelist.');
      onRefresh();
    } catch (err) {
      onToast((err as Error).message, true);
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

  return (
    <div className="admin-section">
      {/* RUBRIC: READ USERS */}
      <div className="admin-panel-box" id="section-users">
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

      {/* RUBRIC: CREATE / READ / UPDATE / DELETE ALLOWED SIGNUP DOMAINS */}
      <div className="admin-panel-box" id="section-domains">
        <div>
          <p className="eyebrow">
            CREATE · READ · UPDATE · DELETE ALLOWED SIGNUP DOMAINS (public.allowed_signup_domains)
          </p>
          <h3>Allowed OAuth Signup Domains ({domains.length})</h3>
        </div>

        <form className="admin-form-grid" onSubmit={handleAddDomain}>
          <input
            className="custom-topic-input"
            placeholder="Domain (e.g., columbia.edu, nyu.edu)"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            required
          />
          <input
            className="custom-topic-input"
            placeholder="Description / Policy note"
            value={newDomainDesc}
            onChange={(e) => setNewDomainDesc(e.target.value)}
          />
          <button type="submit" className="button" disabled={busy}>
            + Add Allowed Domain
          </button>
        </form>

        <div className="table-scroll">
          <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
            <thead>
              <tr>
                <th style={{ width: 220 }}>DOMAIN</th>
                <th>DESCRIPTION</th>
                <th style={{ width: 120 }}>STATUS</th>
                <th style={{ width: 185 }}>UPDATE / DELETE</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d) => {
                const isEditing = editDomId === d.id;
                return (
                  <tr key={d.id} style={isEditing ? { background: '#1c2416' } : undefined}>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ padding: '6px 9px', fontSize: 13 }}
                          value={editDomText}
                          onChange={(e) => setEditDomText(e.target.value)}
                        />
                      ) : (
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>@{d.domain}</strong>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ width: '100%', padding: '6px 9px', fontSize: 13 }}
                          value={editDomDesc}
                          onChange={(e) => setEditDomDesc(e.target.value)}
                        />
                      ) : (
                        <span style={{ color: '#cfd6c6', fontSize: 13 }}>{d.description || '—'}</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-pill ${d.is_active ? 'pill-superadmin' : ''}`}
                        onClick={() => handleToggleDomain(d)}
                        disabled={busy}
                      >
                        {d.is_active ? 'Allowed ✓' : 'Blocked'}
                      </button>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="button button-small"
                            disabled={busy}
                            onClick={() => handleSaveDomain(d.id)}
                          >
                            💾 Save
                          </button>
                          <button type="button" className="topic-chip" onClick={() => setEditDomId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="topic-chip"
                            onClick={() => {
                              setEditDomId(d.id);
                              setEditDomText(d.domain);
                              setEditDomDesc(d.description);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="topic-chip chip-danger"
                            disabled={busy}
                            onClick={() => handleDeleteDomain(d.id)}
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

      {/* RUBRIC: CREATE / READ / UPDATE / DELETE WHITELISTED E-MAIL ADDRESSES */}
      <div className="admin-panel-box" id="section-whitelist">
        <div>
          <p className="eyebrow">
            CREATE · READ · UPDATE · DELETE WHITELISTED E-MAIL ADDRESSES (public.whitelisted_emails)
          </p>
          <h3>Whitelisted E-mail Addresses ({whitelist.length})</h3>
        </div>

        <form className="admin-form-grid" onSubmit={handleAddWhitelist}>
          <input
            type="email"
            className="custom-topic-input"
            placeholder="E-mail address (e.g., reviewer@example.org)"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
          />
          <input
            className="custom-topic-input"
            placeholder="Note / Reviewer role"
            value={newEmailNote}
            onChange={(e) => setNewEmailNote(e.target.value)}
          />
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              padding: '0 10px',
              border: '1px solid var(--line)',
              borderRadius: 6,
              background: '#141812',
            }}
          >
            <input
              type="checkbox"
              checked={newEmailAdmin}
              onChange={(e) => setNewEmailAdmin(e.target.checked)}
            />
            Auto-grant Superadmin
          </label>
          <button type="submit" className="button" disabled={busy}>
            + Whitelist Email
          </button>
        </form>

        <div className="table-scroll">
          <table className="ranking-table" style={{ whiteSpace: 'normal' }}>
            <thead>
              <tr>
                <th style={{ width: 250 }}>E-MAIL ADDRESS</th>
                <th>NOTE</th>
                <th style={{ width: 165 }}>ROLE ESCALATION</th>
                <th style={{ width: 115 }}>STATUS</th>
                <th style={{ width: 185 }}>UPDATE / DELETE</th>
              </tr>
            </thead>
            <tbody>
              {whitelist.map((w) => {
                const isEditing = editWlId === w.id;
                return (
                  <tr key={w.id} style={isEditing ? { background: '#1c2416' } : undefined}>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ padding: '6px 9px', fontSize: 13 }}
                          value={editWlEmail}
                          onChange={(e) => setEditWlEmail(e.target.value)}
                        />
                      ) : (
                        <strong style={{ fontFamily: 'var(--font-mono)' }}>{w.email}</strong>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="custom-topic-input"
                          style={{ width: '100%', padding: '6px 9px', fontSize: 13 }}
                          value={editWlNote}
                          onChange={(e) => setEditWlNote(e.target.value)}
                        />
                      ) : (
                        <span style={{ color: '#cfd6c6', fontSize: 13 }}>{w.note || '—'}</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                          <input
                            type="checkbox"
                            checked={editWlAdmin}
                            onChange={(e) => setEditWlAdmin(e.target.checked)}
                          />
                          Auto Superadmin
                        </label>
                      ) : (
                        <span className={`status-pill ${w.auto_superadmin ? 'pill-superadmin' : ''}`}>
                          {w.auto_superadmin ? '★ Auto-Superadmin' : 'Standard Access'}
                        </span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`status-pill ${w.is_active ? 'pill-superadmin' : ''}`}
                        onClick={() => handleToggleWhitelist(w)}
                        disabled={busy}
                      >
                        {w.is_active ? 'Active ✓' : 'Disabled'}
                      </button>
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="button button-small"
                            disabled={busy}
                            onClick={() => handleSaveWhitelist(w.id)}
                          >
                            💾 Save
                          </button>
                          <button type="button" className="topic-chip" onClick={() => setEditWlId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            type="button"
                            className="topic-chip"
                            onClick={() => {
                              setEditWlId(w.id);
                              setEditWlEmail(w.email);
                              setEditWlNote(w.note);
                              setEditWlAdmin(w.auto_superadmin);
                            }}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className="topic-chip chip-danger"
                            disabled={busy}
                            onClick={() => handleDeleteWhitelist(w.id)}
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
