"""Cost probe: judge a sample of RemoteOK listings the way Chamba Radar would."""
import html
import json
import re
import sys
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

import typesafe_client as api

DATA = Path(__file__).parent / "data"

QUESTIONS = {
    "location": {
        "type": "choice",
        "instructions": "Based on `job`, where can the hired person live?",
        "criteria": {
            "worldwide": "Anywhere, or explicitly includes Venezuela.",
            "latam": "Latin America or the Americas, without excluding Venezuela.",
            "us_or_eu_only": "Only the US, Canada, Europe, or other specific non-LATAM countries.",
            "unclear": "The listing does not say.",
        },
    },
    "contractor_ok": {"type": "noul", "instructions": "Does `job` allow hiring as an independent contractor rather than only as a local employee?"},
    "usd_pay": {"type": "noul", "instructions": "Does `job` pay in US dollars or state a USD salary?"},
    "seniority": {
        "type": "choice",
        "instructions": "What seniority does `job` target?",
        "criteria": {"junior": None, "mid": None, "senior": None, "lead_or_staff": None, "unclear": None},
    },
    "role": {
        "type": "choice",
        "instructions": "What is the main role in `job`?",
        "criteria": {"frontend": None, "backend": None, "fullstack": None, "mobile": None, "data_or_ml": None,
                     "devops_or_infra": None, "qa": None, "design": None, "non_engineering": None},
    },
    "english_level": {
        "type": "score",
        "instructions": "How much English does `job` require?",
        "criteria": ["Not required or Spanish-first role.", "Basic reading and writing.",
                     "Professional: meetings and written communication in English.", "Native or near-native fluency."],
    },
}


def text(raw):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html.unescape(raw or ""))).strip()


listings = [x for x in json.load(open(DATA / "remoteok.json")) if "position" in x][: int(sys.argv[1]) if len(sys.argv) > 1 else 30]
states = [{"job": {"title": x["position"], "company": x["company"], "location": x.get("location", ""),
                   "salary_min": x.get("salary_min"), "salary_max": x.get("salary_max"),
                   "description": text(x.get("description"))[:12000]}} for x in listings]

t0 = time.perf_counter()
with ThreadPoolExecutor(6) as pool:
    results = list(pool.map(lambda s: api.system_one(s, QUESTIONS), states))
wall = time.perf_counter() - t0
api.log_run(f"Medir costo por oferta con {len(states)} empleos de RemoteOK", "research/probe_job_listings.py", results)

ok = [r for r in results if "answers" in r]
tin = [r["usage"]["input_tokens"] for r in ok]
print(f"{len(ok)}/{len(results)} ok in {wall:.1f}s; input tokens/listing avg {sum(tin)/len(tin):.0f}, max {max(tin)}")
for s, r in list(zip(states, results))[:8]:
    a = r.get("answers", {})
    if a:
        print(f"- {s['job']['title'][:45]:45} | {a['location']['choice']:13} contractor={a['contractor_ok']['noul']:.2f} "
              f"usd={a['usd_pay']['noul']:.2f} {a['seniority']['choice']:8} {a['role']['choice']:10} en={a['english_level']['score']:.1f}")
    else:
        print("ERR", r)
