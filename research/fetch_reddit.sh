#!/usr/bin/env bash
# Download r/dev_venezuela listings as RSS (Reddit's JSON API rejects anonymous clients).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data

UA="Mozilla/5.0 (Macintosh)"
BASE="https://www.reddit.com/r/dev_venezuela"

fetch() { curl -fsS -A "$UA" "$BASE/$1" -o "data/$2"; sleep 2; }
fetch "new/.rss?limit=100" new.rss
fetch "hot/.rss?limit=100" hot.rss
fetch "top/.rss?t=all&limit=100" top.rss
fetch "top/.rss?t=year&limit=100" topyear.rss

curl -fsS -A "$UA" https://remoteok.com/api -o data/remoteok.json
echo "Saved feeds to research/data/"
