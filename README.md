# Chimbómetro

Pega una oferta de trabajo y mide qué tan chimba es. Built for r/dev_venezuela with
[Jev](https://docs.typesafe.ai), TypeSafe's System One model: it answers typed questions with
calibrated probabilities instead of writing text.

One request asks Jev 20 questions in parallel: 9 red flags (yes/no), how unfair the offer is
(0–3), a verdict (one of six), and, per red flag, which fragment of the offer is the evidence
("select instead of generate", so citations can't be invented). Plain code turns the probabilities
into a 0–100 score. The page shows every step live: a pipeline diagram driven by the real stream,
a trace with server timestamps, lines from each flag to the words that triggered it, and a receipt
with tokens, cost and latency. `/docs` explains the architecture, every question as sent, the
formula (with a playground that re-scores saved answers without calling Jev), and real latency and
cost charts. Every Jev call made while building the project is recorded in
[`ledger/jev-usage.jsonl`](ledger/jev-usage.jsonl).

Typical request: 20 questions, ~3,500 input tokens, ~$0.00015, ~0.7 s.

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
