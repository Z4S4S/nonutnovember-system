// Sync-Funktion für den No-Nut-November-Tracker.
// Speichert den gemeinsamen Stand pro Challenge in Netlify Blobs (im eigenen Netlify-Konto).
import { getStore } from "@netlify/blobs";

const P = ["p1", "p2"];
const ID_RE = /^[A-Za-z0-9_-]{8,48}$/;
const MAX = 400000;

// Daily Quests: { kürzel: Anzahl }, z. B. { pu: 30, rd: 10 }. Schlüssel sortiert, max. 8, Werte 0–1000.
function normQ(q) {
  const o = {};
  if (!q || typeof q !== "object") return o;
  for (const k of Object.keys(q).filter((k) => /^[a-z]{1,8}$/.test(k)).sort().slice(0, 8)) {
    const v = Math.round(+q[k]);
    o[k] = Number.isFinite(v) ? Math.max(0, Math.min(1000, v)) : 0;
  }
  return o;
}

function norm(s) {
  s = s && typeof s === "object" ? s : {};
  const o = { v: 1, year: Number.isInteger(s.year) ? s.year : new Date().getFullYear(), names: {}, days: {} };
  const c = s.cfg && typeof s.cfg === "object" ? s.cfg : {};
  const num = (v, d) => (Number.isFinite(+v) && v !== "" && v != null ? Math.max(0, Math.min(10000, Math.round(+v))) : d);
  o.cfg = { base: num(c.base, 50), per: num(c.per, 50), t: +c.t || 0 };
  o.pact = {};
  for (const p of P) { const x = s.pact && s.pact[p]; o.pact[p] = { t: (x && +x.t) || 0 }; }
  for (const p of P) {
    const x = s.names && s.names[p];
    o.names[p] = x && typeof x === "object" ? { v: String(x.v || "").slice(0, 40), t: +x.t || 0 } : { v: "", t: 0 };
  }
  if (s.days && typeof s.days === "object") {
    for (const k in s.days) {
      const d = +k;
      if (!(d >= 1 && d <= 30)) continue;
      const src = s.days[k] || {};
      const e = {};
      for (const p of P) {
        const x = src[p];
        if (x && typeof x === "object") {
          const st = x.s === "clean" || x.s === "relapse" ? x.s : null;
          e[p] = {
            s: st,
            st: +x.st || 0,
            n: typeof x.n === "string" ? x.n.slice(0, 5000) : "",
            nt: +x.nt || 0,
            ri: +x.ri || 0,
            rw: +x.rw || 0,
            rc: st === "relapse" ? Math.max(1, Math.min(99, Math.round(+x.rc || 1))) : 0,
            q: normQ(x.q),
            qt: +x.qt || 0,
          };
        }
      }
      o.days[d] = e;
    }
  }
  return o;
}

function merge(a, b) {
  a = norm(a);
  b = norm(b);
  const o = norm(a);
  for (const p of P) if (b.names[p].t > a.names[p].t) o.names[p] = b.names[p];
  if (b.cfg.t > a.cfg.t) o.cfg = b.cfg;
  for (const p of P) o.pact[p] = { t: Math.max(a.pact[p].t, b.pact[p].t) };
  const keys = new Set([...Object.keys(a.days), ...Object.keys(b.days)]);
  for (const k of keys) {
    o.days[k] = {};
    for (const p of P) {
      const ea = a.days[k] && a.days[k][p], eb = b.days[k] && b.days[k][p];
      if (!ea && !eb) continue;
      const E = { s: null, st: 0, n: "", nt: 0, ri: 0, rw: 0, rc: 0, q: {}, qt: 0 }, A = ea || E, B = eb || E;
      const S = B.st > A.st ? B : A, N = B.nt > A.nt ? B : A, Q = B.qt > A.qt ? B : A;
      o.days[k][p] = { s: S.s, st: S.st, n: N.n, nt: N.nt, ri: Math.max(A.ri || 0, B.ri || 0), rw: Math.max(A.rw || 0, B.rw || 0), rc: S.s === "relapse" ? Math.max(1, S.rc || 1) : 0, q: Q.q, qt: Q.qt };
    }
  }
  return o;
}

const json = (data, status = 200) =>
  new Response(typeof data === "string" ? data : JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

async function readBody(req) {
  const t = await req.text();
  if (t.length > MAX) throw new Error("too_large");
  return JSON.parse(t);
}

export default async (req) => {
  try {
    return await handle(req, getStore({ name: "nnn-tracker", consistency: "strong" }));
  } catch (e) {
    // Falls "strong consistency" in dieser Umgebung nicht verfügbar ist: normal weiterarbeiten.
    if (/uncachedEdgeURL|consistency/i.test(String(e && e.message))) {
      try { return await handle(req, getStore({ name: "nnn-tracker" })); } catch (e2) { e = e2; }
    }
    return json({ error: String((e && e.message) || e) }, 500);
  }
};

async function handle(req, store) {
  const url = new URL(req.url);
  {
    if (req.method === "GET" && url.searchParams.get("ping") !== null) return json({ ok: true });

    if (req.method === "POST") {
      const data = norm(await readBody(req));
      const id = crypto.randomUUID().replace(/-/g, "").slice(0, 20);
      await store.set(id, JSON.stringify(data));
      return json({ id, data });
    }

    const id = url.searchParams.get("id") || "";
    if (!ID_RE.test(id)) return json({ error: "bad_id" }, 400);

    if (req.method === "GET") {
      const v = await store.get(id, { type: "text" });
      if (v === null) return json({ error: "not_found" }, 404);
      return json(v);
    }

    if (req.method === "PUT") {
      const incoming = await readBody(req);
      for (let i = 0; i < 5; i++) {
        const cur = await store.getWithMetadata(id, { type: "text" });
        if (cur === null) return json({ error: "not_found" }, 404);
        const merged = merge(JSON.parse(cur.data), incoming);
        const res = await store.set(id, JSON.stringify(merged), cur.etag ? { onlyIfMatch: cur.etag } : undefined);
        if (!res || res.modified !== false) return json(merged);
      }
      return json({ error: "conflict" }, 409);
    }

    return json({ error: "method" }, 405);
  }
}
