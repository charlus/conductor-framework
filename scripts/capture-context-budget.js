#!/usr/bin/env node
// Capture the current context bill as the committed budget fixture.
//
// RATCHET PROTOCOL — on a failing context-budget test:
//   1. Real, intended growth  → run this, and commit the refreshed fixture in
//      the SAME commit as the growth, so it shows up as a decision in the diff.
//   2. Accidental bloat (a duplicated block, a rule that should be on-demand,
//      a skill body that leaked into frontmatter) → fix the bloat instead.
//   3. After a reduction lands → run this so the ceilings ratchet DOWN and the
//      win is locked against regression.
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildBill, captureBudget, renderBill } from "../src/context-bill.js";

const root = new URL("..", import.meta.url).pathname;
const bill = await buildBill(join(root, "templates", ".agents"));
const fixture = join(root, "test", "fixtures", "context-budget.json");
await writeFile(fixture, `${JSON.stringify(captureBudget(bill), null, 2)}\n`);
console.log(renderBill(bill));
console.log(`\nWrote ${fixture}`);
