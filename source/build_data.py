"""Assemble all course content into one data object for the site."""
import json, re, glob, os, csv, math
import markdown

ROOT = os.path.dirname(os.path.abspath(__file__))
BASE = ROOT if os.path.isdir(os.path.join(ROOT, "content")) else os.path.dirname(ROOT)

ORDER = ["conclusion", "classical", "conception", "crucible", "climax",
         "codify", "collapse", "catastrophe", "correction"]

# Era bands follow the book's dates. Timeline uses a piecewise scale.
ERAS = {
    "classical":   {"start": 1340, "end": 1890, "color": "classical"},
    "conception":  {"start": 1890, "end": 1920, "color": "conception"},
    "crucible":    {"start": 1920, "end": 1950, "color": "crucible"},
    "climax":      {"start": 1950, "end": 1980, "color": "climax"},
    "codify":      {"start": 1980, "end": 2010, "color": "codify"},
    "collapse":    {"start": 2010, "end": 2040, "color": "collapse"},
    "catastrophe": {"start": 2040, "end": 2100, "color": "catastrophe"},
}


def parse_chapter(path):
    raw = open(path, encoding="utf-8").read()
    meta = {}
    for k, v in re.findall(r"<!--\s*(\w+):\s*(.*?)\s*-->", raw):
        meta[k] = v
    body = re.sub(r"<!--.*?-->\n?", "", raw)
    title_m = re.match(r"#\s+(.+)\n", body)
    title = title_m.group(1).strip() if title_m else ""
    body = body[title_m.end():] if title_m else body
    words = len(re.findall(r"\b\w[\w'’-]*\b", body))
    html = markdown.markdown(body.strip(), extensions=["extra", "smarty"],
                             output_format="html5")
    # headings get ids for an in-chapter outline
    heads = []
    def addid(m):
        text = re.sub(r"<.*?>", "", m.group(1))
        hid = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:48]
        heads.append({"id": hid, "text": text})
        return f'<h2 id="ch-{hid}">{m.group(1)}</h2>'
    html = re.sub(r"<h2>(.*?)</h2>", addid, html)
    epi = None
    if "epigraph" in meta:
        q, _, a = meta["epigraph"].partition("|")
        epi = {"quote": q.strip().strip('"“”'), "attribution": a.strip().lstrip("—").strip()}
    return {
        "title": title, "years": meta.get("years"), "subtitle": meta.get("subtitle"),
        "definition": meta.get("definition"), "epigraph": epi,
        "status": meta.get("status", "draft"), "words": words,
        "minutes": max(1, round(words / 230)), "html": html, "outline": heads,
        "markdown": body.strip(),
    }


def norm_words(t):
    t = re.sub(r"^(projected|scenario|precedent|historical analog):\s*", "", t.lower())
    return set(w for w in re.findall(r"[a-z0-9]+", t) if w not in {"the", "of", "and", "a", "act", "s", "in", "to", "for"})


def main():
    modules = []
    for i, mid in enumerate(ORDER):
        content = json.load(open(f"{BASE}/content/{mid}.json", encoding="utf-8"))
        chap = parse_chapter(glob.glob(f"{BASE}/chapters/{i:02d}-{mid}.md")[0])
        content["chapter"] = chap
        content["downloads"] = {"pdf": f"downloads/{i:02d}-{mid}.pdf"}
        modules.append(content)

    UNIT_ORDER = ["collapse", "conclusion", "codify", "climax", "crucible", "conception", "classical", "catastrophe", "correction"]
    ROLE = {"collapse": "Where we are", "conclusion": "How to read this story", "codify": "How we got here", "climax": "How we got here",
            "crucible": "How we got here", "conception": "How we got here", "classical": "The root", "catastrophe": "Where it's heading", "correction": "What we do now"}
    for m in modules:
        m["unit"] = UNIT_ORDER.index(m["id"]) + 1
        m["role"] = ROLE[m["id"]]
        m["chapterLabel"] = "The book's opening" if m["id"] == "conclusion" else f"Chapter {m['number']} of the book"
    seeds_lens = json.load(open(f"{BASE}/context/seeds_lens.json", encoding="utf-8"))
    course = json.load(open(f"{BASE}/context/course.json", encoding="utf-8"))
    notebook = json.load(open(f"{BASE}/context/notebook.json", encoding="utf-8"))
    for pg in notebook["pages"]:
        pg["file"] = f"notes/p{pg['n']:02d}.jpg"
    for m in modules:
        m["balance"] = notebook.get("byEra", {}).get(m["id"])

    # ---- timeline items
    MT = json.load(open(f"{BASE}/context/master_timeline.json", encoding="utf-8"))
    HAND = {x["id"]: x["hand"] for x in MT["matches"]}
    # a few existing entries belong in the lanes his legend uses (culture / technology, money)
    REASSIGN = {"conception-his-0": ("culture", "tech"), "classical-his-3": ("culture", "tech"), "collapse-his-0": ("culture", "tech"),
                "climax-his-4": ("markets", "money"), "codify-his-1": ("markets", "money")}
    LIST_OF = {"policy": "policyEvents", "markets": "marketDrops", "movements": "socialMovements", "history": "historicalContext", "culture": "cultureEvents"}
    era_of = lambda y: next(k for k, v in ERAS.items() if v["start"] <= y < v["end"])
    items, seen = [], []
    lane_of = {"policyEvents": "policy", "marketDrops": "markets",
               "socialMovements": "movements", "historicalContext": "history"}
    skip_prefix = ("precedent:", "historical analog:", "scenario:")
    for m in modules:
        mid = m["id"]
        m.setdefault("cultureEvents", [])
        moved = []
        for key, lane in lane_of.items():
            for idx, e in enumerate(m.get(key, [])):
                title = e.get("title") or e.get("name")
                e["itemId"] = None
                if title.lower().startswith(skip_prefix):
                    continue
                if mid == "conclusion" and "trustees" not in title.lower():
                    continue
                if mid == "correction" and lane == "history" and "inception" in title.lower():
                    continue
                w = norm_words(title)
                dup = None
                for (ln, yr, ws, oid) in seen:
                    if ln == lane and abs(yr - e["year"]) <= 1 and ws and w and len(w & ws) / len(w | ws) >= 0.4:
                        dup = oid; break
                if dup:
                    e["itemId"] = dup
                    continue
                iid = f"{mid}-{key[:3]}-{idx}"
                seen.append((lane, e["year"], w, iid))
                typ = e.get("type") if lane == "policy" else {"markets": "crisis", "movements": "movement", "history": "history"}[lane]
                ln, typ = REASSIGN.get(iid, (lane, typ or "policy"))
                e["itemId"] = iid
                e["type"] = typ
                if iid in HAND:
                    e["master"] = True; e["hand"] = HAND[iid]
                items.append({
                    "id": iid, "lane": ln, "type": typ,
                    "year": e["year"], "endYear": e.get("endYear"), "title": title,
                    "detail": e.get("detail", ""), "significance": e.get("significance") or e.get("retirementImpact") or "",
                    "decline": e.get("decline"), "module": mid,
                    "projected": e["year"] > 2026 or title.lower().startswith("projected"),
                    "master": iid in HAND, "hand": HAND.get(iid),
                })
                if ln != lane:
                    moved.append((key, e, LIST_OF[ln]))
        for key, e, dest in moved:
            m[key].remove(e); m[dest].append(e)
    # the author's master timeline: entries that were not yet on the line
    for a in MT["add"]:
        mod = era_of(a["year"])
        items.append({"id": a["id"], "lane": a["lane"], "type": a["type"], "year": a["year"], "endYear": a.get("endYear"),
                      "title": a["title"], "detail": a["detail"], "significance": a.get("significance", ""), "decline": a.get("decline"),
                      "module": mod, "projected": a["year"] > 2026, "master": True, "hand": a["hand"], "src": a.get("src", "sheet")})
        m = next(x for x in modules if x["id"] == mod)
        m.setdefault(LIST_OF[a["lane"]], []).append({"year": a["year"], "endYear": a.get("endYear"), "title": a["title"], "detail": a["detail"],
                                                   "significance": a.get("significance", ""), "decline": a.get("decline"), "type": a["type"],
                                                   "itemId": a["id"], "master": True, "hand": a["hand"]})
    for m in modules:
        for key in LIST_OF.values():
            if key in m:
                m[key].sort(key=lambda e: (e["year"], e.get("endYear") or e["year"]))
    # his bracketed notes, as their own lane
    for n in MT["notes"]:
        items.append({"id": n["id"], "lane": "notes", "type": "note", "year": n["year"], "endYear": n.get("endYear"), "title": n["text"],
                      "detail": n["detail"], "significance": "", "decline": None, "color": n.get("color"), "module": era_of(n["year"]),
                      "projected": False, "master": True, "hand": n["text"], "src": n.get("src", "sheet")})
    # one addition from the author's own timeline
    items.append({"id": "grimm-pension-peak", "lane": "policy", "type": "policy", "year": 1979, "endYear": None,
                  "title": "Pension coverage peaks",
                  "detail": "About 38% of private-sector wage and salary workers participated in a defined-benefit pension in 1979, the high-water mark (EBRI). The share declines nearly every year afterward.",
                  "significance": "The people who believe retirement works are largely those who entered the workforce in this narrow window.",
                  "decline": None, "module": "climax", "projected": False})
    for s in seeds_lens["seeds"]:
        items.append({"id": f"seed-{s['n']}", "lane": "seeds", "type": "seed", "year": s["year"], "endYear": None,
                      "title": f"Seed {s['n']}: {s['name']}", "detail": s["root"], "significance": s["short"],
                      "decline": None, "seed": s["n"], "module": era_of(s["year"]),
                      "projected": False, "master": True, "hand": s.get("hand")})

    # ---- two-person lens
    lens = []
    for m in modules:
        if m["id"] == "conclusion":
            continue
        t = m["twoPersonLens"]
        lens.append({"year": t["year"], "module": m["id"], "label": m["title"], "older": t["older"], "younger": t["younger"], "irony": t["irony"], "source": "module"})
    for x in seeds_lens["extraLens"]:
        mod = next(k for k, v in ERAS.items() if v["start"] <= x["year"] < v["end"])
        lens.append({**x, "module": mod, "source": "author"})
    lens.sort(key=lambda r: r["year"])
    for i, l in enumerate(lens):
        l["id"] = f"lens-{l['year']}-{i}"
        items.append({"id": l["id"], "lane": "lens", "type": "lens", "year": l["year"], "endYear": None,
                      "title": f"Two-Person Lens, {l['year']}", "detail": "", "significance": l["irony"],
                      "decline": None, "module": l["module"], "projected": l["year"] > 2026, "lens": l["id"]})

    items.sort(key=lambda r: (r["year"], r["lane"]))

    sp = [[int(r["year"]), float(r["value"])] for r in csv.DictReader(open(f"{BASE}/context/sp500.csv"))]

    data = {
        "meta": {"title": "The Story of Retirement", "subtitle": "A brief history (because it really hasn't been around that long)",
                 "byline": "Jonathan Grimm", "org": "Fernbridge Advisors", "book": "A Concise History of Retirement",
                 "status": "Working draft, 2026", "fullPdf": "downloads/the-story-of-retirement-draft.pdf",
                 "guidePdf": "downloads/course-guide.pdf"},
        "eras": [{"id": k, **v} for k, v in ERAS.items()],
        "modules": sorted(modules, key=lambda m: m["unit"]), "seeds": seeds_lens["seeds"], "lens": lens, "items": items,
        "sp": sp, "course": course,
        "links": MT["links"], "threads": MT["threads"], "notebook": notebook,
        "master": {"legend": MT["legend"], "quotes": MT["quotes"], "source": MT["source"], "photo": "master-timeline.jpg",
                   "thumb": "master-timeline-thumb.jpg", "count": sum(1 for i in items if i.get("master"))},
    }
    ids = {i["id"] for i in items}
    for l in MT["links"]:
        assert l["from"] in ids and l["to"] in ids, l
    for t in MT["threads"]:
        assert all(i in ids for i in t["items"]), t["id"]
    os.makedirs(f"{ROOT}/build", exist_ok=True)
    json.dump(data, open(f"{ROOT}/build/data.json", "w", encoding="utf-8"), ensure_ascii=False)
    # slim copy for the browser (drop markdown source)
    for m in data["modules"]:
        m["chapter"].pop("markdown", None)
    js = "window.__SOR__=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";"
    open(f"{ROOT}/build/data.js", "w", encoding="utf-8").write(js)
    from collections import Counter
    print("items", len(items), Counter(i["lane"] for i in items))
    print("lens", [l["year"] for l in lens])
    print("data.js bytes", len(js.encode()))


if __name__ == "__main__":
    main()
