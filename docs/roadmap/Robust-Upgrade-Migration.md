# Robust Cross-Version Upgrade Migration

> **Status:** Proposed — design assessment
> **Goal:** Let any user on V4, V5, or an unversioned install upgrade safely to the current framework — **preserving their `conductor/` project knowledge while replacing the `.agents/` methodology instructions wholesale.**

## The principle: two zones, opposite policies

Conductor installs two fundamentally different kinds of content, and the upgrade must treat them oppositely:

| Zone | What it is | Ownership | Upgrade policy |
|---|---|---|---|
| `conductor/` | The user's **project knowledge** — the built app's compass, backlog, product areas, context, archive | **User-owned** | **Preserve content always.** Migrate *structure* only. Never rename user content. Back up before touching. |
| `.agents/` | The **framework methodology** — AGENTS.md, how-it-works.md, workflows, skills, rules, personas | **Framework-owned** | **Replace wholesale.** The framework owns these files; a methodology upgrade must land the new instructions. Back up the old ones; carry forward only genuinely user-authored additions. |

Today's `upgrade` gets the `.agents/` policy backwards.

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
Write `.agents/.conductor-version.json` on every `init`/`upgrade`:
```json
{ "frameworkVersion": "5.0.0", "installedAt": "…", "upgradedAt": "…",
  "schema": { "selections": 1, "loopState": 2 } }
```
Going forward this makes upgrades **version-aware and idempotent**. For installs with no stamp, fall back to today's structure inference to detect the *shape* (V4/V5), then stamp them.

### 2. Back up first — always
Before any destructive step, copy the existing `.agents/` (and, if a structural `conductor/` migration will run, `conductor/`) to a timestamped, git-ignorable `.conductor-backup/<timestamp>/`. Nothing is ever truly lost; users can diff their old customizations. This single change removes the "no rollback" class of risk.

### 3. `.agents/` — replace framework-owned, carry forward custom
On upgrade, for `.agents/`:
- **Framework-owned files** (anything present in the current templates + `registry.json`, plus always `AGENTS.md`, `how-it-works.md`, `rules/*`, `prime-directive`): **overwritten unconditionally** with the current template — no checksum gate. This is the wholesale instruction replacement the user needs.
- **User-authored additions** (files in the install but *not* in the current templates — a custom skill/workflow/persona): **carried forward** untouched.
- **Everything old** is in the backup regardless, so a user who edited a framework file can recover their changes deliberately.
- **Selections:** honor `.agents/.selections.json` for *optional* skills, but always install core rules, workflows, and the interview/drafting/handoff **primitives** (same rationale as the existing "rules are always selected" rule — new core capabilities must land even if they postdate the user's selection file). Missing selections file ⇒ full install.

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

## Open decisions (for the human)
1. **Backup location** — recommend a git-ignorable `.conductor-backup/<timestamp>/` at project root (vs. inside `conductor/6-archive/`, which is for finished project work).
2. **Carry-forward vs. backup-only for user-edited *framework* files** — user directive is "replace instructions," so: replace + back up (recover manually). Confirm we don't try to auto-merge edited framework files.
3. **Version bump** — a change this size likely warrants publishing as the next version so the stamp is meaningful.
