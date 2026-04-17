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

## Test Coverage
- iteration_1.json → iteration_7.json
- Latest: **56/56 backend tests passed** (27 v8 + 29 v7 regression)
- Zero open critical/minor bugs

## Known Issues
- emergentintegrations `get_checkout_status()` Pydantic validation error on Stripe status polling (mitigated via try/except graceful fallback; webhook handles actual payment confirmation)

## P1 / P2 Backlog
- P1: Per-turn diff view ("what changed") in code pane
- P1: File rollback / point-in-time history
- P2: Visual plan editor (drag-drop file list before approving)
- P2: Multi-agent orchestration (planner + coder + reviewer as separate LLM calls)
- P2: In-app notification bell (for invites, reviews, deploys)
- P3: Marketplace for community system prompts
- P3: Supabase/Firebase integration options
