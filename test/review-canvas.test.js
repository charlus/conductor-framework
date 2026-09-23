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

import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  renderReviewPage,
  normalizeFeedback,
  isLoopbackRequest,
  summariseFeedback,
} from "../src/review/canvas.js";
import { loadPending, appendPending, clearPending, pendingPathFor } from "../src/review/store.js";
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

  test("the document is pointable, not just readable", () => {
    const html = renderReviewPage({ markdown: MD, title: "Plan", artifactPath: "/p/plan.md" });
    // The affordance that makes this a canvas rather than a comment box.
    assert.match(html, /data-anchorable/);
    assert.match(html, /kind: "annotation"/);
    // Anchoring an inline element yields a selector the agent cannot act on.
    assert.match(html, /h1,h2,h3,h4,h5,h6,p,li,pre,blockquote,tr/);
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
    assert.equal(normalizeFeedback({ kind: "nonsense", text: "later" }), null);
    assert.equal(normalizeFeedback(null), null);
    assert.equal(normalizeFeedback("approve"), null);
  });

  test("an annotation carries what the human pointed at", () => {
    // The whole reason for a canvas rather than a chat box: "move THIS" is
    // pointed at, not described. Without the anchor it is just a comment.
    const f = normalizeFeedback({
      kind: "annotation",
      text: "Split this into two phases",
      anchor: { selector: "h2:nth-of-type(3)", tag: "h2", snippet: "Phase 2: Migration" },
    });
    assert.equal(f.kind, "annotation");
    assert.equal(f.text, "Split this into two phases");
    assert.equal(f.anchor.snippet, "Phase 2: Migration");
    assert.equal(f.anchor.tag, "h2");
  });

  test("an annotation with no anchor degrades to a comment, not to nothing", () => {
    const f = normalizeFeedback({ kind: "annotation", text: "generally unclear" });
    assert.equal(f.kind, "comment", "losing the text because the anchor failed is worse");
    assert.equal(f.text, "generally unclear");
  });

  test("an annotation's anchor fields are bounded and stringified", () => {
    // The anchor comes from a browser and is written into conductor/. A
    // 2MB snippet or a nested object would land in the knowledge base.
    const f = normalizeFeedback({
      kind: "annotation",
      text: "x",
      anchor: { selector: "p", tag: "p", snippet: "y".repeat(5000), extra: { evil: true } },
    });
    assert.ok(f.anchor.snippet.length <= 400);
    assert.equal(f.anchor.extra, undefined, "unknown anchor fields are dropped");
  });

  test("an annotation is not a verdict", () => {
    const s = summariseFeedback([
      { kind: "annotation", text: "move this", anchor: { snippet: "Phase 2" } },
    ]);
    assert.equal(s.done, false);
  });
});

describe("F4 — feedback survives an interrupted wait", () => {
  // Slice 1's stated cost: the server lived inside the waiting process, so if
  // that process died the human's click died with it — and from their side,
  // clicking simply appeared to do nothing.
  let home;

  test("pending feedback round-trips through the store", async () => {
    home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    const artifact = "/p/plan.md";
    assert.deepEqual(await loadPending(artifact, home), []);

    await appendPending(artifact, { kind: "comment", text: "first", at: "t1" }, home);
    await appendPending(artifact, { kind: "comment", text: "second", at: "t2" }, home);

    const back = await loadPending(artifact, home);
    assert.equal(back.length, 2);
    assert.equal(back[0].text, "first");
    assert.equal(back[1].text, "second");
    await rm(home, { recursive: true, force: true });
  });

  test("each artifact has its own queue", async () => {
    home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    await appendPending("/p/a.md", { kind: "comment", text: "for a", at: "t" }, home);
    await appendPending("/p/b.md", { kind: "comment", text: "for b", at: "t" }, home);
    assert.equal((await loadPending("/p/a.md", home))[0].text, "for a");
    assert.equal((await loadPending("/p/b.md", home))[0].text, "for b");
    assert.notEqual(pendingPathFor("/p/a.md", home), pendingPathFor("/p/b.md", home));
    await rm(home, { recursive: true, force: true });
  });

  test("a resolved review clears its queue", async () => {
    home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    await appendPending("/p/a.md", { kind: "comment", text: "x", at: "t" }, home);
    await clearPending("/p/a.md", home);
    assert.deepEqual(await loadPending("/p/a.md", home), []);
    await rm(home, { recursive: true, force: true });
  });

  test("a corrupt queue file reads as empty, it does not throw", async () => {
    // The store sits in front of a blocking CLI call. A half-written line
    // must not be the thing that stops the human being able to approve.
    home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    await appendPending("/p/a.md", { kind: "comment", text: "good", at: "t" }, home);
    const { writeFile } = await import("node:fs/promises");
    await writeFile(pendingPathFor("/p/a.md", home), '{"kind":"comment"\nnot json\n', "utf8");
    assert.deepEqual(await loadPending("/p/a.md", home), []);
    await rm(home, { recursive: true, force: true });
  });

  test("an unwritable store does not take the review down", async () => {
    // Persistence is a safety net, not the mechanism. Losing it costs the
    // queue; throwing here would cost the review.
    await appendPending("/p/a.md", { kind: "comment", text: "x", at: "t" }, "/dev/null/nope");
    assert.deepEqual(await loadPending("/p/a.md", "/dev/null/nope"), []);
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

  test("rejects a DIFFERENT loopback port — the review blocker", () => {
    // Independent review, blocker B4: any page served from another localhost
    // port (a dev server, anything) could POST {verdict:"approve"} and end
    // the agent's wait with an approval nobody gave. Loopback is not the
    // boundary; the ORIGIN of this page is.
    const ok = (origin) =>
      isLoopbackRequest({ headers: { host: "127.0.0.1:44761", origin } });
    assert.equal(ok("http://localhost:3000"), false, "another localhost port");
    assert.equal(ok("http://127.0.0.1:3000"), false, "same IP, another port");
    assert.equal(ok("http://localhost:44761"), false, "a different host spelling is a different origin");
    assert.equal(ok("http://127.0.0.1:44761"), true, "this page itself");
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

  test("a wait that died replays what the human already said", async () => {
    const home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    const artifact = "/p/replay.md";
    try {
      // First wait: the human comments, then the process dies.
      const first = await createReviewServer({ markdown: MD, title: "P", artifactPath: artifact, home });
      await post(first.url, { kind: "comment", text: "why two phases?" });
      await first.close();

      // Second wait: their words are still there.
      const second = await createReviewServer({ markdown: MD, title: "P", artifactPath: artifact, home });
      try {
        assert.equal(second.feedback.length, 1);
        assert.equal(second.feedback[0].text, "why two phases?");
      } finally {
        await second.close();
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  test("a verdict given to a dead wait is honoured, not asked for twice", async () => {
    const home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    const artifact = "/p/verdict.md";
    try {
      const first = await createReviewServer({ markdown: MD, title: "P", artifactPath: artifact, home });
      await post(first.url, { kind: "verdict", verdict: "approve" });
      await first.close();

      const second = await createReviewServer({ markdown: MD, title: "P", artifactPath: artifact, home });
      try {
        // Must already be settled — the human decided, the agent just missed it.
        const result = await Promise.race([
          second.waitForVerdict(),
          delay(150).then(() => "never-settled"),
        ]);
        assert.notEqual(result, "never-settled");
        assert.equal(result.status, "approved");
      } finally {
        await second.close();
      }

      // And the queue is spent, so a third run starts clean.
      const third = await createReviewServer({ markdown: MD, title: "P", artifactPath: artifact, home });
      try {
        assert.deepEqual(third.feedback, []);
      } finally {
        await third.close();
      }
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  });

  test("the reviewer's exact attack is refused end to end", async () => {
    // Reproduces B4 against a live server: a cross-origin text/plain POST —
    // a "simple request", so no CORS preflight ever fires — carrying an
    // approval. It must not end the wait.
    const home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    const server = await createReviewServer({ markdown: MD, title: "P", artifactPath: "/p/atk.md", home });
    try {
      const status = await rawPost(server.port, {
        host: `127.0.0.1:${server.port}`,
        origin: "http://localhost:3000",
        "content-type": "text/plain",
      }, JSON.stringify({ kind: "verdict", verdict: "approve" }));
      assert.equal(status, 403);
      const settled = await Promise.race([server.waitForVerdict(), delay(80).then(() => "waiting")]);
      assert.equal(settled, "waiting", "a forged approval ended the wait");
    } finally {
      await server.close();
      await rm(home, { recursive: true, force: true });
    }
  });

  test("a POST that is not application/json is refused, even same-origin", async () => {
    // Defence in depth: a cross-site page can only send JSON after a CORS
    // preflight, which this server never grants. Requiring JSON means a
    // no-preflight simple request cannot reach the handler at all.
    const home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    const server = await createReviewServer({ markdown: MD, title: "P", artifactPath: "/p/ct.md", home });
    try {
      const status = await rawPost(server.port, {
        host: `127.0.0.1:${server.port}`,
        "content-type": "text/plain",
      }, JSON.stringify({ kind: "verdict", verdict: "approve" }));
      assert.equal(status, 415);
    } finally {
      await server.close();
      await rm(home, { recursive: true, force: true });
    }
  });

  test("a verdict for an OLDER version of the document is not replayed", async () => {
    // Review IMPORTANT: the queue was keyed by path, so an approval given to
    // v1 was honoured after the agent rewrote the document into v2 — an
    // approval of text the human never saw.
    const home = await mkdtemp(join(tmpdir(), "conductor-review-"));
    const artifact = "/p/versions.md";
    try {
      const v1 = await createReviewServer({ markdown: "# v1\n", title: "P", artifactPath: artifact, home });
      await post(v1.url, { kind: "comment", text: "keep this note" });
      await post(v1.url, { kind: "verdict", verdict: "approve" });
      await v1.close();

      // Replay the queue by hand, as a crashed wait would have left it:
      // re-append both records (v1 cleared the queue on resolving).
      const { appendPending: ap } = await import("../src/review/store.js");
      const { contentHash } = await import("../src/review/canvas.js");
      const h1 = contentHash("# v1\n");
      await ap(artifact, { kind: "comment", text: "keep this note", at: "t", doc: h1 }, home);
      await ap(artifact, { kind: "verdict", verdict: "approve", at: "t", doc: h1 }, home);

      const v2 = await createReviewServer({ markdown: "# v2 — rewritten\n", title: "P", artifactPath: artifact, home });
      try {
        const settled = await Promise.race([v2.waitForVerdict(), delay(120).then(() => "waiting")]);
        assert.equal(settled, "waiting", "a v1 approval approved v2");
        assert.ok(
          v2.feedback.some((f) => f.text === "keep this note"),
          "comments from the earlier version are still the human's words",
        );
      } finally {
        await v2.close();
      }
    } finally {
      await rm(home, { recursive: true, force: true });
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

/** POST /api/feedback with arbitrary headers. Returns the status code. */
function rawPost(port, headers, body) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: "127.0.0.1", port, path: "/api/feedback", method: "POST", headers },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode));
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

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
