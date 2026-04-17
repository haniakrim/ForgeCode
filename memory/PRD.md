# FORGE — Product Requirements Document

## Original Problem Statement
"i want to build a full-stack app developer like you SAAS"

## Product Vision
FORGE is an AI full-stack app developer SaaS — a noir-editorial, developer-focused competitor to Emergent / Lovable / v0 / Bolt. Users describe an app idea in natural language; the selected LLM (Claude / GPT / Gemini) plans and writes code; a split-pane IDE shows generated files with a live React preview. Users can push to GitHub, deploy to Vercel/Netlify, or export a ZIP.

## User Personas
1. **Indie Hacker** — ship MVPs over a weekend without boilerplate.
2. **Freelance Engineer** — accelerate client project scaffolding.
3. **Product Manager** — prototype internal tools without engineering wait.
4. **Senior Engineer** — generate readable, owner-operable code.

## Core Capabilities
- Google OAuth via Emergent Auth (httpOnly cookie + Bearer fallback)
- Multi-model AI code generation: Claude Sonnet 4.5 (default) / Haiku 4.5 / Opus 4.5, GPT-5.2 / 4o-mini, Gemini 3 Pro / Flash
- Bring-your-own API keys per provider (optional)
- Custom system prompts (override FORGE persona)
- Multi-turn chat with SSE streaming
- Split-view workspace: chat ↔ code/preview IDE (Sandpack)
- Monaco editor with Yjs CRDT collaborative editing
- Real-time presence + typing indicators (WebSocket)
- Role-based collaboration (owner / editor / viewer)
- Email invitations (Resend)
- Project activity log
- Template gallery (6 prebuilt prompts)
- Credit system (100 free credits / user, −1 per turn/review)
- Stripe-powered billing (4 packages: Studio $29, Maison $99, Topup $10, Topup $29)
- ZIP project export

## Agent Cognition (v8 — "think like Claude")
1. **Senior-engineer system prompt** — principal-level CoT (restate → edges → approach → file plan → code), quality rules (data-testid, env vars, no _id leak, /api prefix), stack conventions.
2. **Plan → Build two-pass** — `mode="plan"` returns only a markdown plan (Goal / Approach / File plan / Risks). User clicks "Approve & build" to run build pass.
3. **Self-critique review** — `POST /api/projects/{id}/review` concatenates project files and grades against a 5-axis rubric (correctness, security, conventions, maintainability, UX).
4. **Agentic tool-use loop** — `mode="agent"` lets the model emit `<tool name="list_files|read_file|write_file|done" .../>` XML tags. Backend parses, executes, feeds results back. Max 5 rounds.
5. **Per-project memory** — auto-maintained `project_memory` collection. Compressed bullet-point doc of architecture decisions, files created, open TODOs. Injected into system prompt every turn.

## Integrations (v7)
| Provider | Auth | Purpose |
|---|---|---|
| GitHub | PAT or OAuth (end-user) | Create repo + push files via Git Data API |
| Vercel | PAT (end-user) | Deploy via `/v13/deployments` with inline files |
| Netlify | PAT (end-user) | Deploy ZIP via `/api/v1/sites/{site_id}/deploys` |

## Architecture
**Backend (FastAPI + MongoDB + emergentintegrations)** — `/app/backend/server.py`
- Collections: `users`, `user_sessions`, `user_settings`, `projects`, `project_members`, `messages`, `project_files`, `project_memory`, `project_activity`, `payment_transactions`
- WebSocket endpoints: `/api/ws/projects/{id}` (presence), `/api/ws/yjs/{id}/{file_path}` (CRDT relay)
- Streaming: SSE `/api/projects/{id}/chat/stream` with events `user | token | agent_step | tool_result | done`

**Frontend (React + Tailwind + Sandpack + Monaco)** — `/app/frontend/src/`
- Routes: `/`, `/dashboard`, `/templates`, `/project/:id`, `/settings`, `/billing`, `/billing/success`, `/share/:id`
- Settings page tabs: Profile / AI engine (model picker + system prompt + BYO keys) / Integrations (GitHub/Vercel/Netlify cards)
- Project page: split IDE, toolbar (Export · Deploy · Review · Memory · Activity · Share), chat with mode selector (Plan/Build/Agent)

## Implemented Milestones
### Phase 1-5 (complete)
- Scaffold, auth, chat SSE, ZIP export, Stripe billing
- Noir/Editorial UI redesign, theme toggle (Noir/Daylight)
- Role-based collaboration, WebSocket live presence
- Sandpack multi-file preview, Monaco+Yjs collaborative editor
- Project activity logs, Resend email invites, offline/reconnect

### Phase 6 — Integrations (v7, iteration 6)
- User settings: `/api/settings` + model picker + custom system prompt + BYO keys
- GitHub PAT + OAuth connect; one-click push from project
- Vercel deploy (inline files, v13 API)
- Netlify deploy (ZIP upload)
- DeployMenu toolbar component

### Phase 7 — Agent Cognition (v8, iteration 7)
- Rewritten SYSTEM_PROMPT (principal-engineer CoT + quality rules)
- Plan / Build / Agent mode selector
- Plan-only responses with "Approve & build" button
- `/api/projects/{id}/review` endpoint + drawer UI
- `/api/projects/{id}/memory` GET/PUT + auto-maintenance
- Agentic XML tool-use loop (list_files / read_file / write_file / done)

### Phase 8 — Time travel + Collaboration polish (v9, iteration 8)
- `project_file_versions` collection — content-idempotent snapshots on every save (user + agent)
- `GET /api/projects/{id}/files/history` (list) + `GET /files/version/{id}` (read)
- `GET /api/projects/{id}/files/diff?path=X&a=&b=` — unified diff text
- `POST /api/projects/{id}/files/restore` — point-in-time rollback
- `HistoryDialog` component — files / versions / compare-A-vs-B grid with Restore
- `notifications` collection + `_notify()` helper; emits on invite / review / deploy / push
- `GET /api/notifications`, `POST /api/notifications/read` endpoints
- `NotificationBell` component in Navbar (unread badge, polls every 30s, mark-all-read)
- Multi-agent orchestration: `POST /api/projects/{id}/multi-agent/stream` chains Planner → Coder → Reviewer as 3 sequential LLM calls with role-specific system-prompt suffixes
- 4th mode pill "Multi" in chat (costs 3 credits)
- New SSE events: `phase_start`, `phase_end`

### Phase 9 — Reasoning, Snapshots, Public Showcase (v10, iteration 10)
- `<thinking>...</thinking>` tag protocol — LLM wraps private reasoning, backend strips and emits `reasoning` SSE event; frontend shows a floating side-panel while model plans
- Full-project snapshots: `project_snapshots` collection + create/list/restore/delete endpoints. Restore auto-captures a safety snapshot beforehand so nothing is ever lost
- HistoryDialog upgraded with tabs (Versions / Snapshots) and side-by-side visual diff toggle
- Public Showcase gallery: `PUT /projects/{id}/visibility`, `GET /showcase` (no auth), `GET /showcase/{id}`, `POST /showcase/{id}/fork`
- New `/showcase` page with editorial hero, Recent/Popular sort, one-click Fork that clones files + memory + increments source.fork_count
- Visibility toggle drawer in project toolbar with showcase-tagline editor

### Phase 10 — Marketplace, Detail pages, Mobile (v11, iteration 13)
- Reasoning protocol rewritten to `[[REASONING]]...[[/REASONING]]` custom markers (Claude was silently converting XML `<thinking>` to native thinking blocks); now always appended regardless of custom system prompt
- `/showcase/:id` project detail page — hero with author/stack/forks/files/published metadata, iterative file tree, optional project memory, big Fork CTA
- Community Prompt Marketplace — `prompt_marketplace` collection + 6 seeded curated prompts (Stripe-style Engineer, Paranoid Security Auditor, Design-obsessed Frontend Dev, Rust Systems Engineer, Concise Documentation Writer, Kubernetes-native DevOps)
- `GET/POST /prompts`, `POST /prompts/{id}/upvote` (toggle), `POST /prompts/{id}/apply` (sets user system_prompt + tracks applied_prompt_id)
- `/prompts` page — editorial hero, Featured/Popular/Recent sort, search + tag filters, per-card upvote + Apply, submit-new dialog
- Applied badge on active prompt card; link from Settings → AI Engine tab
- Mobile-responsive Project IDE — Chat/Workspace pane switcher for <768px viewports

## Test Coverage
- iteration_1.json → iteration_13.json
- Latest: **24/24 v11 tests passed + 100% frontend E2E** (prior 43/43 v10 + 88/88 v9 + all earlier regression)
- Zero open critical/minor bugs

## Known Issues
- emergentintegrations `get_checkout_status()` Pydantic validation error on Stripe status polling (mitigated via try/except graceful fallback; webhook handles actual payment confirmation)
- Side-by-side diff for single-line files without trailing newline produces unusual layout (difflib edge case; real multi-line code works fine)

## Backlog
- P3: Supabase / Firebase backend integration options
- P3: Per-user analytics dashboard (credits spent, models used, deploys per week)
- P3: Weekly Showcase trending email digest (requires scheduled job)
- P3: Headless Sandpack thumbnail capture for Showcase cards (currently text-only)
