// src/loop/doctor.js
//
// `conductor loop doctor` (F1 + F6 of the first unattended crossing,
// docs/roadmap/Unattended-Crossing.md). Preparing a project for the loop took
// six project facts that nothing checked, and the prep notes were proven wrong
// only by a live run. The doctor checks those facts before any beat.
//
// `diagnose` is pure over facts the command layer gathers
// (src/commands/loop-doctor.js), so every rule is unit-testable. A check is
// "pass", "warn" (the run can start but something will likely hurt) or "fail"
// (the run would halt, stall or be unsafe). Each non-pass check names its fix.

const ICON = { pass: "✔", warn: "⚠", fail: "✖" };

function check(id, level, title, detail = "", fix = "") {
  return { id, level, title, detail, fix };
}

/** @param {object} f facts gathered by the command layer */
export function diagnose(f) {
  const out = [];
  const s = f.state ?? {};

  if (f.configErrors?.length) {
    out.push(check("config", "fail", "conductor.config.json loop block", f.configErrors.join("; "), "Fix the listed values; the run refuses an invalid loop block."));
  }

  if (f.preflightHalt) {
    out.push(check("preflight", "fail", `pre-flight would halt: ${f.preflightHalt}`, f.preflightReason ?? "", "Change loop-state.json as the reason says, then run the doctor again."));
  } else {
    out.push(check("preflight", "pass", `pre-flight passes (${s.phase}, ${s.autonomy_level}, sandbox ${s.sandbox})`));
  }

  if (f.projectVersion && f.cliVersion && f.projectVersion !== f.cliVersion) {
    out.push(check("version", "warn", `project framework ${f.projectVersion}, CLI ${f.cliVersion}`, "The loop runs the CLI's code against the project's templates.", "Run `conductor upgrade` in the project."));
  }

  if (s.sandbox === "cli-native") {
    const p = f.profile ?? {};
    if (!p.credentials || !p.strict) {
      const missing = [!p.credentials && "forge credentials are not withheld", !p.strict && "headless beats can stall on commands that need approval"].filter(Boolean);
      out.push(check("sandbox-profile", "fail", "sandbox profile is out of date", missing.join("; "), "Run `conductor upgrade` (6.17.0 or later)."));
    } else {
      out.push(check("sandbox-profile", "pass", "sandbox profile withholds credentials and runs headless"));
    }
    if (s.platform === "claude" || !s.platform) {
      const t = f.hostTools ?? {};
      const missing = [!t.bwrap && "bubblewrap", !t.socat && "socat"].filter(Boolean);
      out.push(
        missing.length
          ? check("host-tools", "fail", `missing for the sandbox: ${missing.join(", ")}`, "", "Install bubblewrap and socat (`sudo apt install bubblewrap socat`); see .agents/sandbox/README.md.")
          : check("host-tools", "pass", "bubblewrap and socat are installed")
      );
    }
  } else if (s.sandbox === "none") {
    out.push(check("sandbox", "warn", "sandbox is none", "Every run needs --unsafe-no-sandbox, and L3 is refused.", 'Set "sandbox": "cli-native" in loop-state.json.'));
  }

  const c = f.claude ?? {};
  if (c.available === false && (s.platform === "claude" || !s.platform)) {
    out.push(check("claude", "fail", "claude is not on PATH", "", "Install Claude Code, or set platform in loop-state.json."));
  } else if (c.available) {
    for (const w of c.warnings ?? []) out.push(check("instructions", "warn", "Claude Code may not see the framework", w, "See the warning; `conductor status` shows the same."));
    if (!(c.warnings ?? []).length) out.push(check("instructions", "pass", "Claude Code reads AGENTS.md here"));
  }

  const fg = f.forge ?? {};
  if (fg.needed) {
    if (!fg.forge) out.push(check("forge", "fail", "cannot tell which forge opens the PR", fg.error ?? "", 'Set loop.forge to "gh" or "glab" in conductor.config.json.'));
    else if (!fg.authOk) out.push(check("forge", "fail", `${fg.forge} is not logged in${fg.host ? ` to ${fg.host}` : ""}`, "", `Run \`${fg.forge} auth login${fg.host ? ` --hostname ${fg.host}` : ""}\`.`));
    else out.push(check("forge", "pass", `${fg.forge} is logged in${fg.host ? ` to ${fg.host}` : ""}`));
  }

  if (f.nestedRepos?.length) {
    out.push(check("nested", "fail", `nested repositories: ${f.nestedRepos.join(", ")}`, "Loop worktrees would not contain that code.", "Run the loop in the code repository, or set loop.allow_nested_repo if it is unrelated."));
  }

  const q = f.queue;
  if (q) {
    if (q.count === 0) {
      out.push(check("queue", "warn", "--from-conductor would find no work", "", q.requireReady ? "Tag a backlog item `(loop-ready)`, or use --goal." : "Add a backlog item, or use --goal."));
    } else {
      out.push(check("queue", "pass", `--from-conductor would take ${q.count} item${q.count === 1 ? "" : "s"}`));
    }
  }

  if (f.dotenv?.present && !f.dotenv.copiedBySetup) {
    out.push(check("dotenv", "warn", ".env is not in the worktree", "It is gitignored, so tests or evals that read it will skip or fail in a loop worktree, the push gate included.", "Copy it in loop.setup, for example `[ -f ../../../.env ] && cp ../../../.env .env`."));
  }

  const pr = f.probe;
  if (pr?.ran) {
    if (pr.setup?.configured) {
      out.push(
        pr.setup.ok
          ? check("setup", "pass", `loop.setup ran in a fresh worktree (${pr.setup.secs ?? "?"}s)`)
          : check("setup", "fail", "loop.setup failed in a fresh worktree", pr.setup.reason ?? "", "Run the setup command by hand in a new worktree of this repo and fix it.")
      );
    }
    if (pr.verify) {
      const v = pr.verify;
      if (v.exitCode === 0) {
        out.push(check("verify", "pass", `verify is green in a fresh worktree (${v.secs ?? "?"}s): ${v.command}`));
      } else {
        const fix = pr.setup?.configured
          ? "The base must be green: fix the failure, or the setup that should prepare it."
          : "A fresh worktree has no installed dependencies or ignored files. Set loop.setup to prepare it.";
        out.push(check("verify", "fail", `verify is red in a fresh worktree (exit ${v.exitCode}): ${v.command}`, v.tail ?? "", fix));
      }
    }
  }

  // The main checkout: green in a fresh worktree but red here means the local
  // environment is older than the code (eurassistant, 2026-10-19: the .venv
  // still held the old SDK after the loop's MR changed the lock file). Loop runs
  // push from their own worktree, so it is a warning; the owner's next push fails.
  const rv = f.rootVerify;
  if (rv && pr?.verify?.exitCode === 0) {
    out.push(
      rv.exitCode === 0
        ? check("local-env", "pass", "verify is green in your main checkout too")
        : check(
            "local-env",
            "warn",
            `verify is red in your main checkout (exit ${rv.exitCode}) but green in a fresh worktree`,
            rv.tail ?? "",
            "Your local environment is older than the code, for example dependencies installed from an older lock file, or uncommitted changes. Reinstall the dependencies as loop.setup does, or commit or discard the changes. Your next push fails until then."
          )
    );
  }

  const b = f.beat;
  if (b?.ran) {
    if (b.blocked) out.push(check("beat", "fail", "a sandboxed beat could not run the verify command", b.blocked, "Run `conductor upgrade`; if it persists, the command needs a host or path the sandbox blocks: add it to loop.allowed_domains or loop.setup."));
    else if (b.exitCode !== 0) out.push(check("beat", "fail", `in a sandboxed beat the verify command exits ${b.exitCode}`, b.tail ?? "", "It passes outside the sandbox, so the sandbox blocks something it needs: read the tail and add the host to loop.allowed_domains."));
    else out.push(check("beat", "pass", "a sandboxed beat ran the verify command green"));
  }

  return out;
}

/** The report, one line per check, a fix under each non-pass, and a verdict. */
export function renderDoctor(checks) {
  const lines = ["conductor loop doctor", ""];
  for (const c of checks) {
    lines.push(`  ${ICON[c.level]} ${c.title}`);
    if (c.level !== "pass" && c.detail) lines.push(`      ${c.detail}`);
    if (c.level !== "pass" && c.fix) lines.push(`      fix: ${c.fix}`);
  }
  const fails = checks.filter((c) => c.level === "fail").length;
  const warns = checks.filter((c) => c.level === "warn").length;
  lines.push("");
  if (fails) lines.push(`  ${fails} to fix${warns ? `, ${warns} to check` : ""} before an unattended run.`);
  else if (warns) lines.push(`  Ready for an unattended run, with ${warns} warning${warns === 1 ? "" : "s"} to check.`);
  else lines.push("  Ready for an unattended run.");
  return `${lines.join("\n")}\n`;
}

/** Exit code: 1 when any check fails. */
export function doctorExitCode(checks) {
  return checks.some((c) => c.level === "fail") ? 1 : 0;
}
