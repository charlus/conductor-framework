---
name: GitLab-CLI
description: GitLab workflow using glab CLI — creating issues, MRs, wiki updates, and CI/CD integration. Use when the project is hosted on GitLab.
---

# GitLab CLI Integration

## Prerequisites

- `glab` CLI installed and authenticated (`glab auth login`)
- Project is a GitLab repository

## Quick Reference

### Issues

```bash
# Create issue from Feature Spec
glab issue create \
  --title "feat: [Feature Name]" \
  --description "$(cat Feature-Spec.md)" \
  --label "implementation"

# List open issues
glab issue list --per-page 20

# Close issue when done
glab issue close <number>
```

### Merge Requests

```bash
# Create MR from current branch
glab mr create \
  --title "feat(scope): [description]" \
  --description "## What\n[description]\n\n## Why\n[reason]\n\n## Testing\n- [ ] Tests pass" \
  --assignee @me

# Create MR with auto-close issue
glab mr create \
  --title "feat: [description]" \
  --description "Closes #<issue_number>" \
  --assignee @me

# List open MRs
glab mr list

# Merge when ready
glab mr merge <number>
```

### Wiki

```bash
# Update wiki with Project Documentation
glab repo wiki create \
  --title "[Project] Documentation" \
  --content "$(cat Project-Documentation.md)"

# List wiki pages
glab repo wiki list
```

### CI/CD

```bash
# Check pipeline status
glab ci status

# View pipeline logs
glab ci view

# Retry failed pipeline
glab ci retry
```

## Build Workflow Integration

### During Build Phase 1 (Execute Batch)
- Each task maps to a commit: `feat(scope): task description`
- Push regularly: `git push origin feature/branch-name`

### During Build Phase 4 (Ship & Close)
1. Create MR: `glab mr create --title "feat: [Implementation Name]" --assignee @me`
2. Link to issue: Include `Closes #<issue>` in description
3. After merge: Close related issues

### After Retrospective
- Update wiki with lessons learned
- Update existing documentation pages
