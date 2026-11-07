// Lokaler Testserver: liefert public/ aus und führt die echte Sync-Funktion
// gegen einen lokalen Netlify-Blobs-Server aus. Start (aus tools/):
//   npm install && npm run dev      → http://localhost:8766
// Testdatum erzwingen: http://localhost:8766/?debugDate=2026-11-12
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { BlobsServer } from "@netlify/blobs/server";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pub = path.join(repo, "public");
const bs = new BlobsServer({ directory: "/tmp/nnn-blobs", port: 9911, token: "tok" });
await bs.start();
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(
  JSON.stringify({ edgeURL: "http://localhost:9911", uncachedEdgeURL: "http://localhost:9911", siteID: "local", token: "tok" })
).toString("base64");
const fn = await import(path.join(repo, "netlify/functions/sync.mjs"));
const types = { ".html": "text/html; charset=utf-8", ".png": "image/png", ".js": "text/javascript", ".json": "application/json" };

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost:8766");
  if (u.pathname === "/.netlify/functions/sync") {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const r = new Request(u, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
    const out = await fn.default(r, {});
    res.writeHead(out.status, Object.fromEntries(out.headers));
    res.end(Buffer.from(await out.arrayBuffer()));
    return;
  }
  const f = path.join(pub, u.pathname === "/" ? "index.html" : u.pathname);
  if (f.startsWith(pub) && fs.existsSync(f) && fs.statSync(f).isFile()) {
    res.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" });
    res.end(fs.readFileSync(f));
  } else {
    res.writeHead(404, { "content-type": "text/html" });
    res.end("not found");
  }
}).listen(8766, () => console.log("Testserver: http://localhost:8766"));
