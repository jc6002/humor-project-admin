'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ObservabilityWorkspace } from './admin/observability-workspace';
import { PromptChainsWorkspace } from './admin/prompt-chains-workspace';
import { ModelsProvidersWorkspace } from './admin/models-providers-workspace';
import { MediaVotesWorkspace } from './admin/media-votes-workspace';
import { UsersAccessWorkspace } from './admin/users-access-workspace';
import type {
  AllowedDomainRow,
  ComedyTermRow,
  GenerationExampleRow,
  GenerationRequestRow,
  GenerationRow,
  LlmModelRow,
  LlmProviderRow,
  LlmResponseRow,
  PromptChainRow,
  PromptChainStepRow,
  WhitelistedEmailRow,
} from './admin/admin-types';

type TabKey = 'observability' | 'chains' | 'models' | 'media' | 'access' | 'all';

type Props = {
  adminUser: { id: string; email: string };
  initialData: {
    week7Migrated?: boolean;
    summary: {
      totalUsers: number;
      superadmins: number;
      totalBattles: number;
      totalGenerations: number;
      totalVotes: number;
      decisiveRate: number;
      groanRate: number;
      tieRate: number;
      avgLatencyMs: number;
      totalLlmResponses: number;
      totalInputTokens: number;
      totalOutputTokens: number;
    };
    models: LlmModelRow[];
    llmProviders: LlmProviderRow[];
    promptChains: PromptChainRow[];
    promptChainSteps: PromptChainStepRow[];
    comedyTerms: ComedyTermRow[];
    generationExamples: GenerationExampleRow[];
    generationRequests: GenerationRequestRow[];
    llmResponses: LlmResponseRow[];
    allowedDomains: AllowedDomainRow[];
    whitelistedEmails: WhitelistedEmailRow[];
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

const RUBRIC_QUICK_JUMP: Array<{ label: string; tab: TabKey; anchor: string }> = [
  { label: '1 · Users (R)', tab: 'access', anchor: 'section-users' },
  { label: '2 · Prompt Chains (R)', tab: 'chains', anchor: 'section-prompt-chains' },
  { label: '3 · Chain Steps (R)', tab: 'chains', anchor: 'section-chain-steps' },
  { label: '4 · Chain Mix (R/U)', tab: 'chains', anchor: 'section-chain-mix' },
  { label: '5 · Terms (CRUD)', tab: 'chains', anchor: 'section-terms' },
  { label: '6 · AI Media (View/CRUD)', tab: 'media', anchor: 'section-media' },
  { label: '7 · Gen Requests (R)', tab: 'observability', anchor: 'section-gen-requests' },
  { label: '8 · Examples (CRUD)', tab: 'chains', anchor: 'section-examples' },
  { label: '9 · LLM Models (CRUD)', tab: 'models', anchor: 'section-models' },
  { label: '10 · LLM Providers (CRUD)', tab: 'models', anchor: 'section-providers' },
  { label: '11 · LLM Responses (R)', tab: 'observability', anchor: 'section-llm-responses' },
  { label: '12 · Signup Domains (CRUD)', tab: 'access', anchor: 'section-domains' },
  { label: '13 · Whitelisted Emails (CRUD)', tab: 'access', anchor: 'section-whitelist' },
];

export function AdminDashboard({ adminUser, initialData }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('observability');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const {
    week7Migrated,
    summary,
    models,
    llmProviders,
    promptChains,
    promptChainSteps,
    comedyTerms,
    generationExamples,
    generationRequests,
    llmResponses,
    allowedDomains,
    whitelistedEmails,
    angleBreakdown,
    profiles,
    generations,
    votes,
  } = initialData;

  function showToast(msg: string, isErr = false) {
    if (isErr) {
      setError(msg);
      setNotice('');
    } else {
      setNotice(msg);
      setError('');
    }
  }

  function jumpToRubricItem(targetTab: TabKey, anchor: string) {
    setTab(targetTab);
    setTimeout(() => {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  return (
    <div className="admin-shell">
      {/* FLOATING TOAST NOTIFICATION */}
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
          <span>SUPERADMIN OBSERVABILITY CONSOLE · VERIFIED (profiles.is_superadmin == TRUE)</span>
        </div>
        <div className="status-quota">
          <span>Signed in as</span>
          <strong>{adminUser.email}</strong>
        </div>
      </div>

      {week7Migrated === false && (
        <p className="notice">
          Heads up: Week 7 observability tables were not detected yet. Run <code>supabase/week7_migration.sql</code> once in the Supabase SQL Editor to activate Prompt Chains, LLM Responses, Terms, Examples, Providers, and Domain/Email Whitelists.
        </p>
      )}

      {/* HERO OBSERVABILITY KPI STRIP */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span className="eyebrow">LLM RESPONSES &amp; LATENCY</span>
          <strong>{summary.totalLlmResponses}</strong>
          <small>
            {summary.avgLatencyMs}ms avg · {(summary.totalInputTokens + summary.totalOutputTokens).toLocaleString()}{' '}
            tokens
          </small>
        </div>
        <div className="admin-kpi-card">
          <span className="eyebrow">PROMPT CHAINS &amp; STEERING</span>
          <strong>{promptChains.length}</strong>
          <small>
            {promptChainSteps.length} steps · {comedyTerms.length} terms · {generationExamples.length} examples
          </small>
        </div>
        <div className="admin-kpi-card">
          <span className="eyebrow">AI MEDIA &amp; REQUESTS</span>
          <strong>{generations.length}</strong>
          <small>
            {generationRequests.length} gen requests · {summary.totalVotes} votes ({summary.groanRate}% groan)
          </small>
        </div>
        <div className="admin-kpi-card">
          <span className="eyebrow">USERS &amp; ACCESS GATES</span>
          <strong>{summary.totalUsers}</strong>
          <small>
            {allowedDomains.length} allowed domains · {whitelistedEmails.length} whitelisted emails
          </small>
        </div>
      </div>

      {/* 13-CAPABILITY RUBRIC QUICK-JUMP INDEX */}
      <div className="rubric-jump-bar" aria-label="Week 7 Rubric Quick Jump">
        <span className="custom-topic-label">WEEK 7 RUBRIC INDEX (13/13):</span>
        <div className="premise-badges">
          {RUBRIC_QUICK_JUMP.map((item) => (
            <button
              key={item.anchor}
              type="button"
              className="topic-chip"
              onClick={() => jumpToRubricItem(item.tab, item.anchor)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 5 WORKSPACE NAVIGATION TABS + SHOW ALL */}
      <div className="admin-tabs" role="tablist">
        <button
          type="button"
          className={`admin-tab ${tab === 'observability' ? 'active' : ''}`}
          onClick={() => setTab('observability')}
        >
          1 · Observability &amp; LLM Traces ({llmResponses.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'chains' ? 'active' : ''}`}
          onClick={() => setTab('chains')}
        >
          2 · Prompt Chains, Mix, Terms &amp; Examples
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'models' ? 'active' : ''}`}
          onClick={() => setTab('models')}
        >
          3 · LLM Providers ({llmProviders.length}) &amp; Models ({models.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'media' ? 'active' : ''}`}
          onClick={() => setTab('media')}
        >
          4 · AI Media ({generations.length}) &amp; Votes ({votes.length})
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'access' ? 'active' : ''}`}
          onClick={() => setTab('access')}
        >
          5 · Users ({profiles.length}), Domains &amp; Whitelist
        </button>
        <button
          type="button"
          className={`admin-tab ${tab === 'all' ? 'active' : ''}`}
          onClick={() => setTab('all')}
        >
          View All 13 Panels
        </button>
      </div>

      {(tab === 'observability' || tab === 'all') && (
        <ObservabilityWorkspace
          models={models}
          angleBreakdown={angleBreakdown}
          generationRequests={generationRequests}
          llmResponses={llmResponses}
        />
      )}

      {(tab === 'chains' || tab === 'all') && (
        <PromptChainsWorkspace
          initialChains={promptChains}
          steps={promptChainSteps}
          initialTerms={comedyTerms}
          initialExamples={generationExamples}
          onToast={showToast}
          onRefresh={() => router.refresh()}
        />
      )}

      {(tab === 'models' || tab === 'all') && (
        <ModelsProvidersWorkspace
          initialProviders={llmProviders}
          initialModels={models}
          onToast={showToast}
          onRefresh={() => router.refresh()}
        />
      )}

      {(tab === 'media' || tab === 'all') && (
        <MediaVotesWorkspace
          initialGenerations={generations}
          votes={votes}
          onToast={showToast}
          onRefresh={() => router.refresh()}
        />
      )}

      {(tab === 'access' || tab === 'all') && (
        <UsersAccessWorkspace
          profiles={profiles}
          initialDomains={allowedDomains}
          initialWhitelist={whitelistedEmails}
          onToast={showToast}
          onRefresh={() => router.refresh()}
        />
      )}
    </div>
  );
}
