// test/conductor-state.test.js
//
// ONE state function, TWO renderers. `conductor status` (terminal) and
// `conductor view` (HTML) must both read from this module, or the two surfaces
// will disagree and the human will stop believing either. So the digest is
// built and tested here, once, as a pure function.
//
// It also proves the read path reuses `src/loop/harvester.js` — the autonomous
// loop already had a structured view of `conductor/` and the human did not.
// Closing that asymmetry is the whole point; a second parser would reopen it.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  SECTIONS,
  sectionForPath,
  summariseBacklog,
  computeBacklinks,
  computeStale,
  buildState,
  appendInboxLine,
  ensureGitignoreEntry,
  openerFor,
  captureInbox,
} from "../src/conductor-state.js";
import { harvestWorkQueue } from "../src/loop/harvester.js";

const INBOX = `# Inbox

Dump anything here.

---

- rename the export button
- investigate the flaky upload test
`;

const BACKLOG = `# Backlog

## P1 - High Priority (Do Next)
- [ ] Fix login timeout bug on mobile
- [ ] Update README

## P2 - Medium Priority
- [ ] Add "Clear All" button
- [x] Already shipped this

## P3 - Low Priority (Nice to Have)
- [ ] Explore animation library
`;

const docs = (overrides = []) => [
  { relPath: "conductor/0-compass/north-star.md", raw: "# North Star\n\nSee conductor/2-backlog/task-backlog.md\n", mtimeMs: 0 },
  { relPath: "conductor/2-backlog/task-backlog.md", raw: BACKLOG, mtimeMs: 0 },
  { relPath: "conductor/3-product-areas/auth/spec.md", raw: "# Auth\n\nDepends on north-star.md\n", mtimeMs: 0 },
  ...overrides,
];

describe("section mapping", () => {
  test("every lifecycle folder has a section with a label", () => {
    assert.equal(SECTIONS.length, 7);
    assert.deepEqual(
      SECTIONS.map((s) => s.key),
      ["0-compass", "1-workbench", "2-backlog", "3-product-areas", "4-context", "5-templates", "6-archive"]
    );
    assert.ok(SECTIONS.every((s) => s.label && s.blurb));
  });

  test("a path maps to its numbered folder", () => {
    assert.equal(sectionForPath("conductor/2-backlog/task-backlog.md"), "2-backlog");
    assert.equal(sectionForPath("conductor/3-product-areas/auth/spec.md"), "3-product-areas");
  });

  test("an unknown path maps to null rather than guessing", () => {
    assert.equal(sectionForPath("conductor/stray.md"), null);
  });
});

describe("backlog summary", () => {
  test("counts open items per priority and ignores done ones", () => {
    const s = summariseBacklog(BACKLOG);
    assert.equal(s.open, 4);
    assert.equal(s.done, 1);
    assert.equal(s.byPriority.P1, 2);
    assert.equal(s.byPriority.P2, 1);
    assert.equal(s.byPriority.P3, 1);
  });

  test("groups keep their heading order and carry the items", () => {
    const s = summariseBacklog(BACKLOG);
    assert.deepEqual(
      s.groups.map((g) => g.priority),
      ["P1", "P2", "P3"]
    );
    assert.equal(s.groups[0].items[0].title, "Fix login timeout bug on mobile");
    assert.equal(s.groups[1].items.find((i) => i.done)?.title, "Already shipped this");
  });

  test("an empty backlog is not an error", () => {
    const s = summariseBacklog("");
    assert.equal(s.open, 0);
    assert.deepEqual(s.groups, []);
  });
});

describe("backlinks — information the folder tree cannot show", () => {
  test("a document referenced by another gets a backlink to it", () => {
    const links = computeBacklinks(docs());
    assert.deepEqual(links["conductor/2-backlog/task-backlog.md"], ["conductor/0-compass/north-star.md"]);
  });

  test("a bare filename reference counts as a link", () => {
    const links = computeBacklinks(docs());
    assert.deepEqual(links["conductor/0-compass/north-star.md"], ["conductor/3-product-areas/auth/spec.md"]);
  });

  test("a document does not link to itself", () => {
    const links = computeBacklinks([
      { relPath: "conductor/0-compass/north-star.md", raw: "see north-star.md", mtimeMs: 0 },
    ]);
    assert.deepEqual(links["conductor/0-compass/north-star.md"] ?? [], []);
  });
});

describe("staleness", () => {
  const now = Date.parse("2026-09-08T00:00:00Z");
  const day = 86400000;

  test("flags documents older than the threshold", () => {
    const stale = computeStale(
      [
        { relPath: "conductor/0-compass/north-star.md", mtimeMs: now - 40 * day },
        { relPath: "conductor/0-compass/ship-log.md", mtimeMs: now - 2 * day },
      ],
      { now, days: 30 }
    );
    assert.deepEqual(stale.map((d) => d.relPath), ["conductor/0-compass/north-star.md"]);
    assert.equal(stale[0].ageDays, 40);
  });

  test("templates and the archive are never stale — they are meant to sit still", () => {
    const stale = computeStale(
      [
        { relPath: "conductor/5-templates/prd.md", mtimeMs: now - 999 * day },
        { relPath: "conductor/6-archive/old.md", mtimeMs: now - 999 * day },
      ],
      { now, days: 30 }
    );
    assert.deepEqual(stale, []);
  });
});

describe("buildState — the shared digest", () => {
  const state = () =>
    buildState({
      root: "/repo",
      projectName: "repo",
      inboxMd: INBOX,
      backlogMd: BACKLOG,
      loopState: { status: "idle", beat: 7 },
      docs: docs(),
      now: Date.parse("2026-09-08T00:00:00Z"),
    });

  test("the digest carries what the human asks for daily", () => {
    const d = state().digest;
    assert.equal(d.inboxCount, 2);
    assert.equal(d.backlogOpen, 4);
    assert.equal(d.byPriority.P1, 2);
    assert.equal(d.docCount, 3);
    assert.equal(d.loop.status, "idle");
  });

  test("the work queue is the harvester's, not a second parser", () => {
    const s = state();
    assert.deepEqual(s.queue, harvestWorkQueue({ inboxMd: INBOX, backlogMd: BACKLOG }));
    assert.equal(s.queue[0].type, "bugfix", "bugs still come first");
  });

  test("documents are grouped into sections and sorted by title", () => {
    const s = state();
    const compass = s.sections.find((x) => x.key === "0-compass");
    assert.equal(compass.docs.length, 1);
    assert.equal(compass.docs[0].title, "North Star");
    assert.ok(s.sections.every((x) => Array.isArray(x.docs)));
  });

  test("each document carries rendered html, headings and its backlinks", () => {
    const doc = state().docs.find((d) => d.relPath === "conductor/2-backlog/task-backlog.md");
    assert.ok(doc.html.includes("<h1"), "html is rendered at generation time");
    assert.ok(doc.headings.length > 0);
    assert.deepEqual(doc.backlinks, ["conductor/0-compass/north-star.md"]);
    assert.ok(!("raw" in doc), "raw markdown is not shipped to the page — html already is");
  });

  test("an empty conductor/ still produces a usable state", () => {
    const s = buildState({ root: "/repo", projectName: "repo", docs: [], now: 0 });
    assert.equal(s.digest.inboxCount, 0);
    assert.equal(s.digest.backlogOpen, 0);
    assert.equal(s.digest.loop, null);
    assert.equal(s.sections.length, 7, "the lifecycle is still shown, just empty");
  });
});

describe("inbox capture — deterministic, so it cannot be forgotten", () => {
  test("appends a bullet under the existing list", () => {
    const out = appendInboxLine("# Inbox\n\n---\n\n- first\n", "second");
    assert.ok(out.endsWith("- first\n- second\n"), JSON.stringify(out));
  });

  test("replaces the template's empty placeholder instead of stacking under it", () => {
    const out = appendInboxLine("# Inbox\n\n---\n\n- \n", "first real thought");
    assert.ok(out.includes("- first real thought"), out);
    assert.ok(!/^-\s*$/m.test(out), "the empty placeholder bullet is gone");
  });

  test("creates the list when the file has no bullets yet", () => {
    const out = appendInboxLine("# Inbox\n\nSome prose.\n", "a thought");
    assert.ok(out.endsWith("- a thought\n"), out);
  });

  test("text is appended verbatim — no triage, no rewording", () => {
    const odd = "  **Fix** the [thing](x) -- ASAP  ";
    const out = appendInboxLine("- \n", odd);
    assert.ok(out.includes("- **Fix** the [thing](x) -- ASAP"), out);
  });

  test("a multi-line thought stays one bullet", () => {
    const out = appendInboxLine("- \n", "line one\nline two");
    assert.ok(out.includes("- line one line two"), out);
  });

  test("empty text is refused rather than writing a blank bullet", () => {
    assert.throws(() => appendInboxLine("- \n", "   "), /empty/i);
  });
});

describe("capture refuses to litter", () => {
  test("captureInbox will not scaffold conductor/ in a project that has none", async () => {
    const dir = await mkdtemp(join(tmpdir(), "conductor-capture-"));
    await assert.rejects(() => captureInbox(dir, "a thought"), /conductor/i);
    assert.equal(existsSync(join(dir, "conductor")), false, "nothing was created");
  });

  test("but it does create inbox.md inside a real install", async () => {
    const dir = await mkdtemp(join(tmpdir(), "conductor-capture-"));
    await mkdir(join(dir, "conductor", "1-workbench"), { recursive: true });
    const res = await captureInbox(dir, "a thought");
    assert.equal(res.created, true);
    assert.match(readFileSync(join(dir, "conductor/1-workbench/inbox.md"), "utf8"), /- a thought/);
  });
});

describe("derived views are never committed", () => {
  test("adds the ignore entry when missing", () => {
    const out = ensureGitignoreEntry("node_modules\n", "conductor/.views/");
    assert.ok(out.includes("conductor/.views/"), out);
  });

  test("is idempotent", () => {
    const once = ensureGitignoreEntry("", "conductor/.views/");
    assert.equal(ensureGitignoreEntry(once, "conductor/.views/"), once);
  });

  test("does not match a different entry by prefix", () => {
    const out = ensureGitignoreEntry("conductor/.views-old/\n", "conductor/.views/");
    assert.ok(out.includes("conductor/.views/"), out);
  });
});

describe("--open picks the right platform opener", () => {
  test("WSL uses wslview so the file lands in the Windows browser", () => {
    assert.equal(openerFor("linux", { WSL_DISTRO_NAME: "Ubuntu" }), "wslview");
  });

  test("plain linux, macOS and windows", () => {
    assert.equal(openerFor("linux", {}), "xdg-open");
    assert.equal(openerFor("darwin", {}), "open");
    assert.equal(openerFor("win32", {}), "start");
  });
});
