// `conductor survey` — the facts about an inherited codebase (F15).
//
// Genesis assumes a blank page. A product owner who has just inherited a
// running product has the opposite problem: the code is the only honest
// record of what it does, and nobody left to ask. There was no path from
// code to `conductor/`.
//
// Split on purpose, and the split is the point: a SCRIPT collects facts
// exhaustively and an AGENT judges them. Everything here is the script half,
// so it is deterministic, testable, and cannot flatter itself. The workflow
// reads what this prints; it never asks the model what it remembers seeing.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  classifyFile,
  coverageByArea,
  extractEnvKeys,
  findRoutes,
  findEntryPoints,
  renderSurvey,
} from "../src/survey.js";

describe("F15 — file classification", () => {
  test("tests are recognised across the languages we already gate", () => {
    for (const p of [
      "test/thing.test.js",
      "src/thing.spec.ts",
      "tests/test_thing.py",
      "internal/thing_test.go",
      "spec/models/user_spec.rb",
      "src/__tests__/x.js",
    ]) {
      assert.equal(classifyFile(p).kind, "test", `${p} should be a test`);
    }
  });

  test("source is source, and config is not counted as source", () => {
    assert.equal(classifyFile("src/app.js").kind, "source");
    assert.equal(classifyFile("lib/handler.py").kind, "source");
    assert.equal(classifyFile("package.json").kind, "config");
    assert.equal(classifyFile("tsconfig.json").kind, "config");
    assert.equal(classifyFile("README.md").kind, "doc");
    assert.equal(classifyFile("assets/logo.png").kind, "other");
  });

  test("vendored and generated trees are excluded, not classified", () => {
    // A node_modules with 40k files would drown every count in the report.
    for (const p of [
      "node_modules/x/index.js",
      "vendor/lib.go",
      "dist/bundle.js",
      "build/out.js",
      ".git/config",
      "coverage/lcov.info",
      "__pycache__/x.pyc",
      // A git worktree is a second full checkout of the same repo. Walking
      // into it doubles every file and lets the copy shadow the original —
      // which is exactly what happened on this repo's own .claude/worktrees.
      ".claude/worktrees/some-branch/src/view/markdown.js",
      "some/nested/.worktrees/x/src/a.js",
    ]) {
      assert.equal(classifyFile(p).kind, "excluded", `${p} should be excluded`);
    }
  });
});

describe("F15 — the risk map", () => {
  // The single most useful fact for a PO inheriting a product: which parts of
  // it nobody has ever tested. Not a quality score — a place to look.
  test("counts source and tests per top-level area", () => {
    const areas = coverageByArea([
      "src/auth/login.js",
      "src/auth/token.js",
      "src/auth/login.test.js",
      "src/billing/invoice.js",
      "src/billing/charge.js",
      "src/billing/refund.js",
      "README.md",
    ]);
    const auth = areas.find((a) => a.area === "src/auth");
    const billing = areas.find((a) => a.area === "src/billing");
    assert.equal(auth.source, 2);
    assert.equal(auth.tests, 1);
    assert.equal(billing.source, 3);
    assert.equal(billing.tests, 0);
  });

  test("untested areas sort first — that is what the reader came for", () => {
    const areas = coverageByArea([
      "src/covered/a.js",
      "src/covered/a.test.js",
      "src/bare/b.js",
      "src/bare/c.js",
    ]);
    assert.equal(areas[0].area, "src/bare");
    assert.equal(areas[0].tests, 0);
  });

  test("a CENTRAL tests/ tree is attributed back to the source it covers", () => {
    // Found on a real repo, not by a fixture: ECC keeps 320 tests under
    // tests/ rather than beside the source, so prefix grouping reported
    // every source area as untested — a false alarm in the one section the
    // reader is told to look at first.
    const areas = coverageByArea([
      "scripts/lib/hooks-config.js",
      "scripts/lib/catalog.js",
      "scripts/hooks/gateguard.js",
      "tests/lib/hooks-config.test.js",
      "tests/hooks/gateguard.test.js",
    ]);
    const lib = areas.find((a) => a.area === "scripts/lib");
    const hooks = areas.find((a) => a.area === "scripts/hooks");
    assert.equal(lib.tests, 1, "tests/lib/hooks-config.test.js covers scripts/lib");
    assert.equal(hooks.tests, 1);
    assert.ok(!areas.some((a) => a.area.startsWith("tests")), "the test tree is not its own area");
    // catalog.js is genuinely uncovered and must still show up.
    assert.equal(lib.source, 2);
  });

  test("a prefixed test name still finds its source", () => {
    // Conductor's own convention is `test/loop-driver.test.js` for
    // `src/loop/driver.js`. Exact stem matching missed every one of them and
    // reported src/loop — 18 files, heavily tested — as untested.
    const areas = coverageByArea([
      "src/loop/driver.js",
      "src/loop/swarm.js",
      "src/view/markdown.js",
      "test/loop-driver.test.js",
      "test/loop-swarm.test.js",
      "test/view-markdown.test.js",
    ]);
    assert.equal(areas.find((a) => a.area === "src/loop").tests, 2);
    assert.equal(areas.find((a) => a.area === "src/view").tests, 1);
  });

  test("an ambiguous filename is resolved by path, not by walk order", () => {
    // index.js, utils.js and render.js exist many times in a real repo. With
    // "first stem wins" the winner was whichever readdir happened to reach
    // first, so a test could be credited to a completely unrelated area.
    const areas = coverageByArea([
      "src/view/render.js",
      "src/report/render.js",
      "src/view/render.test.js",
    ]);
    assert.equal(areas.find((a) => a.area === "src/view").tests, 1);
    assert.equal(areas.find((a) => a.area === "src/report").tests, 0);
  });

  test("what a test IMPORTS beats what it is named", () => {
    // The naming heuristic cannot resolve a real collision: this repo has
    // BOTH src/commands/evidence.js and src/evidence/, so the name
    // "evidence.test.js" is genuinely ambiguous. What the file imports is
    // not — it is a fact, and facts beat guesses here as everywhere else.
    const areas = coverageByArea(
      [
        "src/commands/evidence.js",
        "src/evidence/ledger.js",
        "src/evidence/wtree.js",
        "test/evidence.test.js",
      ],
      { importsByTest: { "test/evidence.test.js": ["src/evidence/ledger.js"] } },
    );
    assert.equal(areas.find((a) => a.area === "src/evidence").tests, 1);
    assert.equal(areas.find((a) => a.area === "src/commands").tests, 0);
  });

  test("a test with no resolvable imports still falls back to the name", () => {
    const areas = coverageByArea(
      ["src/alpha/thing.js", "test/thing.test.js"],
      { importsByTest: { "test/thing.test.js": [] } },
    );
    assert.equal(areas.find((a) => a.area === "src/alpha").tests, 1);
  });

  test("a test named after a module DIRECTORY credits that directory", () => {
    // test/evidence.test.js covers src/evidence/{wtree,ledger}.js — no single
    // source file is named "evidence", but the area is.
    const areas = coverageByArea([
      "src/evidence/wtree.js",
      "src/evidence/ledger.js",
      "test/evidence.test.js",
    ]);
    assert.equal(areas.find((a) => a.area === "src/evidence").tests, 1);
  });

  test("the directory fallback works for EVERY test, not just the first", () => {
    // One test file is not a sample. The first version passed this section
    // with a single case while being broken for every case after it.
    const areas = coverageByArea([
      "src/evidence/wtree.js",
      "src/review/canvas.js",
      "src/survey/scan.js",
      "test/evidence.test.js",
      "test/review.test.js",
      "test/survey.test.js",
    ]);
    for (const name of ["src/evidence", "src/review", "src/survey"]) {
      assert.equal(areas.find((a) => a.area === name).tests, 1, `${name} lost its test`);
    }
  });

  test("an ambiguous stem with no path signal is not guessed", () => {
    const areas = coverageByArea([
      "src/alpha/index.js",
      "src/beta/index.js",
      "test/index.test.js",
    ]);
    assert.equal(
      areas.reduce((n, a) => n + a.tests, 0),
      0,
      "a coin-flip attribution is worse than none",
    );
  });

  test("a stem that matches nothing is not force-fitted to a source", () => {
    const areas = coverageByArea(["src/alpha/thing.js", "test/completely-unrelated.test.js"]);
    assert.equal(areas.find((a) => a.area === "src/alpha").tests, 0);
  });

  test("a test that names no known source still counts somewhere", () => {
    const areas = coverageByArea(["src/a.js", "test/orphan.test.js"]);
    assert.equal(areas.length, 1, "an orphan test must not invent an area");
    assert.equal(areas[0].area, "src");
  });

  test("an area with no source is not reported as untested", () => {
    // A docs or fixtures folder has nothing to test; listing it as a risk
    // is noise, and noise is how a risk report gets skimmed.
    const areas = coverageByArea(["docs/a.md", "docs/b.md"]);
    assert.deepEqual(areas, []);
  });
});

describe("F15 — the configuration surface", () => {
  test("env keys are read from the example file, never from a real .env", () => {
    const keys = extractEnvKeys(
      "# comment\nDATABASE_URL=postgres://localhost/x\n\nSTRIPE_KEY=sk_test_abc\nexport API_HOST=localhost\nBROKEN LINE\n",
    );
    assert.deepEqual(keys, ["API_HOST", "DATABASE_URL", "STRIPE_KEY"]);
  });

  test("values are discarded, only names survive", () => {
    // A survey is committed to conductor/. Carrying values across would put
    // whatever someone left in .env.example into the knowledge base.
    const keys = extractEnvKeys("SECRET=hunter2\n");
    assert.deepEqual(keys, ["SECRET"]);
    assert.ok(!JSON.stringify(keys).includes("hunter2"));
  });
});

describe("F15 — the surfaces the product exposes", () => {
  test("finds express/fastify style routes", () => {
    const routes = findRoutes(
      `app.get("/health", h);\nrouter.post('/api/users', create);\napp.delete(\`/api/users/:id\`, rm);\n`,
      "js",
    );
    assert.deepEqual(routes.sort(), ["DELETE /api/users/:id", "GET /health", "POST /api/users"]);
  });

  test("finds flask/fastapi decorators", () => {
    const routes = findRoutes(
      '@app.get("/items")\ndef items(): pass\n@router.post("/items/{id}")\ndef add(): pass\n',
      "py",
    );
    assert.deepEqual(routes.sort(), ["GET /items", "POST /items/{id}"]);
  });

  test("a mention in a comment or a string is not a route", () => {
    assert.deepEqual(findRoutes('// app.get("/old", h) — removed\n', "js"), []);
    assert.deepEqual(findRoutes('const doc = "app.get(/x)";\n', "js"), []);
  });

  test("entry points come from the manifest, not from guessing", () => {
    const entries = findEntryPoints({
      "package.json": JSON.stringify({
        main: "src/index.js",
        bin: { mytool: "bin/cli.js" },
        scripts: { start: "node server.js", test: "vitest" },
      }),
    });
    assert.ok(entries.includes("src/index.js"));
    assert.ok(entries.includes("bin/cli.js"));
    assert.ok(entries.some((e) => e.includes("server.js")));
    assert.ok(!entries.some((e) => e.includes("vitest")), "test script is not an entry point");
  });

  test("a manifest that is not JSON does not take the survey down", () => {
    assert.deepEqual(findEntryPoints({ "package.json": "{oops" }), []);
    assert.deepEqual(findEntryPoints({}), []);
  });
});

describe("F15 — the report", () => {
  const facts = {
    root: "/p/app",
    fileCount: 42,
    languages: [{ lang: "js", files: 30 }, { lang: "py", files: 5 }],
    areas: [
      { area: "src/billing", source: 3, tests: 0 },
      { area: "src/auth", source: 2, tests: 1 },
    ],
    entryPoints: ["src/index.js"],
    routes: ["GET /health", "POST /api/users"],
    envKeys: ["DATABASE_URL"],
    dependencies: { runtime: ["express"], dev: ["vitest"] },
  };

  test("leads with what is untested", () => {
    const md = renderSurvey(facts);
    const untestedAt = md.indexOf("src/billing");
    const routesAt = md.indexOf("GET /health");
    assert.ok(untestedAt !== -1 && routesAt !== -1);
    assert.ok(untestedAt < routesAt, "the risk map must come before the inventory");
  });

  test("says what it could not determine, rather than omitting it", () => {
    // A survey that silently drops an empty section reads as "there are no
    // routes" when it means "I did not find any". Those are different.
    const md = renderSurvey({ ...facts, routes: [], envKeys: [] });
    assert.match(md, /none found/i);
  });

  test("is honest that it is facts, not understanding", () => {
    const md = renderSurvey(facts);
    assert.match(md, /what it is for|why|interview|human/i);
  });
});
