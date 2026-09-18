# Chimbómetro

Pega una oferta de trabajo y mide qué tan chimba es. Built for r/dev_venezuela with
[Jev](https://docs.typesafe.ai), TypeSafe's System One model: it answers typed questions with
calibrated probabilities instead of writing text.

One request asks Jev 11 questions in parallel: 9 red flags (yes/no), how unfair the offer is (0–3)
and a verdict (one of six). Plain code turns those probabilities into a 0–100 score. The page shows
every step live — the request leaving, Jev's answers, tokens, cost and latency — and every Jev call
made while building the project is recorded in [`ledger/jev-usage.jsonl`](ledger/jev-usage.jsonl).

Typical request: ~1,450 input tokens, ~$0.00006, ~0.6 s.

## Run it

```sh
cp .env.example .env        # add TYPESAFE_API_KEY from https://console.typesafe.ai
npm install
npm run jev:check           # verify the key with one tiny request
npm run dev                 # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `npm run check` | Typecheck, lint and unit tests |
| `npm run jev:eval` | Runs the example offers through Jev and checks each verdict; appends to the ledger |
| `npm run build` | Production build (the cost section is rendered from the ledger at build time) |

## How it is put together

```
src/
  app/api/chimba/route.ts   POST endpoint; streams NDJSON events as each step happens
  lib/jev/                  typed HTTP client, pricing, wire types (no SDK dependency)
  lib/chimba/
    questions.ts            everything Jev is asked, in one place
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

- **The API key never reaches the browser.** The route validates input, rate-limits per IP and
  logs one structured line per request (tokens, cost, latency, score). Offer text is never logged
  or stored.
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
