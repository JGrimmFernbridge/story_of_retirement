# The Story of Retirement

Live at https://story-of-retirement.netlify.app (Netlify project `story-of-retirement`, deployed from `main`).

A horizontal course site on the history of retirement by Jonathan Grimm (Fernbridge Advisors). Visitors land on today, the Collapse era (2010–2040), travel left through how we got here, and right into what's coming and the Correction. Eras and events open into their own views; the course runs in the same order.

## What's in this repository

| Folder | What it is |
| --- | --- |
| `public/` | The finished site Netlify publishes: `index.html` plus `downloads/` (chapter PDFs, the full draft, the course guide). |
| `netlify/functions/media.mts` + `lib/media-core.mjs` | The podcast & lecture library. Recordings are stored in this site's own Netlify storage (Netlify Blobs). No outside database. |
| `source/` | Everything used to build `public/`: chapter text (`chapters/`), course content (`content/`, `context/course.json`), the hand-drawn master timeline as data (`context/master_timeline.json`) and as a photo (`assets/`), the page code (`src/`) and build scripts. |
| `netlify.toml` | Tells Netlify to publish `public/` and where the function lives. |

## Podcasts and lectures

- Students listen and watch on each unit's **Podcast & lecture** panel.
- Instructors select the lock icon at the top right and enter the **instructor password**. Then every unit's Podcast & lecture panel shows a form to upload an audio or video file (up to 750 MB) or paste a YouTube, Vimeo or podcast link. Uploads go up in 3 MB pieces, so keep the page open until it says "Posted."
- The password is the `INSTRUCTOR_PASSWORD` environment variable on the Netlify project. To change it: Netlify → the project → **Project configuration → Environment variables** → edit `INSTRUCTOR_PASSWORD` → then **Deploys → Trigger deploy → Deploy project** so the change takes effect.
- Long video lectures play best from YouTube (unlisted) or Vimeo: paste the link instead of uploading the file.
- Stored recordings are visible in Netlify under **Data & Storage → Blobs → course-media**.

## The master timeline

The author's hand-drawn master timeline is in the site three ways: as the photograph (`public/master-timeline.jpg`, shown on the **Master timeline** view), as entries on the interactive line (each one ringed, with his words in its "On the master timeline" note), and as the **Author's notes** lane. The transcription lives in `source/context/master_timeline.json`: `matches` attach his words to entries that already existed, `add` holds the entries that came only from the sheet, `notes` are his bracketed notes, `links` are his arrows and `threads` are the sequences he underlined (redlining; money in your own name). Edit that file and rebuild to change any of it.

## The notebook

The author's early handwritten notes and marked-up draft pages (18 scanned pages in `public/notes/`) are organized by idea in `source/context/notebook.json` and shown on the **His hand** view under the Notebook and Pages tabs. Entries on the line that came from the notebook rather than the kraft sheet carry `"src": "notebook"` in `master_timeline.json`.

## Updating the content

Chapter text and course content live in `source/`. After editing, rebuild from `source/`:

```bash
npm install
python3 -m pip install markdown playwright && python3 -m playwright install chromium
python3 build.py      # rebuilds public/index.html
python3 make_pdfs.py  # rebuilds the PDFs in public/downloads/
```

Then commit and push; Netlify publishes the new version.
