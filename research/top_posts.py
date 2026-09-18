"""Compare what reaches r/dev_venezuela's all-time top (ranked by upvotes) with everything else.

Needs data/top.rss and data/judgments.json (run classify_posts.py first).
"""
import collections
import json
import xml.etree.ElementTree as ET
from pathlib import Path

DATA = Path(__file__).parent / "data"
NS = {"a": "http://www.w3.org/2005/Atom"}
TOP_N = 30

judged = {r["id"]: r for r in json.load(open(DATA / "judgments.json")) if "answers" in r}
ranked = [e.findtext("a:id", namespaces=NS) for e in ET.parse(DATA / "top.rss").getroot().findall("a:entry", NS)]
top = [pid for pid in ranked[:TOP_N] if pid in judged]
rest = [pid for pid in judged if pid not in set(top)]


def topic(pid):
    return judged[pid]["answers"]["topic"]["choice"]


print(f"Top {TOP_N} all time:")
for rank, pid in enumerate(top, 1):
    a = judged[pid]["answers"]
    print(f"{rank:2}. [{a['topic']['choice']}/{a['intent']['choice']}] {judged[pid]['title'][:90]}")

top_share = collections.Counter(map(topic, top))
rest_share = collections.Counter(map(topic, rest))
print(f"\n{'topic':22} top{TOP_N}   rest")
for name in sorted(set(top_share) | set(rest_share), key=lambda k: -top_share[k]):
    print(f"{name:22} {top_share[name] / len(top):5.0%}  {rest_share[name] / len(rest):5.0%}")
