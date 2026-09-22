// src/review/server.js
//
// The loopback server behind `conductor review` (F4, slice 1).
//
// The agent blocks on one call; the human opens a page, reads, and decides;
// the call returns their verdict as JSON. That is the whole contract.
//
// Deliberately NOT a detached daemon. ECC runs a shared background server on a
// fixed port keyed by artifact path, which buys "feedback survives an
// interrupted await" at the cost of a port registry, a queue and a lifecycle
// nobody owns. Slice 1 keeps the server inside the waiting process: one
// artifact, one wait, ephemeral port. The agent runs it as a background Bash
// call and reads the JSON when it exits.
//
// The cost of that choice, stated plainly: if the waiting process dies, queued
// feedback dies with it and the human's click is lost. That is the first thing
// slice 2 should fix, and it is why the human is told the page is live only
// while the command runs.

import { createServer } from "node:http";
import { isLoopbackRequest, normalizeFeedback, summariseFeedback, renderReviewPage } from "./canvas.js";

const MAX_BODY_BYTES = 64 * 1024;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      // A review page has no reason to receive a large body, and an unbounded
      // read is a way to take the process down from a page the human has open.
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function send(res, status, type, body) {
  res.writeHead(status, {
    "content-type": type,
    // This page can approve work; nothing should frame it or sniff it.
    "x-content-type-options": "nosniff",
    "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'none'",
    "cache-control": "no-store",
  });
  res.end(body);
}

/**
 * Start a review server for one artifact.
 *
 * @returns {Promise<{url:string, port:number, feedback:Array, waitForVerdict:()=>Promise<object>, close:()=>Promise<void>}>}
 */
export async function createReviewServer({ markdown, title, artifactPath, host = "127.0.0.1", port = 0 }) {
  const page = renderReviewPage({ markdown, title, artifactPath });
  const feedback = [];
  let resolveVerdict;
  const verdictReached = new Promise((resolve) => {
    resolveVerdict = resolve;
  });

  const server = createServer(async (req, res) => {
    // Every route, including the page: a rebound origin must not even read it.
    if (!isLoopbackRequest(req)) {
      send(res, 403, "text/plain; charset=utf-8", "forbidden");
      return;
    }

    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      send(res, 200, "text/html; charset=utf-8", page);
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      send(res, 200, "application/json", JSON.stringify(summariseFeedback(feedback)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/feedback") {
      let record;
      try {
        record = normalizeFeedback(JSON.parse(await readBody(req)));
      } catch {
        send(res, 400, "application/json", JSON.stringify({ error: "unreadable body" }));
        return;
      }
      if (!record) {
        // An unrecognised verdict is refused rather than coerced — see canvas.js.
        send(res, 400, "application/json", JSON.stringify({ error: "not a feedback record" }));
        return;
      }
      feedback.push(record);
      const summary = summariseFeedback(feedback);
      send(res, 200, "application/json", JSON.stringify(summary));
      // A comment is not a decision: only a verdict ends the agent's wait.
      if (summary.done) resolveVerdict(summary);
      return;
    }

    send(res, 404, "text/plain; charset=utf-8", "not found");
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });

  const actual = server.address();
  return {
    url: `http://${host}:${actual.port}/`,
    port: actual.port,
    feedback,
    waitForVerdict: () => verdictReached,
    close: () =>
      new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(() => resolve());
      }),
  };
}
