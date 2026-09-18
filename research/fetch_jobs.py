"""Download remote job listings from public sources into data/jobs.json (one normalized list).

Sources: HN "Who is hiring?" (latest month), Remotive, We Work Remotely, Get on Board.
Only public APIs/feeds, one request per page, a pause between requests.
"""
import html
import json
import re
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

DATA = Path(__file__).parent / "data"
UA = {"User-Agent": "chimbometro-research/0.1 (+https://github.com/elberacasa)"}


def get(url):
    time.sleep(0.5)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return r.read()


def text(raw):
    t = re.sub(r"<(br|p|li)[^>]*>", "\n", html.unescape(raw or ""))
    t = html.unescape(re.sub(r"<[^>]+>", " ", t))
    return re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", t)).strip()


def hn():
    story = json.loads(get("https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=10"))
    hiring = next(h for h in story["hits"] if h["title"].startswith("Ask HN: Who is hiring?"))
    item = json.loads(get(f"https://hn.algolia.com/api/v1/items/{hiring['objectID']}"))
    for c in item["children"]:
        body = text(c.get("text"))
        if len(body) < 80:
            continue
        first = body.split("\n")[0]
        yield {
            "source": "hn",
            "id": f"hn-{c['id']}",
            "title": first[:160],
            "company": first.split("|")[0].strip()[:80],
            "location": "",
            "text": body,
            "url": f"https://news.ycombinator.com/item?id={c['id']}",
            "posted": c.get("created_at", ""),
        }


def remotive():
    data = json.loads(get("https://remotive.com/api/remote-jobs?category=software-dev"))
    for j in data["jobs"]:
        yield {
            "source": "remotive",
            "id": f"remotive-{j['id']}",
            "title": j["title"],
            "company": j["company_name"],
            "location": j.get("candidate_required_location", ""),
            "text": text(j.get("description")),
            "url": j["url"],
            "posted": j.get("publication_date", ""),
        }


def wwr():
    root = ET.fromstring(get("https://weworkremotely.com/categories/remote-programming-jobs.rss"))
    for item in root.iter("item"):
        title = item.findtext("title", "")
        company, _, role = title.partition(":")
        yield {
            "source": "wwr",
            "id": f"wwr-{item.findtext('guid', title)[-40:]}",
            "title": role.strip() or title,
            "company": company.strip(),
            "location": item.findtext("region", ""),
            "text": text(item.findtext("description")),
            "url": item.findtext("link", ""),
            "posted": item.findtext("pubDate", ""),
        }


# Get on Board's modality codes, spelled out so the model doesn't have to guess platform jargon.
# "remote_local" is our reading of their docs: remote, but only for residents of the job's country.
MODALITY = {
    "fully_remote": "Fully remote, open to candidates in any country.",
    "remote_local": "Remote, but only for candidates who live in the job's country.",
    "temporarily_remote": "Temporarily remote; will become on-site in the job's city.",
    "hybrid": "Hybrid: part on-site in the job's city.",
    "no_remote": "On-site in the job's city.",
}


def getonbrd(pages=4):
    for page in range(1, pages + 1):
        data = json.loads(get(f"https://www.getonbrd.com/api/v0/search/jobs?query=developer&per_page=50&page={page}"))
        for j in data.get("data", []):
            a = j["attributes"]
            # The public search API returns only the company id; the text names the company when it matters.
            company = f"getonbrd-company-{((a.get('company') or {}).get('data') or {}).get('id', '')}"
            yield {
                "source": "getonbrd",
                "id": f"gob-{j['id']}",
                "title": a.get("title", ""),
                "company": company,
                "location": ", ".join(a.get("countries") or []) + (f" ({a['remote_zone']})" if a.get("remote_zone") else ""),
                "text": text(" ".join(filter(None, [a.get("description"), a.get("functions"), a.get("benefits"), a.get("projects")])))
                + (f"\nSalary: {a['min_salary']}-{a['max_salary']} USD/month" if a.get("min_salary") else "")
                + (f"\nWhere: {MODALITY.get(a.get('remote_modality'), a.get('remote_modality'))}" if a.get("remote_modality") else "")
                + (f"\nCountries: {', '.join(a.get('countries') or [])}" if a.get("countries") else ""),
                "url": j.get("links", {}).get("public_url", ""),
                "posted": str(a.get("published_at", "")),
            }
        if len(data.get("data", [])) < 50:
            break


if __name__ == "__main__":
    jobs, counts = [], {}
    for source in (hn, remotive, wwr, getonbrd):
        try:
            got = list(source())
        except Exception as e:  # one broken source should not sink the others
            print(f"{source.__name__}: failed ({e})")
            continue
        counts[source.__name__] = len(got)
        jobs += got
    json.dump(jobs, open(DATA / "jobs.json", "w"), ensure_ascii=False, indent=1)
    print(counts, "total", len(jobs))
