# AI Joke Arena — Week 5

Week 5 evolution of the AI Joke Arena, upgrading model comedic capability, eliminating user friction with hybrid matchmaking, and accelerating Hall-of-Flame leaderboard graduation.

> [!IMPORTANT]
> **Week 4 / Week 5 Isolation Strategy**:
> - **Week 4 (Immutable Course Submission)**: Preserved on branch `week4-arena` and deployed to Vercel project `humor-project-week4`. The submitted deployment URL remains completely frozen and untouched for course grading.
> - **Week 5 (Current Evolution)**: Maintained on branch `week5-arena` (or separate Vercel project `humor-project-week5`). All Week 5 experiments, Prompt iterations, and matchmaking upgrades are isolated here without affecting Week 4.

---

## What's New in Week 5

1. **Gemini Model Upgrade (`gemini-3-flash-preview`)**:
   - Upgraded from `gemini-3.1-flash-lite` to **`gemini-3-flash-preview`** (with `thinkingLevel: 'low'`), paired with `gpt-6-luna`.
   - Max output tokens capped at 400 tokens per call, keeping dual-model generation fast and ultra-low cost (< \$0.08 for 100 battles).

2. **25-Token Structured Schema Micro-CoT (`ai-roast-v3`)**:
   - Instead of wordy setups, the model JSON schema requires `cliche_to_avoid` (< 8 words) and `comic_twist` (< 12 words) **before** outputting `setup` and `punchline`.
   - This deterministic pre-planning forces models to bypass obvious clichés (*"context window"*, *"training data"*) and deliver sharp, punchy two-liners (15–42 words).

3. **Single-Click `Next battle →` with Hybrid Matchmaking**:
   - Removed the separate "Generate" vs "Community Vote" buttons.
   - When users click `Next battle →`, the server dynamically mixes:
     - **60% weight**: Existing unvoted community battles (ordered by `votes desc, random()`) so under-voted jokes graduate quickly.
     - **40% weight**: Fresh random AI roasts picked from a rich server-side scenario bank (`SCENARIOS`).
     - **Automatic Fallback**: If quota is exhausted or a provider errors, the matchmaker gracefully falls back to community battles without error popups.

4. **Faster Hall-of-Flame Graduation (3-Vote Threshold)**:
   - Battles close and graduate to the homepage at **3 votes** (reduced from 5), requiring at least 2 decisive votes and majority wins.
   - Solves the cold-start problem where the homepage Hall of Flame previously remained empty.

5. **Zero-Cognitive-Friction Blind UI**:
   - Removed manual topic-selection forms; full-width arena auto-loads a matchup on entry.
   - **Neutral Pre-Vote Styling**: Fixed pre-vote CSS color leaks (Card A/B neutral before voting; GPT green and Gemini blue only reveal after voting).
   - **Per-Vote Elo Delta**: Displays `(+8)` / `(-8)` next to model Elo scores upon voting.
   - **3-Second Cooldown & Multi-Skip Array**: Cooldown reduced from 30s to 3s; `p_skip uuid[]` array prevents infinite skipping loops.

---

## Setup & Configuration

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy environment template:
   ```bash
   cp .env.example .env.local
   ```
3. Set your credentials in `.env.local`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=AIza...

   OPENAI_MODEL=gpt-6-luna
   GEMINI_MODEL=gemini-3-flash-preview
   GENERATION_ENABLED=true
   ```
4. Database migrations:
   - For fresh databases: Run `supabase/schema.sql`, then `supabase/arena.sql`.
   - For existing databases: Run `supabase/model-identity.sql`, then apply the updated `supabase/arena.sql`.
5. Start development server:
   ```bash
   npm run dev
   ```

---

## Verification & Tests

Run isolated in-memory database and UI flow tests:
```bash
npm run test:db        # Tests 3-vote graduation, model identity, Elo replay, RLS
node tests/battle-flow.mjs # Tests single-click hybrid matchmaker, error recovery
npm run build          # Verifies Next.js production compilation
```

---

## Deployment & Branching

- **Week 4 Branch**: `https://github.com/jc6002/humor-project/tree/week4-arena` (Frozen for submission)
- **Week 5 Branch**: `https://github.com/jc6002/humor-project/tree/week5-arena`
- **Vercel**: Deploy Week 5 as a separate project or preview linked to `week5-arena` to guarantee that the Week 4 submission URL remains completely immutable.
