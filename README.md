# AI Joke Arena — Week 7 Superadmin & Observability Console

Dedicated Superadmin & LLM Observability Console (`humor-project-admin`) for the **AI Joke Arena** (`humor-project`), protected behind Google OAuth and `public.profiles.is_superadmin == TRUE`.

---

## Week 7 Capability Coverage (13 / 13)

| # | Week 7 Requirement | Backing Table(s) | Admin Workspace |
|---|---|---|---|
| 1 | **Read users** | `public.profiles` + `auth.users` | Tab 5 · Users, Domains & Whitelist |
| 2 | **Read prompt chains** | `public.prompt_chains` | Tab 2 · Prompt Chains, Mix, Terms & Examples |
| 3 | **Read prompt chain steps** | `public.prompt_chain_steps` | Tab 2 · Prompt Chains, Mix, Terms & Examples |
| 4 | **Read / update prompt chain mix** | `public.prompt_chains` (`mix_weight`, `is_active`) | Tab 2 · Prompt Chains, Mix, Terms & Examples |
| 5 | **CRUD terms** | `public.comedy_terms` | Tab 2 · Prompt Chains, Mix, Terms & Examples |
| 6 | **Read / view (+ CRUD) AI generated media** | `public.arena_generations` | Tab 4 · AI Media & Votes (`👁 View` trace drawer + `✏️ Edit` + `🗑 Delete` + `+ Create`) |
| 7 | **Read generation requests** | `public.arena_battles` | Tab 1 · Observability & LLM Traces (`👁 Prompt` inspector) |
| 8 | **CRUD AI generation examples** | `public.ai_generation_examples` | Tab 2 · Prompt Chains, Mix, Terms & Examples |
| 9 | **CRUD LLM models** | `public.arena_models` | Tab 3 · LLM Providers & Models |
| 10 | **CRUD LLM providers** | `public.llm_providers` | Tab 3 · LLM Providers & Models |
| 11 | **Read LLM responses** | `public.llm_responses` | Tab 1 · Observability & LLM Traces (`👁 Raw JSON`, latency, HTTP status, token counts) |
| 12 | **CRUD allowed signup domains** | `public.allowed_signup_domains` | Tab 5 · Users, Domains & Whitelist |
| 13 | **CRUD whitelisted e-mail addresses** | `public.whitelisted_emails` | Tab 5 · Users, Domains & Whitelist |

*(Note: AI Joke Arena is a text-only 1v1 blind joke generation & rating platform without user image uploads.)*

---

## Setup & Deployment

1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env.local` (shared with `humor-project`):
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=AIza...

   OPENAI_MODEL=gpt-6-luna,gpt-5.6-luna
   GEMINI_MODEL=gemini-3-flash-preview
   GENERATION_ENABLED=true
   ```
3. Run `supabase/week7_migration.sql` once in the **Supabase SQL Editor**.
4. In **Supabase → Authentication → URL Configuration → Redirect URLs**, ensure `https://<your-admin-vercel-domain>/auth/callback` (or `https://*.vercel.app/auth/callback`) is listed.
5. In **Vercel → Project Settings → Deployment Protection**, turn **OFF** Vercel Authentication so commit-specific URLs can be viewed in Incognito Mode.
