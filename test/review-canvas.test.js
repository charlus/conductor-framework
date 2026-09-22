// The review canvas (F4, slice 1).
//
// Conductor's human is a PO, and on Claude Code there is no file browser: the
// terminal is the only surface. `conductor view` fixed the READ half — every
// document rendered into one page. This is the missing return path: the human
// reads a plan in a browser, says approve or request changes, and the verdict
// comes back to a blocked CLI call the agent is waiting on.
//
// Slice 1 is verdict + comments. Element-anchored annotations ("move THIS")
// are slice 2 — the shape of the feedback record already has room for them.
//
// These cover the pure half plus the server contract. The browser half is not
// covered here; a human clicking a button is not something node --test proves.

import { test, describe } from "node:test";
import { request as httpRequest } from "node:http";
import assert from "node:assert/strict";

import {
  renderReviewPage,
  normalizeFeedback,
  isLoopbackRequest,
  summariseFeedback,
} from "../src/review/canvas.js";
import { createReviewServer } from "../src/review/server.js";

const MD = "# Plan\n\n## Phase 1\n\nDo the thing.\n\n## Phase 2\n\nDo the other thing.\n";

describe("F4 — the review page", () => {
  test("renders the artifact's markdown, not a link to it", () => {
    const html = renderReviewPage({ markdown: MD, title: "Plan", artifactPath: "/p/plan.md" });
    assert.match(html, /<h1[^>]*>Plan<\/h1>/);
    assert.match(html, /Do the thing\./);
  });

  test("offers exactly two verdicts", () => {
    const html = renderReviewPage({ markdown: MD, title: "Plan", artifactPath: "/p/plan.md" });
    assert.match(html, /data-verdict="approve"/);
    assert.match(html, /data-verdict="request-changes"/);
    // A third option is a decision the human has not been asked to make.
    assert.equal((html.match(/data-verdict="/g) || []).length, 2);
  });

  test("is self-contained — no external script or style", () => {
    // The page is served on loopback to a human who may be offline, and a CDN
    // script would also be an unreviewed dependency in a review tool.
    const html = renderReviewPage({ markdown: MD, title: "Plan", artifactPath: "/p/plan.md" });
    assert.ok(!/<script[^>]+src=/.test(html), "no external <script src>");
    assert.ok(!/<link[^>]+stylesheet/.test(html), "no external stylesheet");
  });

  test("escapes the artifact path rather than interpolating it raw", () => {
    const html = renderReviewPage({
      markdown: "# x\n",
      title: 'a"><script>alert(1)</script>',
      artifactPath: '/p/<img src=x onerror=1>.md',
    });
    assert.ok(!html.includes("<script>alert(1)</script>"), "title was injected raw");
    assert.ok(!html.includes("<img src=x onerror=1>"), "path was injected raw");
  });
});

describe("F4 — feedback records", () => {
  test("a verdict is normalised and stamped", () => {
    const f = normalizeFeedback({ kind: "verdict", verdict: "approve" });
    assert.equal(f.kind, "verdict");
    assert.equal(f.verdict, "approve");
    assert.match(f.at, /^\d{4}-\d{2}-\d{2}T/);
  });

  test("an unknown verdict is rejected, not coerced", () => {
    // Coercing an unrecognised verdict to "approve" would be the worst
    // possible default: it ships work the human did not sign off.
    assert.equal(normalizeFeedback({ kind: "verdict", verdict: "lgtm" }), null);
    assert.equal(normalizeFeedback({ kind: "verdict" }), null);
  });

  test("a comment keeps the human's text verbatim", () => {
    const f = normalizeFeedback({ kind: "comment", text: "  Split phase 2.  " });
    assert.equal(f.kind, "comment");
    assert.equal(f.text, "Split phase 2.");
  });

  test("an empty comment is not a record", () => {
    assert.equal(normalizeFeedback({ kind: "comment", text: "   " }), null);
  });

  test("an unknown kind is rejected", () => {
    assert.equal(normalizeFeedback({ kind: "annotation", text: "later" }), null);
    assert.equal(normalizeFeedback(null), null);
    assert.equal(normalizeFeedback("approve"), null);
  });

  test("the summary tells the agent what to do next", () => {
    const approved = summariseFeedback([
      { kind: "comment", text: "nice" },
      { kind: "verdict", verdict: "approve" },
    ]);
    assert.equal(approved.status, "approved");
    assert.equal(approved.done, true);

    const changes = summariseFeedback([{ kind: "verdict", verdict: "request-changes" }]);
    assert.equal(changes.status, "changes-requested");
    assert.equal(changes.done, true);

    const open = summariseFeedback([{ kind: "comment", text: "why phase 2?" }]);
    assert.equal(open.status, "open");
    assert.equal(open.done, false, "a comment is not a verdict — keep listening");
  });

  test("the last verdict wins", () => {
    const s = summariseFeedback([
      { kind: "verdict", verdict: "request-changes" },
      { kind: "comment", text: "actually, fine" },
      { kind: "verdict", verdict: "approve" },
    ]);
    assert.equal(s.status, "approved");
  });
});

describe("F4 — the server only answers the local browser", () => {
  // A page on 127.0.0.1 is reachable by any site the human has open, via
  // DNS rebinding, unless Host is checked. This server can approve work.
  const ok = (host) => isLoopbackRequest({ headers: { host } });

  test("accepts loopback hosts", () => {
    assert.equal(ok("127.0.0.1:8321"), true);
    assert.equal(ok("localhost:8321"), true);
    assert.equal(ok("[::1]:8321"), true);
  });

  test("rejects a rebound hostname", () => {
    assert.equal(ok("evil.example.com:8321"), false);
    assert.equal(ok("127.0.0.1.evil.com:8321"), false);
    assert.equal(ok(undefined), false);
  });

  test("rejects a cross-origin request even from loopback", () => {
    assert.equal(
      isLoopbackRequest({ headers: { host: "127.0.0.1:8321", origin: "https://evil.example.com" } }),
      false,
    );
    assert.equal(
      isLoopbackRequest({ headers: { host: "127.0.0.1:8321", origin: "http://127.0.0.1:8321" } }),
      true,
    );
  });
});

describe("F4 — the server resolves when the human decides", () => {
  test("a verdict POST ends the wait and returns the whole thread", async () => {
    const server = await createReviewServer({
      markdown: MD,
      title: "Plan",
      artifactPath: "/p/plan.md",
    });
    try {
      const settled = server.waitForVerdict();

      // A comment alone must NOT end the wait.
      await post(server.url, { kind: "comment", text: "why two phases?" });
      const early = await Promise.race([settled, delay(60).then(() => "still-waiting")]);
      assert.equal(early, "still-waiting", "a comment ended the wait");

      await post(server.url, { kind: "verdict", verdict: "request-changes" });
      const result = await settled;
      assert.equal(result.status, "changes-requested");
      assert.equal(result.feedback.length, 2);
      assert.equal(result.feedback[0].text, "why two phases?");
    } finally {
      await server.close();
    }
  });

  test("the page is served, and a bad Host is refused", async () => {
    const server = await createReviewServer({
      markdown: MD,
      title: "Plan",
      artifactPath: "/p/plan.md",
    });
    try {
      const good = await fetch(server.url);
      assert.equal(good.status, 200);
      assert.match(await good.text(), /Do the thing\./);

      // fetch() silently DROPS a Host header — it is a forbidden header name
      // in undici — so testing the rebinding guard through fetch tests
      // nothing at all. It has to go over a raw client.
      const bad = await rawGet(server.port, "evil.example.com");
      assert.equal(bad, 403);
      const good2 = await rawGet(server.port, "127.0.0.1");
      assert.equal(good2, 200, "the guard must still let the real browser in");
    } finally {
      await server.close();
    }
  });

  test("a malformed body is refused without taking the server down", async () => {
    const server = await createReviewServer({
      markdown: MD,
      title: "Plan",
      artifactPath: "/p/plan.md",
    });
    try {
      const res = await fetch(`${server.url}api/feedback`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{not json",
      });
      assert.equal(res.status, 400);
      assert.equal((await fetch(server.url)).status, 200, "server survived");
    } finally {
      await server.close();
    }
  });
});

/** GET / with an arbitrary Host header. Returns the status code. */
function rawGet(port, host) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port, path: "/", method: "GET", headers: { host } },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function post(baseUrl, body) {
  const res = await fetch(`${baseUrl}api/feedback`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}
