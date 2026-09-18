"""Export the aggregate numbers the site shows about r/dev_venezuela to src/content/subreddit.json.

Only aggregates leave research/: no post text, titles or usernames.
"""
import collections
import json
import xml.etree.ElementTree as ET
from pathlib import Path

HERE = Path(__file__).parent
DATA = HERE / "data"
OUT = HERE.parent / "src" / "content" / "subreddit.json"
NS = {"a": "http://www.w3.org/2005/Atom"}
TOP_N = 30

TOPIC_LABELS = {
    "job_search": "Buscar trabajo",
    "salaries": "Sueldos",
    "learning_career": "Estudiar o cambiar de carrera",
    "remote_and_freelance": "Remoto y freelance",
    "payments": "Cobrar y mover dinero",
    "tools_and_hardware": "Herramientas y equipos",
    "ai_and_future": "La IA y el futuro",
    "technical_question": "Preguntas técnicas",
    "project_showcase": "Proyectos propios",
}

judged = [r for r in json.load(open(DATA / "judgments.json")) if "answers" in r]
by_topic = collections.defaultdict(list)
for r in judged:
    by_topic[r["answers"]["topic"]["choice"]].append(r)

pain = sorted(
    (
        {
            "id": topic,
            "label": TOPIC_LABELS[topic],
            "posts": len(rows),
            "pain": round(sum(r["answers"]["pain"]["score"] for r in rows) / len(rows), 2),
        }
        for topic, rows in by_topic.items()
        if topic in TOPIC_LABELS and len(rows) >= 5
    ),
    key=lambda t: -t["pain"],
)

ranked = [e.findtext("a:id", namespaces=NS) for e in ET.parse(DATA / "top.rss").getroot().findall("a:entry", NS)]
dates = sorted(r["published"] for r in judged)
usage = [r["usage"]["input_tokens"] for r in judged]
latency = sorted(r["latency_ms"] for r in judged)

OUT.parent.mkdir(exist_ok=True)
json.dump(
    {
        "posts": len(judged),
        "questionsPerPost": len(judged[0]["answers"]),
        "from": dates[0][:10],
        "to": dates[-1][:10],
        "topN": TOP_N,
        "topRankedAvailable": len(ranked),
        # Hand-verified: "¿No quieren que vuele también?" (#4) and "Cada día peor" (#6) are screenshots of offers.
        "absurdOffersInTop6": 2,
        "inputTokens": sum(usage),
        "latencyP50Ms": latency[len(latency) // 2],
        "latencyP90Ms": latency[int(len(latency) * 0.9)],
        # 50 ms bins of per-request round trip, for the docs histogram.
        "latencyHistogram": [
            {"fromMs": b, "count": sum(1 for x in latency if b <= x < b + 50)}
            for b in range(latency[0] // 50 * 50, latency[-1] // 50 * 50 + 50, 50)
        ],
        "painByTopic": pain,
    },
    open(OUT, "w"),
    ensure_ascii=False,
    indent=2,
)
print(f"wrote {OUT.relative_to(HERE.parent)}")
