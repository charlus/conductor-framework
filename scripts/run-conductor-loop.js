#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execAsync = promisify(exec);

async function runBeat() {
  const statePath = path.resolve('conductor/1-workbench/loop-state.json');
  
  try {
    const rawState = await fs.readFile(statePath, 'utf8');
    const state = JSON.parse(rawState);
    
    if (state.status === 'completed' || state.status === 'stalled') {
      console.log(`[CONDUCUTOR LOOP] Terminal status reached: ${state.status}. Exiting.`);
      process.exit(0);
    }
    
    console.log(`[CONDUCUTOR LOOP] Starting beat iteration ${state.iterations.current + 1}...`);
    
    // Command that invokes the host agent to execute the unattended-loop workflow
    const { stdout, stderr } = await execAsync('antigravity run workflows/unattended-loop.md');
    console.log(stdout);
    if (stderr) console.error(stderr);
    
  } catch (error) {
    console.error(`[CONDUCUTOR LOOP ERROR] Failed running loop beat: ${error.message}`);
    process.exit(1);
  }
}

runBeat();
