// Minimal static server for the ticketing UI (no dependencies).
// Serves ./frontend, ethers from node_modules, and proxies /rpc to the Hardhat node
// so the browser talks to the chain from the same origin (no CORS issues).
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, "frontend");
const PORT = Number(process.env.PORT ?? 5180);
const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8545";

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const routes = {
  "/vendor/ethers.js": path.join(root, "node_modules/ethers/dist/ethers.umd.min.js"),
};

async function proxyRpc(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try {
    const upstream = await fetch(RPC_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: Buffer.concat(chunks),
    });
    res.writeHead(upstream.status, { "content-type": "application/json" });
    res.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32000, message: "Hardhat node unreachable" } }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/rpc" && req.method === "POST") return proxyRpc(req, res);

  let file = routes[url.pathname];
  if (!file) {
    const rel = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).slice(1);
    file = path.join(publicDir, rel);
    if (!file.startsWith(publicDir + path.sep)) {
      res.writeHead(403).end();
      return;
    }
  }

  try {
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": types[path.extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain" }).end("Not found");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`UI running at http://localhost:${PORT} (RPC -> ${RPC_URL})`);
});
