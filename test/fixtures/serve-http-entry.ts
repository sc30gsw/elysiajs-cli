/**
 * Minimal HTTP server for `elysia serve` integration tests.
 *
 * Elysia's Node adapter does not support `.listen()`; real apps often use Bun for `serve`.
 * This fixture uses `node:http` so the Node watch path can be exercised.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

const port = Number(process.env.PORT ?? "3000");

/**
 * `GET /` → `200` with JSON `{ ok: true }`; any other path → `404` with empty body.
 * @param req - Incoming HTTP request
 * @param res - Server response to write
 */
function handleRequest(req: IncomingMessage, res: ServerResponse): void {
  if (req.url === "/" || req.url === "") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end();
}

createServer(handleRequest).listen(port);
