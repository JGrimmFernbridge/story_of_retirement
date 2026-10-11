# Module content schema

Write one JSON file per module to `/home/claude/content/<id>.json` (UTF-8, valid JSON — run `python3 -m json.tool <file> > /dev/null` to check). Use typographic dashes/quotes freely. No HTML; plain text only (you may use \n\n between paragraphs).

```json
{
  "id": "crucible",
  "number": 3,
  "title": "Crucible",
  "years": "1920–1950",
  "definition": "cru·ci·ble (noun) the forging of something",
  "tagline": "One evocative line (≤ 14 words) capturing the era in Jonathan's framing.",
  "bigQuestion": "The single guiding question students carry through the module.",
  "overview": "Two or three short paragraphs (160–240 words total) introducing the era for students.",
  "learningObjectives": ["Students will be able to … (measurable verb: explain, trace, evaluate, compare, analyze…)", "… 4 to 5 items"],

  "policyEvents": [
    {"year": 1935, "title": "Social Security Act", "type": "legislation|policy",
     "detail": "2–3 sentences: what it did, factually.",
     "significance": "1–2 sentences: why it matters to the story / which seed it waters."}
  ],
  "marketDrops": [
    {"year": 1929, "endYear": 1932, "name": "The Great Crash", "decline": "−89% (Dow, Sept 1929 – July 1932)",
     "detail": "2 sentences, including recovery time if known.", "retirementImpact": "1 sentence."}
  ],
  "socialMovements": [
    {"year": 1933, "endYear": 1936, "name": "Townsend Movement", "detail": "2 sentences.", "significance": "1 sentence."}
  ],
  "inequities": [
    {"title": "Short title", "detail": "2–3 sentences with specific, sourced facts."}
  ],
  "historicalContext": [
    {"year": 1918, "title": "Spanish Flu", "detail": "1–2 sentences — non-policy events that shaped the era (wars, technology, culture)."}
  ],
  "seeds": [
    {"seed": 4, "stage": "planted|sprouting|growing|blooming|harvest", "detail": "2–3 sentences: how this seed shows up in this era."}
  ],
  "twoPersonLens": {
    "year": 1950,
    "older": {"born": 1890, "headline": "short", "text": "90–140 words"},
    "younger": {"born": 1930, "headline": "short", "text": "90–140 words"},
    "irony": "One sentence, the closing irony."
  },
  "keyTerms": [{"term": "Defined-benefit pension", "definition": "1–2 sentences."}],
  "keyFigures": [{"name": "Frances Perkins", "role": "1–2 sentences on why they matter here."}],
  "primarySources": [
    {"title": "Social Security Act of 1935 (full text)", "year": 1935, "source": "SSA History", "url": "https://www.ssa.gov/history/35act.html", "why": "1 sentence on what students should look for."}
  ],
  "discussionQuestions": ["5 to 6 open questions; at least one asks students to challenge or test the book's argument with evidence."],
  "assignment": {
    "title": "Assignment title",
    "type": "e.g. Seed-tracing brief / Primary source analysis / Two-Person Lens interview / Data investigation",
    "prompt": "What students do, 80–150 words.",
    "deliverable": "Format and length (e.g., 1,000–1,200 word essay with ≥3 cited sources).",
    "points": 100,
    "rubric": [
      {"criterion": "Historical accuracy & evidence", "points": 30,
       "exemplary": "What A-level work does (1–2 sentences)",
       "proficient": "B-level",
       "developing": "C-level",
       "beginning": "D/F-level"}
    ]
  },
  "quiz": [
    {"q": "Self-check question", "options": ["A", "B", "C", "D"], "answer": 1, "explain": "1–2 sentences explaining the right answer."}
  ],
  "sources": [{"label": "Short source name", "url": "https://…"}]
}
```

Quantities per module (historical eras 1–7): policyEvents 6–10, marketDrops 1–4 (only real market declines in that era's span; for eras without major drops, include the nearest relevant ones or financial panics), socialMovements 2–4, inequities 3–5, historicalContext 3–6, seeds: every seed active in the era (typically 3–9), keyTerms 6–9, keyFigures 3–5, primarySources 3–5, discussionQuestions 5–6, rubric 4 criteria summing to 100 points, quiz 5 questions, sources: every source you used to verify facts.

Every item with a year must have an integer `year` (and optional integer `endYear`) because the interactive timeline plots them. Projected future events (Collapse/Catastrophe) must say "projected" in the title or detail and cite the projection source.

Module 0 (Conclusion/Orientation) and Module 8 (Correction) are thematic rather than chronological: they may leave marketDrops/socialMovements/historicalContext as empty arrays, but must still have overview, objectives, key terms, discussion questions, assignment+rubric, quiz, and seeds (for Conclusion: introduce all nine seeds at stage "planted" with a 1–2 sentence description each; for Correction: how each seed might be uprooted or redirected, stage "harvest").
