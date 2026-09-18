# Research: r/dev_venezuela

Scripts used to decide what to build. They call Jev directly over HTTP with the
Python standard library, so there is nothing to install. `data/` is git-ignored.

```sh
./fetch_reddit.sh            # RSS feeds + RemoteOK listings into data/
python3 parse_rss.py         # data/posts.json (deduplicated posts)
python3 classify_posts.py    # data/judgments.json (7 Jev questions per post)
python3 top_posts.py         # what reaches the all-time top vs the rest
python3 probe_job_listings.py 30   # cost/latency probe on job listings
python3 fetch_jobs.py        # remote jobs from HN, Get on Board, We Work Remotely, Remotive
python3 classify_jobs.py     # Chamba Radar: 7 Jev questions per listing (add a source id to redo one)
python3 export_radar_stats.py  # aggregates for the docs Laboratorio
```

## Findings (2026-09-18, 206 posts from 2025-07 to 2026-09)

- 206 posts × 7 questions judged in 25 s, p50 latency 698 ms, ~324k input tokens ≈ $0.014.
- Most painful topics: job search (pain 2.2/3), salaries (1.9), studying or
  switching careers (1.9). Payments are the most Venezuela-specific topic (0.87).
- Two of the six most upvoted posts ever are screenshots of absurd job offers
  ("¿No quieren que vuele también?", "Cada día peor"). Venting and AI anxiety are
  over-represented in the top 30; payments and tools never reach it.
- Job listings average ~1,600 input tokens with 6 questions, ≈ $0.00007 each.

## Chamba Radar experiment (2026-09-18, 501 listings from 4 sources)

- 130 of 496 real job posts (26%) accept someone living in Venezuela; on HN "Who is hiring?"
  only 30 of 256 (12%). 11 of the eligible are junior roles. $0.027 and 44 s for all of them.
- Structured fields (Get on Board's remote modality) must be decided in code; passing the raw
  code `remote_local` misled Jev until it was spelled out. "Contractor OK" stays between 0.5 and
  0.8 because listings rarely say, so it is not usable as a filter.

That led to the Chimbómetro: paste a job offer, get a score and red flags, share the result.

Caveats: RSS carries no scores or comments, and the sample leans toward top and hot posts.
