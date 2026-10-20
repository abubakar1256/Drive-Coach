"""Read-only transcription of visually inspected Category B table regions.

Explicit crops prevent mixing lorry/motorcycle columns with car passage lists.
No geocoding, database writes or automatic location review.
"""
import json
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[2] / "output/chatbot-audit/operator-sources-20261020"
# slug, Category B bounds (relative to page), point-column bounds, exact groups
PLANS = [
    ("arlon-weyler", (.209, .334, .94, .571), (.268, .48, .711, .94), 8),
    ("bastogne", (.105, .400, .47, .661), (.133, .24, .355, .47), 8),
    ("eupen-lontzen", (.105, .380, .47, .644), (.133, .24, .355, .47), 8),
    ("huy-tihange", (.209, .313, .94, .573), (.268, .48, .711, .94), 10),
    ("liege-wandre", (.069, .280, .314, .943), (.0895, .160, .237, .314), 20),
    ("lobbes", (.209, .650, .94, .912), (.268, .48, .711, .94), 8),
    ("louvain-la-neuve", (.209, .249, .94, .432), (.268, .48, .711, .94), 8),
    ("marche-en-famenne", (.209, .271, .94, .460), (.268, .48, .711, .94), 8),
    ("mons-cuesmes", (.105, .277, .431, .951), (.133, .232, .332, .431), 20),
    ("namur-suarlee", (.105, .288, .47, .552), (.133, .24, .355, .47), 8),
    ("tournai-marquain", (.105, .306, .47, .961), (.133, .238, .348, .47), 20),
    ("aibv-braine-points", (.046, .300, .957, .830), (.110, .391, .675, .957), 8),
    ("aibv-couillet-points", (.046, .300, .957, .900), (.110, .391, .675, .957), 20),
    ("aibv-mariembourg-points", (.046, .300, .957, .830), (.110, .391, .675, .957), 8),
]

def extract(slug, bounds, cols, count):
    key = slug if slug.startswith("aibv-") else "autosecurite-" + slug
    with pdfplumber.open(ROOT / (key + ".pdf")) as document:
        if len(document.pages) != 1:
            raise ValueError("Inspected single-page source required")
        page = document.pages[0]
        w, h = page.width, page.height
        box = tuple(v * (w if i % 2 == 0 else h) for i, v in enumerate(bounds))
        numbers = [p for p in page.crop((box[0], box[1], cols[0] * w, box[3])).extract_words() if p["text"].isdigit()]
        if [int(n["text"]) for n in numbers] != list(range(1, count + 1)):
            raise ValueError(key + ": numbered row crop incomplete: " + str([n["text"] for n in numbers]))
        centres = [(n["top"] + n["bottom"]) / 2 for n in numbers]
        edges = [box[1]] + [(a + b) / 2 for a, b in zip(centres, centres[1:])] + [box[3]]
        rows = []
        for index in range(count):
            cells = [" ".join((page.crop((a * w, edges[index], b * w, edges[index + 1])).extract_text() or "").split()) for a, b in zip(cols, cols[1:])]
            if any(not c for c in cells):
                raise ValueError(key + ": missing printed cell")
            rows.append(cells)
        return {"key": key, "groups": rows, "sourceCategory": "B", "automaticallyLocationReviewed": False}

if __name__ == "__main__":
    for plan in PLANS:
        result = extract(*plan)
        target = ROOT / (result["key"] + "-category-b.json")
        target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(result, ensure_ascii=True), flush=True)
