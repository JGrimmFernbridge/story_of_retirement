"""Compile the React app and assemble two builds:
   dist/   - the full website to upload to any host (index.html + downloads/)
   preview/ - the same page shaped for a Claude artifact preview"""
import subprocess, os, json, shutil, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
subprocess.run([sys.executable, "build_data.py"], check=True)
subprocess.run(["node_modules/.bin/esbuild", "src/app.jsx", "--loader:.jsx=jsx", "--jsx-factory=React.createElement",
                "--jsx-fragment=React.Fragment", "--target=es2019", "--minify", "--outfile=build/app.js"], check=True)
css = open("src/styles.css", encoding="utf-8").read()
data = open("build/data.js", encoding="utf-8").read()
app = open("build/app.js", encoding="utf-8").read()
config = json.load(open("site-config.json", encoding="utf-8")) if os.path.exists("site-config.json") else {}
FONTS = "https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,300..800&family=Courier+Prime:wght@400;700&family=Newsreader:ital,opsz,wght@0,6..72,400..650;1,6..72,400..500&family=Permanent+Marker&display=swap"
REACT = ["https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js",
         "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"]
DESC = "An interactive course on the history of retirement by Jonathan Grimm: timeline, chapters, nine seeds, podcasts, lectures and graded assignments."
def head():
    return (f'<title>The Story of Retirement</title>\n<meta name="description" content="{DESC}">\n'
            f'<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
            f'<link rel="stylesheet" href="{FONTS}">\n<style>\n{css}\n</style>\n')
def body():
    cfg = json.dumps(config, indent=2)
    return ('<div id="root"><noscript><p style="padding:24px">This course site needs JavaScript turned on.</p></noscript></div>\n'
            '<script>\n/* ===== SITE SETTINGS =====\n   api: where the podcast & lecture library lives (this site\'s Netlify function).\n   staticMedia: optional fixed links shown when that library is unreachable, e.g.\n   { "module": "crucible", "kind": "podcast", "title": "Episode 5", "url": "https://..." } */\n'
            f'window.SOR_CONFIG = {cfg};\n</script>\n'
            + "".join(f'<script src="{u}" crossorigin="anonymous"></script>\n' for u in REACT)
            + f'<script>{data}</script>\n<script>{app}</script>\n')
OUTDIR = "../public" if os.path.isdir("../public") and os.path.isdir("../netlify") else "dist"  # inside the repo, write straight to public/
os.makedirs(f"{OUTDIR}/downloads", exist_ok=True); os.makedirs("preview", exist_ok=True)
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + head() + '</head>\n<body>\n' + body() + '</body>\n</html>\n')
open(f"{OUTDIR}/index.html", "w", encoding="utf-8").write(full)
for f in ("master-timeline.jpg", "master-timeline-thumb.jpg"):
    if os.path.exists(f"assets/{f}"):
        shutil.copy(f"assets/{f}", f"{OUTDIR}/{f}"); shutil.copy(f"assets/{f}", f"preview/{f}")
open("preview/index.html", "w", encoding="utf-8").write(head() + body())
print(f"{OUTDIR}/index.html", len(full.encode()) // 1024, "KB")
