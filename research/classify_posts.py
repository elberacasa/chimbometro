"""Ask Jev a fixed set of questions about every post in data/posts.json.

Writes data/judgments.json (one record per post) and prints token/latency totals.
"""
import json
import time
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

from typesafe_client import log_run, system_one

CONCURRENCY = 6
DATA = Path(__file__).parent / "data"

CONTEXT = (
    "The post is from r/dev_venezuela, a Spanish-language Reddit community for "
    "Venezuelan software developers living in Venezuela or abroad."
)

QUESTIONS = {
    "topic": {
        "type": "choice",
        "instructions": [CONTEXT, "What is the main subject of `post`?"],
        "criteria": {
            "salaries": "Pay levels, what to charge, whether a salary is fair.",
            "payments": "Receiving or moving money: getting paid from abroad, USDT/P2P, banks, Zinli, Binance, payment gateways, exchange rates.",
            "job_search": "Finding a job: first job, CV, interviews, LinkedIn, recruiters, where to apply.",
            "remote_and_freelance": "Working for foreign companies or clients, freelancing, contracts, platforms.",
            "emigration": "Leaving Venezuela or living/working in another country.",
            "learning_career": "What to study, universities, courses, learning resources, switching careers.",
            "ai_and_future": "AI tools, whether AI will replace developers, the future of the profession.",
            "tools_and_hardware": "Laptops, operating systems, editors, terminals, VPNs, dev tools, access to blocked services.",
            "local_infrastructure": "Power outages, internet providers, connectivity, local telecom.",
            "project_showcase": "The author shares something they built.",
            "technical_question": "A specific programming or architecture question.",
            "community": "Meetups, events, greetings, the subreddit itself.",
            "other": None,
        },
    },
    "intent": {
        "type": "choice",
        "instructions": [CONTEXT, "What does the author of `post` mainly want from the community?"],
        "criteria": {
            "help": "Concrete help or an answer to a specific problem.",
            "opinions": "Opinions or recommendations on a decision.",
            "feedback_on_project": "Attention or feedback on something they built.",
            "share_info": "To share news, a resource, or data.",
            "vent_or_story": "To vent or tell a personal story.",
            "work": "To offer or find paid work or collaborators.",
            "other": None,
        },
    },
    "unmet_need": {
        "type": "noul",
        "instructions": [
            CONTEXT,
            "Does `post` reveal a concrete problem or information need that the author "
            "(or Venezuelan developers generally) lacks a good, easy solution for today?",
        ],
    },
    "venezuela_specific": {
        "type": "noul",
        "instructions": [
            CONTEXT,
            "Does the problem or question in `post` depend on conditions specific to "
            "Venezuela or Venezuelans (local banking and payment restrictions, exchange "
            "rates, blocked or unavailable services, power or internet reliability, local "
            "companies, local salaries, visas or documents)?",
        ],
    },
    "software_could_help": {
        "type": "noul",
        "instructions": [
            CONTEXT,
            "Could a small piece of software (a web app, a bot, a shared dataset, or a "
            "searchable guide) meaningfully solve or reduce the problem in `post` for many "
            "people, not just the author?",
        ],
    },
    "recurring": {
        "type": "noul",
        "instructions": [
            CONTEXT,
            "Is the question in `post` the kind that gets asked again and again in "
            "developer communities, where each asker starts from zero?",
        ],
    },
    "pain": {
        "type": "score",
        "instructions": [CONTEXT, "How costly is the problem in `post` for the person experiencing it?"],
        "criteria": [
            "No real problem: the post is news, a showcase, or casual chat.",
            "Minor annoyance or curiosity; nothing much is lost if it stays unsolved.",
            "Real friction: costs time or small amounts of money, or blocks a side project.",
            "Serious: blocks income, a job, getting paid, or a major life decision.",
        ],
    },
}


def ask(post):
    r = system_one({"post": {"title": post["title"], "body": post["body"]}}, QUESTIONS)
    if "error" in r:
        return {**post, "error": r["error"]}
    return {**post, "latency_ms": r["latency_ms"], "model": r["model"], "answers": r["answers"], "usage": r["usage"]}


if __name__ == "__main__":
    posts = json.load(open(DATA / "posts.json"))
    t0 = time.perf_counter()
    with ThreadPoolExecutor(CONCURRENCY) as pool:
        results = list(pool.map(ask, posts))
    wall = time.perf_counter() - t0

    json.dump(results, open(DATA / "judgments.json", "w"), ensure_ascii=False, indent=1)
    log_run(f"Clasificar {len(posts)} posts de r/dev_venezuela", "research/classify_posts.py", results)
    ok = [r for r in results if "answers" in r]
    errors = [r for r in results if "error" in r]
    tin = sum(r["usage"]["input_tokens"] for r in ok)
    tout = sum(r["usage"]["output_tokens"] for r in ok)
    lat = sorted(r["latency_ms"] for r in ok)
    print(f"{len(ok)} judged, {len(errors)} errors, {len(QUESTIONS)} questions each")
    print(f"wall {wall:.1f}s | latency p50 {lat[len(lat)//2]}ms p90 {lat[int(len(lat)*.9)]}ms")
    print(f"tokens in {tin} out {tout}")
    for r in errors[:3]:
        print("ERR", r["title"][:60], r["error"])
