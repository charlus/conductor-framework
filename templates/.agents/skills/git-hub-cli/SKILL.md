---
name: GitHub-CLI
description: GitHub workflow using gh CLI — creating issues, PRs, wiki updates, and Actions integration. Use when the project is hosted on GitHub.
---

# GitHub CLI Integration

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth login`)
- Project is a GitHub repository

## Quick Reference

### Issues

```bash
# Create issue from Feature Spec
gh issue create \
  --title "feat: [Feature Name]" \
  --body-file Feature-Spec.md \
  --label "implementation"

# List open issues
gh issue list

# Close issue when done
gh issue close <number>
```

### Pull Requests

```bash
# Create PR from current branch
gh pr create \
  --title "feat(scope): [description]" \
  --body "## What\n[description]\n\n## Why\n[reason]\n\n## Testing\n- [ ] Tests pass" \
  --assignee @me

# Create PR with auto-close issue
gh pr create \
  --title "feat: [description]" \
  --body "Closes #<issue_number>" \
  --assignee @me

# List open PRs
gh pr list

# Merge when ready
gh pr merge <number> --squash
```

### Releases

```bash
# Create release after shipping
gh release create v1.0.0 \
  --title "v1.0.0 — [Release Name]" \
  --notes "## Changes\n- [feature 1]\n- [feature 2]"
```

### Actions

```bash
# Check workflow status
gh run list

# View run details
gh run view <run-id>

# Re-run failed workflow
gh run rerun <run-id>
```

## Build Workflow Integration

### During Build Phase 1 (Execute Batch)
- Each task maps to a commit: `feat(scope): task description`
- Push regularly: `git push origin feature/branch-name`

### During Build Phase 4 (Ship & Close)
1. Create PR: `gh pr create --title "feat: [Implementation Name]" --assignee @me`
2. Link to issue: Include `Closes #<issue>` in description
3. After merge: Close related issues

### After Retrospective
- Create release if applicable: `gh release create`
- Update project wiki with documentation
