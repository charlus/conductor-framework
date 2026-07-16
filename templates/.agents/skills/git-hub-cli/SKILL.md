---
name: GitHub-CLI
description: GitHub workflow using the gh CLI — issues, PRs, releases, and Actions. Use when the project is hosted on GitHub. Conventions (commit/branch/PR-body) come from git-workflow.
---

# GitHub CLI Integration

> This skill owns the **`gh` mechanics only**. Commit messages, branch names, and the PR description structure are conventions — they live in `skills/git-workflow/SKILL.md`, the single host-agnostic source of truth. This skill does not restate them; it shows how to drive `gh`.

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth login`)
- Project is a GitHub repository

## Quick Reference

### Issues

```bash
# Create issue from a Feature Spec
gh issue create --title "feat: [Feature Name]" --body-file feature-spec.md --label "implementation"

gh issue list                 # list open issues
gh issue close <number>        # close when done
```

### Pull Requests

```bash
# Write the PR body using the PR/MR template in git-workflow, save it to a file,
# then pass it with --body-file (avoids shell-escaping the multi-line template):
gh pr create --title "feat(scope): [description]" --body-file .git/pr-body.md --assignee @me

# Quick PR that auto-closes an issue on merge:
gh pr create --title "feat: [description]" --body "Closes #<issue_number>" --assignee @me

gh pr list                     # list open PRs
gh pr merge <number> --squash  # merge when ready
```

### Releases

```bash
gh release create v1.0.0 --title "v1.0.0 — [Release Name]" --notes-file release-notes.md
```

### Actions

```bash
gh run list                    # check workflow status
gh run view <run-id>           # view run details
gh run rerun <run-id>          # re-run a failed workflow
```

## Build integration

Follow `skills/git-workflow/SKILL.md` for *when* and *how* to commit (one commit per verified task, Conventional Commits, PR at Ship). This skill only supplies the `gh` commands those steps invoke — `gh pr create` at Build's Ship & Close phase, `gh release create` after Retrospective, and `gh issue close` on merge.
