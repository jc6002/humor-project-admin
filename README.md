# AI Joke Arena — Admin Panel (Week 6)

> **Administrative Operations & Database Management Suite**  
> Course: COMS 6998: Designing for Generative AI (The Humor Project) • Fall 2026  
> Author: Junjie Cheng (`jc6002@columbia.edu`)

---

## Overview

`humor-project-admin` is the dedicated administrative console and telemetry dashboard for **AI Joke Arena**, built for the Week 6 assignment. It provides full database observability, role-based access control, user profile management, AI media CRUD operations, and rating audits.

---

## Technical Implementation & Assignment Rubric Compliance

### 1. Google Login Wall & Role-Based Access Control (`is_superadmin`)
- **Protected Routes & APIs**: Every route and API endpoint (`/`, `/api/admin/media`) is guarded by `checkSuperadmin()` and `requireSuperadminApi()`.
- **Authorization Verification**: Queries `public.profiles.is_superadmin === true` via the Supabase Service Role client, preventing any unauthenticated or unauthorized access.
- **Lockout Resolution (Assignment Question)**:
  > *Question: If this specific database field is required to use your own admin area, won't you be locked out? How do you solve this problem?*  
  > **Solution**: Out-of-band privilege bootstrapping. As database owners, we execute a direct SQL statement in the **Supabase Dashboard SQL Editor** (or via the Supabase Service Role API), which bypasses Row-Level Security (RLS) to grant superadmin status:
  ```sql
  UPDATE public.profiles
  SET is_superadmin = TRUE
  WHERE email = 'jc6002@columbia.edu';
  ```
  The included `week6_migration.sql` also automatically bootstraps superadmin status for the earliest user in `auth.users`.

### 2. Rich Data Statistics & Highlights
- **KPI Summary Grid**:
  - Registered user count and active superadmin count.
  - Total battles, generations, and stored AI jokes.
  - **Decisive Win Rate %** vs. **Groan ("Both missed") Rate %** vs. **Tie Rate %**.
  - Dual-model average generation latency (ms).
- **Head-to-Head Model Family Telemetry**: Win share distribution between GPT and Gemini models.
- **Scenario Angle Breakdown**: Comedy category performance tracking voter preferences across failure modes.

### 3. User & Profile Management (`READ users/profiles`)
- Real-time table of all user profiles with Google authentication emails, names, avatars, and creation timestamps.
- Aggregated user engagement telemetry: total battles initiated and total votes cast per user.
- Visual `Superadmin` badges with RLS escalation protection.

### 4. AI Generated Media Management (`CREATE / READ / UPDATE / DELETE AI generated media`)
- **CREATE**:
  - Admin-triggered live generation: orchestrate a head-to-head battle between GPT and Gemini on any custom topic or angle.
  - Manual media insertion: create custom jokes directly in `ai_jokes`.
- **READ**:
  - Live inspection table of all outputs in `arena_generations` and `ai_jokes`.
  - Displays model snapshot, target, angle, setup, punchline, and generation latency.
- **UPDATE**:
  - Inline modal editor to modify setup, punchline, target, angle, or battle status (`ready`, `closed`, `failed`).
- **DELETE**:
  - Single-generation purge or complete battle purge (with cascading vote clean-up).

### 5. Upvote / Downvote & Rating Management (`READ upvotes/downvotes/ratings`)
- Comprehensive audit feed of all user votes (`arena_votes`).
- Displays voter email/identifier, battle scenario, user preference (`Comedian A`, `Comedian B`, `Tie`, `Both missed`).
- Shows full punchline context and resulting Bradley-Terry Elo score adjustments (`left_delta`, `right_delta`).

---

## Setup & Local Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure `.env.local`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   OPENAI_API_KEY=sk-...
   GEMINI_API_KEY=AIza...

   OPENAI_MODEL=gpt-6-luna,gpt-5.6-luna
   GEMINI_MODEL=gemini-3-flash-preview,gemini-3.1-flash-lite
   GENERATION_ENABLED=true
   ```

3. Run locally:
   ```bash
   npm run dev
   ```

4. Production build test:
   ```bash
   npm run build
   ```

---

## Deployment & Grading Notes

- **Vercel Project**: Create a new project in Vercel importing `humor-project-admin`.
- **Turn off Vercel Deployment Protection**:
  Navigate to **Project Settings** -> **Deployment Protection** and ensure **Vercel Authentication** is **Disabled** so grading staff can access the Google login wall in Incognito mode.
