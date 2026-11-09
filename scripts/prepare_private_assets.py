"""Add project assets from a local copy of Tailings_Platform_Main."""
import argparse
import json
import shutil
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("platform", type=Path)
args = parser.parse_args()
public = Path(__file__).resolve().parents[1] / "frontend/public"
source = args.platform.resolve()
shutil.copytree(
    source / "resources/models/original_scene",
    public / "models/original_scene",
    dirs_exist_ok=True,
)
model = public / "models/original_scene/tileset.json"
if not model.is_file():
    raise SystemExit("Missing original_scene/tileset.json")
library = public / "data/handbooks"
library.mkdir(parents=True, exist_ok=True)
catalog = []
with sqlite3.connect((source / "data/platform.sqlite").as_uri() + "?mode=ro", uri=True) as db:
    for identifier, name, pages, indexed, status in db.execute(
        "SELECT id,name,page_count,indexed_pages,status FROM docs "
        "WHERE id LIKE 'manual_%' ORDER BY id"
    ):
        entries = [
            {"page": page, "text": text}
            for page, text in db.execute(
                "SELECT page,text FROM chunks WHERE doc_id=? ORDER BY page,id", (identifier,)
            )
        ]
        catalog.append({
            "id": identifier, "name": name, "pageCount": pages, "pagesWithText": indexed,
            "count": len(entries), "status": status,
        })
        if entries:
            (library / (identifier + ".json")).write_text(
                json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
            )
(library / "catalog.json").write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
(public / "data/scene.json").write_text('{"original":true}', encoding="utf-8")
