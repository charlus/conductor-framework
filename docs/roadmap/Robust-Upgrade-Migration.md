# Robust Cross-Version Upgrade Migration

> **Status:** ✅ Shipped in 6.0.0 (2026-07-14). Implemented in `src/commands/upgrade.js`, `src/version.js`, `src/backup.js`, `src/update.js`, `src/kebab.js`; covered by `test/upgrade.test.js`.
> **Goal:** Let any user on V4, V5, or an unversioned install upgrade safely to the current framework — **preserving their `conductor/` project knowledge while replacing the `.agents/` methodology instructions wholesale.**

## The principle: ownership, not location

The naive split is "`.agents/` = replace, `conductor/` = preserve." That is *almost* right, but `conductor/` is not homogeneous — it contains framework-provided scaffolding (`5-templates/`, the loop-state schema) mixed in with the user's knowledge. So the real rule is about **ownership**, decided per path:

**A file is framework-owned iff it ships in the package templates** (`templates/**`). Framework-owned files are *replaced* on upgrade; everything else is *user content* and *preserved*. This one rule spans both zones and dissolves the ambiguity.

| Content | Ownership | Upgrade policy |
|---|---|---|
| `.agents/**` (AGENTS.md, how-it-works.md, workflows, skills, rules, personas) | **Framework** | **Replace wholesale** with current templates. Methodology upgrade must land. |
| `.agents/**` files *not* in the package (a user's custom skill/workflow) | **User** | Carry forward untouched. |
| `conductor/5-templates/**` (document scaffolding the workflows reference) | **Framework** | Refresh with current templates (back up first). |
| `conductor/1-workbench/loop-state.json` | **Framework schema** | Schema-migrate (`v1→v2`), never discard the user's live values. |
| `conductor/{0-compass,1-workbench,2-backlog,3-product-areas,4-context,6-archive}/**` — the user's app knowledge | **User** | **Preserve content always**, even where a same-named *seed* file ships in the package. Migrate only framework-scaffolded *folder* names/structure; never rename user files. |

Today's `upgrade` gets the framework-owned `.agents/` policy backwards (preserves instead of replaces) **and** never refreshes `conductor/5-templates/`.

## What's wrong today

(From an audit of `src/commands/upgrade.js`, `src/update.js`, `src/kebab.js`.)

1. **Instructions are preserved, not replaced.** `update.js` classifies any `.agents/` file whose content differs from the stored checksum as `SKIP` ("local override kept"). So a user who tweaked a workflow — or the whole V6 rewrite of an interview workflow — is **kept on stale instructions**. For a methodology upgrade this is exactly wrong.
2. **Silent no-op with no checksum baseline.** If `.agents/.checksums.json` is absent (every V4 install, every hand-copied `.agents/`), *every* file is `SKIP` and **nothing updates** — an upgrade that reports success but changes nothing.
3. **No version stamp.** Nothing records which framework version a project is on; V4 vs V5 is inferred purely from directory shape/casing. Fragile and non-idempotent at the edges.
4. **No backup, no rollback.** Every op is in-place `rename`/`rm`/`cp`. A mid-run failure leaves a half-migrated tree. There is nowhere to recover a clobbered file.
5. **User knowledge files get force-renamed.** Step 2 kebab-renames *everything* under `conductor/` except a 7-file allowlist, so a user's `My-Design-Notes.md` → `my-design-notes.md`, and name collisions fall through to a silent overwrite.
6. **Structural-migration gaps.** Root numbered folders are only migrated when `conductor/` doesn't yet exist (else orphaned); when both a legacy and new dir exist, the legacy is `rm -rf`'d with no merge; loop-state `v1→v2` is *not* migrated by upgrade (only lazily by the driver on first run).

## Recommended design

### 1. Stamp a version (the missing primitive)
Write `.agents/.conductor-version.json` on every `init`/`upgrade`, reading the number from the package's own `package.json` (so a bump "just works"):
```json
{ "frameworkVersion": "6.0.0", "installedAt": "…", "upgradedAt": "…",
  "schema": { "selections": 1, "loopState": 2 } }
```
Going forward this makes upgrades **version-aware and idempotent**. For installs with no stamp, fall back to structure inference to detect the *shape* (V4/V5), then stamp them. Detection signals (unstamped installs):
- **V4:** `.agent/` (singular) or `.conductor/` (dotted) present; root-level Title-Case numbered folders (`0-Compass`…); no `.selections.json`/`.checksums.json`.
- **V5:** `.agents/` + undotted `conductor/`, kebab-case, `.selections.json`/`.checksums.json` present, **no** version stamp.

### 2. Back up first — always
Before any destructive step, copy the existing `.agents/` — and `conductor/5-templates/` plus any `conductor/` subtree a structural migration will mutate — to a timestamped **`.conductor-backup/<timestamp>/`** at the project root *(confirmed location)*. Add `.conductor-backup/` to the project `.gitignore` (create/append). The full user knowledge tree is only copied when a structural migration will actually touch it (it can be large); `.agents/` is always backed up (it's small). Nothing is ever truly lost; on any step failure the command restores from the backup and exits non-zero.

### 3. Framework-owned files — replace; user content — carry forward
The engine walks the current package templates and the install together, classifying each path by the ownership rule:
- **Framework-owned** (path exists under `templates/**`): `.agents/**` and `conductor/5-templates/**` are **overwritten unconditionally** with the current template — **no checksum gate**. This is the wholesale instruction/template replacement the upgrade needs.
- **User-authored additions** (present in the install, absent from `templates/**` — a custom skill/workflow/persona/template): **carried forward** untouched (today's `KEEP`).
- **User knowledge** (`conductor/` outside `5-templates/`, and live values in `loop-state.json`): **never overwritten**, even where a same-named seed file ships in the package.
- **Everything replaced or removed** is in the backup, so a user who edited a framework file can recover their changes deliberately.
- **Selections:** honor `.agents/.selections.json` for *optional* skills, but always install the core set — all rules, all workflows, and the interview/drafting/handoff **primitives** (same rationale as today's "rules are always selected": new core capabilities must land even if they postdate the user's selections file). Missing selections file ⇒ full install (this replaces today's silent no-op).

This deletes risks #1 and #2 outright: framework files are replaced regardless of checksum or its absence.

### 4. `conductor/` — preserve content, migrate structure safely
- **Never rename user content files.** Restrict kebab-renaming to the *known framework-scaffolded* names (the numbered folders and shipped template files), never arbitrary user files. Fixes risk #5.
- **Structural migrations become transactional and complete:** copy → verify → only then delete; migrate orphaned root numbered folders **even when `conductor/` already exists** (merge, don't skip); when both legacy and new dirs exist, **merge** rather than `rm -rf`. Fixes risk #6.
- **Run schema migrations at upgrade time** — fold loop-state `v1→v2` (reuse the driver's existing migration) during upgrade, not lazily.

### 5. One idempotent, version-spanning chain
Order the migration as a sequence of individually-idempotent steps, each guarded by detected state, so any starting point converges:

```
detect shape/version
  → [V4] normalize dirs (.agent→.agents, .conductor→conductor, root→wrapper, Title→kebab for framework names)
  → [V4/V5] backup
  → replace .agents framework files, carry custom, apply selections
  → migrate conductor structure (transactional) + schema (loop-state v2)
  → regenerate platform stubs + slash commands + git hooks
  → write version stamp
```
A V4 user runs the whole chain; a V5 user skips the shape steps; a current user is a stamped no-op.

### 6. Safety rails & UX
- `--dry-run`: print the plan (what's replaced / backed up / migrated / carried forward) and exit.
- Non-interactive by default (CI-friendly); because we always back up, no destructive prompt is needed. Optional `--no-backup` for the brave.
- On any step failure: restore from the backup and exit non-zero.
- Clear final report: *"Instructions upgraded to 5.0.0 (old `.agents/` backed up to `.conductor-backup/…`). `conductor/` knowledge preserved. Carried forward N custom skills. Migrated loop-state to v2."*
- Post-upgrade self-check: run `check-conductor.sh` and surface the result.

## Migration matrix

| Starting state | Detection | Actions |
|---|---|---|
| **V4** (`.agent/`, `.conductor/`, Title-Case, root numbered folders, no checksums) | structure inference | full chain: normalize dirs → backup → replace instructions → migrate `conductor/` structure+schema → stamp |
| **V5** (`.agents/`, `conductor/`, kebab, `.selections`/`.checksums`) | structure + absent version stamp | backup → replace instructions → schema migrate → stamp |
| **Unversioned / hand-copied** (`.agents/` present, no `.checksums.json`) | absent stamp + absent checksums | backup → full instruction reinstall (no silent no-op) → stamp |
| **Current** | version stamp == package version | no-op (regenerate stubs/commands/hooks only) |

## Implementation touch points
- `src/commands/upgrade.js` — reorder into the chain; add backup, version stamp, dry-run, restore-on-failure, post-check.
- `src/update.js` — split classification: framework-owned ⇒ always `UPDATE`; non-template ⇒ `KEEP`; drop the checksum-`SKIP` preservation for framework files (checksums can still detect *custom vs template* set membership).
- `src/kebab.js` — scope renames to framework-scaffolded names; guard collisions instead of overwriting.
- New `src/version.js` — read/write `.conductor-version.json`; detect shape for unstamped installs.
- New `src/backup.js` — timestamped backup + restore.
- Reuse `src/loop/driver.js`'s loop-state migration at upgrade time.
- Tests: `node:test` cases for each starting state (fixtures for V4/V5/unversioned trees) asserting conductor content preserved, instructions replaced, custom files carried forward, backup created, idempotent re-run.

## Decisions (confirmed)
1. **Backup location** — `.conductor-backup/<timestamp>/` at project root, git-ignored. ✅
2. **Edited framework files** — replace + back up (no auto-merge); users recover edits from the backup deliberately. ✅ (matches the "replace instructions" directive)
3. **Version** — ship as **6.0.0**; the stamp reads the number from `package.json`. ✅

## `--dry-run` output (sketch)
```
Conductor upgrade — plan (dry run)
  Detected: V5 install (no version stamp)  →  target 6.0.0
  Backup:   .conductor-backup/2026-07-14T…/  (.agents/, conductor/5-templates/)
  .agents/  REPLACE 41 framework files · CARRY 2 custom (skills/acme-deploy, personas/ceo)
  conductor/5-templates/  REFRESH 6 files
  conductor/1-workbench/loop-state.json  MIGRATE schema v1 → v2
  conductor/  preserve 128 knowledge files (untouched)
  Regenerate: .claude/commands/*, platform stubs, git hooks
  Stamp: .agents/.conductor-version.json → 6.0.0
No changes written (dry run). Re-run without --dry-run to apply.
```
