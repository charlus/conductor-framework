# Conductor Loop — Sandbox Profile (document-only)

> **Why this exists.** `conductor loop` at autonomy **L3** runs an agent unattended
> with shell access. That is only safe inside a sandbox (survey §5). Per ADR-0001
> Q2, Conductor is **document-only**: it does not spawn or manage containers — you
> run the loop *inside* a sandbox you control, and the driver **refuses L3 unless
> `loop-state.json` has `"sandbox": "container"`** (terminal `halted_sandbox_required`).
> This keeps Conductor a thin BYO-CLI driver (D7), not a runtime.

## The profile you should provide

A conforming sandbox MUST give the loop:

1. **Default-deny network.** No outbound access except what the agent CLI needs to
   reach its model endpoint (e.g. `api.anthropic.com`). Nothing else.
2. **Workspace-only filesystem.** The repo (and its worktree under
   `.agents/.worktrees/`) is writable; the rest of the host is not mounted.
3. **Per-beat resource limits.** CPU/memory caps and a wall-clock kill so a runaway
   beat cannot exhaust the host. (The driver also enforces `budget.max_wall_clock_min`,
   but that is belt-and-suspenders, not a substitute for an OS-level limit.)
4. **No host credentials** beyond the single model API key the CLI needs.

## Example container profile

`Dockerfile.sandbox` in this directory is a starting point. Build and run the loop
inside it, with the network locked down by your container runtime:

```bash
docker build -f .agents/sandbox/Dockerfile.sandbox -t conductor-loop .

# --network none blocks ALL egress; add an allowlisted proxy for the model API.
docker run --rm -it \
  --network none \
  --cpus 2 --memory 4g \
  -v "$PWD:/work" -w /work \
  -e ANTHROPIC_API_KEY \
  conductor-loop \
  conductor loop --unsafe-no-sandbox   # inside the sandbox, this flag is honest
```

Then set `"sandbox": "container"` and `"autonomy_level": "L3"` in
`conductor/1-workbench/loop-state.json`. Without `"sandbox": "container"`, an L3 run
halts immediately with `halted_sandbox_required` before any beat.

## Levels below L3

L0–L2 (interactive, single-beat, or unattended *blueprint*) do not require a
container — they either keep a human on the loop or never touch a protected branch.
`sandbox: "none"` is fine there. The gate applies only to L3 (unattended execution).
