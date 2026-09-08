# Terminal-First Human Surfaces (E6)

> **Status:** shipped 2026-09-08 on `worktree-terminal-first-views`.
> Motivated by a real workflow change: the maintainer moved from the Antigravity IDE
> (abandoned by Google — only agy 2.0 desktop, agy cli and agy sdk still receive updates)
> to Claude Code's CLI. Most coding agents now favour a CLI over IDE integration.
>
> **Shipped:** `conductor status`, `conductor inbox add|list`, `conductor view`, the shared
> `src/conductor-state.js` read path, a dependency-free markdown renderer, three CLI-backed
> slash shims, a table-free guard on the state files.
> **Descoped on evidence:** flattening pipe tables out of 17 `conductor/` templates (§5).
> **Deferred:** HTML review reports; diagram-bearing documents (§6).
>
> Every claim below is either live-verified and cited, or labelled as a prediction.

---

## 1. The problem, and the diagnosis that mattered

The old loop was: drop ideas in the inbox, review the backlogs in a rendered markdown preview,
then say "process my inbox" or "what's on our plate today". **The files were the prompt.** The
human rarely typed a real instruction — they steered by editing state and let the agent read it.

Working through a CLI agent removes the three things that made that work: the file tree to
browse, the rendered preview to read, and the editor to type into. Getting a sense of the todo
list became `ls`, `ls` again, `vim`, decipher a pipe table by eye, quit, `cd ../..`.

The tempting conclusion is that a file-based methodology is a poor fit for terminal work. That
is wrong, and getting it wrong would have been expensive:

- The **agent's** read path was never impaired. Agents read markdown perfectly well.
- The files are what make the rest of the framework work: the autonomous loop drains
  `conductor/`, the evidence ledger fingerprints tracked content, and every quality gate runs
  through a git diff and a PR. Move state into a database or into chat and all three break.

What actually broke is the **human's** read/write channel. One number makes it concrete:

> `src/loop/harvester.js` already parsed `inbox.md` and `task-backlog.md` into a ranked, typed
> work queue — for the *loop*. The human, reading the same two files, had `cat`.

The loop was the better-served client of the human's own folder. E6 closes that asymmetry.

**Principle: one source of truth (`conductor/`), many renderers.** Never a second store.

---

## 2. The split, by consumer

The decision that shaped everything else is *which* content gets which surface. It is not a
folder split; it is a consumer split.

| Content | Surface | Why |
|---|---|---|
| **Machine state** — `inbox.md`, `task-backlog.md`, `loop-state.json`, `review-log.jsonl` | markdown/JSON, read through `conductor status` | Parsed by the harvester, diffed line-by-line in git, and read as one-liners. Nobody reads an inbox for layout. HTML here would add a parse surface and destroy the diffs for nothing. |
| **Human documents** — PRDs, specs, briefs, storyboards, retrospectives | markdown source, **derived** HTML via `conductor view` | These are long (the UX/UI brief once ran 448 lines) and read for sense-making. Rendered, they gain tables, outlines, search and backlinks. |
| **`.agents/` instructions** | markdown, always | **Nothing renders a prompt.** HTML costs bytes against the `src/context-bill.js` ceiling, which is paid on every loop beat and is deliberately ratcheted down. |

That last row is where a popular argument does not transfer. The case for HTML over markdown as
an agent's output format ([Anthropic, *the unreasonable effectiveness of
HTML*](https://claude.com/blog/using-claude-code-the-unreasonable-effectiveness-of-html))
dismisses the token cost against a 1M-token context window. Conductor has a **hard byte budget**
on always-on instructions, so the dismissal does not hold there. The argument is taken for
`conductor/` documents and rejected for `.agents/`.

---

## 3. Why one HTML file and not a site

`conductor view` writes exactly one file, `conductor/.views/index.html`. Two reasons, and the
first is a hard constraint rather than a preference:

1. **The page is opened over `file://`**, where the document has a `null` origin and the browser
   blocks the fetch API and XHR. Nothing can be loaded at runtime. So the nav, the search index
   and every rendered document are stamped in at generation time. A page that tried to load a
   sibling data file would show nothing, with no error a reader would notice — pinned by
   `test/view-render.test.js`.
2. **One file is one bookmark.** A per-document site puts the human back to choosing which file
   to open, which is the problem being solved.

Consequences, all deliberate:

- documents arrive **pre-rendered**, so the page ships no markdown parser;
- state travels in an `application/json` block that is **parsed, not evaluated**, with `<`, `>`,
  `&` and U+2028/2029 escaped so no document content can close the tag or break the parse;
- CSS and JS live in real sibling source files (`styles.css`, `app.client.js`) and are inlined at
  generation time — readable source, single artefact out.

Cost, measured: **48 documents → 429 KB**, one file, no dependencies, no build step.

### 3.0 The link has to match the browser's platform, not the process's

`conductor view` prints a clickable `file://` URL, and it resolves it for the platform the
**browser** runs on. Under WSL those differ: the page sits on the Linux filesystem, but the
browser is a Windows one and cannot resolve `file:///home/...`. The UNC host
`wsl.localhost/<distro>` is what it can resolve — confirmed working by the maintainer.

This is enforced in code (`clickableUrl` in `src/conductor-state.js`, six cases under test)
rather than left to the agent, and the `/view` shim tells the agent to relay the printed URL
**verbatim** instead of constructing one. A hand-made `file:///home/...` link on WSL looks
correct and silently does nothing, which is worse than printing a bare path — the failure gives
the human no signal at all.

### 3.1 What generation-time nav buys

Rendering with every file visible at once produces information that neither `cat` nor the folder
tree can show:

- **Backlinks** — which documents reference this one. Live-verified on a seeded cross-reference:
  2 documents gained referrers.
- **Freshness** — documents untouched past a threshold, with `5-templates` and `6-archive`
  excluded because they are meant to sit still.
- **Search** across every document, offline, from an inlined index.

This also removes the reason to flatten `0-compass`..`6-archive`. **The nav is the index**, so
path depth stops mattering to the human, and the loop's path assumptions stay intact.

### 3.2 The security contract of the renderer

`src/view/markdown.js` is dependency-free, which means its escaping is ours to get right. The
threat is real rather than theoretical: `conductor/` holds text written by the human, by agents,
and — through the inbox — by whatever the human pasted in; and the page runs from `file://`, an
origin with more local reach than a website.

So: every character of content is escaped; raw HTML in the source is rendered as visible text and
never passed through; `javascript:`, `data:`, `vbscript:` and `file:` URLs become `#`, tested
against entity- and whitespace-obfuscated variants. **There is no trusted-markdown path and there
must never be one.** Six tests in `test/view-markdown.test.js` exist only to hold that line.

---

## 4. Enforce with code, not prose

`Inbox: X` already existed as a row in the always-on request classifier, and the maintainer's
report was that it "doesn't work every time". That is the expected outcome for a prose
instruction competing for attention with everything else in context — and the framework's own
operating rule is to enforce with code wherever the rule is mechanical. Appending a line to a
file is as mechanical as it gets.

So capture became `conductor inbox add "…"` plus a generated `/inbox` shim. The chat convention
stays as the fallback for platforms without the CLI on PATH.

Two details worth keeping:

- **Capture refuses to scaffold.** The first live run created a stray `conductor/1-workbench/`
  inside an unrelated repo. Capture is meant to be failure-proof *inside* a Conductor project;
  run anywhere else, a clear refusal beats littering. Fixed with a test, red first.
- **Reading state must never cost an agent turn.** `conductor status` answers the most frequently
  asked question in a day for zero tokens and zero context. Asking an agent to summarise the
  backlog cost a full turn every time.

And one invariant: `conductor status` and the HTML digest both render **one** state object from
`src/conductor-state.js`, which itself calls the harvester rather than re-parsing. Two parsers
over the same file would eventually disagree, and the first time they did, the human would stop
trusting both.

---

## 5. Descoped on evidence: flattening the template tables

The plan included making `conductor/` templates table-free, justified by the maintainer's report
that pipe tables were "the hardest part" to decipher raw.

Measured before doing it: **17 files carry tables, and every one of them is a document — none of
the state files read raw has a single table.** `inbox.md`, `scratchpad.md` and `task-backlog.md`
are all table-free already.

The justification therefore inverts. Once `conductor view` renders them, a table is dense and
scannable — the format's actual strength — and flattening 17 files would destroy information
density to solve a problem that no longer exists.

What shipped instead is the defensible half: a **guard** pinning the three state files table-free
(`test/template-integrity.test.js`), verified red→green by seeding a table into `inbox.md`.

---

## 6. Deferred, with reasons

- **HTML review reports** from `independent-review` + `review-log` — severity colouring, blocker
  quotes in diff context, rounds-to-approve trend. Highest-value next step: it aims at the gate
  the repo already instruments.
- **Diagram-bearing documents** (`agentic-flow`, `storyboard`, `ux-ui-design-brief`,
  `technical-vision`). An SVG data-flow diagram holds information no prose version does, so it is
  a genuine upgrade — but the artefact must be split, not replaced: **markdown keeps the
  document, the diagram lands beside it as a committed `.svg`**, and `conductor view` composes
  them. That way markdown stays the agent's source of truth, and there is no duplicated prose to
  drift, because the two halves do not overlap.
- **A multi-file site** (`--split`) for deep-linking one document to a colleague. The generator
  already produces a state object, so a second renderer is a flag rather than a rewrite. Not
  built because nothing needs it yet.

---

## 7. Evidence

Green suites prove the deterministic layer only. What was actually executed:

| Claim | How it was verified |
|---|---|
| install → capture → digest → render works end to end | Live run: `init` a scratch project, two `inbox add`, `inbox list`, `status`, `view` |
| the generated page is well-formed and safe | Data block re-parsed standalone from the written file: JSON parses, exactly 2 script tags, no raw U+2028/2029, no remote refs, no fetch/XHR, no unescaped `<` in the data block |
| the client script is valid | `node --check src/view/app.client.js` |
| backlinks, callouts, tables, task lists, outlines render | Seeded a cross-referencing document with a `[!WARNING]`, a table and task items; re-rendered: backlinks on 2 docs, 1 callout, 17 docs with tables, 8 with checkboxes, 30 with an outline |
| capture will not litter | Red test first (stray `conductor/` created in an unrelated repo), then fixed |
| the table guard can fail | Seeded a table into `inbox.md` → red; reverted → green |
| the always-on ratchet held | 16,442 → **16,433** bytes: a routing row was *added* and the bill went down. Ceiling ratcheted to match. |
| the interactive path is untouched | `templates/.agents/workflows/` byte-identical — no workflow file changed |
| nothing regressed | `test:unit` (452), `npm test` (127), `test:smoke` (13), `test:hooks` (12), `test:trust` (17) all green |

**Not verified:** nobody has opened the page in a browser and looked at it. Structure, escaping
and syntax are checked by machine; the visual result is not. That is the first thing to do with
`conductor view --open`.
