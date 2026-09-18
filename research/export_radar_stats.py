"""Export the Chamba Radar experiment aggregates to src/content/radar-lab.json for the docs.

Eligible = a real job post, remote from anywhere or from the Americas/LATAM, and Jev does not think
it rules out someone living in Venezuela. Only aggregates and a few public listing titles leave.
"""
import json
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
OUT = HERE.parent / "src" / "content" / "radar-lab.json"
SOURCES = {
    "hn": ("Hacker News: Who is hiring? (septiembre 2026)", "https://news.ycombinator.com/submitted?id=whoishiring"),
    "getonbrd": ("Get on Board", "https://www.getonbrd.com"),
    "wwr": ("We Work Remotely", "https://weworkremotely.com"),
    "remotive": ("Remotive", "https://remotive.com"),
}
LOW_CONFIDENCE = 0.6

judged = [r for r in json.load(open(DATA / "job_judgments.json")) if "answers" in r]
a = lambda r, q: r["answers"][q]
jobs = [r for r in judged if a(r, "is_job")["noul"] >= 0.5]


def eligible(r):
    return a(r, "where")["choice"] in ("anywhere", "americas_or_latam") and a(r, "excludes_venezuela")["noul"] < 0.5


E = [r for r in jobs if eligible(r)]
tokens = sum(r["usage"]["input_tokens"] for r in judged)
latency = sorted(r["latency_ms"] for r in judged)

out = {
    "at": datetime.now().astimezone().isoformat(timespec="minutes"),
    "listings": len(judged),
    "jobPosts": len(jobs),
    "eligible": len(E),
    "eligibleJunior": sum(a(r, "seniority")["choice"] == "junior" for r in E),
    "eligibleWithUsd": sum(a(r, "usd_pay")["noul"] >= 0.5 for r in E),
    "lowConfidence": sum(a(r, "where")["confidence"] < LOW_CONFIDENCE for r in jobs),
    "questions": len(judged[0]["answers"]),
    "inputTokens": tokens,
    "costUsd": round(tokens * 0.042 / 1e6, 6),
    "latencyP50Ms": latency[len(latency) // 2],
    "sources": [
        {
            "id": sid,
            "name": name,
            "url": url,
            "jobPosts": sum(r["source"] == sid for r in jobs),
            "eligible": sum(r["source"] == sid for r in E),
        }
        for sid, (name, url) in SOURCES.items()
    ],
    # A few eligible HN listings, with their public links, as examples.
    "examples": [
        {"title": r["title"][:90], "url": r["url"], "where": a(r, "where")["choice"], "confidence": round(a(r, "where")["confidence"], 2)}
        for r in sorted((r for r in E if r["source"] == "hn"), key=lambda r: -a(r, "where")["confidence"])[:4]
    ],
}
json.dump(out, open(OUT, "w"), ensure_ascii=False, indent=2)
print(f"wrote {OUT.relative_to(HERE.parent)}: {out['eligible']}/{out['jobPosts']} eligible")
