"""Offline candidate discovery for the remaining operator references, never approval."""
import hashlib
import json
import re
import unicodedata
from pathlib import Path
from datetime import datetime, timezone
import osmium

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/chatbot-audit/phase-two-remaining"
PBF = ROOT / "output/chatbot-audit/phase-two-offline-map/belgium-261017.osm.pbf"

def normalize(value):
    value = unicodedata.normalize("NFKD", value).lower()
    value = re.sub(r"str\.(?=\W|$)", "straat ", value)
    value = re.sub(r"stwg\.?", "steenweg ", value)
    return "".join(c for c in value if c.isascii() and c.isalnum())

def main():
    if PBF.stat().st_size != 697053885:
        raise ValueError("Complete dated extract required")
    md5, sha = hashlib.md5(), hashlib.sha256()
    with PBF.open("rb") as stream:
        while chunk := stream.read(8 * 1024 * 1024):
            md5.update(chunk); sha.update(chunk)
    if md5.hexdigest() != PBF.with_suffix(".pbf.md5").read_text().split()[0]:
        raise ValueError("Provider checksum mismatch")
    sources = []
    for filename in ["supplemental-passage-sources.json", "walloon-passage-sources-2026.json"]:
        sources += json.loads((ROOT / "api/prisma/data" / filename).read_text(encoding="utf8"))["sources"]
    terms = set()
    for source in sources:
        for point in source["points"]:
            words = re.sub(r"[/–—\-():]", " ", point["junction"]).split()
            for start in range(len(words)):
                for end in range(start + 1, min(start + 10, len(words)) + 1):
                    value = normalize(" ".join(words[start:end]))
                    if len(value) >= 4:
                        terms.add(value)
    retained, scanned = [], 0
    processor = osmium.FileProcessor(str(PBF)).with_locations("flex_mem").with_filter(osmium.filter.KeyFilter("highway"))
    allowed = {"motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified", "living_street", "service"}
    for way in processor:
        if not way.is_way():
            continue
        scanned += 1
        if way.tags.get("highway") not in allowed:
            continue
        names = [n for key in ("name", "name:nl", "name:fr", "name:de", "official_name", "alt_name", "ref") for n in way.tags.get(key, "").split(";") if n]
        if not any(normalize(n) in terms for n in names):
            continue
        if any(not n.location.valid() for n in way.nodes):
            continue
        retained.append({"id": way.id, "tags": dict(way.tags), "names": names, "nodes": [{"id": n.ref, "latitude": n.lat, "longitude": n.lon} for n in way.nodes], "url": f"https://www.openstreetmap.org/way/{way.id}"})
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / "named-road-candidates.json"
    result = {"createdAt": datetime.now(timezone.utc).isoformat(), "sourceUrl": "https://download.geofabrik.de/europe/belgium-261017.osm.pbf", "sourceSha256": sha.hexdigest(), "licenseUrl": "https://www.openstreetmap.org/copyright", "attribution": "© OpenStreetMap contributors", "automaticallyVerified": False, "sources": sources, "ways": retained}
    target.write_text(json.dumps(result, ensure_ascii=False), encoding="utf8")
    print(json.dumps({"file": str(target), "waysScanned": scanned, "retainedWays": len(retained), "sources": len(sources), "providerRequests": 0, "databaseChanged": False}), flush=True)

if __name__ == "__main__":
    main()
