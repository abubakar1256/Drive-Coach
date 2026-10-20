"""Read-only source inspection; derived text/tables/previews, no source approval."""
import json
from pathlib import Path
import pdfplumber

ROOT = Path(__file__).resolve().parents[2] / "output/chatbot-audit/operator-sources-20261020"
for filename in sorted(ROOT.glob("*.pdf")):
    if (ROOT / f"{filename.stem}-extracted.json").exists():
        continue
    pages = []
    with pdfplumber.open(filename) as document:
        for number, page in enumerate(document.pages, 1):
            pages.append({"page": number, "text": page.extract_text() or "", "tables": page.extract_tables()})
            page.to_image(resolution=110).save(ROOT / f"{filename.stem}-page-{number}.png")
    result = {"file": str(filename), "pages": pages, "automaticallyReviewed": False}
    target = ROOT / f"{filename.stem}-extracted.json"
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"file": filename.name, "pages": len(pages), "text": "\n".join(p["text"] for p in pages)}, ensure_ascii=True), flush=True)
