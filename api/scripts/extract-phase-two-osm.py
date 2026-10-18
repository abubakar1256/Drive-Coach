"""Offline evidence only: never verifies database locations or publishes routes.

Requires pyosmium in an isolated tool environment. Input is a dated Geofabrik
Belgium extract. The JSON contains public road objects and ODbL provenance, not
personal OSM contributor metadata. Missing/ambiguous/restricted data stays visible.
"""
import hashlib
import json
import math
from pathlib import Path
import sys
import unicodedata
from datetime import datetime, timezone

import osmium

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/chatbot-audit/phase-two-offline-map"
PBF = OUT / "belgium-261017.osm.pbf"


def normalize(value):
    return "".join(c for c in unicodedata.normalize("NFKD", value).lower() if c.isascii() and c.isalnum())


def cell(lat, lon):
    return math.floor(lat * 100), math.floor(lon * 100)


def main():
    if not PBF.is_file() or PBF.stat().st_size != 697053885:
        raise ValueError("Complete, dated Belgium extract required (697053885 bytes)")
    checksum_file = OUT / "belgium-261017.osm.pbf.md5"
    expected = checksum_file.read_text(encoding="utf-8").split()[0]
    md5 = hashlib.md5()
    sha256 = hashlib.sha256()
    with PBF.open("rb") as stream:
        while chunk := stream.read(8 * 1024 * 1024):
            md5.update(chunk)
            sha256.update(chunk)
    if md5.hexdigest() != expected:
        raise ValueError("Provider checksum mismatch; do not use this map extract")
    sources = json.loads((ROOT / "output/chatbot-audit/phase-two-map-evidence/passage-candidates.json").read_text(encoding="utf-8"))["centres"]
    routes = json.loads((ROOT / "api/prisma/data/road-practice-phase-two-prepared.json").read_text(encoding="utf-8"))["routes"]
    names = {normalize(road.strip()) for source in sources for point in source["points"] for road in point["junction"].replace(" – ", " - ").split(" - ")}
    names.update(map(normalize, ["Kolmen", "Lammerdries", "Neerveld", "Santvoortbeeklaan", "Nieshofstraat", "Ambachtenlaan"]))
    starts = [{"key": f'{r["centreSlug"]}:{r.get("slot", 1)}', **r["points"][0]} for r in routes]
    start_cells = set()
    for start in starts:
        y, x = cell(start["latitude"], start["longitude"])
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                start_cells.add((y + dy, x + dx))

    class Evidence(osmium.SimpleHandler):
        def __init__(self):
            super().__init__()
            self.ways = []
            self.scanned = 0

        def way(self, way):
            self.scanned += 1
            if self.scanned % 500000 == 0:
                print(json.dumps({"waysScanned": self.scanned, "retained": len(self.ways)}), flush=True)
            if "highway" not in way.tags:
                return
            named = any(normalize(way.tags.get(k, "")) in names for k in ("name", "name:nl", "official_name", "alt_name"))
            near_start = False
            if not named:
                near_start = any(n.location.valid() and cell(n.lat, n.lon) in start_cells for n in way.nodes)
                if not near_start:
                    return
            nodes = [{"id": n.ref, "lat": n.lat, "lon": n.lon} for n in way.nodes if n.location.valid()]
            if len(nodes) != len(way.nodes) or len(nodes) < 2:
                return
            self.ways.append({"id": way.id, "tags": dict(way.tags), "nodes": [n["id"] for n in nodes], "geometry": [{"lat": n["lat"], "lon": n["lon"]} for n in nodes], "url": f"https://www.openstreetmap.org/way/{way.id}"})

    evidence = Evidence()
    evidence.apply_file(str(PBF), locations=True, idx="flex_mem")
    result = {"createdAt": datetime.now(timezone.utc).isoformat(), "sourceUrl": "https://download.geofabrik.de/europe/belgium-261017.osm.pbf", "sourceMd5": md5.hexdigest(), "sourceSha256": sha256.hexdigest(), "license": "ODbL 1.0", "licenseUrl": "https://www.openstreetmap.org/copyright", "attribution": "© OpenStreetMap contributors", "automaticallyVerified": False, "waysScanned": evidence.scanned, "elements": evidence.ways}
    target = OUT / "road-evidence.json"
    # Derived public map evidence; no application/database writes.
    target.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"evidenceFile": str(target), "ways": len(evidence.ways), "databaseChanged": False, "automaticallyVerified": False}), flush=True)


if __name__ == "__main__":
    main()
