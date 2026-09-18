"""Minimal TypeSafe System One HTTP client (stdlib only).

Reads TYPESAFE_API_KEY from the environment or the repo-root .env file, and
appends one summary line per run to ledger/jev-usage.jsonl via log_run().
"""
import json
import os
import random
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

API_URL = "https://api.typesafe.ai/v1/systemone"
ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "ledger" / "jev-usage.jsonl"
# Must match src/lib/jev/pricing.ts. Output tokens are free.
USD_PER_INPUT_TOKEN = 0.042 / 1_000_000


def load_key():
    if os.environ.get("TYPESAFE_API_KEY"):
        return os.environ["TYPESAFE_API_KEY"]
    for line in (ROOT / ".env").read_text().splitlines():
        if line.startswith("TYPESAFE_API_KEY="):
            return line.split("=", 1)[1].strip().strip("'\"")
    raise SystemExit("TYPESAFE_API_KEY not found in env or .env")


KEY = load_key()


def system_one(state, questions, model="jev-latest"):
    """POST one request; retries on 429/529/5xx. Returns the response dict plus latency_ms, or {"error": ...}."""
    payload = json.dumps({"model": model, "state": state, "questions": questions}).encode()
    for attempt in range(6):
        req = urllib.request.Request(API_URL, data=payload, headers={
            "Authorization": f"Bearer {KEY}",
            "Content-Type": "application/json",
        })
        start = time.perf_counter()
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                body = json.load(resp)
            return {**body, "latency_ms": round((time.perf_counter() - start) * 1000)}
        except urllib.error.HTTPError as e:
            if e.code in (429, 529, 500, 502, 503) and attempt < 5:
                time.sleep(2 ** attempt + random.random())
                continue
            return {"error": f"HTTP {e.code}: {e.read()[:300].decode(errors='replace')}"}
        except (urllib.error.URLError, TimeoutError) as e:
            if attempt < 5:
                time.sleep(2 ** attempt)
                continue
            return {"error": str(e)}


def log_run(purpose, script, responses):
    """Append one ledger line summarizing the successful responses of a run."""
    ok = [r for r in responses if "usage" in r]
    if not ok:
        return
    input_tokens = sum(r["usage"]["input_tokens"] for r in ok)
    entry = {
        "model": ok[0]["model"],
        "at": datetime.now().astimezone().isoformat(timespec="seconds"),
        "purpose": purpose,
        "script": script,
        "calls": len(ok),
        "input_tokens": input_tokens,
        "output_tokens": sum(r["usage"]["output_tokens"] for r in ok),
        "latency_ms": sum(r["latency_ms"] for r in ok),
        "exact": True,
        "cost_usd": round(input_tokens * USD_PER_INPUT_TOKEN, 8),
    }
    LEDGER.parent.mkdir(exist_ok=True)
    with LEDGER.open("a") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
