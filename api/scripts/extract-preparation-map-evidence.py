"""Offline map evidence candidates, not automatic review or driving permission."""
import hashlib
import json
import math
from pathlib import Path
import sys
from datetime import datetime, timezone
import osmium

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output/chatbot-audit/preparation-content"
PBF = ROOT / "output/chatbot-audit/phase-two-offline-map/belgium-261017.osm.pbf"

def cell(lat, lon):
    return math.floor(lat * 1000), math.floor(lon * 1000)

def main():
    route_file = Path(sys.argv[1]).resolve()
    if not route_file.is_relative_to(OUT) or PBF.stat().st_size != 697053885:
        raise ValueError("Task evidence and complete dated map extract required")
    md5, sha256 = hashlib.md5(), hashlib.sha256()
    with PBF.open("rb") as stream:
        while chunk := stream.read(8 * 1024 * 1024):
            md5.update(chunk)
            sha256.update(chunk)
    if md5.hexdigest() != PBF.with_suffix(".pbf.md5").read_text().split()[0]:
        raise ValueError("Map provider checksum mismatch")
    routes = json.loads(route_file.read_text(encoding="utf-8"))
    cells = set()
    for route in routes["routes"]:
        if not route["valid"]:
            continue
        for lon, lat in route["coordinates"]:
            y, x = cell(lat, lon)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    cells.add((y + dy, x + dx))

    class Evidence(osmium.SimpleHandler):
        def __init__(self):
            super().__init__()
            self.ways, self.nodes = [], []
            self.scanned = 0

        def node(self, node):
            if not node.location.valid() or cell(node.lat, node.lon) not in cells:
                return
            if node.tags.get("highway") in ("traffic_signals", "crossing", "stop", "give_way"):
                self.nodes.append({"id": node.id, "latitude": node.lat, "longitude": node.lon, "tags": dict(node.tags), "url": f"https://www.openstreetmap.org/node/{node.id}"})

        def way(self, way):
            self.scanned += 1
            if self.scanned % 750000 == 0:
                print(json.dumps({"waysScanned": self.scanned, "retained": len(self.ways)}), flush=True)
            highway = way.tags.get("highway", "")
            if highway not in ("motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "unclassified", "living_street", "service"):
                return
            if any(way.tags.get(key) in ("no", "private", "destination") for key in ("access", "vehicle", "motor_vehicle", "motorcar")):
                return
            if not any(n.location.valid() and cell(n.lat, n.lon) in cells for n in way.nodes):
                return
            nodes = [{"id": n.ref, "latitude": n.lat, "longitude": n.lon} for n in way.nodes if n.location.valid()]
            if len(nodes) != len(way.nodes) or len(nodes) < 2:
                return
            self.ways.append({"id": way.id, "tags": dict(way.tags), "nodes": nodes, "url": f"https://www.openstreetmap.org/way/{way.id}"})

    handler = Evidence()
    # Filter in C++ before entering Python: untagged road vertices still feed
    # the location cache but do not trigger millions of Python node callbacks.
    processor = osmium.FileProcessor(str(PBF)).with_locations("flex_mem").with_filter(osmium.filter.KeyFilter("highway"))
    for entity in processor:
        if entity.is_node():
            handler.node(entity)
        elif entity.is_way():
            handler.way(entity)
    result = {"createdAt": datetime.now(timezone.utc).isoformat(), "inputIdentity": routes["identity"], "inputSha256": hashlib.sha256(route_file.read_bytes()).hexdigest(), "sourceUrl": "https://download.geofabrik.de/europe/belgium-261017.osm.pbf", "sourceSha256": sha256.hexdigest(), "attribution": "© OpenStreetMap contributors", "licenseUrl": "https://www.openstreetmap.org/copyright", "automaticallyReviewed": False, "ways": handler.ways, "nodes": handler.nodes}
    target = OUT / "route-map-evidence.json"
    target.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"file": str(target), "ways": len(handler.ways), "nodes": len(handler.nodes), "automaticallyReviewed": False, "databaseChanged": False}), flush=True)

if __name__ == "__main__":
    main()
