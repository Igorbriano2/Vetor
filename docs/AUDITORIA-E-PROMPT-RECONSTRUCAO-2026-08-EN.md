# Vetor as a full agency — audit + reconstruction prompt (English translation)

**Generated:** 2026-08-26. Method: cross-referencing `docs/STATUS-REAL-ATUAL.md` (2026-08-19, real
production/test/SQL evidence) + the work done in this session since then (Rota Estratégica, Tráfego
V2, Missions Kanban, in-node Creative Canvas) + direct code inspection wherever the status doc had
gone stale + research on the 4 references the user attached. Nothing below was classified without
evidence.

*This is a translation of `docs/AUDITORIA-E-PROMPT-RECONSTRUCAO-2026-08.md`, the original
Portuguese-language document. The Portuguese version remains the source of truth for the project
(Vetor's own prompts and code comments stay in Portuguese by convention) — this English copy exists
for reading/sharing purposes.*

---

## Part 1 — Audit: the 8 requested roles vs. what exists today

The user's request defines Vetor as an agency with 8 fronts. For each: what is already **built and
proven**, what is **built but unproven/incomplete**, and what **doesn't exist at all**.

### 1. Define strategy for the company
**Status: strong, with one real gap just discovered.**
- ✅ Real `estrategia` agent (`apps/agentes/src/agents/prompts/estrategia.md`), fires `propor_missao`
  with hypothesis + measurable success criteria — proven live multiple times this session.
- ✅ **Rota Estratégica** (commits `cfd492f`/`8c48270`, this session): full executive report
  (diagnosis + market + real performance + day-by-day timeline + checklist + metrics), confirmed
  rendering in production with real Dog King Cambé data.
- ⚠️ Real gap: **no automated market/competitor research** — the market diagnosis in Rota
  Estratégica today comes from what the LLM already knows + what the client says in chat, never from
  a real web search. There is no web-search tool at all in the Tool Registry
  (`apps/agentes/src/tools/registry.ts`).

### 2. Research the company / local market / scan of prior content-traffic-social work
**Status: weak — this is the biggest real hole on the list.**
- ✅ Research *about the company itself*: exists via onboarding (`business_profiles`, brand kit,
  `business_context_snapshots`) — but it's the client who provides it; Vetor doesn't go find it on
  its own.
- ❌ **No real web-research tool exists** (not for local market, not for competitor scanning, not
  for auditing what the client already posted on social before Vetor). The "Growth" role the user
  mentioned maps to the existing `growth` agent (`prompts/growth.md`), but it also has no web-search
  tool — it only reasons over what's already in context.
- **This is real priority gap #1** — without it, "research local market" will never be true, just
  nice-sounding language in the prompt.

### 3. Growth marketing
**Status: agent exists, barely exercised.**
- ✅ `agente: "growth"` is one of the 7 valid values in `AGENTES_EXECUTORES_VALIDOS`
  (`vetorPlataforma.ts`), has its own prompt.
- ⚠️ Across this entire session, almost no real mission went through it — most live work was
  `estrategia`/`design`/`social-media`/`trafego`. Not a bug, just lack of real exercise.

### 4. Design — generate pieces, real product images, image bank with prompts
**Status: the most mature front of the system.**
- ✅ Design V1 complete and proven (Fabric.js, editable layers, own brand fonts, `DesignCritic` with
  12 + 5 structural criteria — **proven this session rejecting a real piece** for contrast/cropped
  text, correct behavior, not a fake pass).
- ✅ Design V2 (`ArtDirectionSpec`, 6 real layout styles) — implemented after the 08/19 status doc
  (was `NOT_STARTED` there; today lives in `apps/agentes/src/negocio/artDirection.ts`).
- ✅ Per-piece provider selector (Gemini "Nano Banana" / OpenAI GPT Image) already in the Creative
  Canvas.
- ✅ Image bank: `business_assets` is real (311 real images on the test client, categorized:
  operations-environment/campaign-references/visual-identity/products-services).
- ❌ **Real gap, exactly what the user asked for**: "image bank **with prompts** for creating it"
  (Gravyx feature) — today `business_assets` stores the file and metadata, but **doesn't store the
  prompt that generated each image**, nor lets you reuse/remix a saved prompt as a starting point
  for a new piece. This is a field + a screen, not a feature from scratch.

### 5. Video editor — cuts, captions, sound effects, reference-based editing
**Status: real foundation, shallow execution — the second-biggest gap.**
- ✅ Real upload, real proxy, real timeline with real `trimIn`/`trimOut`, proven versioning,
  reference-video analysis via Claude vision **already proven in production**
  (`ReferenceVideoProfile`).
- ⚠️ Migration `0024` already defines **18 stages** of a professional pipeline (captions, sound
  effects, color grading, etc. — the schema already anticipates all of it). **Only 2 of the 18
  actually run** (`proxy`, `timeline_draft`). Captions have ready schema and UI
  (`CaptionsAndAudioPanel.tsx`) but the `captions` stage **has never executed** (0 rows).
  Preview/final render: **never ran** (0 of 5 projects have output).
- 🔍 New reference (Vendus Content Studio, see Part 2): "ChatCut" solves exactly this — chat-command
  editing with AI doing cut/transcription/review automatically, leaving the manual editor as an
  advanced/optional path. This is the right pattern to follow: **finish the stages that already have
  schema, expose them as a chat command**, don't reinvent the pipeline.

### 6. Social media management — publish content
**Status: planning exists, real publishing doesn't.**
- ✅ Real editorial calendar (`CalendarioEditorial`), copy/caption generated by the `social-media`
  agent proven this session ("Dobradinha da Semana", 3 real caption variants).
- ❌ **Real automatic publishing doesn't exist** — Instagram shows as "not connected" everywhere in
  this session; the OAuth flow exists (`/api/connections/instagram/start`) but has never been
  exercised end-to-end. This is a credential blocker (needs the approved Meta app — same blocker as
  Part 2 of the plan in progress), not a code gap.

### 7. Traffic management
**Status: strong, just reinforced this session.**
- ✅ Real sync via the Meta Graph API (`metaAdsSync.ts`), real conversion funnel, creative leaderboard
  by metric (top 5 by CPC/CTR/Purchases), all committed and tested this session.
- ❌ Only blocker: `connections`/`campanhas_trafego` have 0 real rows — needs an approved Meta app +
  a real connected ad account (Part 2 of the plan in progress this session).

### 8. Metrics and campaign dashboard
**Status: fragmented — the data exists, there's no single place to see it all.**
- ✅ `VetorCockpit.tsx` has basic insights (voice analysis, simple analytics, active modules).
- ⚠️ Real traffic metrics live in `/planejamento?aba=trafego`, design/social metrics live scattered
  across `mission_steps`/`artifacts` with no aggregated view. There is no central "Analytics" —
  exactly the gap identified in Phase 4.4 of the plan already approved this session
  (`/Users/usuario1/.claude/plans/scalable-plotting-avalanche.md`).

### 9. Vetor — Jarvis-style main agent (speaks and understands audio)
**Status: infrastructure ready, never proven live with real voice.**
- ✅ STT (`OPENAI` provider) and TTS (`fish`, fallback `onyx`) configured with real credentials.
- ✅ The cockpit UI already simulates the Jarvis aesthetic (central orb, "voice analysis",
  "frequency response", "confidence") — but with placeholder data ("No audio right now") because it
  has never actually run.
- ❌ Custom wake word ("Say Vetor") **has never worked** — the 3 ONNX models were never trained; it's
  not missing code, it's an ML artifact that needs to be generated/purchased separately.
- **Medium-priority gap**: run 1 real voice→text→response→speech smoke test and persist the proof,
  exactly as `STATUS-REAL-ATUAL.md` already recommended on 08/19 and it still hasn't been done.

---

## Part 2 — What we learned from the attached references

### Gravyx (`app.gravyx.com.br`)
Already exhaustively audited in earlier rounds of this session (multiple docs in `docs/`:
`GRAVYX-UPGRADE-AUDIT.md` etc.) — not repeated here. The relevant structural patterns (per-node
panel, per-piece AI selector, traffic funnel/leaderboard, mission Kanban) have already been ported.

### Vendus Content Studio (course "loja de saas", lesson "Editando com Chatcut")
Concrete finding, straight from a real frame of the lesson video:
- **Navigation structure**: central hub with a glowing "V" orb (visually very close to Vetor's own
  cockpit core today) surrounded by 4 flow states (Raw → AI Editor → Review → Instagram) in a radial
  layout.
- **Product tagline**: *"You record. The rest enters the flow."* — transcription, editing, and
  review happen automatically; the manual editor (ChatCut) is only the advanced option, not the
  default path. This validates the Part 1, item 5 decision: finish the automatic pipeline before
  exposing manual editing as the primary path.
- **Real sidebar navigation of the product**: Overview, Content, Talk to the agent, AI Editor,
  Creative Matrix, Schedule, Insights, References, Live ChatCut — **note that "Talk to the agent" is
  its own screen, not mixed with the rest**, and "AI Editor"/"Live ChatCut" are two distinct screens
  (chat-driven editing vs. live visual editor).
- **Automatic queue with fixed publishing times** (e.g. 08:00, 12:30, 18:30, 21:00) and a small
  production Kanban (Inbox / Editing / Ready) — a UI pattern directly applicable to Vetor's
  Analytics/Social (Phases 4.3/4.4 of the plan in progress).
- **Methodological finding directly relevant to the "reconstruction prompt" request**: the lesson
  itself uses the pattern of **a single installation prompt** ("I want you to install and get Vendus
  running... The system's ZIP file is attached to this conversation") handed to a coding agent
  (Codex) — confirms this is a real market pattern for system "handoff", and is exactly the format
  of Part 6 of this document.

### YouTube — "How to EDIT VIDEOS with CLAUDE CODE (Cuts + Motion)" (Rafa Voss | IA na Prática)
Confirms there's real market demand and practice for using Claude Code as a video-editing engine
(cuts + motion graphics), reinforcing the direction of Part 1, item 5. I could not extract the
step-by-step content of the video (the player didn't expose a transcript/description through the
reading tool) — I recommend watching it manually before designing the prompts for the
`captions`/`effects` stage, since the video itself likely has the technical "how" (probably FFmpeg
orchestrated by Claude Code via Bash/MCP).

### Instagram @fabianocarvalhojr
Founder of **lasy.ai** — a natural-language app builder in Portuguese, stack confirmed via research:
**Claude (Anthropic) + OpenAI + Gemini** simultaneously, Supabase/Vercel/Cloudflare/GitHub infra, a
"self-correcting agent" that detects and fixes errors during generation. I didn't find a specific
GitHub repo linked in the public bio — the real, reusable finding here is the **confirmation that
multi-provider (not just one model) is the market standard** for this kind of product, which is
already Vetor's architecture (`ProviderRouter` exists, today only used for TTS — see Part 1, item 13
of `STATUS-REAL-ATUAL.md`: expanding the routing by cost/health to design/video too is real work,
not greenfield).

### GitHub `msitarzewski/agency-agents`
A library of **200+ agent personas** across 22+ divisions (Marketing alone has 35+ sub-agents:
Twitter, TikTok, Instagram, Reddit, SEO, email, podcast...). The file pattern for each agent
(Identity & Memory, Core Mission, Critical Rules, Technical Deliverables, Workflow Process, Success
Metrics) is **richer** than Vetor's current prompts in `apps/agentes/src/agents/prompts/*.md` (which
are already good but leaner). **Genuinely reusable**: use that 6-section structure as a checklist to
enrich Vetor's 7 existing prompts (never copy text — the repo's license wasn't verified, so it's
structure-only reference, same pattern already used in `apps/agentes/src/skills/README.md` for other
external skills).

---

## Part 3 — Recommended AIs/APIs (beyond what's already integrated)

Vetor already integrates: Claude (orchestration), Gemini "Nano Banana" + OpenAI GPT Image (design),
Higgsfield (video), OpenAI (STT) + Fish/Onyx (TTS), Meta Graph API (traffic). New recommendations,
each with the real reasoning:

| API/AI | For what in Vetor | Why this one and not another |
|---|---|---|
| **Nano Banana 2** (`gemini-3.1-flash-image`) | Upgrade of the current image provider | $0.02/image, ~4s, subject consistency across up to 14 reference images (solves item 4 — "real product images" stay consistent across pieces), grounding with real Google image search |
| **Tavily or Exa** (search API) | Solves Part 1 gap #1 (company/market/competitor research) | Search APIs designed for LLM consumption (already-clean results, no HTML parsing), cheaper and more predictable than opening a real browser per search |
| **ElevenLabs** | More natural TTS for "Vetor speaks" (item 9) | Today it's Fish/Onyx — ElevenLabs has better latency and naturalness for a voice assistant the client will hear frequently; compare real cost before switching |
| **AssemblyAI or Deepgram** | Real transcription for the Videomaker `captions` stage (item 5) | Word-level timestamped transcription is what's missing to populate `CaptionTrack`/`CaptionCue`, which already exists in the schema but never runs |
| **Runway Gen-4 / Kling 2** | Second option for video generation/editing besides Higgsfield | Same logic as the `ProviderRouter` already used for design — never depend on a single paid provider for a critical step |
| **Claude Agent Skills** (via API, not CLI) | Package the workflows that are currently just prompt text (e.g. building the Rota Estratégica) as a formal, testable, reducible skill | Vetor **already has its own skills system** (`apps/agentes/src/skills/`, 34 already imported and active) — the action here isn't "adopt Skills", it's **audit + enrich what already exists**, see Part 4 |

---

## Part 4 — Claude skills already in use inside Vetor (not greenfield)

**Critical finding to avoid duplicating work**: Vetor already has its own real skill system, with
audited license provenance, at `apps/agentes/src/skills/`:

- 34 skills imported from real MIT/Apache-2.0 repos (`coreyhaines31/marketingskills`,
  `samuraigpt/generative-media-skills`, `FireRedTeam/FireRed-OpenStoryline`, `KyaniteLabs/kinocut`,
  `irinabuht12-oss/google-meta-ads-ga4-mcp`, among others — full list in
  `apps/agentes/src/skills/README.md`), covering marketing-psychology, ads, offers, growth-loops,
  A/B testing, diagnosis, format-adaptation, transcript-and-highlights, captions, brand-compliance,
  read-only account audit, social-performance, quality-gate, campaign analysis, content strategy,
  creative brief, influencer marketing, cross-platform reporting, customer research, marketing plan,
  content calendar, brand onboarding, image direction, budget recommendation, attribution check,
  media ingestion — **35 real folders under `skills/skills/`**.
- **Confirmed wired in production**: `selecionarSkills`/`carregarSkillsSelecionadas` are called from
  inside `specialistRunner.ts` — this is not dead inventory, the specialist agents genuinely select
  and load these skills by matching triggers against the step's text.
- Real progressive loading (small manifest always loaded, full `SKILL.md` only when selected,
  `references/` only on demand) — the architecture is already correct, doesn't need to be redone.

**What's actually missing** (not "add skills", it's closing gaps in the existing system):
1. The skill-manifest schema has no `cost`/`timeout`/`idempotencyKey` (`STATUS-REAL-ATUAL.md`, item
   14).
2. No new skill has been added since the initial import — the Part 1 gaps (market research, video
   captions) are natural candidates to become new skills, following the same process in
   `apps/agentes/src/skills/README.md` (check license → adapt vocabulary → manifest + SKILL.md +
   entry in `source-manifest.json` → `permissions.ts` validates before it becomes visible).
3. No skill today covers "local market research" or "chat-command video editing" — Part 1's two
   biggest gaps have a natural shape as new skills rather than loose code.

---

## Part 5 — UI/UX: where we are vs. Spatial UI + Liquid Glass

### Where we are today (real, `apps/painel/src/app/globals.css`)
- Single dark theme (`--color-petroleo: #050a12`, `oklch` surfaces), Inter + JetBrains Mono
  typography (Inter is the most commonly cited "too-generic" font in AI-design audits — a candidate
  for replacement).
- `@utility panel`: `backdrop-filter: blur(10px)` + subtle gradient + `color-mix` border — this is
  **basic** glassmorphism (blur only), no refraction and no animated edge highlight.
- `@utility vetor-aurora`: an animated `conic-gradient` with 60px blur — decorative, no real depth
  (no z-stacking, no cast shadow, everything is flat 2D).
- No use of `perspective`/`transform: rotateX/rotateY/translateZ`, no mouse parallax, no shadow that
  varies with simulated "height" — i.e., **zero Spatial UI today**, even though the visual language
  is already "tech/dark" and on the right track.

### How to reach Liquid Glass (refraction + edge glow) — 100% CSS, no WebGL
- **True refraction** requires a filter that distorts what's behind the glass — plain CSS has no
  true refraction, but the effect is convincingly simulable with: `backdrop-filter: blur(Npx)
  saturate(150%)` (already used) + a `::before` pseudo-element with `mix-blend-mode: overlay` and a
  subtle radial gradient that shifts with mouse position (gives the sense of "light passing through
  the glass").
- **Edge glow that "runs along the corner"**: an animated `border-image`, or an `::after` with a
  spinning `background: conic-gradient(...)` (`animation: spin`) clipped to just the border via
  `mask` (`mask: linear-gradient(#000 0 0) padding-box, linear-gradient(#000 0 0); mask-composite:
  xor`) — a real, lightweight technique, no new dependency.
- This is a direct evolution of the already-existing `@utility panel`, not a rewrite.

### How to reach Spatial UI (real depth, floating windows)
- **Stacking with real depth**: each panel/node gets `transform: perspective(1200px)
  rotateY(Ndeg) translateZ(Mpx)`, varying per z-index, with `box-shadow` scaling with `translateZ`
  (the "closer to the camera", the larger/softer the shadow) — gives the Vision Pro effect without
  WebGL.
- **Subtle mouse parallax**: a `mousemove` listener on the container applies small
  `rotateX/rotateY` (±2-4deg) proportional to cursor position — a similar pattern already implicitly
  exists in `card-lift` (hover lifts with `translateY`), a natural extension, not a new concept for
  the codebase.
- **Where to apply it first**: the Creative Canvas (React Flow, already has overlapping nodes with
  z-index) is the natural candidate for real Spatial UI — it already has the "multiple windows in the
  same space" structure, it just lacks the real visual depth.
- **Performance cost**: well-applied `transform`/`filter` (without triggering layout reflow) are
  cheap; the `@media (prefers-reduced-motion: reduce)` rule already exists in `globals.css` and
  should cover this too.

---

## Part 6 — Reconstruction prompt (to run as an execution directive)

> This block is the requested "execution prompt." It assumes the Vetor **already existing in this
> repository** as the base — never greenfield, always reinforcing what's already built and proven
> (Parts 1 and 4). It must be run in sequential, verified phases, not in parallel (a lesson already
> learned this session: a push to `apps/agentes` in the middle of a live test brought down the
> production mission worker).

```
You are rebuilding VETOR, an autonomous AI-operated marketing agency, inside the already-existing
repository (do not create a new project). Before writing any code, read
docs/AUDITORIA-E-PROMPT-RECONSTRUCAO-2026-08.md (the complete, up-to-date audit) and
docs/STATUS-REAL-ATUAL.md (real state by evidence) — never assume a feature doesn't exist without
checking both those sources AND the code first.

MISSION
Vetor has 8 fronts: Strategy, Research (company/market/competitors/social-history scan), Growth,
Design (pieces + reusable-prompt image bank), Video Editor (cuts, captions, sound effects,
reference-based editing), Social Media Management (scheduling and real publishing), Traffic
Management, Metrics Dashboard — coordinated by the Vetor agent (Jarvis-style, capable of real
voice). Reinforce each front in real priority order (not the order they were requested in): gaps
that block everything else come first.

EXECUTION ORDER (each phase ends with a live verification before the next; never run two phases
that touch apps/agentes at the same time — always check whether a test mission is in progress
before pushing)

PHASE A — Real research (closes the biggest gap, Part 1 item 2)
- Add one new tool to the Tool Registry (apps/agentes/src/tools/registry.ts) that calls a search API
  (Tavily or Exa — compare price/quality before deciding), low risk (read-only).
- New skill under apps/agentes/src/skills/skills/market-research/ following the skill registry's
  real process (README.md: license → adaptation → manifest → source-manifest.json →
  permissions.ts) to guide the growth/strategy agent to use that tool for local market research and
  competitor scanning.
- Verification: ask Vetor, in chat, for a Rota Estratégica for a real client and confirm the "Market
  and competition" section now cites a real source (not just what the LLM already knew).

PHASE B — Reusable-prompt image bank (Part 1 item 4, Gravyx feature)
- Additive migration on business_assets (or a new business_asset_prompts table) storing the real
  prompt used for each generated image, linked to the asset.
- A screen inside Design (already-existing workspace) to list/reuse/remix saved prompts.
- Verification: generate 1 new piece reusing a prompt saved from an earlier piece, confirm the
  result is visibly derived from that same base prompt.

PHASE C — Video editor: finish the stages that already have schema (Part 1 item 5)
- Actually run the "captions" stage (schema and UI already ready) using a real transcription
  provider (AssemblyAI/Deepgram — Part 3) — populate CaptionTrack/CaptionCue with real timestamps.
- Run the preview/final-render stage until at least 1 real video has a populated
  output_storage_path (today 0 of 5 projects have one).
- New skill/chat command "edit this video: cut the silences, add captions, use effect X" in the
  spirit of ChatCut (Part 2) — the manual editor keeps existing, it becomes the advanced mode, not
  the default path.
- Verification: 1 real video going through upload → proxy → timeline → captions → final render,
  with SQL proof of each stage populated.

PHASE D — Central Analytics dashboard (Part 1 item 8, already Phase 4.4 of the plan in progress)
- Consolidate traffic + design + social metrics into a single /analitico workspace.
- Populate custo_estimado_centavos on agent_runs (always NULL today) — cheap, closes an
  observability gap.

PHASE E — Real voice (Part 1 item 9)
- 1 real voice→text→response→speech smoke test in production, log persisted as proof.
- Custom wake word stays recorded as blocked by an ML artifact (not code) until a separate decision
  on training/buying the ONNX models.

PHASE F — Liquid Glass + Spatial UI/UX (Part 5)
- Evolve the @utility panel (globals.css) with the animated-edge technique (Part 5) — apply first
  to one isolated component, visually confirm in both themes before spreading it.
- Apply real depth (perspective/translateZ/parallax) first to the Creative Canvas (already has
  overlapping nodes, natural candidate), measure performance before expanding to the rest of the
  panel.
- Replace Inter with a self-hosted font with more character (e.g. the geist package, OFL, already
  decided in Phase 4.5 of the plan in progress this session) — don't decide on a new font outside
  that step.

PHASE G — Skills: close the gaps in the existing system (Part 4)
- Add cost/timeout/idempotencyKey to the skill-manifest schema.
- The new skills from Phases A and C already count as the real expansion requested — don't add a
  skill just to add one, only where it closes a gap recognized in this audit.

RULES THAT DON'T CHANGE (already in force in the project, reaffirmed here)
- Never copy branding/palette/logo from any external reference (Gravyx, Vendus, etc.) — structure/
  interaction only, always within Vetor's own design tokens.
- Never fabricate data/metrics — an empty state or "not connected" is always preferable to an
  invented number (DesignCritic and Rota Estratégica already follow this rule, keep it in
  everything new).
- Never install an entire external skill catalog — only the specific skill that closes a real gap,
  with checked license, through the process already documented in
  apps/agentes/src/skills/README.md.
- git status/diff before every commit; never push to apps/agentes while a test mission is in
  progress; local tests + build before every push; live verification before the next phase.
```

---

## What this document is NOT

This document is the requested audit + execution prompt — **it is not authorization for me to start
implementing the 7 phases (A–G) immediately**. Given this session's history (parallel execution
without a checkpoint already caused a real incident today), the recommendation is: review this
document, decide the real order/priority among phases A–G (or confirm the suggested order), and then
I start with Phase A in isolation, with live verification before any following phase.
