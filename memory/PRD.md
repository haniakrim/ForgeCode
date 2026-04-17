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

## Redesigned (Feb 17, 2026 — v2)
- ✅ Full visual overhaul to "Noir Architectural / Editorial" aesthetic (user rejected previous neo-brutalist v1)
- ✅ Deep `#050505` obsidian background with warm radial glow + film grain
- ✅ Typography: Playfair Display (serif, italic accents) + Outfit (body) + IBM Plex Mono (code)
- ✅ Burnt orange `#F25C05` brand + emerald `#00F298` + gold `#E5B05C` accents
- ✅ Glassmorphism panels (`backdrop-blur-2xl` + inner highlight + subtle border)
- ✅ Pill buttons with warm glow shadow, staggered fade-up entrance motion
- ✅ All 6 pages (Landing, Dashboard, Project, Templates, Settings, AuthCallback) ported to new system

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
