/**
 * Minimal HTTP server for `elysia serve` integration tests.
 * (Elysia's Node adapter does not support `.listen()`; real Elysia apps often use Bun for `serve`.)
 */
import { createServer } from "node:http";

const port = Number(process.env.PORT ?? "3000");

createServer((req, res) => {
  if (req.url === "/" || req.url === "") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(port);
