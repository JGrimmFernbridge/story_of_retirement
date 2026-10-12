/* The Story of Retirement — a horizontal course site.
   One left-to-right timeline that visitors enter at today (2010–2040); eras and events are clicked into;
   every click-in view also reads left to right. */
const { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback, useContext, createContext } = React;
const D = window.__SOR__;
const CFG = Object.assign({ api: "/api/media", staticMedia: [] }, window.SOR_CONFIG || {});
const MODS = D.modules;
const MOD = Object.fromEntries(MODS.map(m => [m.id, m]));
const ERA_IDS = ["collapse", "codify", "climax", "crucible", "conception", "classical", "catastrophe"]; // course order: today, then back, then ahead
const ENTRY_YEAR = 2010; // visitors arrive at the start of Collapse: today

// Colors follow the legend on the author's hand-drawn master timeline: crashes red, money green, history blue, culture pink, technology orange, seeds brown.
const TYPE = {
  legislation: { label: "Legislation", color: "var(--t-legislation)" },
  policy: { label: "Policy", color: "var(--t-policy)" },
  crisis: { label: "Market drop", color: "var(--t-crisis)" },
  money: { label: "Money", color: "var(--t-money)" },
  movement: { label: "Social movement", color: "var(--t-movement)" },
  history: { label: "History", color: "var(--t-history)" },
  context: { label: "History", color: "var(--t-history)" },
  culture: { label: "Culture", color: "var(--t-culture)" },
  tech: { label: "Technology", color: "var(--t-tech)" },
  seed: { label: "Seed", color: "var(--t-seed)" },
  lens: { label: "Two-Person Lens", color: "var(--t-lens)" },
  note: { label: "Author's note", color: "var(--t-note)" },
};
const LANES = [
  { id: "policy", label: "Law & policy", color: "var(--t-legislation)" },
  { id: "markets", label: "Markets & money", color: "var(--t-crisis)" },
  { id: "movements", label: "Movements", color: "var(--t-movement)" },
  { id: "history", label: "History", color: "var(--t-history)" },
  { id: "culture", label: "Culture & tech", color: "var(--t-culture)" },
  { id: "seeds", label: "Nine seeds", color: "var(--t-seed)" },
  { id: "lens", label: "Two lives", color: "var(--t-lens)" },
  { id: "notes", label: "Author's notes", color: "var(--t-note)" },
];
const ITEM = Object.fromEntries(D.items.map(i => [i.id, i]));
const LINKS = D.links || [], THREADS = D.threads || [], MASTER = D.master || { legend: [], quotes: [] };
const linksOf = id => LINKS.filter(l => l.from === id || l.to === id);
const threadOf = id => THREADS.find(t => t.items.includes(id)) || null;
const VAR_LABEL = { income: "Wealth & income", race: "Race & ethnicity", gender: "Sex & gender", education: "Education", job: "Job", place: "Place", immigration: "Immigration", longevity: "Longevity", generation: "Generation" };
const LANE_ORDER = Object.fromEntries(LANES.map((l, i) => [l.id, i]));
const STAGES = ["planted", "sprouting", "growing", "blooming", "harvest"];
const eraColor = id => `var(--era-${id})`;
const bandOf = id => (id === "conclusion" ? "var(--ink)" : eraColor(id));
const yrs = (a, b) => (b && b !== a ? `${a}–${b}` : `${a}`);
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } },
};
function setHash(h) { try { history.replaceState(null, "", "#" + h); } catch (e) { /* sandboxed frame */ } }
const reduceMotion = (() => { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } })();
const smooth = reduceMotion ? "auto" : "smooth";
const nextMod = id => MODS[MODS.findIndex(m => m.id === id) + 1] || null;
const prevMod = id => MODS[MODS.findIndex(m => m.id === id) - 1] || null;
const eraOfYear = y => (D.eras.find(e => y >= e.start && y < e.end) || D.eras[D.eras.length - 1]).id;

/* ---------------- icons */
const I = d => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const Icon = {
  down: I(<path d="M12 4v12M6 11l6 6 6-6M5 20h14" />),
  right: I(<path d="M5 12h14M13 6l6 6-6 6" />),
  left: I(<path d="M19 12H5M11 6l-6 6 6 6" />),
  close: I(<path d="M6 6l12 12M18 6L6 18" />),
  lock: I(<g><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></g>),
  ext: I(<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />),
  layers: I(<path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5" />),
  list: I(<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />),
  seed: I(<path d="M12 21v-9M12 12c0-4 3-7 7-7 0 4-3 7-7 7zM12 14c0-3-2-5-5-5 0 3 2 5 5 5z" />),
  book: I(<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5zM4 19a2 2 0 0 1 2-2h13" />),
  mic: I(<g><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></g>),
  info: I(<g><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5h.01" /></g>),
  pen: I(<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />),
  zoom: I(<g><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3M11 8v6M8 11h6" /></g>),
};

/* ================================================================ MEDIA SERVICE */
// Podcasts and lectures live in this site's own Netlify storage, reached through /api/media.
// Anyone can listen and watch; posting needs the instructor password set in Netlify.
const MediaCtx = createContext(null);
const KEY_STORE = "sor-instructor";
function readKey() { try { return sessionStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } }
function saveKey(k) { try { if (k) sessionStorage.setItem(KEY_STORE, k); else sessionStorage.removeItem(KEY_STORE); } catch (e) { /* storage unavailable */ } }
function useMediaService() {
  const API = CFG.api || "/api/media";
  const [st, setSt] = useState({ mode: "loading", items: CFG.staticMedia || [], instructor: false, error: null, limits: { chunkSize: 3145728, maxBytes: 786432000 } });
  const key = useRef(readKey());
  const call = useCallback(async (path, opts = {}) => {
    const res = await fetch(API + path, { ...opts, headers: { ...(opts.headers || {}), ...(key.current ? { "x-instructor-key": key.current } : {}) } });
    let data = null; try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) { const err = new Error((data && data.error) || `The media library answered ${res.status}.`); err.status = res.status; throw err; }
    return data;
  }, [API]);
  const refresh = useCallback(async () => {
    try {
      const data = await call("");
      setSt(s => ({ ...s, mode: "live", items: data.items || [], error: null, limits: { chunkSize: data.chunkSize, maxBytes: data.maxBytes } }));
    } catch (e) {
      setSt(s => ({ ...s, mode: "static", items: CFG.staticMedia || [] }));
    }
  }, [call]);
  useEffect(() => {
    refresh();
    if (key.current) call("/auth", { method: "POST" }).then(() => setSt(s => ({ ...s, instructor: true }))).catch(() => { key.current = ""; saveKey(""); });
  }, []);
  const api = useMemo(() => ({
    publicUrl(item) { return item.external_url || item.file_url || item.url || null; },
    async signIn(password) {
      key.current = password;
      try { await call("/auth", { method: "POST" }); saveKey(password); setSt(s => ({ ...s, instructor: true })); }
      catch (e) { key.current = ""; throw e; }
    },
    signOut() { key.current = ""; saveKey(""); setSt(s => ({ ...s, instructor: false })); },
    async add({ module, kind, title, description, file, url }, onProgress) {
      if (!file) {
        await call("", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ module, kind, title, description, url }) });
        return refresh();
      }
      const start = await call("/upload", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ module, kind, title, description, filename: file.name, mime: file.type || "", size: file.size }) });
      try {
        for (let n = 0; n < start.chunks; n++) {
          const piece = file.slice(n * start.chunkSize, Math.min(file.size, (n + 1) * start.chunkSize));
          let tries = 0;
          for (;;) {
            try { await call(`/upload/${start.id}/${n}`, { method: "PUT", headers: { "content-type": "application/octet-stream" }, body: piece }); break; }
            catch (e) { if (++tries >= 3 || e.status === 401 || e.status === 404) throw e; await new Promise(r => setTimeout(r, 800 * tries)); }
          }
          if (onProgress) onProgress(n + 1, start.chunks);
        }
        await call(`/upload/${start.id}/finish`, { method: "POST" });
      } catch (e) {
        call(`/${start.id}`, { method: "DELETE" }).catch(() => {});
        throw e;
      }
      return refresh();
    },
    async remove(item) { await call(`/${item.id}`, { method: "DELETE" }); return refresh(); },
  }), [call, refresh]);
  return { ...st, live: st.mode === "live", ...api };
}

/* ================================================================ SCALE */
// Linear within each segment. 1890–2040 is one even scale (every year the same width); deep past and far future are compressed.
function makeScale(k) {
  const raw = [[1340, 1770, 340], [1770, 1890, 2000], [1890, 2040, 8400], [2040, 2100, 960]];
  let acc = 0; const PADL = 40, PADR = 70;
  const segs = raw.map(([a, b, w]) => { const s = { a, b, w: Math.round(w * k), x: acc }; acc += s.w; return s; });
  const X = y => {
    y = Math.max(1340, Math.min(2100, y));
    for (const s of segs) if (y <= s.b) return PADL + s.x + (y - s.a) / (s.b - s.a) * s.w;
    return PADL + acc;
  };
  const Y = x => {
    const v = x - PADL;
    for (const s of segs) if (v <= s.x + s.w) return s.a + Math.max(0, v - s.x) / s.w * (s.b - s.a);
    return 2100;
  };
  return { X, Y, W: PADL + acc + PADR };
}
function itemLabel(it) {
  if (it.lane === "seeds") return it.title.replace(/^Seed \d+: /, `${it.seed}. `);
  if (it.lane === "lens") { const l = D.lens.find(x => x.id === it.lens); return l && l.source === "author" ? `${it.year}: ${l.label}` : `${it.year}: two lives`; }
  return it.title.replace(/^Projected: /, "");
}
const LABEL_MAX = 30;

/* ================================================================ TIMELINE STAGE */
function Marker({ it, x, x2, y, sel, onPick, fs }) {
  const c = TYPE[it.type] ? TYPE[it.type].color : "var(--t-policy)";
  const lab = trunc(itemLabel(it), LABEL_MAX);
  let shape, lx = x + 9;
  if (it.lane === "markets" && it.type !== "money") {
    const w = Math.max(6, x2 - x);
    shape = <g><rect x={x} y={y - 4} width={w} height={8} rx={2} style={{ fill: c }} /><path d={`M${x - 4} ${y - 9} h8 l-4 5z`} style={{ fill: c }} /></g>;
    lx = x + w + 6;
  } else if (it.type === "money") {
    shape = <g><circle cx={x} cy={y} r={5.5} style={{ fill: c }} /><text x={x} y={y + 3} textAnchor="middle" style={{ fill: "var(--kraft)", fontSize: 8, fontWeight: 800 }}>$</text></g>;
  } else if (it.type === "seed") {
    // a seed in the ground, sprouting: brown with a green shoot, as on his master timeline
    shape = <g><path d={`M${x} ${y - 7} q0 -5 4.5 -6.5 M${x} ${y - 7} q-1 -3 -3.5 -3.5`} style={{ fill: "none", stroke: "var(--t-sprout)", strokeWidth: 1.8, strokeLinecap: "round" }} /><circle cx={x} cy={y} r={7.5} style={{ fill: c }} /><text x={x} y={y + 3.5} textAnchor="middle" style={{ fill: "var(--kraft)", fontSize: 9, fontWeight: 800 }}>{it.seed}</text></g>;
    lx = x + 12;
  } else if (it.type === "tech") {
    shape = <path d={`M${x} ${y - 5.5} L${x + 5.5} ${y} L${x} ${y + 5.5} L${x - 5.5} ${y}Z`} style={{ fill: c }} />;
  } else if (it.type === "lens") {
    shape = <g style={{ fill: c }}><circle cx={x - 4} cy={y} r={4} /><circle cx={x + 4} cy={y} r={4} style={{ fillOpacity: .55 }} /></g>;
    lx = x + 11;
  } else if (it.type === "movement") {
    shape = <rect x={x - 4.5} y={y - 4.5} width={9} height={9} rx={2} style={{ fill: c }} />;
  } else {
    const r = it.type === "history" || it.type === "culture" ? 4.2 : 5;
    shape = it.projected
      ? <circle cx={x} cy={y} r={r} style={{ fill: "var(--kraft)", stroke: c, strokeWidth: 1.8, strokeDasharray: "2 1.5" }} />
      : <circle cx={x} cy={y} r={r} style={{ fill: c }} />;
  }
  const aria = `${yrs(it.year, it.endYear)}, ${it.title}, ${TYPE[it.type] ? TYPE[it.type].label : ""}`;
  return (
    <g className={"mk" + (sel ? " sel" : "")} role="button" tabIndex={0} aria-label={aria} data-mk="1"
      onClick={() => onPick(it.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(it.id); } }}>
      <title>{aria}</title>
      <circle className="halo" cx={x} cy={y} r={10} style={{ fill: "transparent", stroke: "none" }} />
      {it.master && <circle className="ring" cx={x} cy={y} r={it.type === "seed" ? 10.5 : 8} />}
      {shape}
      <text className="lab" x={lx} y={y + fs * .36} style={{ fill: "var(--kraft-ink)", fontSize: fs, fontWeight: sel ? 700 : 500 }}>{lab}</text>
    </g>
  );
}

// his bracketed notes, drawn as brackets with his words in a handwriting face
function NoteMark({ it, x, x2, y, sel, onPick, fs }) {
  const w = Math.max(14, x2 - x), c = it.color || "var(--t-note)";
  const aria = `${yrs(it.year, it.endYear)}, author's note: ${it.title}`;
  return (
    <g className={"mk note" + (sel ? " sel" : "")} role="button" tabIndex={0} aria-label={aria} data-mk="1"
      onClick={() => onPick(it.id)} onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(it.id); } }}>
      <title>{aria}</title>
      <rect className="halo" x={x - 4} y={y - fs - 8} width={Math.max(w, trunc(it.title, NOTE_MAX).length * fs * .62) + 8} height={fs + 16} rx={6} style={{ fill: "transparent", stroke: "none" }} />
      <path d={`M${x} ${y - 3} v6 h${w} v-6`} style={{ fill: "none", stroke: c, strokeWidth: 1.6, strokeLinecap: "round" }} />
      <text className="lab hand" x={x + 1} y={y - 5} style={{ fill: c, fontSize: fs + 1.5 }}>{trunc(it.title, NOTE_MAX)}</text>
    </g>
  );
}
const NOTE_MAX = 60;

function useSize(ref) {
  const [s, setS] = useState({ w: window.innerWidth, h: Math.max(400, window.innerHeight - 110) });
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return;
    const upd = () => setS({ w: el.clientWidth, h: el.clientHeight });
    upd(); const ro = new ResizeObserver(upd); ro.observe(el); return () => ro.disconnect();
  }, []);
  return s;
}

// the arrows he drew between entries, shown for whichever entry is selected
const LINK_COLOR = { seed: "var(--t-sprout)", echo: "var(--t-lens)", arrow: "var(--kraft-ink)" };
function LinkCurves({ sel, pos }) {
  return (
    <g className="links" aria-hidden="true">
      {linksOf(sel.id).map((l, i) => {
        const a = pos[l.from], b = pos[l.to]; if (!a || !b) return null;
        const c = LINK_COLOR[l.kind] || LINK_COLOR.arrow;
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.max(1, Math.hypot(dx, dy));
        const bend = Math.min(90, 18 + len * .18) * (dy >= 0 ? -1 : 1);
        const mx = (a.x + b.x) / 2 - dy / len * bend, my = (a.y + b.y) / 2 + dx / len * bend;
        const tx = b.x - mx, ty = b.y - my, tl = Math.max(1, Math.hypot(tx, ty)), ux = tx / tl, uy = ty / tl;
        const ex = b.x - ux * 11, ey = b.y - uy * 11;
        const head = `M${ex - uy * 4} ${ey + ux * 4} L${b.x - ux * 9} ${b.y - uy * 9} L${ex + uy * 4} ${ey - ux * 4}`;
        return <g key={i}><path d={`M${a.x} ${a.y} Q${mx} ${my} ${ex} ${ey}`} style={{ fill: "none", stroke: c, strokeWidth: 1.8, strokeDasharray: "5 4", strokeLinecap: "round" }} /><path d={head} style={{ fill: "none", stroke: c, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }} /></g>;
      })}
    </g>
  );
}

function Stage({ layers, selId, pick, go, openModule, openSheet, viewportRef, setGeom, navRef, welcome, setWelcome }) {
  const stageRef = useRef(null);
  const size = useSize(stageRef);
  const phone = size.w < 700;
  const scale = useMemo(() => makeScale(phone ? .74 : 1), [phone]);
  const { X } = scale;
  const LEAD_W = Math.round(Math.min(440, Math.max(300, size.w * (phone ? .9 : .32))));
  const CLOSE_W = Math.round(Math.min(980, Math.max(340, size.w * (phone ? 1 : .8))));
  // the era header band is as tall as its tallest header (name, tagline, link), measured after render
  const [headMeasured, setHeadMeasured] = useState(0);
  const HEAD = Math.max(phone ? 96 : 100, headMeasured);
  useLayoutEffect(() => {
    const el = stageRef.current; if (!el) return;
    const measure = () => {
      let h = 0; el.querySelectorAll(".era-sticky").forEach(n => { h = Math.max(h, n.offsetHeight); });
      if (h) setHeadMeasured(prev => (Math.abs(prev - (h + 10)) > 1 ? h + 10 : prev));
    };
    measure();
    const ro = new ResizeObserver(measure); el.querySelectorAll(".era-sticky").forEach(n => ro.observe(n));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    return () => ro.disconnect();
  }, [size.w, phone]);
  const visible = useMemo(() => D.items.filter(it => layers[it.lane] && (!layers.masterOnly || it.master)), [layers]);
  const ordered = useMemo(() => [...visible].sort((a, b) => a.year - b.year || LANE_ORDER[a.lane] - LANE_ORDER[b.lane]), [visible]);

  const layout = useMemo(() => {
    const charW = phone ? 5.6 : 6.1;
    const rowsByLane = {}, rowOf = {};
    const NOTE_EXTRA = 9; // the notes lane needs room for his handwriting above each bracket
    LANES.forEach(l => {
      const its = visible.filter(i => i.lane === l.id).sort((a, b) => X(a.year) - X(b.year));
      if (!its.length) return;
      const ends = [];
      its.forEach(it => {
        const x0 = X(it.year) - 10;
        const bar = (it.lane === "markets" && it.type !== "money") || it.lane === "notes" ? Math.max(6, X(it.endYear || it.year) - X(it.year)) : 0;
        const w = it.lane === "notes" ? Math.max(bar, trunc(it.title, NOTE_MAX).length * charW * 1.15) + 24 : bar + 24 + trunc(itemLabel(it), LABEL_MAX).length * charW;
        let r = ends.findIndex(e => e <= x0); if (r === -1) { r = ends.length; ends.push(0); }
        ends[r] = x0 + w; rowOf[it.id] = r;
      });
      rowsByLane[l.id] = Math.max(1, ends.length);
    });
    const AXIS = 38, GAP = 7;
    const totalRows = Object.values(rowsByLane).reduce((a, b) => a + b, 0);
    const nl = Object.keys(rowsByLane).length;
    // everything should fit the stage's height, because the wheel scrolls sideways.
    // on a short window the S&P strip shrinks, then steps aside; the rows never go below 15px.
    const fixedFor = (sph, on) => HEAD + AXIS + sph + (on ? 22 : 6) + nl * GAP + (rowsByLane.notes ? rowsByLane.notes * NOTE_EXTRA : 0);
    let SPH = layers.sp ? (phone ? 80 : 98) : 0, spShown = !!layers.sp;
    let rowH = Math.floor((size.h - fixedFor(SPH, spShown)) / Math.max(1, totalRows));
    if (spShown && rowH < 17) { SPH = phone ? 56 : 64; rowH = Math.floor((size.h - fixedFor(SPH, spShown)) / Math.max(1, totalRows)); }
    if (spShown && rowH < 15) { SPH = 0; spShown = false; rowH = Math.floor((size.h - fixedFor(0, false)) / Math.max(1, totalRows)); }
    rowH = Math.max(15, Math.min(23, rowH));
    let top = HEAD; const lanes = [], pos = {};
    LANES.forEach(l => {
      if (!rowsByLane[l.id]) return;
      const rh = rowH + (l.id === "notes" ? NOTE_EXTRA : 0);
      const h = rowsByLane[l.id] * rh + GAP;
      lanes.push({ ...l, top, h });
      visible.filter(i => i.lane === l.id).forEach(it => {
        pos[it.id] = { x: X(it.year), x2: X(it.endYear || it.year), y: top + GAP / 2 + rowOf[it.id] * rh + rh / 2 + (l.id === "notes" ? 4 : 0) };
      });
      top += h;
    });
    const spTop = top + (spShown ? 18 : 0), axisY = spTop + SPH + (spShown ? 4 : 4);
    return { lanes, pos, spTop, SPH, spShown, axisY, AXIS, H: Math.max(size.h, axisY + AXIS), fs: rowH >= 18 ? 11 : 10, overflow: axisY + AXIS > size.h + 2 };
  }, [visible, scale, size.h, phone, layers.sp, HEAD]);

  useEffect(() => { setGeom({ OPEN_W: LEAD_W, CLOSE_W, scale, total: LEAD_W + scale.W + CLOSE_W, spHidden: !!layers.sp && !layout.spShown }); }, [LEAD_W, CLOSE_W, scale, layout.spShown, layers.sp]);

  // where "today" sits when the story opens: 2010 just right of the welcome panel
  const todayLeft = useCallback(() => {
    if (phone) return LEAD_W + X(ENTRY_YEAR) - 16;
    const panel = Math.min(452, size.w - 24), vis = Math.max(320, size.w - panel);
    return LEAD_W + X(2026) - panel - vis * .62; // today sits right of center, with the start of the projections in view
  }, [LEAD_W, scale, size.w, phone]);
  const inited = useRef(false);
  useLayoutEffect(() => {
    const el = viewportRef.current; if (!el || inited.current) return;
    inited.current = true; el.scrollLeft = todayLeft();
  }, [todayLeft]);
  useEffect(() => {
    navRef.current = {
      today: () => viewportRef.current.scrollTo({ left: todayLeft(), behavior: smooth }),
      beginning: () => viewportRef.current.scrollTo({ left: 0, behavior: smooth }),
      ahead: () => viewportRef.current.scrollTo({ left: LEAD_W + X(2026) - 120, behavior: smooth }),
    };
  }, [todayLeft, LEAD_W, scale]);

  /* scrolling: wheel to horizontal, drag to pan */
  const [sx, setSx] = useState({ left: 0, top: 0 });
  useEffect(() => {
    const el = viewportRef.current; if (!el) return;
    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setSx({ left: el.scrollLeft, top: el.scrollTop })); };
    const onWheel = e => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const t = e.target.closest && e.target.closest(".scroll-y");
      if (t && t.scrollHeight > t.clientHeight && ((e.deltaY > 0 && t.scrollTop + t.clientHeight < t.scrollHeight - 1) || (e.deltaY < 0 && t.scrollTop > 0))) return;
      if (e.shiftKey && el.scrollHeight > el.clientHeight) return;
      e.preventDefault(); el.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 32 : 1);
    };
    let drag = null;
    const down = e => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (e.target.closest("[data-mk],button,a,input,select,textarea,.kcard,.era-sticky,.scroll-y")) return;
      drag = { x: e.clientX, y: e.clientY, l: el.scrollLeft, t: el.scrollTop, moved: false };
    };
    const move = e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 4) { drag.moved = true; el.classList.add("dragging"); }
      if (drag.moved) { el.scrollLeft = drag.l - dx; el.scrollTop = drag.t - dy; }
    };
    const up = () => {
      if (drag && drag.moved) { const stop = ev => { ev.stopPropagation(); ev.preventDefault(); }; el.addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => el.removeEventListener("click", stop, { capture: true }), 0); }
      drag = null; el.classList.remove("dragging");
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", down); window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
    return () => { el.removeEventListener("scroll", onScroll); el.removeEventListener("wheel", onWheel); el.removeEventListener("pointerdown", down); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, []);

  const sel = D.items.find(i => i.id === selId) || null;
  const idx = sel ? ordered.findIndex(i => i.id === sel.id) : -1;
  const reveal = useCallback(id => {
    const el = viewportRef.current, p = layout.pos[id]; if (!el || !p) return;
    const ax = LEAD_W + p.x, vw = el.clientWidth;
    const target = phone ? ax - vw * .3 : ax - (vw - 460) * .35;
    if (ax < el.scrollLeft + 40 || ax > el.scrollLeft + vw - (phone ? 40 : 470)) el.scrollTo({ left: Math.max(0, target), behavior: smooth });
    if (phone && p.y > el.scrollTop + el.clientHeight * .3) el.scrollTo({ top: Math.max(0, p.y - 80), behavior: smooth });
  }, [layout, LEAD_W, phone]);
  useEffect(() => { if (selId) reveal(selId); }, [selId]);
  const step = d => { if (!ordered.length) return; pick(ordered[(idx + d + ordered.length) % ordered.length].id); };

  // S&P 500 line
  const lo = Math.log10(3), hi = Math.log10(10000);
  const SY = v => layout.spTop + layout.SPH - (Math.log10(v) - lo) / (hi - lo) * layout.SPH;
  const spPts = D.sp.map(([y, v]) => `${X(y).toFixed(1)},${SY(v).toFixed(1)}`).join(" ");
  const ticks = [];
  [1350, 1500, 1600, 1700].forEach(y => ticks.push({ y, major: false }));
  for (let y = 1780; y < 1890; y += 10) ticks.push({ y, major: y % 50 === 0 });
  for (let y = 1890; y <= 2040; y += 5) ticks.push({ y, major: y % 10 === 0 });
  for (let y = 2050; y <= 2100; y += 10) ticks.push({ y, major: true });
  const W = scale.W, axisY = layout.axisY;
  const railOn = sx.left + 92 > LEAD_W && sx.left < LEAD_W + W - 260 && !(welcome && !phone);

  return (
    <div className="stage" ref={stageRef} style={{ "--sticky-left": welcome && !phone ? Math.min(466, size.w - 300) + "px" : "14px" }}>
      <div className="viewport" ref={viewportRef} tabIndex={-1} aria-label="Timeline of the history of retirement. Scroll sideways to move through time.">
        <div className="track" style={{ "--canvas-h": layout.H + "px" }}>
          <LeadIn width={LEAD_W} toToday={() => navRef.current.today()} openSheet={openSheet} />
          <div className="canvas" style={{ width: W }}>
            <svg width={W} height={axisY} role="img" aria-label="Timeline lanes">
              <defs>
                <pattern id="hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                  <line x1="0" y1="0" x2="0" y2="7" style={{ stroke: "var(--kraft-ink)", strokeOpacity: .12, strokeWidth: 3 }} />
                </pattern>
              </defs>
              {D.eras.map(e => (
                <g key={e.id}>
                  <rect x={X(e.start)} y={0} width={X(e.end) - X(e.start)} height={axisY} style={{ fill: eraColor(e.id), fillOpacity: "var(--band-alpha)" }} />
                  <rect x={X(e.start)} y={0} width={X(e.end) - X(e.start)} height={6} style={{ fill: eraColor(e.id) }} />
                  <line x1={X(e.start)} x2={X(e.start)} y1={0} y2={axisY} style={{ stroke: "var(--kraft-ink)", strokeOpacity: .25 }} />
                </g>
              ))}
              <rect x={X(2026)} y={0} width={W - X(2026)} height={axisY} style={{ fill: "url(#hatch)" }} />
              {layout.lanes.map(l => <line key={l.id} x1={0} x2={W} y1={l.top} y2={l.top} style={{ stroke: "var(--kraft-line)", strokeDasharray: "3 4" }} />)}
              <line x1={X(2026)} x2={X(2026)} y1={0} y2={axisY} style={{ stroke: "var(--kraft-ink)", strokeWidth: 1.5, strokeDasharray: "5 3" }} />
              {layout.spShown && (
                <g>
                  <line x1={0} x2={W} y1={layout.spTop - 14} y2={layout.spTop - 14} style={{ stroke: "var(--kraft-line)" }} />
                  {D.items.filter(i => i.lane === "markets" && i.year >= 1871 && i.year <= 2026).map(i => (
                    <rect key={"sh" + i.id} x={X(i.year)} y={layout.spTop} width={Math.max(3, X(i.endYear || i.year) - X(i.year))} height={layout.SPH} style={{ fill: "var(--t-crisis)", fillOpacity: .13 }} />
                  ))}
                  {[10, 100, 1000].map(v => (
                    <g key={v}>
                      <line x1={X(1871)} x2={X(2026)} y1={SY(v)} y2={SY(v)} style={{ stroke: "var(--kraft-line)", strokeDasharray: "2 3" }} />
                      {[1871, 1940, 2000].map(y => <text key={y} x={X(y) + 4} y={SY(v) - 3} style={{ fill: "var(--kraft-muted)", fontSize: 9.5, fontFamily: "var(--f-type)" }}>{v.toLocaleString()}</text>)}
                    </g>
                  ))}
                  <polygon points={`${X(1871)},${layout.spTop + layout.SPH} ${spPts} ${X(2026)},${layout.spTop + layout.SPH}`} style={{ fill: "var(--kraft-ink)", fillOpacity: .08 }} />
                  <polyline points={spPts} style={{ fill: "none", stroke: "var(--kraft-ink)", strokeWidth: 1.6, strokeLinejoin: "round" }} />
                  <circle cx={X(2026)} cy={SY(D.sp[D.sp.length - 1][1])} r={3.5} style={{ fill: "var(--kraft-ink)" }} />
                  {[1871, 1930, 1990].map(y => <text key={y} x={X(y) + 4} y={layout.spTop - 4} style={{ fill: "var(--kraft-muted)", fontSize: 10, fontFamily: "var(--f-type)" }}>S&amp;P 500 (Shiller composite before 1957), January average, log scale · shaded = market drops</text>)}
                </g>
              )}
              {sel && <LinkCurves sel={sel} pos={layout.pos} />}
              {visible.map(it => layout.pos[it.id] && (it.lane === "notes"
                ? <NoteMark key={it.id} it={it} x={layout.pos[it.id].x} x2={layout.pos[it.id].x2} y={layout.pos[it.id].y} fs={layout.fs} sel={it.id === selId} onPick={pick} />
                : <Marker key={it.id} it={it} x={layout.pos[it.id].x} x2={layout.pos[it.id].x2} y={layout.pos[it.id].y} fs={layout.fs} sel={it.id === selId} onPick={pick} />
              ))}
            </svg>
            {/* the year axis sits at the foot of the canvas and stays in view if a short window has to scroll */}
            <div className="axis-strip" style={{ marginTop: axisY, height: layout.AXIS }}>
              <svg width={W} height={layout.AXIS} role="img" aria-label="Years">
                <line x1={0} x2={W} y1={0.5} y2={0.5} style={{ stroke: "var(--kraft-ink)", strokeOpacity: .5 }} />
                {ticks.map(t => (
                  <g key={t.y}>
                    <line x1={X(t.y)} x2={X(t.y)} y1={0} y2={t.major ? 7 : 4} style={{ stroke: "var(--kraft-ink)", strokeOpacity: .6 }} />
                    <text x={X(t.y)} y={21} textAnchor="middle" style={{ fill: "var(--kraft-ink)", fontSize: t.major ? 11.5 : 10, fontFamily: "var(--f-type)", fontWeight: t.major ? 700 : 400, fillOpacity: t.major ? 1 : .75 }}>{t.y}</text>
                  </g>
                ))}
                {[1770, 1890, 2040].map(y => <text key={"br" + y} x={X(y)} y={4} textAnchor="middle" style={{ fill: "var(--kraft-ink)", fontSize: 12, fontWeight: 700 }}>//</text>)}
                <text x={X(1340) + 4} y={33} style={{ fill: "var(--kraft-muted)", fontSize: 9.5, fontFamily: "var(--f-type)" }}>compressed</text>
                <text x={X(1772)} y={33} style={{ fill: "var(--kraft-muted)", fontSize: 9.5, fontFamily: "var(--f-type)" }}>1770–1890 drawn at one-third scale</text>
                <text x={X(1892)} y={33} style={{ fill: "var(--kraft-muted)", fontSize: 9.5, fontFamily: "var(--f-type)" }}>1890–2040 at full scale: every year the same width</text>
                <text x={X(2042)} y={33} style={{ fill: "var(--kraft-muted)", fontSize: 9.5, fontFamily: "var(--f-type)" }}>projections, one-third scale</text>
              </svg>
            </div>

            {D.eras.map(e => {
              const m = MOD[e.id];
              return (
                <div key={e.id} className="era-box" style={{ left: X(e.start), width: X(e.end) - X(e.start), height: HEAD }}>
                  <div className="era-sticky">
                    <div className="era-meta"><span className="chipdot" style={{ background: eraColor(e.id) }} />Unit {m.unit} · {m.years} · {m.role.toLowerCase()}</div>
                    <button className="era-name" onClick={() => openModule(e.id, "overview")} aria-label={`Open ${m.title}, ${m.years}`}>{m.title}</button>
                    {!phone && size.h >= 720 && <div className="era-tag">{m.tagline}</div>}
                    <button className="era-open" onClick={() => openModule(e.id, "chapter")}>Read the chapter{Icon.right}</button>
                  </div>
                </div>
              );
            })}
            <div className="today-tag" style={{ left: X(2026), top: layout.spShown ? layout.spTop + 4 : layout.axisY - 54 }}>
              <span>TODAY · {new Date().getFullYear()}</span>
              <button onClick={() => openModule("correction", "overview")}>Correction: the book's answer →</button>
            </div>
          </div>
          <Closing width={CLOSE_W} openModule={openModule} openSheet={openSheet} />
        </div>
      </div>
      <div className="rail" style={{ opacity: railOn ? 1 : 0 }} aria-hidden="true">
        {layout.lanes.map(l => <div key={l.id} style={{ top: l.top - sx.top + 2 }}>{l.label}</div>)}
        {layout.spShown && <div style={{ top: layout.spTop - sx.top - 12 }}>S&amp;P 500<br />log scale</div>}
      </div>
      {welcome && <Welcome close={() => setWelcome(false)} openModule={openModule} openSheet={openSheet} nav={navRef} />}
      {!welcome && !sel && <button className="btn small about-chip" onClick={() => { setWelcome(true); navRef.current.today(); }}>{Icon.info}About this story</button>}
      {sel && <Drawer sel={sel} idx={idx} total={ordered.length} step={step} go={go} close={() => pick(null)} openModule={openModule} openSheet={openSheet} />}
    </div>
  );
}

function Welcome({ close, openModule, openSheet, nav }) {
  const n = D.items.filter(i => !["seeds", "lens", "notes"].includes(i.lane)).length;
  const yearsOld = new Date().getFullYear() - 1889;
  return (
    <aside className="welcome" aria-label="Welcome">
      <div className="w-body scroll-y">
        <div className="eyebrow">A course by {D.meta.byline} · {D.meta.org}</div>
        <h1 className="title-card"><span className="thin">The story of</span>Retirement</h1>
        <p className="today">It starts here, with today: <b>Collapse</b> 2010–2040, the years we are living through.</p>
        <p className="lede">Retirement as we know it is only about {yearsOld} years old. To your left is how we got here, all the way back to a world with no word for retirement. To your right is where it is heading if nothing changes. The course runs the same way: today first, then back through how we got here.</p>
        <p className="watching">Are you watching closely?</p>
        <div className="facts">
          <div><b className="tnum">{yearsOld}</b><span>years since Bismarck's pension law</span></div>
          <div><b className="tnum">9</b><span>seeds that grew into today's system</span></div>
          <div><b className="tnum">{n}</b><span>dated events on the line</span></div>
        </div>
        <div className="w-actions">
          <button className="btn primary" onClick={() => openModule("collapse", "overview")}>Start with where we are: Collapse {Icon.right}</button>
          <div className="row">
            <button className="btn" onClick={() => { close(); nav.current.beginning(); }}>{Icon.left}How we got here</button>
            <button className="btn" onClick={() => { close(); nav.current.ahead(); }}>What's coming{Icon.right}</button>
          </div>
        </div>
        <p className="lede" style={{ fontSize: 14.5 }}>The line began as a sheet of kraft paper: the author's hand-drawn master timeline. Everything on that sheet is here, ringed <span className="ring-demo" aria-hidden="true" /> and in his own words. <button className="linkish" onClick={() => openSheet("master")}>See the original</button></p>
        <div className="howto"><span>Scroll or drag sideways</span><span><kbd>←</kbd><kbd>→</kbd> keys</span><span>Click an era's name to open its chapter</span><span>Click any marker to read that moment</span></div>
      </div>
      <div className="w-foot">
        <button className="linkish" onClick={() => openModule("conclusion", "overview")}>The book's opening: Conclusion</button>
        <button className="btn small" onClick={close}>Explore the timeline</button>
      </div>
    </aside>
  );
}

function LeadIn({ width, toToday, openSheet }) {
  return (
    <section className="opening scroll-y" style={{ width, overflowY: "auto" }} aria-label="The beginning">
      <div className="eyebrow">The beginning</div>
      <h2 className="title-card" style={{ fontSize: "clamp(30px, 5vh, 54px)" }}>Before<br />retirement</h2>
      <p className="sub">For most of human history there was no word for it. People grew old inside families, guilds and congregations, and contribution changed shape instead of stopping.</p>
      <p className="lede" style={{ fontSize: 15.5 }}>Travel right to watch the idea get conceived, forged, perfected for one generation, codified, and come apart.</p>
      <div><button className="btn" onClick={toToday}>Back to today {Icon.right}</button></div>
      <div className="master-card">
        <button className="thumb" onClick={() => openSheet("master")} aria-label="Open the author's hand-drawn master timeline"><img src={MASTER.thumb} alt="" loading="lazy" /></button>
        <div className="eyebrow">The author's master timeline</div>
        <p className="hand" style={{ fontSize: 17, lineHeight: 1.3 }}>“{MASTER.quotes[0]}”</p>
        <p style={{ fontSize: 13.5, color: "var(--kraft-muted)" }}>Drawn by hand on kraft paper before any of this was a website. Every entry on it is on this line, ringed, with his words. <button className="linkish" onClick={() => openSheet("master")}>See the original</button></p>
        <div className="legend-dots">{MASTER.legend.filter(l => l.key !== "dates").map(l => <span key={l.key}><i style={{ background: l.color }} />{l.label}</span>)}</div>
      </div>
    </section>
  );
}

function Closing({ width, openModule, openSheet }) {
  const m = MOD.correction;
  const cards = [
    ["seeds", "The nine seeds", "Follow each idea from planting to harvest across every era."],
    ["course", "The course", "Schedule, grading, every assignment and its rubric."],
    ["media", "Podcasts & lectures", "Listen to and watch each era's episode and lecture."],
    ["index", "Every event", "The whole timeline as a list, era by era."],
    ["master", "The master timeline", "The author's hand-drawn original, and where each note landed."],
  ];
  return (
    <section className="closing scroll-y" style={{ width, overflowY: "auto" }} aria-label="Correction and course materials">
      <div className="eyebrow">Unit {m.unit} · {m.role}</div>
      <h2 className="title-card" style={{ fontSize: "clamp(36px, 6.4vh, 80px)" }}>{m.title}</h2>
      <p className="sub" style={{ maxWidth: "36ch" }}>{m.tagline}</p>
      <div><button className="btn primary" onClick={() => openModule("correction", "overview")}>Open the final chapter {Icon.right}</button></div>
      <div className="closing-grid">
        {cards.map(([id, t, d]) => (
          <button key={id} className="kcard click" onClick={() => openSheet(id)}>
            <h3 style={{ fontSize: 17 }}>{t}</h3><p style={{ fontSize: 15 }}>{d}</p>
          </button>
        ))}
      </div>
      <p className="type" style={{ fontSize: 12, color: "var(--kraft-muted)" }}>© {new Date().getFullYear()} {D.meta.byline} · {D.meta.org} · Chapter text from the author's working draft of {D.meta.book}.</p>
    </section>
  );
}

function Drawer({ sel, idx, total, step, go, close, openModule, openSheet }) {
  const t = TYPE[sel.type] || TYPE.policy;
  const lens = sel.lens ? D.lens.find(l => l.id === sel.lens) : null;
  const seed = sel.seed ? D.seeds.find(s => s.n === sel.seed) : null;
  const m = MOD[sel.module];
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = 0; }, [sel.id]);
  const panelFor = lens ? "lens" : { markets: "markets", movements: "movements", history: "history", culture: "culture", seeds: "seeds" }[sel.lane] || "overview";
  const conns = linksOf(sel.id).map(l => ({ l, o: ITEM[l.from === sel.id ? l.to : l.from] })).filter(c => c.o);
  const thread = threadOf(sel.id);
  const isNote = sel.type === "note";
  return (
    <aside className="drawer" aria-label="Event detail" aria-live="polite">
      <div className="drawer-head">
        <div className="meta">
          <span className="pill" style={{ background: t.color }}>{t.label}</span>
          <span className="tnum">{yrs(sel.year, sel.endYear)}</span>
          {sel.projected && <span>projected</span>}
          {m && <span>· {m.title}</span>}
          {sel.master && <span className="ring-tag" title="On the author's hand-drawn master timeline"><span className="ring-demo" aria-hidden="true" />master timeline</span>}
        </div>
        <button className="icon-btn" onClick={close} aria-label="Close detail">{Icon.close}</button>
      </div>
      <div className="drawer-body scroll-y" ref={ref}>
        <h3>{lens ? (lens.source === "author" ? `${lens.year}: ${lens.label}` : `Two lives in ${lens.year}`) : sel.title}</h3>
        {sel.decline && <div className="decline tnum">{sel.decline}</div>}
        {lens ? (
          <div className="lens-mini">
            {[["older", 60, "Leaving work"], ["younger", 20, "Entering work"]].map(([k, age, role]) => (
              <div key={k}><div className="who">{role} · age {age} · born {lens[k].born}</div><h4>{lens[k].headline}</h4><p>{lens[k].text}</p></div>
            ))}
            <p className="irony">{lens.irony}</p>
          </div>
        ) : (
          <>
            {isNote ? <p className="txt" style={{ fontSize: 16 }}>{sel.detail}</p> : <p className="txt">{sel.detail}</p>}
            {sel.significance && <p className="why"><b>{seed ? "The seed in one line" : "Why it matters"}</b>{sel.significance}</p>}
          </>
        )}
        {sel.hand && (
          <div className="master-block">
            <div className="eyebrow">{isNote ? "His note, as written" : seed ? "Where he planted it" : "On the master timeline"}</div>
            <p className="hand">{sel.hand}</p>
            <button className="linkish" onClick={() => openSheet("master", "photo")}>See the hand-drawn original</button>
          </div>
        )}
        {conns.length > 0 && (
          <div className="conns">
            <div className="eyebrow">His arrows connect this to</div>
            {conns.map(({ l, o }) => (
              <button key={o.id} className="conn" onClick={() => go(o.id)} style={{ "--lc": LINK_COLOR[l.kind] || LINK_COLOR.arrow }}>
                <span className="dir" aria-hidden="true">{l.from === sel.id ? "→" : "←"}</span>
                <span className="what">{itemLabel(o)}</span>
                <span className="type tnum">{yrs(o.year, o.endYear)}</span>
              </button>
            ))}
          </div>
        )}
        {thread && (
          <div className="thread" style={{ "--tc": thread.color }}>
            <div className="eyebrow">Thread · {thread.title}</div>
            <p>{thread.summary}</p>
            <div className="steps" role="group" aria-label={thread.title}>
              {thread.items.map((id, i) => <button key={id} className={"stp" + (id === sel.id ? " cur" : "")} aria-current={id === sel.id ? "step" : undefined} onClick={() => go(id)}><span className="tnum">{i + 1} · {ITEM[id].year}</span><span>{trunc(ITEM[id].title, 44)}</span></button>)}
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {m && <button className="btn small primary" onClick={() => openModule(m.id, panelFor)}>Open {m.title}</button>}
          {seed && <button className="btn small" onClick={() => openSheet("seeds", "seed-" + seed.n)}>Follow this seed</button>}
          {m && <button className="btn small" onClick={() => openModule(m.id, "chapter")}>{Icon.book}Read the chapter</button>}
        </div>
      </div>
      <div className="drawer-foot">
        <span className="type tnum" style={{ fontSize: 12, color: "var(--muted)" }}>{idx + 1} of {total} on the line</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn small" onClick={() => step(-1)}>{Icon.left}Earlier</button>
          <button className="btn small" onClick={() => step(1)}>Later{Icon.right}</button>
        </div>
      </div>
    </aside>
  );
}

/* ================================================================ MINIMAP */
const MIN_SHARE = .105; // every era gets at least this much of the bar, so its name is never cut off
function fitLabel(label, px) {
  // Archivo 800 uppercase is about 0.70em per letter at normal width; the face condenses to 62%
  const base = label.length * .70;
  for (const [fs, st] of [[10, 100], [10, 88], [9.5, 78], [9, 68], [8.5, 62]]) if (base * fs * st / 100 + 8 <= px) return { fontSize: fs, fontStretch: st + "%" };
  return { fontSize: 8, fontStretch: "62%" };
}
function Minimap({ viewportRef, geom }) {
  const [v, setV] = useState({ l: 0, w: 0, bw: 0 });
  const bar = useRef(null), dragging = useRef(false);
  useEffect(() => {
    const el = viewportRef.current; if (!el) return;
    const upd = () => setV({ l: el.scrollLeft, w: el.clientWidth, bw: bar.current ? bar.current.getBoundingClientRect().width : 0 });
    upd(); el.addEventListener("scroll", upd, { passive: true }); window.addEventListener("resize", upd);
    return () => { el.removeEventListener("scroll", upd); window.removeEventListener("resize", upd); };
  }, [geom]);
  if (!geom) return <div className="minimap" />;
  const { OPEN_W, CLOSE_W, scale, total } = geom;
  const segs = [{ id: "start", label: "Beginning", x: 0, w: OPEN_W }];
  D.eras.forEach((e, i) => {
    const x0 = OPEN_W + (i === 0 ? 0 : scale.X(e.start)), x1 = OPEN_W + (i === D.eras.length - 1 ? scale.W : scale.X(e.end));
    segs.push({ id: e.id, label: MOD[e.id].title, x: x0, w: x1 - x0, color: eraColor(e.id) });
  });
  segs.push({ id: "correction", label: "Correction", x: OPEN_W + scale.W, w: CLOSE_W, color: eraColor("correction") });
  // bar shares: proportional to time, with a floor for each named era
  const sum = segs.reduce((a, s) => a + (s.color ? Math.max(MIN_SHARE, s.w / total) : s.w / total), 0);
  let acc = 0; segs.forEach(s => { s.bw = (s.color ? Math.max(MIN_SHARE, s.w / total) : s.w / total) / sum; s.bx = acc; acc += s.bw; });
  const toBar = x => { const s = segs.find(q => x >= q.x && x < q.x + q.w) || segs[segs.length - 1]; return s.bx + Math.min(1, Math.max(0, (x - s.x) / s.w)) * s.bw; };
  const fromBar = f => { const s = segs.find(q => f >= q.bx && f < q.bx + q.bw) || segs[segs.length - 1]; return s.x + Math.min(1, Math.max(0, (f - s.bx) / s.bw)) * s.w; };
  const center = v.l + v.w / 2;
  const cur = segs.find(s => center >= s.x && center < s.x + s.w) || segs[segs.length - 1];
  const yearAt = center > OPEN_W && center < OPEN_W + scale.W ? Math.round(scale.Y(center - OPEN_W)) : null;
  const go = x => viewportRef.current.scrollTo({ left: Math.max(0, x), behavior: smooth });
  const ci = segs.indexOf(cur);
  const fromPointer = e => { const r = bar.current.getBoundingClientRect(); viewportRef.current.scrollLeft = fromBar((e.clientX - r.left) / r.width) - v.w / 2; };
  const winL = toBar(v.l), winR = toBar(v.l + v.w);
  return (
    <div className="minimap" aria-label="Where you are in the story">
      <div className="where">
        <span className="chipdot" style={{ background: cur.color || "var(--surface-2)" }} />
        <b>{cur.label}</b>
        <span className="tnum">{cur.id === "start" ? "before 1340" : cur.id === "correction" ? "today" : yearAt ? `≈ ${Math.min(2100, yearAt)}` : ""}</span>
      </div>
      <div className="mapbar" ref={bar} role="slider" tabIndex={0} aria-label="Position on the timeline" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v.l / Math.max(1, total - v.w) * 100)} aria-valuetext={cur.label}
        onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={e => { if (dragging.current) fromPointer(e); }}
        onPointerUp={() => { dragging.current = false; }}
        onKeyDown={e => { if (e.key === "ArrowRight") go(v.l + v.w * .8); if (e.key === "ArrowLeft") go(v.l - v.w * .8); }}>
        {segs.map(s => <div key={s.id} className="seg" style={{ width: (s.bw * 100) + "%", background: s.color || "var(--surface-2)" }} title={s.label}>{s.color && <span style={fitLabel(s.label.toUpperCase(), s.bw * v.bw)}>{s.label}</span>}</div>)}
        <div className="win" style={{ left: (winL * 100) + "%", width: ((winR - winL) * 100) + "%" }} />
      </div>
      <div className="mapnav">
        <button className="icon-btn" aria-label="Previous era" disabled={ci <= 0} onClick={() => go(ci - 1 === 0 ? 0 : segs[ci - 1].x - 10)}>{Icon.left}</button>
        <button className="icon-btn" aria-label="Next era" disabled={ci >= segs.length - 1} onClick={() => go(segs[Math.min(segs.length - 1, ci + 1)].x - 10)}>{Icon.right}</button>
      </div>
    </div>
  );
}

/* ================================================================ SHEETS (horizontal click-in views) */
function Sheet({ band, eyebrow, title, onClose, panels, start, nav }) {
  const strip = useRef(null), refs = useRef({});
  const tabs = useMemo(() => { const seen = []; panels.forEach(p => { if (p.tab && !seen.find(t => t.tab === p.tab)) seen.push({ tab: p.tab, id: p.id }); }); return seen; }, [panels]);
  const [active, setActive] = useState(tabs.length ? tabs[0].tab : null);
  const goTo = useCallback((id, behavior) => {
    const el = refs.current[id], s = strip.current; if (!el || !s) return;
    s.scrollTo({ left: el.offsetLeft - parseFloat(getComputedStyle(s).paddingLeft || 0), behavior: behavior || smooth });
  }, []);
  useLayoutEffect(() => { if (start) setTimeout(() => goTo(start, "auto"), 0); }, []);
  useEffect(() => {
    const s = strip.current; if (!s) return;
    const onScroll = () => {
      const pl = parseFloat(getComputedStyle(s).paddingLeft || 0); let best = null, bd = 1e9;
      panels.forEach(p => { const el = refs.current[p.id]; if (!el || !p.tab) return; const d = Math.abs(el.offsetLeft - pl - s.scrollLeft); if (d < bd) { bd = d; best = p.tab; } });
      if (s.scrollLeft + s.clientWidth >= s.scrollWidth - 4) { const last = [...panels].reverse().find(p => p.tab); if (last) best = last.tab; }
      if (best) setActive(best);
    };
    const onWheel = e => {
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      let t = e.target;
      while (t && t !== s) {
        const cs = getComputedStyle(t);
        if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && t.scrollHeight > t.clientHeight + 1 &&
          ((e.deltaY > 0 && t.scrollTop + t.clientHeight < t.scrollHeight - 1) || (e.deltaY < 0 && t.scrollTop > 0))) return;
        t = t.parentElement;
      }
      e.preventDefault(); s.scrollLeft += e.deltaY * (e.deltaMode === 1 ? 32 : 1);
    };
    s.addEventListener("scroll", onScroll, { passive: true }); s.addEventListener("wheel", onWheel, { passive: false }); onScroll();
    return () => { s.removeEventListener("scroll", onScroll); s.removeEventListener("wheel", onWheel); };
  }, [panels]);
  useEffect(() => {
    const k = e => {
      if (e.target.closest && e.target.closest("input,textarea,select")) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const s = strip.current; s.scrollBy({ left: (e.key === "ArrowRight" ? 1 : -1) * Math.min(520, s.clientWidth * .8), behavior: smooth }); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label={title} style={{ "--band": band }}>
      <div className="sheet-head">
        <button className="btn small" onClick={onClose}>{Icon.left}<span className="hide-sm">Back to the timeline</span></button>
        <div className="t"><div className="eyebrow">{eyebrow}</div><h2>{title}</h2></div>
        <div className="nav2">{nav}</div>
      </div>
      <div className="tabs" role="tablist" aria-label="Sections">
        {tabs.map(t => <button key={t.tab} role="tab" aria-current={active === t.tab ? "true" : undefined} onClick={() => goTo(t.id)}>{t.tab}</button>)}
      </div>
      <div className="strip" ref={strip}>
        {panels.map(p => (
          <section key={p.id} ref={el => { refs.current[p.id] = el; }} className={"panel " + (p.cls || "")} style={p.w ? { "--w": p.w + "px" } : null} aria-label={p.label || p.tab}>
            {p.node}
          </section>
        ))}
      </div>
    </div>
  );
}

function ChapterCols({ m }) {
  const ref = useRef(null);
  const c = m.chapter;
  const measure = useCallback(() => {
    const el = ref.current; if (!el) return;
    const cw = parseFloat(getComputedStyle(el).columnWidth) || 500;
    el.style.width = cw + "px";
    el.style.width = Math.ceil(el.scrollWidth + 2) + "px";
  }, []);
  useLayoutEffect(() => {
    measure();
    const el = ref.current; const ro = new ResizeObserver(() => measure()); ro.observe(el.parentElement);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    return () => ro.disconnect();
  }, [m.id]);
  return (
    <>
      <div className="chapter-head">
        <span>Unit {m.unit} · {m.title} · {m.chapterLabel}</span><span>{c.words.toLocaleString()} words · about {c.minutes} min</span>
        <a className="btn small" href={m.downloads.pdf} download target="_blank" rel="noopener">{Icon.down}Download PDF</a>
        <span>The text runs sideways: keep scrolling right to read on</span>
      </div>
      <div className="cols" ref={ref} style={{ flex: "1 1 auto", minHeight: 0 }}>
        {c.status === "forthcoming" && <div className="forthcoming"><b>This chapter is still being written.</b> What follows is the author's synopsis. Use the events and projections panels for this era's readings and data.</div>}
        {c.subtitle && <p className="eyebrow" style={{ fontSize: 13 }}>{c.subtitle}</p>}
        {c.epigraph && <div className="epigraph">“{c.epigraph.quote}”<cite>— {c.epigraph.attribution}</cite></div>}
        <div dangerouslySetInnerHTML={{ __html: c.html }} />
        <p className="end">End of {m.title}. From the author's working draft of {D.meta.book}; please don't share outside the course.</p>
      </div>
    </>
  );
}

function StageGlyph({ stage, size = 28 }) {
  const c = "var(--t-seed)", s = size;
  const g = { planted: 0, sprouting: 1, growing: 2, blooming: 3, harvest: 4 }[stage];
  if (g === undefined) return <svg width={s} height={s} viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="22" r="1.5" style={{ fill: "var(--line-strong)" }} /></svg>;
  return (
    <svg width={s} height={s} viewBox="0 0 28 28" aria-hidden="true">
      <line x1="5" x2="23" y1="23" y2="23" style={{ stroke: "var(--line-strong)", strokeWidth: 1.5 }} />
      {g === 0 && <ellipse cx="14" cy="21" rx="3" ry="2.2" style={{ fill: c }} />}
      {g >= 1 && <line x1="14" x2="14" y1="23" y2={g === 1 ? 15 : g === 2 ? 9 : 8} style={{ stroke: c, strokeWidth: 2, strokeLinecap: "round" }} />}
      {g === 1 && <ellipse cx="16.5" cy="15" rx="3" ry="1.6" transform="rotate(-30 16.5 15)" style={{ fill: c }} />}
      {g >= 2 && g <= 3 && <g style={{ fill: c }}><ellipse cx="18" cy="15" rx="4" ry="2" transform="rotate(-30 18 15)" /><ellipse cx="10" cy="17" rx="4" ry="2" transform="rotate(30 10 17)" /></g>}
      {g === 3 && <g><circle cx="14" cy="7" r="4.5" style={{ fill: c }} /><circle cx="14" cy="7" r="1.6" style={{ fill: "var(--surface)" }} /></g>}
      {g === 4 && <g style={{ fill: c }}><ellipse cx="14" cy="5.5" rx="2" ry="3" /><ellipse cx="10.5" cy="9" rx="2" ry="3" transform="rotate(-35 10.5 9)" /><ellipse cx="17.5" cy="9" rx="2" ry="3" transform="rotate(35 17.5 9)" /><ellipse cx="10.5" cy="14" rx="2" ry="3" transform="rotate(-35 10.5 14)" /><ellipse cx="17.5" cy="14" rx="2" ry="3" transform="rotate(35 17.5 14)" /></g>}
    </svg>
  );
}

function LensCard({ lens }) {
  return (
    <div className="lens-card">
      <div className="lens-pair" style={{ padding: 0 }}>
        {[["older", 60, "Leaving work"], ["younger", 20, "Entering work"]].map(([k, age, role]) => (
          <div key={k} style={{ padding: "16px 18px" }}>
            <div className="eyebrow">{role} in {lens.year}</div>
            <div className="age">{age}</div>
            <div className="born">born {lens[k].born}</div>
            <h5>{lens[k].headline}</h5>
            <p>{lens[k].text}</p>
          </div>
        ))}
      </div>
      <div className="foot">{lens.irony}</div>
    </div>
  );
}

function Rubric({ rubric }) {
  const total = rubric.reduce((a, r) => a + r.points, 0);
  return (
    <div className="rubric-wrap">
      <table className="rubric">
        <thead><tr><th>Criterion</th><th>Points</th><th>Exemplary</th><th>Proficient</th><th>Developing</th><th>Beginning</th></tr></thead>
        <tbody>{rubric.map(r => <tr key={r.criterion}><th scope="row">{r.criterion}</th><td className="p tnum">{r.points}</td><td>{r.exemplary}</td><td>{r.proficient}</td><td>{r.developing}</td><td>{r.beginning}</td></tr>)}</tbody>
        <tfoot><tr><td>Total</td><td className="p tnum">{total}</td><td colSpan={4} style={{ fontWeight: 400, color: "var(--muted)" }}>Suggested bands: exemplary 90–100% of a criterion's points, proficient 80–89%, developing 70–79%, beginning below 70%.</td></tr></tfoot>
      </table>
    </div>
  );
}

function Quiz({ m }) {
  const key = "sor-quiz-" + m.id;
  const [ans, setAns] = useState(() => store.get(key, {}));
  const pick = (qi, oi) => { if (ans[qi] !== undefined) return; const n = { ...ans, [qi]: oi }; setAns(n); store.set(key, n); };
  const done = Object.keys(ans).length, right = m.quiz.filter((q, i) => ans[i] === q.answer).length;
  return (
    <>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }} className="type"><span>{done} of {m.quiz.length} answered · {right} correct</span>{done > 0 && <button className="btn small ghost" onClick={() => { setAns({}); store.set(key, {}); }}>Start over</button>}</div>
      {m.quiz.map((q, qi) => (
        <div className="qcard" key={qi}>
          <p className="q">{qi + 1}. {q.q}</p>
          <div className="opts">
            {q.options.map((o, oi) => {
              const chosen = ans[qi] !== undefined; const cls = chosen ? (oi === q.answer ? " right" : oi === ans[qi] ? " wrong" : "") : "";
              return <button key={oi} className={"opt" + cls} disabled={chosen} onClick={() => pick(qi, oi)}><span className="k">{"ABCDE"[oi]}</span><span>{o}</span></button>;
            })}
          </div>
          {ans[qi] !== undefined && <p className="explain">{ans[qi] === q.answer ? <b className="ok">Correct. </b> : <b className="bad">Not quite. </b>}{q.explain}</p>}
        </div>
      ))}
    </>
  );
}

function EvList({ list, kind, mid, onShow }) {
  return (
    <ul className="evlist">
      {list.map((e, i) => {
        const itemId = e.itemId, onLine = !!(itemId && ITEM[itemId]), t = TYPE[e.type];
        return (
          <li key={i}>
            <div className="yr tnum">{t && <span className="sq" style={{ background: t.color }} title={t.label} />}{yrs(e.year, e.endYear)}{e.decline && <span style={{ color: "var(--t-crisis)", marginLeft: 8 }}>{e.decline}</span>}{e.master && <span className="ring-tag" title="On the author's hand-drawn master timeline"><span className="ring-demo" aria-hidden="true" />master timeline</span>}</div>
            {onLine ? <button className="t" onClick={() => onShow(itemId)} title="Show on the timeline">{e.title || e.name}</button> : <div style={{ fontWeight: 700 }}>{e.title || e.name}</div>}
            <div className="d">{e.detail}</div>
            {e.hand && <div className="hand-line hand">{e.hand}</div>}
            {(e.significance || e.retirementImpact) && <div className="s"><b>{kind === "markets" ? "For retirement: " : "Why it matters: "}</b>{e.significance || e.retirementImpact}</div>}
          </li>
        );
      })}
    </ul>
  );
}

function moduleSheet(m, { openModule, openSheet, showItem, close }) {
  const extra = D.lens.filter(l => l.module === m.id && l.source === "author");
  const P = [];
  P.push({ id: "overview", tab: "Overview", w: 620, cls: "scroll-y", node: (
    <>
      <div className="def">{m.definition}</div>
      <p className="lead">{m.tagline}</p>
      <div className="bigq"><div className="eyebrow">The big question</div><p className="q">{m.bigQuestion}</p></div>
      <div className="big">{m.overview.split(/\n\n+/).map((p, i) => <p key={i}>{p}</p>)}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a className="btn" href={m.downloads.pdf} download target="_blank" rel="noopener">{Icon.down}Chapter PDF</a>
        {ERA_IDS.includes(m.id) && <button className="btn" onClick={() => { const f = D.items.filter(i => i.module === m.id && i.lane === "policy").sort((a, b) => a.year - b.year)[0]; if (f) showItem(f.id); }}>Show this era on the timeline</button>}
      </div>
      <p className="eyebrow">Scroll sideways for the chapter, events, assignment and more →</p>
    </>
  ) });
  P.push({ id: "chapter", tab: "Chapter", cls: "chapter", label: "Chapter text", node: <ChapterCols m={m} /> });
  P.push({ id: "lens", tab: "Two lives", w: 760, cls: "scroll-y", node: (
    <>
      <h3>The Two-Person Lens · same year, two realities</h3>
      <LensCard lens={m.twoPersonLens} />
      {extra.map(l => <div key={l.id} style={{ display: "grid", gap: 10 }}><h3>From the author's lens notes · {l.label}</h3><LensCard lens={l} /></div>)}
    </>
  ) });
  P.push({ id: "seeds", tab: "Seeds", w: 540, cls: "scroll-y", node: (
    <>
      <h3>Seeds at work in this era</h3>
      {m.seeds.map(s => { const seed = D.seeds.find(x => x.n === s.seed); return (
        <div className="seedrow" key={s.seed}>
          <div className="seednum">{s.seed}</div>
          <div><div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", alignItems: "center" }}><b style={{ fontSize: 16 }}>{seed.name}</b><span className="stage-lbl"><StageGlyph stage={s.stage} size={22} />{s.stage}</span></div>
            <p style={{ color: "var(--ink-2)", marginTop: 4 }}>{s.detail}</p></div>
        </div>); })}
    </>
  ) });
  [["policy", "policyEvents", "Law & policy", "var(--t-legislation)", 520], ["markets", "marketDrops", "Markets & money", "var(--t-crisis)", 460], ["movements", "socialMovements", "Social movements", "var(--t-movement)", 460], ["history", "historicalContext", "History", "var(--t-history)", 460], ["culture", "cultureEvents", "Culture & technology", "var(--t-culture)", 440]].forEach(([k, f, t, c, w]) => {
    if (m[f] && m[f].length) P.push({ id: k, tab: "Events", w, cls: "scroll-y", label: t, node: (<><h3><span className="sq" style={{ background: c }} />{t}</h3><EvList list={m[f]} kind={k} mid={m.id} onShow={showItem} /></>) });
  });
  P.push({ id: "inequities", tab: "Who was left out", w: 540, cls: "scroll-y", node: (
    <>
      <h3>Inequities: who was served and who was left out</h3>
      <p className="ineq-note">Each entry names the variables at work. Hold more than one at a time, and read these against <button className="linkish" onClick={() => openSheet("course", "ineq-funnel")}>the author's inequity funnel</button> and <button className="linkish" onClick={() => openSheet("course", "ineq-frame")}>how this course engages inequity</button>.</p>
      {m.inequities.map(q => (
        <div key={q.title} className="ineq">
          <div className="chips">{(q.vars || []).map(v => <span key={v} className="chip var" data-v={v}>{VAR_LABEL[v] || v}</span>)}</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{q.title}</div>
          <p style={{ color: "var(--ink-2)" }}>{q.detail}</p>
        </div>
      ))}
      <div className="prompt"><b>Before you move on. </b>Pick one entry and name a second variable at work that it does not lead with. What changes when you lead with that one, and what does the author's distinction between equality of opportunity and equality of outcome do to your reading?</div>
    </>
  ) });
  P.push({ id: "study", tab: "Study guide", w: 540, cls: "scroll-y", node: (
    <><h3>Learning objectives</h3><ul className="objs">{m.learningObjectives.map((o, i) => <li key={i}>{o}</li>)}</ul>
      <h3 style={{ marginTop: 8 }}>Key terms</h3><dl className="terms">{m.keyTerms.map(t => <div key={t.term}><dt>{t.term}</dt><dd>{t.definition}</dd></div>)}</dl></>
  ) });
  P.push({ id: "figures", tab: "Study guide", w: 500, cls: "scroll-y", label: "Key figures and primary sources", node: (
    <><h3>Key figures</h3><dl className="terms">{m.keyFigures.map(t => <div key={t.name}><dt>{t.name}</dt><dd>{t.role}</dd></div>)}</dl>
      <h3 style={{ marginTop: 8 }}>Primary sources to read</h3>
      <ul className="sources-list">{m.primarySources.map(s => <li key={s.title}><a href={s.url} target="_blank" rel="noopener">{s.title}</a> <span className="yr">{s.year} · {s.source}</span><div className="why">{s.why}</div></li>)}</ul></>
  ) });
  P.push({ id: "discussion", tab: "Discussion", w: 540, cls: "scroll-y", node: (<><h3>Discussion questions</h3><ol className="qs">{m.discussionQuestions.map((q, i) => <li key={i}>{q}</li>)}</ol></>) });
  P.push({ id: "media", tab: "Podcast & lecture", w: 600, cls: "scroll-y", node: <ModuleMedia m={m} /> });
  P.push({ id: "assignment", tab: "Assignment", w: 1040, cls: "scroll-y", node: (
    <><div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", justifyContent: "space-between", alignItems: "baseline" }}><h4 style={{ fontFamily: "var(--f-display)", fontStretch: "112%", fontSize: 24, fontWeight: 800 }}>{m.assignment.title}</h4><span className="pts">{m.assignment.type} · {m.assignment.points} points</span></div>
      <p className="big" style={{ maxWidth: "70ch" }}>{m.assignment.prompt}</p><p><b>Deliverable: </b>{m.assignment.deliverable}</p>
      <h3>Grading rubric</h3><Rubric rubric={m.assignment.rubric} /></>
  ) });
  P.push({ id: "quiz", tab: "Self-check", w: 620, cls: "scroll-y", node: <><h3>Self-check</h3><Quiz m={m} /></> });
  P.push({ id: "sources", tab: "Sources", w: 520, cls: "scroll-y", node: (<><h3>Sources used to build this unit</h3><ol style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 6, fontSize: 14.5 }}>{m.sources.map((s, i) => <li key={i}><a href={s.url} target="_blank" rel="noopener">{s.label}</a></li>)}</ol></>) });
  const nx = nextMod(m.id);
  if (nx) P.push({ id: "next", cls: "bare", w: 320, label: "Next chapter", node: (
    <button className="kcard click" style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)", marginTop: "auto", marginBottom: "auto" }} onClick={() => openModule(nx.id, "overview")}>
      <div className="k-eyebrow" style={{ color: "var(--muted)" }}>Next · Unit {nx.unit} · {nx.role}</div>
      <h3 style={{ fontSize: 26 }}>{nx.title}</h3><p>{nx.tagline}</p><span className="go">Continue {Icon.right}</span>
    </button>
  ) });
  return P;
}

/* ---------------- media UI */
function embedFor(url) {
  if (!url) return null;
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if (m) return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${m[1]}` };
  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return { kind: "iframe", src: `https://player.vimeo.com/video/${m[1]}` };
  if (/\.(mp3|m4a|aac|wav|ogg|oga)(\?|$)/i.test(url)) return { kind: "audio", src: url };
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return { kind: "video", src: url };
  return { kind: "link", src: url };
}
const KIND = { podcast: "Podcast episode", lecture: "Video lecture", other: "Recording" };
const fmtMB = b => (b / 1048576 >= 10 ? Math.round(b / 1048576) : (b / 1048576).toFixed(1)) + " MB";
function MediaItem({ item }) {
  const media = useContext(MediaCtx);
  const [busy, setBusy] = useState(false), [confirm, setConfirm] = useState(false), [err, setErr] = useState(null);
  const url = media.publicUrl(item);
  let e = item.file_url && item.mime_type
    ? { kind: item.mime_type.startsWith("video") ? "video" : "audio", src: item.file_url }
    : embedFor(url);
  return (
    <div className="media-item">
      <div className="kind"><span>{KIND[item.kind] || "Recording"}{item.size ? ` · ${fmtMB(item.size)}` : ""}</span>{item.created_at && <span className="tnum">{new Date(item.created_at).toLocaleDateString()}</span>}</div>
      <h5>{item.title}</h5>
      {item.description && <p style={{ color: "var(--ink-2)", fontSize: 14.5 }}>{item.description}</p>}
      {e && e.kind === "audio" && <audio controls preload="metadata" src={e.src} />}
      {e && e.kind === "video" && <video controls preload="metadata" src={e.src} />}
      {e && e.kind === "iframe" && <div className="embed"><iframe src={e.src} title={item.title} loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>}
      {url && !item.file_url && <a href={url} target="_blank" rel="noopener" className="btn small" style={{ alignSelf: "flex-start" }}>{Icon.ext}{e && e.kind === "link" ? "Open recording" : "Open in new tab"}</a>}
      {media.instructor && item.id && (confirm ? (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 14 }}>Remove this recording for everyone?</span>
          <button className="btn small" disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { await media.remove(item); } catch (x) { setErr(x.message); setBusy(false); } }}>{busy ? "Removing…" : "Remove"}</button>
          <button className="btn small ghost" onClick={() => setConfirm(false)}>Keep</button>
        </div>) : <button className="btn small ghost" style={{ alignSelf: "flex-start" }} onClick={() => setConfirm(true)}>Remove…</button>)}
      {err && <div className="notice err">{err}</div>}
    </div>
  );
}
function UploadForm({ moduleId }) {
  const media = useContext(MediaCtx);
  const sfx = moduleId || "all";
  const maxMB = Math.round(media.limits.maxBytes / 1048576);
  const [mod, setMod] = useState(moduleId || "collapse");
  const [kind, setKind] = useState("podcast"), [title, setTitle] = useState(""), [desc, setDesc] = useState("");
  const [src, setSrc] = useState("file"), [file, setFile] = useState(null), [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false), [msg, setMsg] = useState(null), [prog, setProg] = useState(null);
  const submit = async e => {
    e.preventDefault(); setMsg(null);
    if (!title.trim()) return setMsg({ err: true, t: "Give the recording a title." });
    if (src === "file" && !file) return setMsg({ err: true, t: "Choose an audio or video file to upload." });
    if (src === "file" && file.size > media.limits.maxBytes) return setMsg({ err: true, t: `That file is ${fmtMB(file.size)}. The limit is ${maxMB} MB; post long videos to YouTube or Vimeo and paste the link instead.` });
    if (src === "file" && !/^(audio|video)\//.test(file.type || "")) return setMsg({ err: true, t: "Choose an audio or video file (for example .mp3, .m4a or .mp4)." });
    if (src === "link" && !/^https:\/\//.test(url.trim())) return setMsg({ err: true, t: "Paste a full link starting with https://" });
    setBusy(true); setProg(null);
    try {
      await media.add({ module: mod, kind, title: title.trim(), description: desc.trim(), file: src === "file" ? file : null, url: src === "link" ? url.trim() : null }, (d, t) => setProg({ d, t }));
      setMsg({ err: false, t: "Posted. Students can see it now." }); setTitle(""); setDesc(""); setFile(null); setUrl("");
      const f = document.getElementById("up-file-" + sfx); if (f) f.value = "";
    } catch (x) { setMsg({ err: true, t: x.message }); }
    setBusy(false); setProg(null);
  };
  return (
    <form className="form" onSubmit={submit}>
      <h3>Post a podcast episode or lecture</h3>
      {!moduleId && <label htmlFor="up-mod">Unit<select id="up-mod" value={mod} onChange={e => setMod(e.target.value)}>{MODS.map(m => <option key={m.id} value={m.id}>{m.unit}. {m.title}</option>)}</select></label>}
      <label htmlFor={"up-kind-" + sfx}>Type<select id={"up-kind-" + sfx} value={kind} onChange={e => setKind(e.target.value)}><option value="podcast">Podcast episode</option><option value="lecture">Video lecture</option><option value="other">Other recording</option></select></label>
      <label htmlFor={"up-title-" + sfx}>Title<input id={"up-title-" + sfx} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Episode 1: Where we are" /></label>
      <label htmlFor={"up-desc-" + sfx}>Description (optional)<textarea id={"up-desc-" + sfx} value={desc} onChange={e => setDesc(e.target.value)} /></label>
      <div className="radios" role="radiogroup" aria-label="Source">
        <label><input type="radio" name={"src-" + sfx} checked={src === "file"} onChange={() => setSrc("file")} />Upload a file</label>
        <label><input type="radio" name={"src-" + sfx} checked={src === "link"} onChange={() => setSrc("link")} />Paste a link (YouTube, Vimeo, podcast)</label>
      </div>
      {src === "file"
        ? <label htmlFor={"up-file-" + sfx}>Audio or video file (up to {maxMB} MB)<input id={"up-file-" + sfx} type="file" accept="audio/*,video/*" onChange={e => setFile(e.target.files[0] || null)} /></label>
        : <label htmlFor={"up-url-" + sfx}>Link<input id={"up-url-" + sfx} type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://" /></label>}
      {busy && prog && <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={prog.t} aria-valuenow={prog.d}><span style={{ width: (prog.d / prog.t * 100) + "%" }} /><em className="tnum">Uploading piece {prog.d} of {prog.t}</em></div>}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? (src === "file" ? "Uploading…" : "Posting…") : "Post recording"}</button>
        {msg && <span className={"notice" + (msg.err ? " err" : " ok")} role="status">{msg.t}</span>}
      </div>
      {src === "file" && <p style={{ fontSize: 13, color: "var(--muted)" }}>Keep this page open until the upload finishes. Long video lectures play best from YouTube (unlisted) or Vimeo.</p>}
    </form>
  );
}
function ModuleMedia({ m }) {
  const media = useContext(MediaCtx);
  const items = media.items.filter(i => i.module === m.id);
  const pods = items.filter(i => i.kind === "podcast"), lects = items.filter(i => i.kind === "lecture"), other = items.filter(i => i.kind !== "podcast" && i.kind !== "lecture");
  return (
    <>
      <h3>Podcast & lecture · {m.title}</h3>
      {media.mode === "loading" && <div className="notice">Loading recordings…</div>}
      {pods.length ? pods.map(i => <MediaItem key={i.id || i.title} item={i} />) : <div className="slot"><b>Podcast episode</b><span>The episode for {m.title} will appear here when it's posted.</span></div>}
      {lects.length ? lects.map(i => <MediaItem key={i.id || i.title} item={i} />) : <div className="slot"><b>Video lecture</b><span>The lecture for {m.title} will appear here when it's posted.</span></div>}
      {other.map(i => <MediaItem key={i.id || i.title} item={i} />)}
      {media.instructor && <UploadForm moduleId={m.id} />}
    </>
  );
}
function InstructorModal({ onClose }) {
  const media = useContext(MediaCtx);
  const [pw, setPw] = useState(""), [busy, setBusy] = useState(false), [msg, setMsg] = useState(null);
  useEffect(() => { const k = e => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  const go = async e => {
    e.preventDefault(); setBusy(true); setMsg(null);
    try { await media.signIn(pw); onClose(); } catch (x) { setMsg(x.message); }
    setBusy(false);
  };
  return (
    <div className="modal-back" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ins-title">
        <h3 id="ins-title">Instructor access</h3>
        {!media.live ? <p>The podcast and lecture library isn't reachable from this copy of the site. On the live site, instructors sign in here to post recordings for each unit.</p>
          : media.instructor ? (
            <div style={{ display: "grid", gap: 12 }}>
              <p>You're signed in as an instructor on this device. Post or remove recordings on any unit's “Podcast & lecture” panel, or in Podcasts & lectures.</p>
              <button className="btn" onClick={() => { media.signOut(); onClose(); }}>Sign out</button>
            </div>
          ) : (
            <form className="form" onSubmit={go}>
              <label htmlFor="ins-pw">Instructor password<input id="ins-pw" type="password" autoComplete="current-password" value={pw} onChange={e => setPw(e.target.value)} required /></label>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? "Checking…" : "Sign in"}</button>
              {msg && <div className="notice err" role="alert">{msg}</div>}
              <p style={{ fontSize: 13, color: "var(--muted)" }}>The password is set in the site's Netlify settings.</p>
            </form>
          )}
        <button className="btn ghost small" style={{ alignSelf: "flex-end" }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

/* ---------------- other click-in views */
const GARDEN_COLS = ["classical", "conception", "crucible", "climax", "codify", "collapse", "catastrophe", "correction"]; // chronological: watch each seed grow left to right
function SeedChart() {
  const [cell, setCell] = useState({ seed: 1, mod: "classical" });
  const stageOf = (n, mid) => MOD[mid].seeds.find(x => x.seed === n) || null;
  const cur = stageOf(cell.seed, cell.mod), seed = D.seeds.find(s => s.n === cell.seed);
  return (
    <>
      <h3>Each seed from its root to today, then ahead · left to right · select a cell</h3>
      <div className="garden-wrap">
        <table className="garden">
          <thead><tr><th style={{ textAlign: "left" }}>Seed</th>{GARDEN_COLS.map(c => <th key={c}><span style={{ display: "block", height: 4, borderRadius: 2, background: eraColor(c), margin: "0 auto 5px", width: 26 }} />{MOD[c].title}<span className="y">{MOD[c].years}</span></th>)}</tr></thead>
          <tbody>{D.seeds.map(s => (
            <tr key={s.n}>
              <th scope="row"><span style={{ color: "var(--t-seed)", fontFamily: "var(--f-display)", fontStretch: "125%", fontWeight: 800, marginRight: 8 }}>{s.n}</span>{s.name}<span className="g">{s.group} · on the master timeline {s.year}</span></th>
              {GARDEN_COLS.map(c => { const st = stageOf(s.n, c), on = cell.seed === s.n && cell.mod === c; return <td key={c}><button className={"gcell" + (on ? " sel" : "")} aria-pressed={on} aria-label={`${s.name} in ${MOD[c].title}: ${st ? st.stage : "not present"}`} onClick={() => setCell({ seed: s.n, mod: c })}><StageGlyph stage={st ? st.stage : null} /></button></td>; })}
            </tr>))}</tbody>
        </table>
      </div>
      <div className="legend">{STAGES.map(s => <span key={s}><StageGlyph stage={s} size={22} />{s}</span>)}<span><StageGlyph stage={null} size={22} />not yet present</span></div>
      <div style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }} aria-live="polite">
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "baseline" }}><span className="seednum">{seed.n}</span><b style={{ fontSize: 18 }}>{seed.name}</b><span className="stage-lbl"><StageGlyph stage={cur ? cur.stage : null} size={22} />{cur ? cur.stage : "not present"} in {MOD[cell.mod].title}</span></div>
        <p className="big" style={{ marginTop: 6 }}>{cur ? cur.detail : `${seed.name} has not yet appeared in this era.`}</p>
      </div>
    </>
  );
}
function seedsSheet() {
  const P = [{ id: "chart", tab: "Seed chart", w: 1060, cls: "scroll-y", node: <SeedChart /> }];
  D.seeds.forEach(s => {
    const trail = GARDEN_COLS.map(mid => ({ mid, st: MOD[mid].seeds.find(x => x.seed === s.n) }));
    P.push({ id: "seed-" + s.n, tab: "The nine seeds", w: 440, cls: "scroll-y seed-panel", label: s.name, node: (
      <>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline" }}><span className="seednum" style={{ fontSize: 40 }}>{s.n}</span><div><h4 style={{ fontSize: 20 }}>{s.name}</h4><div className="eyebrow">{s.group} seed · on the master timeline {s.year}</div></div></div>
        <p className="short">{s.short}</p>
        {s.hand && <div className="master-block"><div className="eyebrow">Where he planted it, in his hand</div><p className="hand">{s.hand}</p></div>}
        <p className="root">{s.root}</p>
        <h3 style={{ marginTop: 6 }}>From the root to today, then ahead</h3>
        <ul className="seed-trail">{trail.map(({ mid, st }) => <li key={mid}><StageGlyph stage={st ? st.stage : null} size={26} /><div><b>{MOD[mid].title}</b> <span className="type" style={{ fontSize: 12, color: "var(--muted)" }}>{st ? st.stage : "not yet present"}</span>{st && <div style={{ marginTop: 2 }}>{st.detail}</div>}</div></li>)}</ul>
      </>
    ) });
  });
  return P;
}
function Funnel({ F }) {
  // four levels narrowing to the mouth, where poverty waits
  const W = 420, top = 18, lh = 58, gap = 6;
  const widths = [400, 330, 260, 190];
  return (
    <div className="funnel">
      <svg viewBox={`0 0 ${W} ${top + 4 * (lh + gap) + 70}`} role="img" aria-label="The inequity funnel: wealth, gender, ethnicity, education, narrowing to poverty">
        {F.levels.map((l, i) => {
          const w0 = widths[i], w1 = widths[i + 1] || 150, y = top + i * (lh + gap);
          return (
            <g key={l.id}>
              <path d={`M${(W - w0) / 2} ${y} H${(W + w0) / 2} L${(W + w1) / 2} ${y + lh} H${(W - w1) / 2} Z`} className="lvl" data-v={l.id} />
              <text x={W / 2} y={y + 25} textAnchor="middle" className="n">{l.n}</text>
              <text x={W / 2} y={y + 45} textAnchor="middle" className="t">{l.name}</text>
            </g>
          );
        })}
        <path d={`M${(W - 150) / 2 + 18} ${top + 4 * (lh + gap)} h114 v26 h-114 Z`} className="mouth" />
        <text x={W / 2} y={top + 4 * (lh + gap) + 18} textAnchor="middle" className="m">POVERTY</text>
        <text x={W / 2} y={top + 4 * (lh + gap) + 48} textAnchor="middle" className="s">the most equal-opportunity player in the world</text>
      </svg>
    </div>
  );
}
function courseSheet(openModule) {
  const C = D.course;
  const wColors = ["var(--accent)", "var(--t-seed)", "var(--t-legislation)", "var(--t-movement)", "var(--t-crisis)"];
  const P = [];
  P.push({ id: "about", tab: "About", w: 640, cls: "scroll-y", node: (<><h3>Course description</h3><p className="big">{C.description}</p><h3>By the end, students will be able to</h3><ul className="objs">{C.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul></>) });
  const Q = C.inequity;
  if (Q) {
    P.push({ id: "ineq-frame", tab: "Engaging inequity", w: 600, cls: "scroll-y", label: "Engaging inequity: the frame", node: (
      <><h3>Engaging inequity · the frame</h3>{Q.framing.map((t, i) => <p key={i} className="big">{t}</p>)}
        <blockquote className="author-words">“{Q.authorWords}”<cite>— {D.meta.byline}</cite></blockquote></>
    ) });
    if (Q.funnel) {
      const F = Q.funnel;
      P.push({ id: "ineq-funnel", tab: "Engaging inequity", w: 900, cls: "scroll-y", label: "The inequity funnel", node: (
        <>
          <h3>{F.title} · the author's working theory</h3>
          <div className="funnel-grid">
            <div>
              <p className="big">{F.intro}</p>
              <Funnel F={F} />
              <p className="hand" style={{ fontSize: 19, lineHeight: 1.3, color: "var(--paper-ink)", marginTop: 8 }}>“{F.mouth}”</p>
              <p className="eyebrow" style={{ marginTop: 10 }}>Contributing factors, under the four levels</p>
              <div className="chips">{F.contributing.map(v => <span key={v} className="chip var" data-v={v}>{VAR_LABEL[v] || v}</span>)}</div>
            </div>
            <ol className="levels">
              {F.levels.map(l => (
                <li key={l.id} className="level" data-v={l.id}>
                  <div className="lv-head"><span className="chip var" data-v={l.id}>{l.n} · {l.name}</span></div>
                  <blockquote className="his">“{l.his}”</blockquote>
                  <p className="ev"><b>Against the data. </b>{l.evidence}</p>
                </li>
              ))}
              <li className="level caveat"><p className="ev">{F.caveat}</p></li>
            </ol>
          </div>
        </>
      ) });
    }
    P.push({ id: "ineq-principles", tab: "Engaging inequity", w: 560, cls: "scroll-y", label: "Seven working principles", node: (
      <><h3>Seven working principles</h3><ol className="principles">{Q.principles.map(p => <li key={p.title}><b>{p.title}</b><p>{p.text}</p></li>)}</ol></>
    ) });
    P.push({ id: "ineq-data", tab: "Engaging inequity", w: 860, cls: "scroll-y", label: "Nine variables, with data", node: (
      <><h3>Nine variables · one checked data point each</h3>
        <p style={{ color: "var(--ink-2)", maxWidth: "70ch" }}>Every “Who was left out” entry in the units is tagged with these. Each card gives one measurement a student can cite and check, and the units where that variable does the most work.</p>
        <div className="var-grid">{Q.variables.map(v => (
          <div key={v.id} className="var-card"><span className="chip var" data-v={v.id}>{v.label}</span><p className="fact">{v.fact}</p><p className="src">{v.source}</p><p className="units">On the timeline: {v.where}</p></div>
        ))}</div></>
    ) });
    P.push({ id: "ineq-questions", tab: "Engaging inequity", w: 580, cls: "scroll-y", label: "Discussion: opportunity and outcome", node: (
      <><h3>Discussion · equality of opportunity, equality of outcome</h3><ol className="qs">{Q.questions.map((q, i) => <li key={i}>{q}</li>)}</ol></>
    ) });
  }
  P.push({ id: "schedule", tab: "Schedule", w: 820, cls: "scroll-y", node: (
    <><h3>Fifteen weeks</h3><table className="sched"><thead><tr><th>When</th><th>Unit</th><th>Focus</th><th>Assignment</th></tr></thead>
      <tbody>{C.schedule.map(s => { const m = s.module ? MOD[s.module] : null; return <tr key={s.weeks}><td>{s.weeks}</td><td>{m ? <button onClick={() => openModule(m.id, "overview")}>{m.unit}. {m.title}</button> : "—"}</td><td>{s.focus}</td><td>{m ? <button style={{ fontWeight: 500 }} onClick={() => openModule(m.id, "assignment")}>{m.assignment.title}</button> : ""}</td></tr>; })}</tbody></table></>
  ) });
  P.push({ id: "grading", tab: "Grading", w: 540, cls: "scroll-y", node: (
    <><h3>Grade weights</h3><div className="weights" role="img" aria-label="Grade weights">{C.grading.map((g, i) => <span key={g.component} style={{ width: g.weight + "%", background: wColors[i] }} />)}</div>
      <ul className="wlist">{C.grading.map((g, i) => <li key={g.component}><span className="sw" style={{ background: wColors[i] }} /><span><b>{g.component}</b></span><span className="w tnum">{g.weight}%</span><span className="dd">{g.detail}</span></li>)}</ul>
      <h3>Grade scale</h3><div className="scale">{C.scale.map(s => <div key={s.grade}><b>{s.grade}</b><span className="tnum">{s.range}</span></div>)}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><a className="btn small" href={D.meta.guidePdf} download target="_blank" rel="noopener">{Icon.down}Course guide PDF</a><a className="btn small" href={D.meta.fullPdf} download target="_blank" rel="noopener">{Icon.down}Full draft PDF</a></div></>
  ) });
  P.push({ id: "assignments", tab: "Assignments", w: 640, cls: "scroll-y", node: (
    <><h3>Unit assignments · 100 points each</h3><table className="sched"><thead><tr><th>Unit</th><th>Assignment</th><th>Type</th></tr></thead>
      <tbody>{MODS.map(m => <tr key={m.id}><td>{m.unit}. {m.title}</td><td><button onClick={() => openModule(m.id, "assignment")}>{m.assignment.title}</button></td><td style={{ fontSize: 13.5, color: "var(--muted)" }}>{m.assignment.type}</td></tr>)}</tbody></table></>
  ) });
  C.projects.forEach(p => P.push({ id: "p-" + p.id, tab: "Projects & rubrics", w: 1000, cls: "scroll-y", label: p.title, node: (
    <><div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "baseline" }}><h4 style={{ fontFamily: "var(--f-display)", fontStretch: "112%", fontSize: 22, fontWeight: 800 }}>{p.title}</h4><span className="pts">{p.weight ? `${p.weight}% of grade` : "part of the capstone"}</span></div>
      <p className="big" style={{ maxWidth: "70ch" }}>{p.prompt}</p><p><b>Deliverable: </b>{p.deliverable}</p><Rubric rubric={p.rubric} /></>
  ) }));
  P.push({ id: "howto", tab: "Using this site", w: 540, cls: "scroll-y", node: (<><h3>Each week</h3><ol className="qs" style={{ fontFamily: "var(--f-ui)", fontSize: 15 }}>{C.howToUse.map((h, i) => <li key={i}>{h}</li>)}</ol><h3>Sources and integrity</h3><p style={{ color: "var(--ink-2)" }}>{C.integrity}</p></>) });
  return P;
}
function MediaOverview({ openModule, openInstructor }) {
  const media = useContext(MediaCtx);
  return (
    <>
      <h3>Every era has a podcast episode and a video lecture</h3>
      <table className="sched"><thead><tr><th>Unit</th><th>Podcast</th><th>Lecture</th></tr></thead>
        <tbody>{MODS.map(m => { const its = media.items.filter(i => i.module === m.id); const p = its.filter(i => i.kind === "podcast").length, l = its.filter(i => i.kind === "lecture").length;
          return <tr key={m.id}><td><button onClick={() => openModule(m.id, "media")}>{m.unit}. {m.title}</button></td><td className="tnum">{p ? `${p} posted` : <span style={{ color: "var(--muted)" }}>coming</span>}</td><td className="tnum">{l ? `${l} posted` : <span style={{ color: "var(--muted)" }}>coming</span>}</td></tr>; })}</tbody></table>
            <div><button className="btn" onClick={openInstructor}>{Icon.lock}{media.instructor ? "Instructor account" : "Instructor sign-in"}</button></div>
    </>
  );
}
function InstructorPanel() {
  const media = useContext(MediaCtx);
  return media.instructor ? <UploadForm /> : <><h3>Instructors</h3><p style={{ color: "var(--ink-2)" }}>Signed-in instructors can post recordings for any era here or on each chapter's “Podcast & lecture” panel.</p></>;
}
function mediaSheet(openModule, openInstructor) {
  const P = [{ id: "overview", tab: "All eras", w: 560, cls: "scroll-y", node: <MediaOverview openModule={openModule} openInstructor={openInstructor} /> }];
  MODS.forEach(m => P.push({ id: "m-" + m.id, tab: "By era", w: 460, cls: "scroll-y", label: m.title, node: <ModuleMedia m={m} /> }));
  P.push({ id: "post", tab: "Instructors", w: 520, cls: "scroll-y", node: <InstructorPanel /> });
  return P;
}
/* ---------------- the author's hand-drawn master timeline */
function PhotoStrip() {
  const [zoom, setZoom] = useState(false);
  return (
    <div className={"photo-wrap" + (zoom ? " zoom" : "")}>
      <div className="photo-tools"><span className="eyebrow">The original · scroll sideways to read it · ringed entries on the line come from here</span><button className="btn small" onClick={() => setZoom(z => !z)} aria-pressed={zoom}>{Icon.zoom}{zoom ? "Fit to height" : "Zoom in"}</button></div>
      <img src={MASTER.photo} alt="The author's hand-drawn master timeline on kraft paper, running from 1602 to today, with seeds, crashes, money, history, culture and technology in colored ink" />
    </div>
  );
}
function MasterList({ showItem }) {
  const list = D.items.filter(i => i.master).sort((a, b) => a.year - b.year || LANE_ORDER[a.lane] - LANE_ORDER[b.lane]);
  return (
    <>
      <h3>Where each note landed · {list.length} entries</h3>
      <ul className="evlist">{list.map(it => { const t = TYPE[it.type] || TYPE.policy; return (
        <li key={it.id}>
          <div className="yr tnum"><span className="pill" style={{ background: t.color, marginRight: 8 }}>{t.label}</span>{yrs(it.year, it.endYear)}</div>
          <button className="t" onClick={() => showItem(it.id)} title="Show on the timeline">{it.lane === "notes" ? it.title : itemLabel(it)}</button>
          {it.hand && it.lane !== "notes" && <div className="hand-line hand">{it.hand}</div>}
        </li>); })}</ul>
    </>
  );
}
function ThreadPanel({ t, showItem }) {
  return (
    <div className="thread" style={{ "--tc": t.color, border: 0, padding: 0, background: "transparent" }}>
      <h3>Thread · {t.title}</h3>
      <p className="big">{t.summary}</p>
      <div className="steps">{t.items.map((id, i) => <button key={id} className="stp" onClick={() => showItem(id)}><span className="tnum">{i + 1} · {ITEM[id].year}</span><span>{ITEM[id].title}</span></button>)}</div>
    </div>
  );
}
function masterSheet(showItem, showMasterOnly) {
  const P = [];
  P.push({ id: "about", tab: "The original", w: 560, cls: "scroll-y", node: (
    <>
      <h3>The author's hand-drawn master timeline</h3>
      <p className="big">Before any of this was a website, it was one long sheet of kraft paper. {D.meta.byline} drew the whole story on it by hand: dates along the bottom, the nine seeds where he saw them take root, crashes in red, money in green, history in blue, culture in pink, technology in orange, and arrows between the moments that explain each other.</p>
      <p className="big">Everything on that sheet is on the interactive line. Entries that come from it carry a thin ring, and his words for each appear in the entry's “On the master timeline” note. His bracketed notes have a lane of their own, in his hand.</p>
      <div className="legend-grid">{MASTER.legend.map(l => <span key={l.key}><i style={{ background: l.color }} />{l.label}</span>)}</div>
      <div className="quotes">{MASTER.quotes.map((q, i) => <p key={i} className="hand">{q}</p>)}<div className="eyebrow" style={{ marginTop: 4 }}>Written across the top of the sheet</div></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn primary" onClick={showMasterOnly}>Show only his entries on the line {Icon.right}</button></div>
      <p className="eyebrow">Scroll right for the photograph, then every note and where it landed →</p>
    </>
  ) });
  P.push({ id: "photo", tab: "Photograph", cls: "photo", label: "The photograph", node: <PhotoStrip /> });
  P.push({ id: "landed", tab: "Every note", w: 560, cls: "scroll-y", node: <MasterList showItem={showItem} /> });
  THREADS.forEach(t => P.push({ id: "t-" + t.id, tab: "Threads", w: 500, cls: "scroll-y", label: t.title, node: <ThreadPanel t={t} showItem={showItem} /> }));
  return P;
}

function IndexPanel({ era, showItem }) {
  const [open, setOpen] = useState(null);
  const items = D.items.filter(i => eraOfYear(i.year) === era).sort((a, b) => a.year - b.year || LANE_ORDER[a.lane] - LANE_ORDER[b.lane]);
  return (
    <>
      <h3><span className="sq" style={{ background: eraColor(era) }} />{MOD[era].title} · {MOD[era].years} · {items.length} items</h3>
      <ul className="evlist">{items.map(it => { const t = TYPE[it.type] || TYPE.policy; const lens = it.lens ? D.lens.find(l => l.id === it.lens) : null; return (
        <li key={it.id}>
          <div className="yr tnum"><span className="pill" style={{ background: t.color, marginRight: 8 }}>{t.label}</span>{yrs(it.year, it.endYear)}</div>
          <button className="t" aria-expanded={open === it.id} onClick={() => setOpen(open === it.id ? null : it.id)}>{lens ? (lens.source === "author" ? `${lens.label}: two lives` : `Two lives in ${lens.year}`) : it.title}</button>
          {open === it.id && <div className="d"><p>{lens ? lens.irony : it.detail}</p><button className="btn small" style={{ marginTop: 8 }} onClick={() => showItem(it.id)}>Show on the timeline</button></div>}
        </li>); })}</ul>
    </>
  );
}
function indexSheet(showItem) {
  // the list opens on today's era, like the timeline
  return ERA_IDS.map(id => ({ id, tab: MOD[id].title, w: 500, cls: "scroll-y", node: <IndexPanel era={id} showItem={showItem} /> }));
}

/* ================================================================ APP */
function App() {
  const media = useMediaService();
  const viewportRef = useRef(null), navRef = useRef({ today() {}, beginning() {}, ahead() {} });
  const [geom, setGeom] = useState(null);
  const [layers, setLayers] = useState({ policy: true, markets: true, movements: true, history: true, culture: true, seeds: true, lens: true, notes: true, sp: true, masterOnly: false });
  const [selId, setSelId] = useState(null);
  const [welcome, setWelcome] = useState(true);
  const [sheet, setSheet] = useState(() => { try { const h = location.hash; const m = h.match(/^#module-(\w+)$/); if (m && MOD[m[1]]) return { type: "module", id: m[1], panel: "overview", k: 1 }; const t = h.match(/^#(seeds|course|media|index|master)$/); return t ? { type: t[1], k: 1 } : null; } catch (e) { return null; } });
  const [ins, setIns] = useState(false), [layersOpen, setLayersOpen] = useState(false);

  const pick = useCallback(id => { setSelId(id); if (id) setWelcome(false); }, []);
  const openModule = useCallback((id, panel) => { setSheet({ type: "module", id, panel: panel || "overview", k: Date.now() }); setHash("module-" + id); }, []);
  const openSheet = useCallback((type, panel) => { setSheet({ type, panel, k: Date.now() }); setHash(type); }, []);
  const closeSheet = useCallback(() => { setSheet(null); setHash("timeline"); setTimeout(() => viewportRef.current && viewportRef.current.focus({ preventScroll: true }), 0); }, []);
  const showItem = useCallback(id => {
    const it = D.items.find(i => i.id === id); if (!it) return;
    setLayers(l => ({ ...l, [it.lane]: true, masterOnly: l.masterOnly && !it.master ? false : l.masterOnly })); setSheet(null); setHash("timeline"); pick(id);
  }, [pick]);

  useEffect(() => {
    const k = e => {
      if (sheet || ins || (e.target.closest && e.target.closest("input,textarea,select,[role=slider]"))) return;
      const el = viewportRef.current; if (!el) return;
      if (e.key === "Escape") { pick(null); setLayersOpen(false); }
      const amt = e.shiftKey ? el.clientWidth * .85 : 280;
      if (e.key === "ArrowRight") { e.preventDefault(); el.scrollBy({ left: amt, behavior: smooth }); }
      if (e.key === "ArrowLeft") { e.preventDefault(); el.scrollBy({ left: -amt, behavior: smooth }); }
      if (e.key === "Home") el.scrollTo({ left: 0, behavior: smooth });
      if (e.key === "End") el.scrollTo({ left: el.scrollWidth, behavior: smooth });
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [sheet, ins]);

  let sheetEl = null;
  if (sheet) {
    if (sheet.type === "module") {
      const m = MOD[sheet.id], pv = prevMod(m.id), nx = nextMod(m.id);
      sheetEl = <Sheet key={m.id + sheet.k} band={bandOf(m.id)} eyebrow={`Unit ${m.unit} · ${m.role} · ${m.years}`} title={m.title} onClose={closeSheet} start={sheet.panel}
        panels={moduleSheet(m, { openModule, openSheet, showItem, close: closeSheet })}
        nav={<>{pv && <button className="icon-btn" aria-label={`Previous: ${pv.title}`} title={pv.title} onClick={() => openModule(pv.id, "overview")}>{Icon.left}</button>}{nx && <button className="icon-btn" aria-label={`Next: ${nx.title}`} title={nx.title} onClick={() => openModule(nx.id, "overview")}>{Icon.right}</button>}</>} />;
    } else if (sheet.type === "seeds") sheetEl = <Sheet key={"s" + sheet.k} band="var(--t-seed)" eyebrow="Sowing and reaping" title="The nine seeds" onClose={closeSheet} start={sheet.panel} panels={seedsSheet()} />;
    else if (sheet.type === "course") sheetEl = <Sheet key={"c" + sheet.k} band="var(--accent)" eyebrow="For students and instructors" title="The course" onClose={closeSheet} start={sheet.panel} panels={courseSheet(openModule)} />;
    else if (sheet.type === "media") sheetEl = <Sheet key={"m" + sheet.k} band="var(--t-lens)" eyebrow="Listen and watch" title="Podcasts & lectures" onClose={closeSheet} start={sheet.panel} panels={mediaSheet(openModule, () => setIns(true))} />;
    else if (sheet.type === "master") sheetEl = <Sheet key={"mt" + sheet.k} band="var(--t-note)" eyebrow="In the author's hand" title="The master timeline" onClose={closeSheet} start={sheet.panel} panels={masterSheet(showItem, () => { setLayers(l => ({ ...l, masterOnly: true, notes: true, seeds: true })); closeSheet(); pick(null); navRef.current.today(); })} />;
    else if (sheet.type === "index") sheetEl = <Sheet key={"i" + sheet.k} band="var(--kraft-ink)" eyebrow="The whole line as a list" title="Every event" onClose={closeSheet} start={sheet.panel || "collapse"} panels={indexSheet(showItem)} />;
  }

  return (
    <MediaCtx.Provider value={media}>
      <div className="app">
        <header className="topbar">
          <button className="brand" onClick={() => { setWelcome(true); navRef.current.today(); }}>The Story of Retirement</button>
          <nav className="top-links" aria-label="Views">
            <button onClick={() => navRef.current.today()}><span>Today</span></button>
            <button onClick={() => openSheet("index")}>{Icon.list}<span className="hide-sm">Every event</span></button>
            <button onClick={() => openSheet("seeds")}>{Icon.seed}<span className="hide-sm">Nine seeds</span></button>
            <button onClick={() => openSheet("master")}>{Icon.pen}<span className="hide-sm">Master timeline</span></button>
            <button onClick={() => openSheet("course")}>{Icon.book}<span>Course</span></button>
            <button onClick={() => openSheet("media")}>{Icon.mic}<span className="hide-sm">Podcasts & lectures</span></button>
            <button aria-expanded={layersOpen} onClick={() => setLayersOpen(o => !o)}>{Icon.layers}<span className="hide-sm">Layers</span></button>
            <button onClick={() => setIns(true)} aria-label="Instructor sign-in">{Icon.lock}</button>
          </nav>
          {layersOpen && (
            <div className="layers-pop" role="dialog" aria-label="Timeline layers">
              <div className="eyebrow">Show on the timeline</div>
              {[...LANES, { id: "sp", label: "S&P 500 line", color: "var(--kraft-ink)" }].map(l => (
                <label key={l.id} htmlFor={"layer-" + l.id}><input id={"layer-" + l.id} type="checkbox" checked={!!layers[l.id]} onChange={() => setLayers(s => ({ ...s, [l.id]: !s[l.id] }))} /><span className="sw" style={{ background: l.color }} />{l.label}</label>
              ))}
              {layers.sp && geom && geom.spHidden && <div className="eyebrow" style={{ fontSize: 11, textTransform: "none", letterSpacing: 0 }}>The S&P line is stepping aside because this window is short; make the window taller to see it.</div>}
              <label htmlFor="layer-master" className="master-toggle"><input id="layer-master" type="checkbox" checked={!!layers.masterOnly} onChange={() => setLayers(s => ({ ...s, masterOnly: !s.masterOnly }))} /><span className="ring-demo" aria-hidden="true" /><span>Only what's on the author's master timeline</span></label>
              <button className="btn small" style={{ justifySelf: "end" }} onClick={() => setLayersOpen(false)}>Done</button>
            </div>
          )}
        </header>
        <Stage layers={layers} selId={selId} pick={pick} go={showItem} openModule={openModule} openSheet={openSheet} viewportRef={viewportRef} setGeom={setGeom} navRef={navRef} welcome={welcome} setWelcome={setWelcome} />
        <Minimap viewportRef={viewportRef} geom={geom} />
      </div>
      {sheetEl}
      {ins && <InstructorModal onClose={() => setIns(false)} />}
    </MediaCtx.Provider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
