# Chamba

Empleos remotos que sí aceptan a Venezuela. Built for r/dev_venezuela with
[Jev](https://docs.typesafe.ai), TypeSafe's System One model: it answers typed questions with
calibrated probabilities instead of writing text.

**Radar (`/`).** The server fetches ~500 listings from four public job boards (HN "Who is hiring?",
Get on Board, We Work Remotely, Remotive). Structured source fields decide location in code;
otherwise Jev reads each listing, answers 7 questions (is it a job, where can you work from, does it
exclude Venezuela, USD, seniority, role, English) and picks the sentence that proves the location.
Only new listings are judged: a full run is ~20 s and ~$0.05, a daily update costs cents. Visitors can
watch an update live (at most one every 15 minutes) or replay the last one; every URL the server
requested is listed on the page.

**Chimbómetro (`/chimbometro`).** Paste a job offer; one request asks Jev 20 questions (9 red flags,
unfairness, verdict, and per flag the fragment that proves it) and code turns the probabilities into a
0–100 score. The page streams every step live and prints a receipt with tokens, cost and latency.

**Laboratorio (`/docs`).** Architecture, every question as sent, a formula playground, security,
latency and cost charts, and what we learned using Jev. Every Jev call made while building is in
[`ledger/jev-usage.jsonl`](ledger/jev-usage.jsonl).

## Run it

```sh
cp .env.example .env        # add TYPESAFE_API_KEY; Upstash is optional locally, required in production
npm install
npm run jev:check           # verify the key with one tiny request
npm run dev                 # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run check` | Typecheck, lint and unit tests |
| `npm run jev:eval` | Runs the example offers through Jev and checks each verdict; appends to the ledger |
| `npm run build` | Production build (the cost section is rendered from the ledger at build time) |

Locally, rate limits use memory even if `.env.local` holds production's Redis (from
`vercel env pull`), so development never spends production's budget. Set `CHIMBA_DEV_REDIS=1` to
test against Redis on purpose.

## How it is put together

```
src/
  app/api/chimba/route.ts   POST endpoint; streams NDJSON events as each step happens
  app/api/stats/route.ts    today's measured offers and Jev spend (cached 10 s)
  app/api/radar/            snapshot, live refresh (NDJSON; daily cron with CRON_SECRET), replay
  lib/radar/                sources, questions, judge (eligibility rules), refresh orchestrator
  app/docs/                 technical documentation page
  lib/server/               guard (limits, budget, origin) and server-only config
  lib/jev/                  typed HTTP client, pricing, wire types (no SDK dependency)
  lib/chimba/
    questions.ts            the judgment questions Jev is asked
    evidence.ts             offer → fragments, and one evidence question per flag
    score.ts                the scoring formula (code, not model)
    extract.ts              salary and technologies read with plain code
    analyze.ts              one offer → Jev → score, with timings
    events.ts, request.ts   the streaming protocol and its browser client
  components/               gauge, live trace, receipt, flags, logo
scripts/                    key check and eval, both logged to the ledger
research/                   the r/dev_venezuela analysis that led here (Python, stdlib only)
ledger/jev-usage.jsonl      every Jev call made while building, with tokens and cost
```

Decisions worth knowing:

- **The API key never reaches the browser.** It is read only in `src/lib/server/config.ts`, which
  imports `server-only`, so bundling it for the client fails the build.
- **The endpoint is guarded before any Jev call** (`src/lib/server/guard.ts`), in this order:
  same-origin check (403), 32 KB body cap (413), daily spend cap (503), 10 requests per minute and
  100 per day per IP (429 with `Retry-After`), 600 requests per minute overall (503). The real cost
  of each call is added to the day's spend afterwards. Counters live in Upstash Redis so they hold
  across serverless instances; IPs are hashed before they become keys. The client IP comes from
  the platform's header, never from client-supplied `x-forwarded-for` in production.
- **It fails closed.** In production, missing Redis settings or an unreachable Redis means no Jev
  calls. Every request logs one structured line (tokens, cost, latency, score, or the limit that
  was hit); offer text is never logged or stored.
- **Policy lives in code.** Jev supplies probabilities; `score.ts` owns weights and thresholds, so
  tuning the score never requires another model call. The formula is shown on the page.
- **Every number on the page is measured.** Trace timestamps are server time since the request
  arrived; the waiting counter runs on the browser clock. Jev returns all answers at once, and the
  trace says so.

## Research

[`research/README.md`](research/README.md) has the analysis of 206 posts that picked this idea:
two of the six most upvoted posts in the sub's history are screenshots of absurd job offers.

---

Hecho por [elberacasa](https://github.com/elberacasa). Not affiliated with TypeSafe AI.
