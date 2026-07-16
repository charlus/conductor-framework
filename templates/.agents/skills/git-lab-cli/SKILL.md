---
name: GitLab-CLI
description: GitLab workflow using the glab CLI — issues, MRs, wiki, and CI/CD. Use when the project is hosted on GitLab. Conventions (commit/branch/MR-body) come from git-workflow.
---

# GitLab CLI Integration

> This skill owns the **`glab` mechanics only**. Commit messages, branch names, and the MR description structure are conventions — they live in `skills/git-workflow/SKILL.md`, the single host-agnostic source of truth. This skill does not restate them; it shows how to drive `glab`.

## Prerequisites

- `glab` CLI installed and authenticated (`glab auth login`)
- Project is a GitLab repository

## Quick Reference

### Issues

```bash
# Create issue from a Feature Spec
glab issue create --title "feat: [Feature Name]" --description "$(cat feature-spec.md)" --label "implementation"

glab issue list --per-page 20  # list open issues
glab issue close <number>       # close when done
```

### Merge Requests

```bash
# Write the MR body using the PR/MR template in git-workflow, then pass it.
# glab has no --description-file, so read the file into the flag:
glab mr create --title "feat(scope): [description]" --description "$(cat .git/mr-body.md)" --assignee @me

# Quick MR that auto-closes an issue on merge:
glab mr create --title "feat: [description]" --description "Closes #<issue_number>" --assignee @me

glab mr list                    # list open MRs
glab mr merge <number>          # merge when ready
```

### Wiki

```bash
glab repo wiki create --title "[Project] Documentation" --content "$(cat project-documentation.md)"
glab repo wiki list             # list wiki pages
```

### CI/CD

```bash
glab ci status                  # check pipeline status
glab ci view                    # view pipeline logs
glab ci retry                   # retry a failed pipeline
```

## Build integration

Follow `skills/git-workflow/SKILL.md` for *when* and *how* to commit (one commit per verified task, Conventional Commits, MR at Ship). This skill only supplies the `glab` commands those steps invoke — `glab mr create` at Build's Ship & Close phase, `glab repo wiki` updates after Retrospective, and `glab issue close` on merge.
