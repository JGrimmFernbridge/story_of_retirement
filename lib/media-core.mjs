// Podcast & lecture library for The Story of Retirement.
// Everything lives in one Netlify Blobs store: item records under "items/<id>",
// uploaded files split into pieces under "files/<id>/<n>" (Netlify functions accept
// about 4.5 MB of binary per request, so the page uploads in 3 MB pieces).
// Reading is public; writing needs the instructor password (INSTRUCTOR_PASSWORD).

import { createHash, timingSafeEqual, randomUUID } from "node:crypto";

export const MODULES = ["collapse", "conclusion", "codify", "climax", "crucible", "conception", "classical", "catastrophe", "correction"];
export const KINDS = ["podcast", "lecture", "other"];
export const CHUNK_SIZE = 3 * 1024 * 1024;
export const MAX_FILE_BYTES = 750 * 1024 * 1024;
const BASE = "/api/media";

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra } });
const fail = (status, message) => json({ error: message }, status);

function sameSecret(given, expected) {
  if (!given || !expected) return false;
  const a = createHash("sha256").update(String(given)).digest();
  const b = createHash("sha256").update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

function publicItem(it) {
  return {
    id: it.id, module: it.module, kind: it.kind, title: it.title, description: it.description || null,
    external_url: it.external_url || null, file_url: it.file ? `${BASE}/file/${it.id}` : null,
    mime_type: it.file ? it.file.mime : null, size: it.file ? it.file.size : null, created_at: it.created_at,
  };
}

function cleanText(v, max) {
  if (v === undefined || v === null) return "";
  return String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

function validateMeta(body) {
  const module = cleanText(body.module, 40), kind = cleanText(body.kind, 20), title = cleanText(body.title, 200), description = cleanText(body.description, 2000);
  if (!MODULES.includes(module)) return { error: "Choose which unit this recording belongs to." };
  if (!KINDS.includes(kind)) return { error: "Choose podcast, lecture or other." };
  if (!title) return { error: "Give the recording a title." };
  return { module, kind, title, description };
}

export function makeHandler({ getStore, getEnv }) {
  const store = () => getStore({ name: "course-media", consistency: "strong" });

  async function readItem(s, id) {
    if (!/^[a-f0-9-]{36}$/.test(id)) return null;
    return s.get(`items/${id}`, { type: "json" });
  }
  async function listItems(s) {
    const { blobs } = await s.list({ prefix: "items/" });
    const all = await Promise.all(blobs.map(b => s.get(b.key, { type: "json" })));
    return all.filter(Boolean);
  }
  async function deleteFiles(s, id) {
    const { blobs } = await s.list({ prefix: `files/${id}/` });
    await Promise.all(blobs.map(b => s.delete(b.key)));
  }

  return async function handler(req) {
    const url = new URL(req.url);
    const parts = url.pathname.replace(/\/+$/, "").split("/").slice(3); // after /api/media
    const method = req.method.toUpperCase();
    const s = store();
    const authed = () => sameSecret(req.headers.get("x-instructor-key"), getEnv("INSTRUCTOR_PASSWORD"));

    try {
      // ---- public reads
      if (method === "GET" && parts.length === 0) {
        const items = (await listItems(s)).filter(i => i.status === "ready")
          .sort((a, b) => MODULES.indexOf(a.module) - MODULES.indexOf(b.module) || a.created_at.localeCompare(b.created_at));
        return json({ items: items.map(publicItem), chunkSize: CHUNK_SIZE, maxBytes: MAX_FILE_BYTES });
      }
      if ((method === "GET" || method === "HEAD") && parts[0] === "file" && parts[1]) {
        const it = await readItem(s, parts[1]);
        if (!it || it.status !== "ready" || !it.file) return fail(404, "Recording not found.");
        const { size, mime, chunkSize, chunks } = it.file;
        const common = { "content-type": mime || "application/octet-stream", "accept-ranges": "bytes", "cache-control": "public, max-age=86400" };
        if (method === "HEAD") return new Response(null, { status: 200, headers: { ...common, "content-length": String(size) } });
        // Each response carries at most one stored piece; media players ask for the next range themselves.
        const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") || "bytes=0-");
        let start = m && m[1] !== "" ? parseInt(m[1], 10) : 0;
        let end = m && m[2] !== "" ? parseInt(m[2], 10) : size - 1;
        if (m && m[1] === "" && m[2] !== "") { start = Math.max(0, size - parseInt(m[2], 10)); end = size - 1; }
        if (!(start >= 0 && start < size) || end < start) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
        const n = Math.floor(start / chunkSize);
        if (n >= chunks) return new Response(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
        end = Math.min(end, size - 1, (n + 1) * chunkSize - 1);
        const piece = await s.get(`files/${it.id}/${n}`, { type: "arrayBuffer" });
        if (!piece) return fail(404, "Part of this recording is missing.");
        const offset = start - n * chunkSize;
        const body = new Uint8Array(piece).subarray(offset, offset + (end - start + 1));
        return new Response(body, { status: 206, headers: { ...common, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(body.byteLength) } });
      }

      // ---- everything below needs the instructor password
      if (method === "POST" && parts[0] === "auth") {
        if (authed()) return json({ ok: true });
        await new Promise(r => setTimeout(r, 700)); // slow down guessing
        return fail(401, "That password isn't right.");
      }
      if (!getEnv("INSTRUCTOR_PASSWORD")) return fail(503, "Uploads are switched off until an instructor password is set in Netlify.");
      if (!authed()) { await new Promise(r => setTimeout(r, 400)); return fail(401, "Sign in as an instructor first."); }

      // add a link (YouTube, Vimeo, podcast page)
      if (method === "POST" && parts.length === 0) {
        const body = await req.json().catch(() => ({}));
        const meta = validateMeta(body); if (meta.error) return fail(400, meta.error);
        const link = cleanText(body.url, 1000);
        if (!/^https:\/\/[^\s]+$/i.test(link)) return fail(400, "Paste a full link starting with https://");
        const it = { id: randomUUID(), ...meta, external_url: link, status: "ready", created_at: new Date().toISOString() };
        await s.setJSON(`items/${it.id}`, it);
        return json({ item: publicItem(it) }, 201);
      }
      // start an upload
      if (method === "POST" && parts[0] === "upload" && parts.length === 1) {
        const body = await req.json().catch(() => ({}));
        const meta = validateMeta(body); if (meta.error) return fail(400, meta.error);
        const size = Number(body.size), mime = cleanText(body.mime, 100).toLowerCase();
        if (!Number.isInteger(size) || size <= 0) return fail(400, "That file looks empty.");
        if (size > MAX_FILE_BYTES) return fail(413, `Files can be up to ${Math.round(MAX_FILE_BYTES / 1048576)} MB. Post longer videos to YouTube or Vimeo and paste the link instead.`);
        if (!/^(audio|video)\/[a-z0-9.+-]+$/.test(mime)) return fail(415, "Upload an audio or video file.");
        const it = { id: randomUUID(), ...meta, status: "uploading", created_at: new Date().toISOString(),
          file: { name: cleanText(body.filename, 200), mime, size, chunkSize: CHUNK_SIZE, chunks: Math.ceil(size / CHUNK_SIZE) } };
        await s.setJSON(`items/${it.id}`, it);
        return json({ id: it.id, chunkSize: CHUNK_SIZE, chunks: it.file.chunks }, 201);
      }
      // upload one piece
      if (method === "PUT" && parts[0] === "upload" && parts.length === 3) {
        const it = await readItem(s, parts[1]);
        if (!it || it.status !== "uploading") return fail(404, "That upload has expired. Start it again.");
        const n = Number(parts[2]);
        if (!Number.isInteger(n) || n < 0 || n >= it.file.chunks) return fail(400, "Unexpected piece number.");
        const buf = await req.arrayBuffer();
        const expected = n === it.file.chunks - 1 ? it.file.size - n * it.file.chunkSize : it.file.chunkSize;
        if (buf.byteLength !== expected) return fail(400, `Piece ${n + 1} arrived incomplete. Try the upload again.`);
        await s.set(`files/${it.id}/${n}`, buf);
        return json({ ok: true, piece: n });
      }
      // finish an upload
      if (method === "POST" && parts[0] === "upload" && parts.length === 3 && parts[2] === "finish") {
        const it = await readItem(s, parts[1]);
        if (!it || it.status !== "uploading") return fail(404, "That upload has expired. Start it again.");
        const { blobs } = await s.list({ prefix: `files/${it.id}/` });
        if (blobs.length !== it.file.chunks) return fail(409, `Only ${blobs.length} of ${it.file.chunks} pieces arrived. Try the upload again.`);
        it.status = "ready";
        await s.setJSON(`items/${it.id}`, it);
        return json({ item: publicItem(it) });
      }
      // remove a recording (or abandon an unfinished upload)
      if (method === "DELETE" && parts.length === 1) {
        const it = await readItem(s, parts[0]);
        if (!it) return fail(404, "Recording not found.");
        await deleteFiles(s, it.id);
        await s.delete(`items/${it.id}`);
        return json({ ok: true });
      }
      return fail(404, "Not found.");
    } catch (e) {
      console.error("media api error", e);
      return fail(500, "The media library had a problem. Try again in a moment.");
    }
  };
}
