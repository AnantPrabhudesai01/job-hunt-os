# Anant Job Hunt OS (MVP — Phases 1 + 2)

Personal job-search command center. Next.js 16 + Supabase Postgres.

## What's built (MVP)

- Auth (login, session via proxy, logout via Supabase)
- Dashboard (level, XP bar, mission cards)
- Missions list + mission detail (resume pack, email drafts, JD)
- Settings (backend wiring status + API config screen)
- Schema with RLS (`supabase/schema.sql`), seed export (`supabase/seed.sql`)

## Setup (do once)

1. **Supabase project** (you have keys ready):
   - Dashboard → SQL Editor → run `supabase/schema.sql`
   - Authentication → Users → Add user (your email) → copy its UUID
   - In `supabase/seed.sql`, replace `YOUR_USER_UUID` → paste, run it
   - Storage (later phases): buckets come in Phase 2+
2. **Env**: copy `.env.example` → `.env.local`, paste URL + anon key
3. **Run**: `npm run dev` → open http://localhost:3000 → sign in
4. **Verify**: Dashboard shows Level 4, 774 XP, 10 missions

## Later phases (not yet built — honest stub list)

Interview prep PDFs, DSA module, people research, follow-up reminders,
analytics, achievements UI, Three.js mission map, Excel import/export.
Each will be added as a real feature, never a fake screen.

## Rules this app follows

- Single master data source (Supabase = the Excel, evolved)
- Prepared ≠ Sent: drafts stay DRAFTED until you confirm sending
- No fake integrations: unconfigured services show "Not connected"
