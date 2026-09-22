// src/review/canvas.js
//
// The review canvas — pure half (F4, slice 1).
//
// WHY THIS EXISTS. Conductor's human is a product owner, and on Claude Code
// there is no file browser: the terminal is the only surface. `conductor view`
// fixed the reading half — every document rendered into one page. This is the
// missing return path. The human reads a plan in a browser and says approve or
// request changes, and that verdict comes back to a CLI call the agent is
// blocked on. No copying text into chat, no describing which paragraph.
//
// Slice 1 is verdict + comments. Element-anchored annotations ("move THIS
// section") are slice 2; the feedback record already has room for them.
//
// Everything here is pure so the page and the rules are testable without a
// browser or a socket. The server lives in ./server.js.

import { renderMarkdown, escapeHtml } from "../view/markdown.js";

export const VERDICTS = Object.freeze(["approve", "request-changes"]);

/** A feedback record, or null when the input is not one. */
export function normalizeFeedback(raw) {
  if (!raw || typeof raw !== "object") return null;
  const at = new Date().toISOString();

  if (raw.kind === "verdict") {
    // Never coerce an unrecognised verdict. Defaulting to "approve" would ship
    // work the human did not sign off; defaulting to "request-changes" would
    // silently discard an approval. Both are worse than refusing the record.
    if (!VERDICTS.includes(raw.verdict)) return null;
    return { kind: "verdict", verdict: raw.verdict, at };
  }

  if (raw.kind === "comment") {
    const text = String(raw.text ?? "").trim();
    if (!text) return null;
    return { kind: "comment", text, at };
  }

  return null;
}

/**
 * What should the agent do with this thread?
 * A comment is not a verdict: the loop keeps listening until the human decides.
 */
export function summariseFeedback(feedback = []) {
  const verdicts = feedback.filter((f) => f?.kind === "verdict");
  const last = verdicts[verdicts.length - 1];
  if (!last) return { status: "open", done: false, feedback };
  return {
    status: last.verdict === "approve" ? "approved" : "changes-requested",
    done: true,
    feedback,
  };
}

/**
 * Is this request really from the human's own browser?
 *
 * A page on 127.0.0.1 is reachable by any site the human has open, through DNS
 * rebinding, unless Host is checked — and this particular page can approve
 * work. Host must be a loopback literal, and any Origin present must match a
 * loopback origin too.
 */
export function isLoopbackRequest(req) {
  const host = req?.headers?.host;
  if (typeof host !== "string" || !host) return false;
  // Strip the port; keep IPv6 brackets intact.
  const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  const loopback = name === "127.0.0.1" || name === "localhost" || name === "[::1]" || name === "::1";
  if (!loopback) return false;

  const origin = req?.headers?.origin;
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).hostname;
    } catch {
      return false;
    }
    if (!["127.0.0.1", "localhost", "::1"].includes(originHost)) return false;
  }
  return true;
}

/**
 * The whole review page: rendered artifact plus the review panel.
 * Self-contained on purpose — served on loopback to a human who may be
 * offline, and a CDN script in a review tool is an unreviewed dependency
 * standing between the author and the approval.
 */
export function renderReviewPage({ markdown, title, artifactPath }) {
  const body = renderMarkdown(String(markdown ?? ""));
  const safeTitle = escapeHtml(String(title ?? "Review"));
  const safePath = escapeHtml(String(artifactPath ?? ""));

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Review — ${safeTitle}</title>
<style>
:root {
  --bg: #fbfaf8; --fg: #1d1c1a; --muted: #6b6862; --line: #e3e0da;
  --card: #ffffff; --accent: #2f6f4f; --warn: #9a5b23;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #17181a; --fg: #e9e7e3; --muted: #9a968f; --line: #2e3033;
    --card: #1f2124; --accent: #6bbd90; --warn: #d79a55;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg);
  font: 16px/1.65 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.wrap { max-width: 860px; margin: 0 auto; padding: 32px 16px 160px; }
.path { color: var(--muted); font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all; margin-bottom: 24px; }
article h1, article h2, article h3 { line-height: 1.25; margin: 1.6em 0 .5em; }
article h1 { font-size: 1.9rem; } article h2 { font-size: 1.4rem; }
article pre { background: var(--card); border: 1px solid var(--line); border-radius: 8px;
  padding: 12px; overflow-x: auto; }
article code { font: 13.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
article table { border-collapse: collapse; width: 100%; display: block; overflow-x: auto; }
article th, article td { border: 1px solid var(--line); padding: 6px 10px; text-align: left; }
.panel { position: fixed; left: 0; right: 0; bottom: 0; background: var(--card);
  border-top: 1px solid var(--line); padding: 12px 16px; }
.panel-inner { max-width: 860px; margin: 0 auto; display: flex; gap: 8px; flex-wrap: wrap; }
textarea { flex: 1 1 260px; min-height: 44px; resize: vertical; padding: 10px;
  border: 1px solid var(--line); border-radius: 8px; background: var(--bg); color: var(--fg);
  font: inherit; font-size: 14px; }
button { border: 1px solid var(--line); border-radius: 8px; padding: 10px 14px;
  font: inherit; font-size: 14px; cursor: pointer; background: var(--bg); color: var(--fg); }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button.changes { border-color: var(--warn); color: var(--warn); }
button:disabled { opacity: .5; cursor: default; }
.thread { max-width: 860px; margin: 0 auto 8px; font-size: 13.5px; color: var(--muted); }
.thread div { padding: 2px 0; }
.done { text-align: center; padding: 14px; font-weight: 600; color: var(--accent); }
</style>
</head><body>
<div class="wrap">
  <div class="path">${safePath}</div>
  <article id="doc">${body}</article>
</div>
<div class="panel">
  <div class="thread" id="thread"></div>
  <div class="panel-inner" id="controls">
    <textarea id="text" placeholder="A comment — or leave it blank and just decide."></textarea>
    <button id="comment">Comment</button>
    <button id="changes" class="changes" data-verdict="request-changes">Request changes</button>
    <button id="approve" class="primary" data-verdict="approve">Approve</button>
  </div>
</div>
<script>
(function () {
  var thread = document.getElementById("thread");
  var text = document.getElementById("text");
  var controls = document.getElementById("controls");

  function draw(items) {
    thread.innerHTML = "";
    items.forEach(function (f) {
      var d = document.createElement("div");
      d.textContent = f.kind === "verdict" ? "\\u2713 " + f.verdict : "\\u201c" + f.text + "\\u201d";
      thread.appendChild(d);
    });
  }

  function send(payload) {
    return fetch("api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (s) {
      draw(s.feedback || []);
      if (s.done) {
        controls.innerHTML = '<div class="done">Sent \\u2014 ' + s.status +
          ". You can close this tab.</div>";
      }
      return s;
    });
  }

  document.getElementById("comment").addEventListener("click", function () {
    var t = text.value.trim();
    if (!t) return;
    text.value = "";
    send({ kind: "comment", text: t });
  });

  ["approve", "changes"].forEach(function (id) {
    document.getElementById(id).addEventListener("click", function () {
      var t = text.value.trim();
      var verdict = this.getAttribute("data-verdict");
      var chain = t ? send({ kind: "comment", text: t }) : Promise.resolve();
      text.value = "";
      chain.then(function () { return send({ kind: "verdict", verdict: verdict }); });
    });
  });
})();
</script>
</body></html>`;
}
