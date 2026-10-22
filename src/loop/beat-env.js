// src/loop/beat-env.js
//
// A beat runs with the app's provider API keys set to empty (`loop.blank_env`).
// `loop.setup` usually copies `.env.example`, and its placeholder key sends app
// code down the "provider configured" path. Behind the sandbox's blocked
// network a client then retries until its deadline: 600 s per test on a real
// project. An empty variable in the environment wins over the `.env` file for
// `load_dotenv()` and pydantic-settings, so the app sees no key.
//
// Only the beats get this environment. The driver's verify runs as CI does.
// The engine's own credential is never blanked: the beat would lose its login.

export const DEFAULT_BLANK_ENV = ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ANTHROPIC_API_KEY"];

const ENGINE_KEYS = {
  claude: ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"],
  codex: ["OPENAI_API_KEY", "CODEX_API_KEY"],
  antigravity: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
};

/** The names to blank for this engine: the list without the engine's own credentials. */
export function blankedNames(names, engine) {
  const own = ENGINE_KEYS[engine] ?? [];
  return (names ?? []).filter((n) => !own.includes(n));
}

/** A copy of `base` with each name set to "". A name absent from `base` is set too, so `.env` cannot fill it. */
export function beatEnv(names, base = process.env) {
  const env = { ...base };
  for (const n of names) env[n] = "";
  return env;
}

/** The adapter with `env` passed to every beat. The adapter itself when there is no env. */
export function withBeatEnv(adapter, env) {
  if (!env) return adapter;
  return {
    ...adapter,
    runBeat: (opts) => adapter.runBeat({ ...opts, env }),
    runChecker: (opts) => adapter.runChecker({ ...opts, env }),
  };
}
