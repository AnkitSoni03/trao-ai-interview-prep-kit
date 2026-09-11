# AI Interview Prep Kit — Trao Full-Stack Assessment

> Status: work in progress. This README is kept up to date as the project develops; sections
> marked **TODO** are not finished yet.

## Overview

Turns a pasted job description + a company URL + a days-until-interview number into a
structured interview prep kit: a company brief, a role/requirement breakdown, a categorised
question bank, flashcards, and a day-by-day study schedule — built through a multi-step
research-and-generation pipeline rather than a single prompt, then reshaped by the user in a
builder UI and rehearsed in a practice mode.

## Tech stack

| Layer      | Choice                                   |
| ---------- | ----------------------------------------- |
| Frontend   | Next.js (App Router) + Tailwind CSS, TypeScript |
| Backend    | Node.js + Express, TypeScript (ESM)        |
| Database   | MongoDB (Atlas free tier) via Mongoose     |
| LLM        | Google Gemini (`gemini-2.0-flash`), free tier via [aistudio.google.com](https://aistudio.google.com) |
| Search     | Tavily (free tier) for public interview-discussion search |
| Crawling   | `fetch` + `cheerio`, own link-ranking crawler (no fixed path list), `robots-parser` for robots.txt |
| Tests      | Vitest |

This matches the brief's preferred stack exactly, so no substitution needs justifying.

## Repository layout

This is an npm-workspaces monorepo with two packages and one shared root:

```
/frontend   Next.js app (Tailwind, App Router)
/backend    Express API + the research/generation pipeline + the batch entry point
/examples   Sample batch input (cases.sample.json) for local testing of `npm run evaluate`
```

`backend/src/pipeline/` is the core library. Both the Express API (`services/kitService.ts`)
and the batch script (`scripts/evaluate.ts`) call `pipeline/index.ts#runPipeline` directly —
the same code path, per Section 9 of the brief.

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
```

See `backend/.env.example` for what every variable is for.

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
one JSON file in the Appendix B shape, continuing past any case that fails.

### Tests

```bash
npm test    # runs backend/src/tests/* via Vitest
```

## Architecture

**TODO** — fill in once the pipeline/API/frontend are complete: a short diagram + description
of how a request flows from "user pastes a JD" through crawl → extract → generate → coverage
loop → schedule → persistence → the builder UI.

### Pipeline steps (`backend/src/pipeline/`)

| Step | File | LLM? | Notes |
| --- | --- | --- | --- |
| Extract requirements from the JD | `extractRequirements.ts` | Yes | No retrieval needed — the JD is pasted text |
| Fetch + clean one page | `fetchPage.ts` | No | SSRF-guarded, content-type/size limited |
| Crawl the company site | `crawlCompanySite.ts` | No | Ranks links by hiring/about keyword heuristics, no fixed path list, respects `robots.txt` |
| Search public interview discussion | `searchInterviewDiscussion.ts` | No (Tavily) | Best-effort, never fatal |
| Synthesise the company brief | `synthesizeCompanyBrief.ts` | Yes | Returns an honest "couldn't find much" brief rather than inventing one when crawling found nothing |
| Generate questions for a category | `generateQuestions.ts` | Yes | Called once per requirement-kind → category (technical/behavioural/company-fit/system-design), never with one shared prompt for all of them |
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

**TODO — expand once the frontend builder is wired up.** Current backend representation:
every `Question` and `Flashcard` carries an `origin: "generated" | "edited" | "user-added"`
field and an optional `pinned: boolean` (additive fields beyond Appendix A, which explicitly
allows extension). Regenerating a question category (`regenerateSection` in
`kitService.ts`) only replaces questions in that category whose `origin` is still
`"generated"` and which are not `pinned`; anything the user edited, added by hand, or pinned
survives untouched. Regenerating `schedule` or `company_brief` currently replaces that section
wholesale, since neither has meaningful per-item edit tracking of its own.

**Known trade-off:** regenerating a question category also rebuilds the schedule immediately
after (since schedule composition depends on the live question set), and does not retroactively
update flashcards already derived from a question that got regenerated. Both are called out
here rather than hidden.

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

## Edge cases (Section 10) — how each is handled

| Case | Handling |
| --- | --- |
| Invalid/404/timeout company URL | `crawlCompanySite` returns `pages: []` with the failure recorded; pipeline continues, `synthesizeCompanyBrief` returns an honest "couldn't retrieve anything" brief. Not a batch failure. |
| No discoverable hiring/about page | Same as above — crawl just doesn't surface one; `hiringPageFound: false`, kit still produced. |
| Two-line JD stub | `extractRequirements` is instructed not to invent requirements; a thin JD yields a short/empty requirement list rather than fabricated ones. |
| No public interview discussion found | `searchInterviewDiscussion` returns `{ found: false, note: "..." }`, non-fatal. |
| Model returns invalid JSON / incomplete kit | `geminiClient.generateJson` retries once on a JSON parse failure; `validateKit` runs before persisting/writing a batch "ok" result, and a kit that fails validation is reported as a `failed` batch case rather than silently saved broken. |
| Rate limit / transient LLM failure | `pipeline/llm/rateLimiter.ts` serialises calls with a floor delay and retries with exponential backoff on 429/5xx. |
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
- **TODO**: practice-mode "next session ordered by least confident" algorithm — not yet built,
  will be documented here once implemented.
- **TODO**: frontend builder UI, deployment, walkthrough video.

## What's built so far / what's next

- [x] Repo scaffold (npm workspaces, Next.js frontend, Express backend)
- [x] Auth (register/login/logout, JWT-in-httpOnly-cookie sessions, ownership-scoped kits)
- [x] Crawler (link ranking, robots.txt, SSRF guard, rate limiting)
- [x] Full pipeline wiring: extract → crawl → search → brief → generate-by-category →
      coverage loop → schedule → validate
- [x] Batch entry point (`npm run evaluate`)
- [x] Tests for coverage checking, schedule allocation, structure validation
- [ ] Frontend: kit creation form, progress view, builder, practice mode
- [ ] Deployment (Vercel + Render/Railway + MongoDB Atlas)
- [ ] Walkthrough video
- [ ] Optional creative feature
