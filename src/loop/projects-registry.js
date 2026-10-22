// src/loop/projects-registry.js
//
// The watch tower (A4a, 2026-10-21): the products the loop works on, on this
// machine, so `conductor watch --all` can show them on one screen. Machine
// state, never in a repository: `~/.config/conductor/loop-projects.json`, or
// `$CONDUCTOR_HOME/loop-projects.json`. `conductor loop on` adds a product.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

export function registryPath(env = process.env) {
  return join(env.CONDUCTOR_HOME || join(homedir(), ".config", "conductor"), "loop-projects.json");
}

/** The registered product folders, in the order they were added. Never throws. */
export async function listLoopProjects(env = process.env) {
  try {
    const d = JSON.parse(await readFile(registryPath(env), "utf8"));
    return Array.isArray(d.projects) ? d.projects.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

/** Add a product folder (absolute), once. */
export async function addLoopProject(dir, env = process.env) {
  const abs = resolve(dir);
  const list = await listLoopProjects(env);
  if (list.includes(abs)) return false;
  await mkdir(join(registryPath(env), ".."), { recursive: true });
  await writeFile(registryPath(env), `${JSON.stringify({ projects: [...list, abs] }, null, 2)}\n`, "utf8");
  return true;
}
