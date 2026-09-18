"""Turn Reddit RSS feeds in data/*.rss into deduplicated posts in data/posts.json."""
import glob
import html
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

DATA = Path(__file__).parent / "data"
NS = {"a": "http://www.w3.org/2005/Atom"}


def clean(raw):
    text = html.unescape(raw or "")
    text = re.sub(r"<br\s*/?>|</p>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    # Reddit appends "submitted by /u/x [link] [comments]" to every entry.
    text = re.sub(r"\s*submitted by\s+/u/\S+.*$", "", text, flags=re.S)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


posts = {}
for path in sorted(glob.glob(str(DATA / "*.rss"))):
    for entry in ET.parse(path).getroot().findall("a:entry", NS):
        pid = entry.findtext("a:id", default="", namespaces=NS)
        if pid in posts:
            continue
        posts[pid] = {
            "id": pid,
            "title": entry.findtext("a:title", default="", namespaces=NS).strip(),
            "body": clean(entry.findtext("a:content", default="", namespaces=NS))[:4000],
            "author": entry.findtext("a:author/a:name", default="", namespaces=NS),
            "published": entry.findtext("a:published", default="", namespaces=NS),
            "url": entry.find("a:link", NS).get("href"),
        }

with open(DATA / "posts.json", "w") as f:
    json.dump(list(posts.values()), f, ensure_ascii=False, indent=1)
print(f"{len(posts)} unique posts")
