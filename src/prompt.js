import readline from 'readline';
import { resolveBundles, getBundleChoices } from './bundles.js';

// ── ANSI escape sequences ──────────────────────────────────────────────────────
const ANSI = {
    HIDE_CURSOR: '\x1b[?25l',
    SHOW_CURSOR: '\x1b[?25h',
    CLEAR_LINE: '\x1b[2K',
    MOVE_UP: (n) => `\x1b[${n}A`,
    MOVE_COL1: '\r',
};

// ── Color helpers ──────────────────────────────────────────────────────────────
const C = {
    green: (s) => `\x1b[32m${s}\x1b[0m`,
    yellow: (s) => `\x1b[33m${s}\x1b[0m`,
    cyan: (s) => `\x1b[36m${s}\x1b[0m`,
    red: (s) => `\x1b[31m${s}\x1b[0m`,
    dim: (s) => `\x1b[2m${s}\x1b[0m`,
    bold: (s) => `\x1b[1m${s}\x1b[0m`,
    magenta: (s) => `\x1b[35m${s}\x1b[0m`,
    inverse: (s) => `\x1b[7m${s}\x1b[0m`,
};

// ── Pure state functions (testable without TTY) ────────────────────────────────

/**
 * Create the internal checklist state from registry items.
 * @param {Array<{name:string, description:string, default:boolean, category?:string}>} items
 * @param {string[]} [previousSelections] - If provided, pre-check these items instead of using defaults.
 * @returns {{cursor:number, items:Array<{name:string, description:string, category:string, selected:boolean}>}}
 */
function createChecklistState(items, previousSelections) {
    const hasPrevious = Array.isArray(previousSelections);
    return {
        cursor: 0,
        items: items.map((item) => ({
            name: item.name,
            description: item.description,
            category: item.category || '',
            selected: hasPrevious ? previousSelections.includes(item.name) : !!item.default,
        })),
    };
}

/**
 * Move the cursor up or down, wrapping around.
 * @param {{cursor:number, items:Array}} state
 * @param {number} delta  -1 for up, +1 for down
 */
function moveCursor(state, delta) {
    const len = state.items.length;
    if (len === 0) return;
    state.cursor = ((state.cursor + delta) % len + len) % len;
}

/**
 * Toggle the selected state of the item at the cursor.
 * @param {{cursor:number, items:Array<{selected:boolean}>}} state
 */
function toggleItem(state) {
    if (state.items.length === 0) return;
    state.items[state.cursor].selected = !state.items[state.cursor].selected;
}

/**
 * Return the names of all selected items.
 * @param {{items:Array<{name:string, selected:boolean}>}} state
 * @returns {string[]}
 */
function getSelected(state) {
    return state.items.filter((i) => i.selected).map((i) => i.name);
}

// ── Rendering ──────────────────────────────────────────────────────────────────

/**
 * Render the checklist to an output stream and return the number of lines written.
 * If `previousLines > 0`, moves the cursor up first to overwrite the previous render.
 *
 * @param {string} title
 * @param {{cursor:number, items:Array}} state
 * @param {NodeJS.WritableStream} output
 * @param {number} previousLines - Number of lines from the previous render to overwrite
 * @returns {number} Total lines rendered
 */
function renderChecklist(title, state, output, previousLines) {
    // Move cursor up to overwrite previous render
    if (previousLines > 0) {
        output.write(ANSI.MOVE_UP(previousLines));
        output.write(ANSI.MOVE_COL1);
    }

    const lines = [];
    lines.push('');
    lines.push(C.bold(C.cyan(title)));

    for (let i = 0; i < state.items.length; i++) {
        const item = state.items[i];
        const isCursor = i === state.cursor;
        const checkbox = item.selected ? C.green('◉') : '○';
        const pointer = isCursor ? C.cyan('❯') : ' ';
        const name = isCursor ? C.bold(C.cyan(item.name)) : C.bold(item.name);
        const desc = C.dim(`— ${item.description}`);
        const tag = item.category ? C.magenta(` (${item.category})`) : '';
        lines.push(`  ${pointer} ${checkbox} ${name}${tag}  ${desc}`);
    }

    lines.push('');
    lines.push(C.dim('  ↑/↓ navigate  ·  space toggle  ·  enter confirm'));

    for (const line of lines) {
        output.write(ANSI.CLEAR_LINE + line + '\n');
    }

    return lines.length;
}

/**
 * Render a single-select (radio) list and return the number of lines written.
 * Only the item at `state.cursor` is shown as selected (filled circle).
 *
 * @param {string} title
 * @param {{cursor:number, items:Array}} state
 * @param {NodeJS.WritableStream} output
 * @param {number} previousLines
 * @returns {number} Total lines rendered
 */
function renderRadioList(title, state, output, previousLines) {
    if (previousLines > 0) {
        output.write(ANSI.MOVE_UP(previousLines));
        output.write(ANSI.MOVE_COL1);
    }

    const lines = [];
    lines.push('');
    lines.push(C.bold(C.cyan(title)));

    for (let i = 0; i < state.items.length; i++) {
        const item = state.items[i];
        const isCursor = i === state.cursor;
        const radio = isCursor ? C.green('◉') : '○';
        const pointer = isCursor ? C.cyan('❯') : ' ';
        const name = isCursor ? C.bold(C.cyan(item.name)) : C.bold(item.name);
        const desc = C.dim(`— ${item.description}`);
        lines.push(`  ${pointer} ${radio} ${name}  ${desc}`);
    }

    lines.push('');
    lines.push(C.dim('  ↑/↓ navigate  ·  enter select'));

    for (const line of lines) {
        output.write(ANSI.CLEAR_LINE + line + '\n');
    }

    return lines.length;
}

// ── Interactive prompt (arrow keys + space + enter) ────────────────────────────

/**
 * Run an interactive arrow-key checklist for a single section.
 *
 * - ↑/↓ to navigate
 * - Space to toggle
 * - Enter to confirm
 *
 * @param {string} title
 * @param {Array<{name:string, description:string, default:boolean, category?:string}>} items
 * @param {Object} [options]
 * @param {NodeJS.ReadableStream} [options.input]
 * @param {NodeJS.WritableStream} [options.output]
 * @param {string[]} [options.previousSelections] - Pre-check these items instead of defaults.
 * @returns {Promise<string[]>} Array of selected item names
 */
function promptChecklist(title, items, options) {
    const input = (options && options.input) || process.stdin;
    const output = (options && options.output) || process.stdout;
    const previousSelections = options && options.previousSelections;

    return new Promise((resolve) => {
        const state = createChecklistState(items, previousSelections);
        let lineCount = 0;

        // Hide cursor for clean rendering
        output.write(ANSI.HIDE_CURSOR);

        // Enable raw mode for keystroke capture (TTY only)
        const isTTY = typeof input.setRawMode === 'function';
        if (isTTY) input.setRawMode(true);
        readline.emitKeypressEvents(input);
        input.resume();

        // Initial render
        lineCount = renderChecklist(title, state, output, 0);

        function onKeypress(_ch, key) {
            if (!key) return;

            if (key.name === 'up') {
                moveCursor(state, -1);
                lineCount = renderChecklist(title, state, output, lineCount);
            } else if (key.name === 'down') {
                moveCursor(state, 1);
                lineCount = renderChecklist(title, state, output, lineCount);
            } else if (key.name === 'space') {
                toggleItem(state);
                lineCount = renderChecklist(title, state, output, lineCount);
            } else if (key.name === 'return') {
                cleanup();
                output.write('\n');
                output.write(ANSI.SHOW_CURSOR);
                resolve(getSelected(state));
            } else if (key.ctrl && key.name === 'c') {
                cleanup();
                output.write(ANSI.SHOW_CURSOR);
                output.write('\n');
                process.exit(0);
            }
        }

        function cleanup() {
            input.removeListener('keypress', onKeypress);
            if (isTTY) input.setRawMode(false);
            input.pause();
        }

        input.on('keypress', onKeypress);
    });
}

// ── Summary & confirm ──────────────────────────────────────────────────────────

/**
 * Print a summary of what will be installed.
 * @param {Object} selections
 * @param {string[]} selections.skills
 * @param {string[]} selections.rules
 * @param {string[]} selections.workflows
 */
function renderSummary(selections) {
    console.log('');
    console.log(C.bold('📦 Installation Summary:'));
    console.log(`   ${C.cyan('Skills:')}    ${selections.skills.length} selected ${C.dim('(' + selections.skills.join(', ') + ')')}`);
    console.log(`   ${C.cyan('Rules:')}     ${selections.rules.length} selected ${C.dim('(' + selections.rules.join(', ') + ')')}`);
    console.log(`   ${C.cyan('Workflows:')} ${selections.workflows.length} selected ${C.dim('(' + selections.workflows.join(', ') + ')')}`);
    console.log('');
}

/**
 * Ask a yes/no confirmation question using standard readline.
 * @param {readline.Interface} rl
 * @param {string} question
 * @returns {Promise<boolean>}
 */
function confirm(rl, question) {
    return new Promise((resolve) => {
        rl.question(C.yellow(`${question} (Y/n): `), (answer) => {
            const a = answer.trim().toLowerCase();
            resolve(a === '' || a === 'y' || a === 'yes');
        });
    });
}

// ── Install Mode (single-select: bundle vs manual) ────────────────────────────

/**
 * The two installation mode choices.
 * @type {Array<{name:string, description:string}>}
 */
const INSTALL_MODES = [
    { name: 'bundle',  description: 'Install a curated bundle (recommended)' },
    { name: 'manual',  description: 'Pick individual skills, rules & workflows' },
];

/**
 * Prompt the user to choose between bundle and manual installation.
 * Uses a single-select (radio) UI — cursor position = selected item.
 *
 * @param {Object} [options]
 * @param {NodeJS.ReadableStream} [options.input]
 * @param {NodeJS.WritableStream} [options.output]
 * @returns {Promise<string>} 'bundle' or 'manual'
 */
function promptInstallMode(options) {
    const input = (options && options.input) || process.stdin;
    const output = (options && options.output) || process.stdout;

    return new Promise((resolve) => {
        const state = { cursor: 0, items: INSTALL_MODES.map((m) => ({ ...m })) };
        let lineCount = 0;

        output.write(ANSI.HIDE_CURSOR);

        const isTTY = typeof input.setRawMode === 'function';
        if (isTTY) input.setRawMode(true);
        readline.emitKeypressEvents(input);
        input.resume();

        lineCount = renderRadioList('⚙  Installation mode:', state, output, 0);

        function onKeypress(_ch, key) {
            if (!key) return;

            if (key.name === 'up') {
                moveCursor(state, -1);
                lineCount = renderRadioList('⚙  Installation mode:', state, output, lineCount);
            } else if (key.name === 'down') {
                moveCursor(state, 1);
                lineCount = renderRadioList('⚙  Installation mode:', state, output, lineCount);
            } else if (key.name === 'return') {
                cleanup();
                output.write('\n');
                output.write(ANSI.SHOW_CURSOR);
                resolve(state.items[state.cursor].name);
            } else if (key.ctrl && key.name === 'c') {
                cleanup();
                output.write(ANSI.SHOW_CURSOR);
                output.write('\n');
                process.exit(0);
            }
        }

        function cleanup() {
            input.removeListener('keypress', onKeypress);
            if (isTTY) input.setRawMode(false);
            input.pause();
        }

        input.on('keypress', onKeypress);
    });
}

/**
 * Run the full interactive setup flow.
 *
 * Flow:
 *   1. Choose installation mode (bundle vs manual)
 *   2a. Bundle → select bundles → resolve → summary → confirm
 *   2b. Manual → select skills → rules → workflows → summary → confirm
 *
 * @param {Object} registry - Parsed registry.json
 * @param {Object} [options]
 * @param {NodeJS.ReadableStream} [options.input]
 * @param {NodeJS.WritableStream} [options.output]
 * @param {{skills:string[], rules:string[], workflows:string[]}} [options.previousSelections]
 *        If provided, pre-checks previously installed items (reconfigure mode).
 * @returns {Promise<{skills: string[], rules: string[], workflows: string[]} | null>}
 */
async function runInteractiveSetup(registry, options) {
    const input = (options && options.input) || process.stdin;
    const output = (options && options.output) || process.stdout;
    const prev = options && options.previousSelections;

    console.log('');
    if (prev) {
        console.log(C.bold('🔧 Agentic-Dev — Reconfigure'));
        console.log(C.dim('   Your current selections are pre-checked. Toggle to add/remove.\n'));
    } else {
        console.log(C.bold('🚀 Agentic-Dev Interactive Setup'));
        console.log(C.dim('   Select which skills, rules, and workflows to install.\n'));
    }

    // Step 1: Choose installation mode
    const mode = await promptInstallMode({ input, output });

    let selections;

    if (mode === 'bundle') {
        // ── Bundle path ────────────────────────────────────────────────────
        const bundleChoices = getBundleChoices(registry);

        if (bundleChoices.length === 0) {
            console.log(C.yellow('No bundles defined in registry. Falling back to manual mode.\n'));
            const manual = await runManualSetup(registry, { input, output, prev });
            if (!manual) return null;
            return { ...manual, bundles: prev ? (prev.bundles || []) : [] };
        }

        const bundleNames = await promptChecklist('📦 Select Bundles:', bundleChoices, { 
            input, 
            output,
            previousSelections: prev && prev.bundles
        });

        if (bundleNames.length === 0) {
            console.log(C.yellow('No bundles selected. Falling back to manual mode.\n'));
            const manual = await runManualSetup(registry, { input, output, prev });
            if (!manual) return null;
            return { ...manual, bundles: prev ? (prev.bundles || []) : [] };
        }

        // Resolve bundles into concrete selections
        const resolvedNew = resolveBundles(bundleNames, registry);

        if (prev) {
            // Find "Manual Additions" (items in prev that were NOT provided by prev bundles)
            const resolvedOld = resolveBundles(prev.bundles || [], registry);
            
            const manualSkills = (prev.skills || []).filter(s => !resolvedOld.skills.includes(s));
            const manualRules = (prev.rules || []).filter(r => !resolvedOld.rules.includes(r));
            const manualWorkflows = (prev.workflows || []).filter(w => !resolvedOld.workflows.includes(w));

            selections = {
                skills: [...new Set([...resolvedNew.skills, ...manualSkills])],
                rules: [...new Set([...resolvedNew.rules, ...manualRules])],
                workflows: [...new Set([...resolvedNew.workflows, ...manualWorkflows])],
                bundles: bundleNames
            };
        } else {
            selections = { ...resolvedNew, bundles: bundleNames };
        }
    } else {
        // ── Manual path ────────────────────────────────────────────────────
        const manual = await runManualSetup(registry, { input, output, prev });
        if (!manual) return null;
        selections = {
            ...manual,
            bundles: prev ? (prev.bundles || []) : [] // Preserve bundle metadata if reconfiguring
        };
    }

    renderSummary(selections);

    // For the Y/n confirm, use standard readline (not raw mode)
    const rl = readline.createInterface({ input, output, terminal: input.isTTY !== false });
    try {
        const proceed = await confirm(rl, 'Proceed with installation?');
        if (!proceed) {
            console.log(C.yellow('\n⊘ Installation cancelled.'));
            return null;
        }
        return selections;
    } finally {
        rl.close();
    }
}

/**
 * Run the manual selection flow (skills → rules → workflows).
 * Extracted to allow both direct and fallback calls.
 *
 * @param {Object} registry
 * @param {Object} opts
 * @param {NodeJS.ReadableStream} opts.input
 * @param {NodeJS.WritableStream} opts.output
 * @param {{skills:string[], rules:string[], workflows:string[]}|null} opts.prev
 * @returns {Promise<{skills: string[], rules: string[], workflows: string[]}>}
 */
async function runManualSetup(registry, opts) {
    const { input, output, prev } = opts;

    const skillOpts = { input, output, previousSelections: prev && prev.skills };
    const ruleOpts = { input, output, previousSelections: prev && prev.rules };
    const wfOpts = { input, output, previousSelections: prev && prev.workflows };

    const skills = await promptChecklist('🧩 Select Skills:', registry.skills, skillOpts);
    const rules = await promptChecklist('📏 Select Rules:', registry.rules, ruleOpts);
    const workflows = await promptChecklist('🔄 Select Workflows:', registry.workflows, wfOpts);

    return { skills, rules, workflows };
}

export { 
    // Pure state functions (for testing)
    createChecklistState,
    moveCursor,
    toggleItem,
    getSelected,
    // Rendering
    renderChecklist,
    renderRadioList,
    // Interactive
    promptChecklist,
    promptInstallMode,
    renderSummary,
    confirm,
    runInteractiveSetup,
    runManualSetup,
    // Constants (for testing)
    INSTALL_MODES,
 };
