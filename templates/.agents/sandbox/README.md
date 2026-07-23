# Conductor Loop — Sandbox

> **Why this exists.** `conductor loop` at autonomy **L3** runs an agent unattended
> with shell access. That is only safe inside a sandbox (survey §5). The driver
> **refuses L3 unless `loop-state.json` has an isolating `sandbox`** (terminal
> `halted_sandbox_required`). You do **not** build or maintain a container image —
> the sandbox is the agent CLI vendor's job.

## Two ways to satisfy the L3 gate

### 1. `"sandbox": "cli-native"` — recommended, no Docker

Use the agent CLI's **own, vendor-maintained** OS-level sandbox. Nothing for this
project (or you) to maintain but a host package.

- **`claude` (primary):** Anthropic's built-in **bubblewrap + socat** sandbox.
  Conductor passes [`claude-sandbox.settings.json`](./claude-sandbox.settings.json)
  to each headless `claude -p` beat via `--settings` (it never touches your own
  `.claude/settings.json`). That profile sets `sandbox.enabled: true`,
  `failIfUnavailable: true` (fail-closed — a beat exits non-zero if the sandbox
  can't start, so an unsandboxed L3 run is impossible), `autoAllowBashIfSandboxed`
  (so headless bash runs without prompts), and a **network allowlist**.
  - **Host setup (one-time, no Docker):**
    ```bash
    sudo apt install -y bubblewrap socat      # Debian/Ubuntu (dnf on Fedora)
    # Ubuntu 24.04+: add the AppArmor profile for bwrap user namespaces
    # (see https://code.claude.com/docs/en/sandboxing).
    ```
  - **Before a real run, edit `network.allowedDomains`** in the profile to add
    YOUR git host (e.g. `code.euranova.eu`) and any package registries your build
    needs. Everything not listed is blocked (default-deny egress).
- **`agy` (Antigravity):** runs in **Google's hosted sandbox** — isolation is
  server-side and managed by Google; nothing to configure locally.
- **`codex`:** uses **OpenAI's** Docker-based sandbox; ensure your codex CLI is
  configured for a sandboxed mode.

Set in `conductor/1-workbench/loop-state.json`:
```json
{ "autonomy_level": "L3", "sandbox": "cli-native", "concurrency": 4 }
```

### 2. `"sandbox": "container"` — BYO container (defence-in-depth / unsupported hosts)

For hosts where bubblewrap can't run, or if you want a second isolation layer,
run the whole loop inside a container **you** control. You still don't need to
*publish* an image — start from a trusted public base (e.g. the official `node`
image) and lock the network down at `docker run` time. `Dockerfile.sandbox` in
this directory is a minimal starting point:

```bash
docker build -f .agents/sandbox/Dockerfile.sandbox -t conductor-loop .
docker run --rm -it \
  --network none \                 # or an allowlisted proxy for the model API + git host
  --cpus 2 --memory 4g \
  -v "$PWD:/work" -w /work \
  -e ANTHROPIC_API_KEY \
  conductor-loop \
  conductor loop --from-conductor --unsafe-no-sandbox   # inside the container, this is honest
```

Then set `"sandbox": "container"` and `"autonomy_level": "L3"`.

## Levels below L3

L0–L2 (interactive, single-beat, or unattended *blueprint*) do not require a
sandbox — they keep a human on the loop or never touch a protected branch.
`sandbox: "none"` is fine there. A real `sandbox: "none"` run still requires the
operator to pass `--unsafe-no-sandbox` (asserting they've isolated it some other
way, e.g. a throwaway VM). The gate applies to L3 (unattended execution).
