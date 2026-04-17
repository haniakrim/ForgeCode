# FORGE — Product Requirements Document

## Original Problem Statement
"i want to build a full-stack app developer like you SAAS"

## Product Vision
FORGE is an AI full-stack app developer SaaS — a neo-brutalist, developer-focused competitor to Emergent / Lovable / v0 / Bolt. Users describe an app idea in natural language, Claude Sonnet 4.5 plans + writes code, a split-pane IDE shows generated files with a live HTML/React preview.

## User Personas
1. **Indie Hacker** — wants to ship MVPs over a weekend without boilerplate.
2. **Freelance Engineer** — uses FORGE to accelerate client project scaffolding.
3. **Product Manager** — prototypes internal tools without waiting for engineering.
4. **Senior Engineer** — generates readable code they can own and extend.

## Core Requirements (static)
- Google OAuth via Emergent Auth (httpOnly cookie + Bearer fallback)
- AI code generation via Claude Sonnet 4.5 (emergentintegrations)
- Project CRUD with multi-turn chat history
- Split-view workspace: chat ↔ code/preview IDE
- Credit system (100 free credits / user, −1 per message)
- Template gallery (6 prebuilt prompts)
- Neo-brutalist aesthetic: Cabinet Grotesk + JetBrains Mono, 2px black borders, hard offset shadows, `#FF3311` accent

## Architecture
**Backend (FastAPI + MongoDB)** — `/app/backend/server.py`
- Models: `User`, `Project`, `Message`, `Session`
- Endpoints (all `/api`):
  - `POST /auth/session` (X-Session-ID → cookie)
  - `GET /auth/me`, `POST /auth/logout`
  - `GET/POST /projects`, `GET/DELETE /projects/{id}`
  - `POST /projects/{id}/chat` (Claude Sonnet 4.5)
  - `GET /templates`
- LLM: `emergentintegrations.llm.chat.LlmChat` + model `anthropic/claude-sonnet-4-5-20250929`

**Frontend (React 19 + Tailwind + shadcn)** — `/app/frontend/src`
- Pages: `Landing`, `Dashboard`, `Project`, `Templates`, `Settings`, `AuthCallback`
- Global `AuthContext` with `/auth/me` gate + session_id hash detection
- Live preview: iframe with Babel standalone + Tailwind CDN renders AI-generated JSX / HTML

## Implemented (Feb 17, 2026)
- ✅ Full landing page (hero, marquee, features, how-it-works, pricing, manifesto, testimonials, CTA, footer)
- ✅ Emergent Google Auth end-to-end
- ✅ Dashboard with quick-prompt + project cards + profile panel
- ✅ Split-pane workspace with file tree, code tab, live preview tab
- ✅ Template gallery with 6 starters (SaaS dashboard, chatbot, CRM, blog CMS, e-commerce, kanban)
- ✅ Settings page with credits display + logout
- ✅ Claude Sonnet 4.5 integration via emergentintegrations
- ✅ Credit system (decrements atomically)
- ✅ 13/13 backend API tests passing, all frontend flows verified

## Implemented (Feb 17, 2026 — v3: SSE + Export + Stripe + Mobile Contrast)
- ✅ `POST /api/projects/{id}/chat/stream` — SSE endpoint streams Claude's reply token-by-token (events: `user` / `token` / `done`). Persists both messages, deducts 1 credit.
- ✅ `GET /api/projects/{id}/export` — bundles all assistant code fences into a ZIP (with README), preserves file paths from `:path` annotations.
- ✅ Stripe checkout (test key) — 3 tiers (Atelier free, Studio $29, Maison $99) + 2 top-up packs ($10/500 credits, $29/2000 credits). Endpoints: `/payments/{packages,checkout,status/{sid}}` + `/webhook/stripe`. All transactions recorded in `payment_transactions` collection, credits applied idempotently.
- ✅ `/billing` and `/billing/success` frontend pages with polling + timeout handling.
- ✅ Mobile contrast pass: bumped `--text-2`, `--text-3`, `--border` in `@media (max-width: 768px)`, chip borders strengthened, serif headlines clamped for small viewports.
- ✅ Graceful fallback when `emergentintegrations.stripe.get_checkout_status` hits a library pydantic bug — endpoint returns `pending` instead of 502, webhook keeps credit assignment working.
- ✅ 17/17 v2 backend tests pass.

## P0 Backlog (next)
- Real-time streaming responses (SSE) instead of polled replies
- Stripe subscription tiers (Builder $29, Studio $99)
- GitHub export: download project as ZIP / push to repo
- Project forking & version history

## P1 Backlog
- Multi-file diff / patch application view
- Shared projects + team workspaces
- Tool-use: backend actually executes generated code in an ephemeral sandbox (Docker)
- Voice-to-code input (Whisper)

## P2 Backlog
- Marketplace for community templates
- Custom domain deployment
- Analytics dashboard (build times, credit burn)

## Known Constraints
- Preview iframe only renders single-file React / HTML; multi-file apps cannot fully execute in-browser (would need server-side sandbox).
- Credits are virtual until Stripe is wired up.
