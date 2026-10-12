"""Render chapter PDFs, the full draft and the course guide with headless Chromium."""
import json, os, html, pathlib
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent
in_repo = (ROOT.parent / "public").is_dir() and (ROOT.parent / "netlify").is_dir()
OUT = (ROOT.parent / "public" if in_repo else ROOT / "dist") / "downloads"; OUT.mkdir(parents=True, exist_ok=True)
TMP = ROOT / "build" / "pdf"; TMP.mkdir(parents=True, exist_ok=True)
D = json.load(open(ROOT / "build" / "data.json", encoding="utf-8"))
NM = ROOT / "node_modules"
E = html.escape

CSS = f"""
@font-face {{ font-family: Archivo; src: url('file://{NM}/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2') format('woff2'); font-weight: 100 900; font-stretch: 62% 125%; }}
@font-face {{ font-family: Newsreader; src: url('file://{NM}/@fontsource-variable/newsreader/files/newsreader-latin-standard-normal.woff2') format('woff2'); font-weight: 200 800; }}
@font-face {{ font-family: Newsreader; font-style: italic; src: url('file://{NM}/@fontsource-variable/newsreader/files/newsreader-latin-standard-italic.woff2') format('woff2'); font-weight: 200 800; }}
@font-face {{ font-family: 'Courier Prime'; src: url('file://{NM}/@fontsource/courier-prime/files/courier-prime-latin-400-normal.woff2') format('woff2'); font-weight: 400; }}
@font-face {{ font-family: 'Courier Prime'; src: url('file://{NM}/@fontsource/courier-prime/files/courier-prime-latin-700-normal.woff2') format('woff2'); font-weight: 700; }}
@page {{ size: Letter; margin: 0.85in 0.95in 0.9in; }}
* {{ box-sizing: border-box; }}
body {{ font-family: Newsreader, Georgia, serif; font-size: 11.6pt; line-height: 1.55; color: #16181d; margin: 0; }}
.eyebrow {{ font-family: 'Courier Prime', monospace; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: #5e6573; }}
h1.ct {{ font-family: Archivo, sans-serif; font-stretch: 125%; font-weight: 800; font-size: 40pt; line-height: .95; text-transform: uppercase; margin: 6pt 0 8pt; }}
.def {{ font-family: 'Courier Prime', monospace; font-size: 10pt; color: #5e6573; }}
.sub {{ font-style: italic; font-size: 14pt; color: #363b46; margin: 6pt 0 0; }}
.band {{ height: 6pt; border-radius: 3pt; width: 64pt; margin-bottom: 14pt; }}
.epi {{ font-style: italic; font-size: 13pt; color: #363b46; margin: 16pt 0 18pt; max-width: 34em; }}
.epi cite {{ display: block; font-style: normal; font-family: 'Courier Prime', monospace; font-size: 9pt; color: #5e6573; margin-top: 4pt; }}
.chapter-head {{ border-bottom: 1px solid #c9ced6; padding-bottom: 14pt; margin-bottom: 18pt; }}
p {{ margin: 0 0 .8em; orphans: 3; widows: 3; }}
h2 {{ font-family: Archivo, sans-serif; font-stretch: 112%; font-weight: 800; font-size: 12.5pt; text-transform: uppercase; letter-spacing: .02em; margin: 1.6em 0 .6em; break-after: avoid; }}
blockquote {{ margin: 1em 0; padding-left: 14pt; border-left: 2.5pt solid #a9b0bc; font-style: italic; color: #363b46; }}
.note {{ font-family: Archivo, sans-serif; font-size: 9pt; color: #5e6573; border: 1px dashed #a9b0bc; border-radius: 6pt; padding: 7pt 9pt; margin-bottom: 16pt; }}
.chap {{ break-before: page; }}
.title-page {{ height: 9.1in; display: flex; flex-direction: column; justify-content: center; }}
.title-page h1 {{ font-family: Archivo, sans-serif; font-stretch: 125%; font-weight: 800; font-size: 58pt; line-height: .9; text-transform: uppercase; margin: 0; }}
.title-page h1 span {{ display: block; font-weight: 300; font-size: 22pt; letter-spacing: .14em; color: #5e6573; margin-bottom: 6pt; }}
.toc {{ list-style: none; padding: 0; margin: 0; font-family: Archivo, sans-serif; }}
.toc li {{ display: flex; gap: 10pt; padding: 7pt 0; border-top: 1px solid #d3d8df; font-size: 11pt; }}
.toc .n {{ font-family: 'Courier Prime', monospace; color: #5e6573; width: 70pt; }}
.toc .y {{ margin-left: auto; font-family: 'Courier Prime', monospace; color: #5e6573; }}
/* guide */
.ui {{ font-family: Archivo, sans-serif; font-size: 9.6pt; line-height: 1.45; }}
h3 {{ font-family: Archivo, sans-serif; font-stretch: 112%; font-weight: 800; font-size: 13pt; margin: 18pt 0 6pt; break-after: avoid; }}
h4 {{ font-family: 'Courier Prime', monospace; font-weight: 700; font-size: 8.5pt; letter-spacing: .08em; text-transform: uppercase; color: #5e6573; margin: 14pt 0 5pt; break-after: avoid; }}
ul, ol {{ margin: 0 0 8pt; padding-left: 16pt; }}
li {{ margin-bottom: 3pt; }}
table {{ width: 100%; border-collapse: collapse; font-family: Archivo, sans-serif; font-size: 8.2pt; line-height: 1.35; margin: 4pt 0 10pt; break-inside: auto; }}
th, td {{ border: 1px solid #c9ced6; padding: 5pt 6pt; vertical-align: top; text-align: left; }}
thead th {{ background: #eef0f3; font-family: 'Courier Prime', monospace; font-size: 7.5pt; letter-spacing: .05em; text-transform: uppercase; }}
tr {{ break-inside: avoid; }}
.q {{ font-size: 13.5pt; font-style: italic; margin: 6pt 0 10pt; }}
dl {{ margin: 0; }} dt {{ font-weight: 700; font-family: Archivo, sans-serif; font-size: 9.6pt; }} dd {{ margin: 0 0 6pt; font-family: Archivo, sans-serif; font-size: 9.6pt; color: #363b46; }}
.cols {{ columns: 2; column-gap: 22pt; }}
.cols > * {{ break-inside: avoid; }}
"""
ERA_HEX = {"classical": "#9FE1CB", "conception": "#B5D4F4", "crucible": "#FAC775", "climax": "#C0DD97", "codify": "#CECBF6",
           "collapse": "#F4C0D1", "catastrophe": "#F7C1C1", "correction": "#E7DFCB", "conclusion": "#16181d"}
FOOT = ('<div style="width:100%;font-family:Helvetica,Arial,sans-serif;font-size:7.5px;color:#6b7280;padding:0 0.95in;display:flex;justify-content:space-between">'
        '<span>{left}</span><span><span class="pageNumber"></span></span></div>')


def chapter_html(m, standalone=True):
    c = m["chapter"]
    epi = f'<div class="epi">“{E(c["epigraph"]["quote"])}”<cite>— {E(c["epigraph"]["attribution"])}</cite></div>' if c.get("epigraph") else ""
    sub = f'<p class="sub">{E(c["subtitle"])}</p>' if c.get("subtitle") else ""
    note = '<div class="note">This chapter is still being written. What follows is the author’s synopsis.</div>' if c.get("status") == "forthcoming" else ""
    return (f'<section class="{"" if standalone else "chap"}"><div class="chapter-head"><div class="band" style="background:{ERA_HEX[m["id"]]}"></div>'
            f'<div class="eyebrow">{E(m["chapterLabel"].replace(" of the book", ""))} · {E(m["years"])} · Unit {m["unit"]} in the course</div><h1 class="ct">{E(m["title"])}</h1>'
            f'<div class="def">{E(m["definition"])}</div>{sub}</div>{epi}{note}{c["html"]}</section>')


def doc(body, title):
    return f'<!doctype html><html><head><meta charset="utf-8"><title>{E(title)}</title><style>{CSS}</style></head><body>{body}</body></html>'


def rubric_table(rub):
    rows = "".join(f'<tr><th>{E(r["criterion"])}<br><span style="font-weight:400">{r["points"]} pts</span></th><td>{E(r["exemplary"])}</td><td>{E(r["proficient"])}</td><td>{E(r["developing"])}</td><td>{E(r["beginning"])}</td></tr>' for r in rub)
    total = sum(r["points"] for r in rub)
    return (f'<table><thead><tr><th style="width:17%">Criterion</th><th>Exemplary</th><th>Proficient</th><th>Developing</th><th>Beginning</th></tr></thead>'
            f'<tbody>{rows}<tr><th>Total</th><td colspan="4">{total} points</td></tr></tbody></table>')


def guide_html():
    C = D["course"]
    parts = [f'<div class="title-page"><div class="eyebrow">Course guide · {E(D["meta"]["byline"])} · {E(D["meta"]["org"])}</div>'
             f'<h1><span>The story of</span>Retirement</h1><p class="sub" style="margin-top:14pt">{E(D["meta"]["subtitle"])}</p>'
             f'<p style="margin-top:24pt;max-width:34em">{E(C["description"])}</p></div>']
    parts.append('<section class="chap ui"><h3 style="margin-top:0">Course outcomes</h3><p>By the end of the course, students will be able to:</p><ol>' + "".join(f"<li>{E(o)}</li>" for o in C["outcomes"]) + '</ol>')
    parts.append('<h3>Schedule</h3><table><thead><tr><th>When</th><th>Unit</th><th>Focus</th><th>Assignment</th></tr></thead><tbody>')
    mods = {m["id"]: m for m in D["modules"]}
    for s in C["schedule"]:
        m = mods.get(s["module"]) if s["module"] else None
        parts.append(f'<tr><td>{E(s["weeks"])}</td><td>{E(f"Unit {m["unit"]}. {m["title"]}") if m else "—"}</td><td>{E(s["focus"])}</td><td>{E(m["assignment"]["title"]) if m else ""}</td></tr>')
    parts.append('</tbody></table><h3>Grading</h3><table><thead><tr><th>Component</th><th>Weight</th><th>What it is</th></tr></thead><tbody>')
    for g in C["grading"]:
        parts.append(f'<tr><td><b>{E(g["component"])}</b></td><td>{g["weight"]}%</td><td>{E(g["detail"])}</td></tr>')
    parts.append('</tbody></table><p>Grade scale: ' + " · ".join(f'{E(s["grade"])} {E(s["range"])}' for s in C["scale"]) + '</p>')
    parts.append('<h3>How to use the course site each week</h3><ol>' + "".join(f"<li>{E(h)}</li>" for h in C["howToUse"]) + f'</ol><h3>Sources and integrity</h3><p>{E(C["integrity"])}</p></section>')
    Q = C.get("inequity")
    if Q:
        F = Q.get("funnel")
        parts.append(f'<section class="chap ui"><h3 style="margin-top:0">{E(Q["title"])}</h3>' + "".join(f'<p style="font-family:Newsreader,serif;font-size:11.2pt">{E(t)}</p>' for t in Q["framing"])
                     + f'<blockquote style="font-size:11pt">“{E(Q["authorWords"])}”<br><span class="eyebrow">— {E(D["meta"]["byline"])}</span></blockquote>')
        if F:
            parts.append(f'<h3>{E(F["title"])}: the author’s working theory</h3><p>{E(F["intro"])}</p><table><thead><tr><th style="width:12%">Level</th><th style="width:34%">In his words</th><th>Against the data</th></tr></thead><tbody>'
                         + "".join(f'<tr><td><b>{l["n"]}. {E(l["name"])}</b></td><td><i>{E(l["his"])}</i></td><td>{E(l["evidence"])}</td></tr>' for l in F["levels"])
                         + f'<tr><td><b>The mouth</b></td><td colspan="2"><i>{E(F["mouth"])}</i></td></tr></tbody></table><p>{E(F["caveat"])}</p>')
        parts.append('<h3>Seven working principles</h3><ol>' + "".join(f'<li><b>{E(p["title"])}.</b> {E(p["text"])}</li>' for p in Q["principles"]) + '</ol>')
        parts.append('<h3>Nine variables, one checked data point each</h3><table><thead><tr><th style="width:14%">Variable</th><th>Data point</th><th style="width:26%">Source</th></tr></thead><tbody>'
                     + "".join(f'<tr><td><b>{E(v["label"])}</b></td><td>{E(v["fact"])}</td><td>{E(v["source"])}</td></tr>' for v in Q["variables"]) + '</tbody></table>')
        parts.append('<h3>Discussion: equality of opportunity, equality of outcome</h3><ol>' + "".join(f"<li>{E(q)}</li>" for q in Q["questions"]) + '</ol></section>')
    parts.append('<section class="chap ui"><h3 style="margin-top:0">Course-wide projects</h3>')
    for p in C["projects"]:
        w = f'{p["weight"]}% of grade' if p["weight"] else "part of the capstone"
        parts.append(f'<h3>{E(p["title"])} <span class="eyebrow">· {w}</span></h3><p>{E(p["prompt"])}</p><p><b>Deliverable:</b> {E(p["deliverable"])}</p>{rubric_table(p["rubric"])}')
    parts.append('</section>')
    for m in D["modules"]:
        a = m["assignment"]
        parts.append(f'<section class="chap ui"><div class="band" style="background:{ERA_HEX[m["id"]]}"></div><div class="eyebrow">Unit {m["unit"]} · {E(m["role"])} · {E(m["years"])} · {E(m["chapterLabel"])}</div>'
                     f'<h1 class="ct" style="font-size:30pt">{E(m["title"])}</h1><p class="q" style="font-family:Newsreader,serif">{E(m["bigQuestion"])}</p>'
                     '<h4>Learning objectives</h4><ul>' + "".join(f"<li>{E(o)}</li>" for o in m["learningObjectives"]) + '</ul>'
                     '<h4>Discussion questions</h4><ol>' + "".join(f"<li>{E(q)}</li>" for q in m["discussionQuestions"]) + '</ol>'
                     '<h4>Key terms</h4><dl class="cols">' + "".join(f'<div><dt>{E(t["term"])}</dt><dd>{E(t["definition"])}</dd></div>' for t in m["keyTerms"]) + '</dl>'
                     '<h4>Primary sources</h4><ul>' + "".join(f'<li><b>{E(s["title"])}</b> ({s["year"]}, {E(s["source"])}). {E(s["why"])}<br><span style="color:#5e6573">{E(s["url"])}</span></li>' for s in m["primarySources"]) + '</ul>'
                     f'<h3>Assignment: {E(a["title"])}</h3><p class="eyebrow">{E(a["type"])} · {a["points"]} points</p><p>{E(a["prompt"])}</p><p><b>Deliverable:</b> {E(a["deliverable"])}</p>{rubric_table(a["rubric"])}'
                     '<h4>Self-check answer key</h4><ol>' + "".join(f'<li>{E(q["q"])} <b>Answer: {"ABCDE"[q["answer"]]}. {E(q["options"][q["answer"]])}</b></li>' for q in m["quiz"]) + '</ol></section>')
    return doc("".join(parts), "Course guide — The Story of Retirement")


def render(pg, html_str, out, left):
    path = TMP / (out.stem + ".html"); path.write_text(html_str, encoding="utf-8")
    pg.goto(path.as_uri()); pg.wait_for_load_state("load"); pg.evaluate("document.fonts.ready")
    pg.pdf(path=str(out), format="Letter", print_background=True, display_header_footer=True,
           header_template="<span></span>", footer_template=FOOT.format(left=E(left)),
           margin={"top": "0.85in", "bottom": "0.9in", "left": "0.95in", "right": "0.95in"})


def main():
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        left = "The Story of Retirement · Jonathan Grimm · Working draft, shared for course use"
        book = sorted(D["modules"], key=lambda m: m["number"])  # the draft keeps the book's own order
        for m in book:
            render(pg, doc(chapter_html(m), f'{m["title"]} — The Story of Retirement'), OUT / f"{m['number']:02d}-{m['id']}.pdf", left)
        toc = "".join(f'<li><span class="n">{"Opening" if m["number"] == 0 else "Chapter " + str(m["number"])}</span><span>{E(m["title"])}</span><span class="y">{E(m["years"])}</span></li>' for m in book)
        full = (f'<div class="title-page"><div class="eyebrow">{E(D["meta"]["byline"])} · {E(D["meta"]["org"])}</div><h1><span>The story of</span>Retirement</h1>'
                f'<p class="sub" style="margin-top:14pt">{E(D["meta"]["subtitle"])}</p><p class="def" style="margin-top:18pt">From Conception to Catastrophe · Working draft, 2026</p></div>'
                f'<section class="chap"><div class="eyebrow">Contents</div><ul class="toc" style="margin-top:10pt">{toc}</ul>'
                f'<p class="note" style="margin-top:22pt">This is the author’s working draft of {E(D["meta"]["book"])}, shared for course use. The Catastrophe chapter is in progress. Please don’t redistribute outside the course.</p></section>'
                + "".join(chapter_html(m, standalone=False) for m in book))
        render(pg, doc(full, "The Story of Retirement — working draft"), OUT / "the-story-of-retirement-draft.pdf", left)
        render(pg, guide_html(), OUT / "course-guide.pdf", "The Story of Retirement · Course guide")
        b.close()
    for f in sorted(OUT.iterdir()):
        print(f.name, f.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
