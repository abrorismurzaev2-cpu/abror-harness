/**
 * Tool: execute_bash
 * Runs a shell command in a controlled way (no interactive TTY, timeout).
 * WARNING: This is powerful — use only in trusted environments.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { Tool } from '../core/types.js';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_OUTPUT = 16_000;

export const executeBashTool: Tool = {
  name: 'execute_bash',
  description:
    'Execute a bash command and return its stdout/stderr. Use for simple shell operations (ls, cat, node, npm, git status, etc.). Avoid long-running or interactive commands.',
  parameters: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to run (e.g. "ls -la", "cat package.json")',
      },
      timeout_ms: {
        type: 'number',
        description: `Optional timeout in milliseconds (default ${DEFAULT_TIMEOUT_MS})`,
      },
    },
    required: ['command'],
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const command = String(args.command ?? '').trim();
    if (!command) {
      return 'Error: command is required';
    }

    // Basic deny-list for the MVP (can be made configurable later)
    const forbidden = [/rm\s+-rf\s+[\/~]/i, /mkfs/i, /dd\s+if=/i, /:\(\)\s*\{/];
    if (forbidden.some((re) => re.test(command))) {
      return 'Error: command blocked by safety filter';
    }

    const timeout = Number(args.timeout_ms) || DEFAULT_TIMEOUT_MS;

    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      let out = '';
      if (stdout) out += stdout;
      if (stderr) out += (out ? '\n--- stderr ---\n' : '') + stderr;

      if (out.length > MAX_OUTPUT) {
        out = out.slice(0, MAX_OUTPUT) + '\n\n... [truncated]';
      }

      return out || '(no output)';
    } catch (err: any) {
      if (err.killed) {
        return `Error: command timed out after ${timeout}ms`;
      }
      const msg = err.stderr || err.message || String(err);
      return `Error: ${msg}`.slice(0, MAX_OUTPUT);
    }
  },
};
