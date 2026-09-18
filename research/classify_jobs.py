"""Chamba Radar experiment: can Jev tell which remote jobs a developer in Venezuela can apply to?

Reads data/jobs.json (fetch_jobs.py), asks Jev 7 questions per listing, writes
data/job_judgments.json and prints the aggregate. Logged to the ledger.
"""
import json
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from typesafe_client import log_run, system_one

DATA = Path(__file__).parent / "data"
CONCURRENCY = 8

QUESTIONS = {
    "is_job": {
        "type": "noul",
        "instructions": "Is `job` an actual job opening someone could apply to (not a comment, question or ad for a service)?",
    },
    "where": {
        "type": "choice",
        "instructions": "Based on `job`, where can the hired person live and work from?",
        "criteria": {
            "anywhere": "Fully remote from anywhere in the world, or explicitly open to any country.",
            "americas_or_latam": "Remote from Latin America or the Americas (time zone overlap), without excluding Venezuela.",
            "specific_countries": "Remote, but only from a listed set of countries.",
            "us_or_canada": "Remote only from the US and/or Canada.",
            "europe": "Remote only from Europe or the EU/UK.",
            "onsite_or_hybrid": "Requires working on-site or hybrid in a city.",
            "unclear": "The listing does not say where the person can be.",
        },
    },
    "excludes_venezuela": {
        "type": "noul",
        "instructions": (
            "Does `job` rule out a candidate living in Venezuela, for example by requiring work authorization in a "
            "specific country, excluding sanctioned countries, or listing allowed countries that do not include Venezuela?"
        ),
    },
    "contractor_ok": {
        "type": "noul",
        "instructions": "Could the person be hired as an independent contractor or through an employer-of-record, rather than only as a local employee?",
    },
    "usd_pay": {
        "type": "noul",
        "instructions": "Does `job` state pay in US dollars?",
    },
    "seniority": {
        "type": "choice",
        "instructions": "What seniority does `job` target?",
        "criteria": {"junior": None, "mid": None, "senior": None, "lead_or_staff": None, "unclear": None},
    },
    "english": {
        "type": "score",
        "instructions": "How much English does `job` require?",
        "criteria": [
            "None: the role works in Spanish or Portuguese.",
            "Basic reading and writing.",
            "Professional: meetings and written communication in English.",
            "Native or near-native fluency.",
        ],
    },
}


def ask(job):
    state = {"job": {k: job[k] for k in ("title", "company", "location")} | {"text": job["text"][:8000]}}
    r = system_one(state, QUESTIONS)
    return {**job, **({"error": r["error"]} if "error" in r else {"answers": r["answers"], "usage": r["usage"], "latency_ms": r["latency_ms"], "model": r["model"]})}


if __name__ == "__main__":
    jobs = json.load(open(DATA / "jobs.json"))
    only = sys.argv[1] if len(sys.argv) > 1 else None  # e.g. "getonbrd" to re-judge one source
    previous = {r["id"]: r for r in json.load(open(DATA / "job_judgments.json"))} if only else {}
    if only:
        jobs = [j for j in jobs if j["source"] == only]
    t0 = time.perf_counter()
    with ThreadPoolExecutor(CONCURRENCY) as pool:
        results = list(pool.map(ask, jobs))
    wall = time.perf_counter() - t0
    merged = {**previous, **{r["id"]: r for r in results}}
    json.dump(list(merged.values()), open(DATA / "job_judgments.json", "w"), ensure_ascii=False, indent=1)
    log_run(f"Chamba Radar: clasificar {len(jobs)} empleos remotos (7 preguntas c/u)", "research/classify_jobs.py", results)

    ok = [r for r in results if "answers" in r]
    tin = sum(r["usage"]["input_tokens"] for r in ok)
    lat = sorted(r["latency_ms"] for r in ok)
    print(f"{len(ok)}/{len(results)} judged in {wall:.1f}s, p50 {lat[len(lat)//2]} ms, {tin} tokens, ${tin * 0.042 / 1e6:.4f}")
