# AI Interview Prep Kit — Trao Full-Stack Assessment

## Live deployment

- **App**: https://trao-ai-interview-prep-kit-frontend.vercel.app
- **API**: https://trao-ai-interview-prep-kit-backend.onrender.com (health check: `/health`)
- **Repo**: https://github.com/AnkitSoni03/trao-ai-interview-prep-kit

The backend is on Render's free tier, which spins down after inactivity — the first request
after a quiet period can take ~50s to wake it up. Everything after that is normal speed.

## Overview

Turns a pasted job description + a company URL + a days-until-interview number into a
structured interview prep kit: a company brief, a role/requirement breakdown, a categorised
question bank, flashcards, and a day-by-day study schedule — built through a multi-step
research-and-generation pipeline rather than a single prompt, then reshaped by the user in a
builder UI and rehearsed in a practice mode.

## Tech stack

| Layer      | Choice                                   |
| ---------- | ----------------------------------------- |
| Frontend   | Next.js (App Router) + Tailwind CSS, TypeScript — deployed on Vercel |
| Backend    | Node.js + Express, TypeScript (ESM) — deployed on Render (free web service) |
| Database   | MongoDB (Atlas free M0 cluster) via Mongoose |
| LLM        | Google Gemini, model `gemini-flash-lite-latest`, free tier via [aistudio.google.com](https://aistudio.google.com) |
| Search     | Tavily (free tier) for public interview-discussion search |
| Crawling   | `fetch` + `cheerio`, own link-ranking crawler (no fixed path list), `robots-parser` for robots.txt |
| Tests      | Vitest |

This matches the brief's preferred stack exactly, so no substitution needs justifying.

**Why `gemini-flash-lite-latest` and not a pinned version:** during development, both
`gemini-2.0-flash` and `gemini-2.5-flash` returned 404 ("no longer available to new users")
for a freshly created API key, and the newest pinned model (`gemini-3.6-flash`) hit its
**20-requests/day** free-tier cap after a couple of test runs. The `-latest` alias for the
lite model has a much higher free daily quota and Google repoints it at whatever
currently-supported model backs it, which avoids both failure modes for a project that needs
to keep working after submission.

## Repository layout

This is an npm-workspaces monorepo with two packages and one shared root:

```
/frontend   Next.js app (Tailwind, App Router) — auth pages, builder, practice mode
/backend    Express API + the research/generation pipeline + the batch entry point
/examples   Sample batch input (cases.sample.json) for local testing of `npm run evaluate`
```

`backend/src/pipeline/` is the core library. Both the Express API (`services/kitService.ts`)
and the batch script (`scripts/evaluate.ts`) call `pipeline/index.ts#runPipeline` directly —
the same code path, per Section 9 of the brief.

`package-lock.json` is deliberately **not** committed (see `.gitignore`): Tailwind v4's
`lightningcss` ships platform-specific native binaries as optional dependencies, and a lockfile
generated on one OS only resolves that OS's binary — which broke the Vercel (Linux) build when
built from a lockfile generated on Windows. Each environment runs a plain `npm install` and
resolves its own platform's binaries correctly.

## Setup

### Prerequisites

- Node.js 20+
- A MongoDB Atlas connection string (free M0 cluster)
- A Gemini API key (free, from aistudio.google.com)
- A Tavily API key (free tier, from tavily.com) — optional; the pipeline degrades gracefully
  (reports "no discussion found") without one, it just won't actually search anything

### Install

```bash
npm install        # installs both workspaces from the repo root
```

### Configure environment variables

```bash
cp backend/.env.example backend/.env
# then fill in MONGODB_URI, JWT_SECRET, GEMINI_API_KEY, TAVILY_API_KEY
cp frontend/.env.example frontend/.env.local
```

See `backend/.env.example` for what every backend variable is for. The frontend needs exactly
one: `NEXT_PUBLIC_API_URL`, the backend's base URL.

### Run locally

```bash
npm run dev:backend    # http://localhost:4000
npm run dev:frontend   # http://localhost:3000
```

### Run the batch entry point (Section 9)

```bash
npm run evaluate -- --input examples/cases.sample.json --output examples/kits.output.json
```

This only needs `GEMINI_API_KEY` (and optionally `TAVILY_API_KEY`) set — it does not touch
MongoDB or auth. It runs `backend/src/pipeline/index.ts` directly against each case and writes
one JSON file in the Appendix B shape, continuing past any case that fails. Verified against
three real cases (GitLab, PostHog, and a deliberately thin example.com case) completing well
under the 15-minute/5-case budget.

### Tests

```bash
npm test    # runs backend/src/tests/* via Vitest
```

### Deploying your own copy

- **Backend (Render)**: New Web Service → connect the repo → leave Root Directory blank →
  Build Command `npm install && npm run build --workspace=backend` → Start Command
  `npm run start --workspace=backend` → Free instance type → add the same env vars as
  `backend/.env.example`, plus `NODE_ENV=production` and `CORS_ORIGIN` set to your frontend's
  URL. (Render also needs `.npmrc`'s `include=dev` at the repo root — without it, npm omits
  devDependencies whenever `NODE_ENV=production` is set during install, which breaks the
  TypeScript build since `typescript`/`@types/node` are devDependencies.)
- **Frontend (Vercel)**: New Project → import the repo → set Root Directory to `frontend` →
  framework preset **Next.js** (not the auto-suggested "Services" multi-service preset, which
  requires a `vercel.json` this repo doesn't have) → add `NEXT_PUBLIC_API_URL` (as a **Config**
  variable, not Secret, since `NEXT_PUBLIC_*` values are exposed to the browser anyway) pointing
  at your deployed backend URL.

## Architecture

```
Browser (Next.js)
  │  fetch(credentials: "include")
  ▼
Express API  ──requireAuth──▶  Controllers  ──▶  Services (kitService)
                                                        │
                                                        ▼
                                        pipeline/index.ts#runPipeline
                              ┌──────────────┬──────────┴───────────┬──────────────┐
                              ▼              ▼                      ▼              ▼
                    extractRequirements  crawlCompanySite  searchInterviewDiscussion  ...
                        (Gemini)          (fetch+cheerio)         (Tavily)
                                                        │
                                                        ▼
                                        generateQuestionsForCategory (Gemini, per category)
                                                        │
                                                        ▼
                                checkCoverage → gap-fill loop → buildSchedule (deterministic)
                                                        │
                                                        ▼
                                          validateKit → MongoDB (Mongoose)
```

A kit-creation request returns immediately (202) with a `pending` record; generation runs in
the background (`processKitInBackground` in `kitService.ts`) while the frontend polls
`GET /api/kits/:id` every 2-3s and renders a step-by-step progress view. `npm run evaluate`
calls the exact same `runPipeline` function synchronously per case, so the web app and the
batch script can never drift apart.

### Pipeline steps (`backend/src/pipeline/`)

| Step | File | LLM? | Notes |
| --- | --- | --- | --- |
| Extract requirements from the JD | `extractRequirements.ts` | Yes | No retrieval needed — the JD is pasted text |
| Fetch + clean one page | `fetchPage.ts` | No | SSRF-guarded, content-type/size limited |
| Crawl the company site | `crawlCompanySite.ts` | No | Ranks links by hiring/about keyword heuristics, no fixed path list, respects `robots.txt`. Verified live: finds PostHog's actual `/handbook/people/hiring-process` page from the homepage alone |
| Search public interview discussion | `searchInterviewDiscussion.ts` | No (Tavily) | Best-effort, never fatal |
| Synthesise the company brief | `synthesizeCompanyBrief.ts` | Yes | Returns an honest "couldn't find much" brief rather than inventing one when crawling found nothing |
| Generate questions for a category | `generateQuestions.ts` | Yes | Called once per requirement-kind → category (technical/behavioural/company-fit/system-design), never with one shared prompt for all of them; categories run **concurrently** (see Performance below) |
| Derive flashcards | `generateFlashcards.ts` | No | One flashcard per requirement, built from its covering question — a deliberate choice to avoid a second LLM round-trip; see "Design decisions" below |
| Check coverage | `checkCoverage.ts` | **No — deterministic, by design** | Set comparison of `requirement_ids` referenced by questions vs. every requirement id |
| Build the schedule | `buildSchedule.ts` | **No — deterministic, by design** | Arithmetic allocation, see below |
| Validate kit structure | `validateKit.ts` | No | Zod schema + cross-reference checks (every `question_ids`/`requirement_ids` entry must resolve) |

The orchestrator (`pipeline/index.ts`) sequences these and runs the coverage-gap-fill loop
(Section 4): after the first generation pass, any requirement with no covering question is
re-submitted for generation (must-have gaps first), coverage is re-checked, and this repeats
for up to **2 extra passes** (3 total). Chosen because: two retries catch essentially all
gaps in practice (a single miss is usually a transient/partial LLM response, not a systematic
one), and an unbounded loop risks burning the free-tier rate limit on a pathological case.
Any requirement still uncovered after that is reported honestly in `coverage.uncovered_requirement_ids`
rather than looped on forever.

### Performance / free-tier rate limits

A single Gemini call was measured at 30-100s+ end-to-end on the network this was built on.
Running every LLM step one-after-another would risk the batch entry point's 15-minute/5-case
budget, so `pipeline/index.ts` runs independent steps concurrently: the company-brief synthesis
and all category question-generation calls fire together via `Promise.all` (question generation
uses a raw excerpt of the crawled pages as context so it doesn't have to wait on the polished
brief), and the coverage-gap-fill passes also generate all missing categories concurrently.
`pipeline/llm/rateLimiter.ts` still caps concurrency (3 in flight) and requests/minute (12) with
exponential backoff on 429/5xx, so this stays within free-tier limits rather than bursting past
them.

### How the schedule is allocated

Deterministic, in `buildSchedule.ts`, no model involved:

1. Sort all generated questions by (a) whether they cover a `must` requirement over a `nice`
   one, then (b) difficulty descending.
2. Split that sorted list into exactly `days` contiguous chunks — earlier chunks get one extra
   item when the count doesn't divide evenly, so the hardest/highest-priority material lands
   in the earliest days, not "the night before" (Section 8).
3. Each day's `minutes` is the sum of a fixed per-difficulty estimate (15/25/40 min for
   difficulty 1/2/3). `days_available` always equals the requested day count exactly, including
   the 1-day and 60-day edge cases (a 60-day request with few questions produces mostly empty
   "buffer / light review" days rather than inventing filler).

### Builder state model (generated / edited / pinned)

Every `Question` and `Flashcard` carries an `origin: "generated" | "edited" | "user-added"`
field and an optional `pinned: boolean` (additive fields beyond Appendix A, which explicitly
allows extension). Editing a field in the frontend flips a still-`"generated"` item to
`"edited"` the moment it changes (`lib/kitEdits.ts#markEdited` on the frontend, mirrored by the
same rule server-side); a brand-new item added by hand starts as `"user-added"`.

Regenerating a question category (`regenerateSection` in `kitService.ts`) only replaces
questions in that category whose `origin` is still `"generated"` and which are not `pinned`;
anything the user edited, added by hand, or pinned survives untouched, and the new questions
are appended alongside them. Regenerating `schedule` or `company_brief` replaces that section
wholesale, since neither has meaningful per-item edit tracking of its own.

**Live-verified**: edited a technical question's prompt in the builder, regenerated the
technical category, and confirmed the edited question kept its edited text (`origin: "edited"`)
while the other two technical questions were replaced with newly generated content.

**Known trade-off:** regenerating a question category also rebuilds the schedule immediately
after (since schedule composition depends on the live question set), and does not retroactively
update flashcards already derived from a question that got regenerated. Both are called out
here rather than hidden. The frontend's coverage banner also recomputes coverage live from the
current question set (`frontend/src/lib/checkCoverage.ts`) rather than trusting the
server-persisted `coverage.uncovered_requirement_ids`, so it can't go stale after the user
deletes or edits a question client-side.

### Saving edits without round-tripping every keystroke

Text-field edits (prompt, answer outline, brief text, flashcard front/back) update local React
state immediately for a responsive feel, then persist via a 700ms debounce
(`frontend/src/lib/useDebouncedCallback.ts`) so typing doesn't fire a network request per
character. Discrete actions (delete, reorder, pin, add, move to another category, regenerate)
update state and persist immediately, since each is already a single atomic user action.

## Practice mode and the creative feature

Flashcards are presented one at a time; revealing the answer surfaces a Low/Medium/High
confidence rating, stored per-flashcard (`kit.practice`, another additive Appendix A extension)
with a timestamp. **Ordering**: a confidence-weighted sort — flashcards with no rating yet sort
first (treated as needing the most attention), then ascending by their last recorded confidence.
This was chosen over a full spaced-repetition scheduler (SM-2 etc.) because the brief's practice
sessions are short-lived (days, not weeks), so interval-based scheduling has little room to do
anything a simple "lowest confidence first" rule doesn't already achieve, for much less
complexity.

**Creative feature — Weak Spots panel** (`WeakSpots` in `frontend/src/app/kits/[id]/practice/page.tsx`):
aggregates practice confidence per *requirement* (not per card), ranking requirements by average
confidence across their covering flashcards, so the user sees which underlying skills need work
rather than just which cards. This answers the real question a candidate has with limited time
left — "what should I actually spend the next hour on?" — computed client-side from data the
practice mode already collects, no extra backend endpoint needed.

## Retrieval approach and sources

- Company research: the company's own site, crawled from its homepage, following same-site
  links only, ranked by a hiring/about keyword heuristic (see `crawlCompanySite.ts`) rather
  than a fixed path list — depth-limited to 2 hops and `CRAWL_MAX_PAGES_PER_SITE` pages.
  `robots.txt` is checked before every page beyond the homepage.
- Public interview-discussion: Tavily search API, query `"<company> interview process
  questions experience"`, best-effort.
- The job description itself is never fetched from a job board — it's pasted text, per the
  brief.

## Security notes

- `utils/urlSafety.ts` resolves and rejects loopback/private/link-local addresses before any
  fetch, both for the initial company URL and every link discovered while crawling (checked
  again after redirects). Disabled only via `ALLOW_PRIVATE_NETWORK_FETCH=true`, meant for
  pointing `npm run evaluate` at a locally-served fixture site as the brief allows.
- `fetchPage.ts` restricts to `text/html`/`application/xhtml+xml` and caps response size at 2MB.
- `utils/promptSafety.ts` wraps every piece of untrusted text (the pasted JD, every crawled
  page, every search snippet) in an explicit "this is data, not instructions" delimiter before
  it reaches a prompt.
- Session cookie is `httpOnly`, and `SameSite=None; Secure` in production (Vercel and Render are
  different domains, so the cookie is cross-site from the browser's perspective) or
  `SameSite=Lax` in local dev (same-site on localhost, doesn't need HTTPS).

## Edge cases (Section 10) — how each is handled

| Case | Handling |
| --- | --- |
| Invalid/404/timeout company URL | `crawlCompanySite` returns `pages: []` with the failure recorded; pipeline continues, `synthesizeCompanyBrief` returns an honest "couldn't retrieve anything" brief. Not a batch failure. |
| No discoverable hiring/about page | Same as above — crawl just doesn't surface one; `hiringPageFound: false`, kit still produced. |
| Two-line JD stub | `extractRequirements` is instructed not to invent requirements; a thin JD yields a short/empty requirement list rather than fabricated ones. |
| No public interview discussion found | `searchInterviewDiscussion` returns `{ found: false, note: "..." }`, non-fatal. |
| Model returns invalid JSON / incomplete kit | `geminiClient.generateJson` validates the parsed JSON against a zod schema *inside* the retry loop (not just JSON.parse) and retries on either failure; a known "lite model returns a bare array instead of the requested `{key: [...]}` object" case is auto-coerced rather than spending a retry. `validateKit` runs before persisting/writing a batch "ok" result either way, and a kit that fails validation is reported as a `failed` batch case rather than silently saved broken. |
| Rate limit / transient LLM failure | `pipeline/llm/rateLimiter.ts` caps concurrency and requests/minute, and retries with exponential backoff on 429/5xx. |
| Same description + company submitted twice | `kitService.createKit` hashes `(jd, company_url)` per user and returns the existing kit instead of re-running the pipeline. |
| 1-day / 60-day schedule request | Handled by `buildSchedule`'s chunking — see tests in `backend/src/tests/buildSchedule.test.ts`. |

## Key design decisions and known limitations

- **Flashcards are derived, not separately generated** — one per requirement, from its first
  covering question — to save an LLM round-trip and keep the deck to "one core fact per
  requirement" instead of duplicating the full question bank. Trade-off: a requirement covered
  by multiple questions only gets one flashcard from the first of them.
- **`MONGODB_URI`/`JWT_SECRET` are validated at server startup, not at import time** —
  specifically so `npm run evaluate` never requires a database or auth setup, per Section 9's
  "needs no setup beyond your documented install step".
- **Requirements are not directly editable in the builder** — only questions, answer outlines,
  flashcards, and the brief are (per Section 6's explicit list). Requirements stay as the
  read-only reference coverage is computed against; editing them live would need a live
  coverage recompute story of its own and wasn't worth the added complexity for this scope.
- **`npm ci` won't work** for either workspace since `package-lock.json` isn't committed (see
  "Repository layout" above for why) — use `npm install`.
- **Cold starts**: Render's free tier spins the backend down after inactivity; the first request
  after a quiet spell takes up to ~50s. Not something a free tier can avoid.

## What's built

- [x] Repo scaffold (npm workspaces, Next.js frontend, Express backend)
- [x] Auth (register/login/logout, JWT-in-httpOnly-cookie sessions, ownership-scoped kits)
- [x] Crawler (link ranking, robots.txt, SSRF guard, rate limiting) — live-verified against real sites
- [x] Full pipeline wiring: extract → crawl → search → brief → generate-by-category (concurrent)
      → coverage loop → schedule → validate
- [x] Batch entry point (`npm run evaluate`)
- [x] Tests for coverage checking, schedule allocation, structure validation (17 tests)
- [x] Frontend: kit creation form (single + bulk upload), progress view, full builder, practice mode
- [x] Deployment (Vercel + Render + MongoDB Atlas) — live and verified end-to-end
- [x] Optional creative feature (Weak Spots panel)
- [ ] Walkthrough video
