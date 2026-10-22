# Server-Side Gates — the discipline as a required CI check

> **Status:** dropped by the owner, 2026-10-21, the same day it was scheduled: the framework must not leak into the teams' GitLab CI (as the outer layout never leaks into a team repository). Not designed. Under `conductor loop` (D5) the gates already run on the owner's machine: hooks on each beat's commit, the driver's own verify, the code repository's pre-push on the loop's push. If an orchestrator Conductor does not launch is adopted one day, the same checks belong before the MR exists, in the driver or the private outer repository, never in the team's CI.
> **Why:** Conductor's gates (a test before the code, an eval for LLM code, verification evidence that matches the pushed tree) are git hooks on the machine that commits. An agent Conductor never launches, such as a Claude cloud session, another orchestrator, or a server, may not have them installed, or can skip them with `--no-verify`. Run the same checks as a CI job on every MR and make it required to merge: then the discipline holds whatever tool wrote the code. It is what positioning D4 ("the discipline that holds under any orchestrator", `../research/2026-10-21/orchestrators.md`) needs in code.

## Scope to design

- The checks the job runs, reusing the hooks' library (`templates/.agents/hooks/lib.sh`): TDD presence, the Goodhart boundary and protected paths, eval presence, the Verify command; and how the evidence check works on a CI runner, where the developer's evidence ledger does not exist (re-run, or trust a signed record).
- One job template per forge: GitLab CI first (most products), GitHub Actions second; installed and updated by `conductor init` and `upgrade`, or by a command such as `conductor ci install`.
- What makes it required: GitLab "Pipelines must succeed" plus protected branches; GitHub branch protection with required status checks. Which of these Conductor can set, and which the owner sets on the forge.
- Waivers: the commit-message waivers the hooks accept must pass the same way in CI, and be visible on the MR.
- The outer layout: the code repository's MR carries the code; the checks need the outer repository's hooks library (copy it into the job, or a published package).

## Open questions for the owner

- **Q1:** a CI job runs in the team's repositories and is visible to the team. Introduce it per product, after a word with each team?
- **Q2:** the job costs CI minutes on every MR. Acceptable on code.euranova.eu runners?
