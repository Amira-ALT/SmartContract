// Waits until the JSON-RPC node answers (used by run.bat). Usage: node scripts/wait-rpc.mjs [url] [timeoutSec]
const url = process.argv[2] ?? "http://127.0.0.1:8545";
const deadline = Date.now() + Number(process.argv[3] ?? 90) * 1000;

while (Date.now() < deadline) {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_chainId", params: [] }),
    });
    if (res.ok) process.exit(0);
  } catch {}
  await new Promise((r) => setTimeout(r, 1000));
}
console.error(`Timed out waiting for ${url}`);
process.exit(1);
