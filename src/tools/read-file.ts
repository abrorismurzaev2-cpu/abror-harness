/**
 * Tool: read_file
 * Safely reads a file from the local filesystem (with basic path guards).
 */

import { readFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import type { Tool } from '../core/types.js';

const WORKDIR = process.cwd();

export const readFileTool: Tool = {
  name: 'read_file',
  description:
    'Read the contents of a text file. Path is relative to the current working directory. Returns the file content as a string.',
  parameters: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file (e.g. "src/index.ts" or "package.json")',
      },
    },
    required: ['path'],
  },

  async execute(args: Record<string, unknown>): Promise<string> {
    const pathArg = String(args.path ?? '');
    if (!pathArg) {
      return 'Error: path is required';
    }

    // Prevent path traversal outside the working directory
    const abs = isAbsolute(pathArg) ? pathArg : resolve(WORKDIR, pathArg);
    const rel = relative(WORKDIR, abs);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      return `Error: access denied — path is outside the working directory`;
    }

    try {
      const content = await readFile(abs, 'utf-8');
      // Soft limit to avoid blowing up context
      if (content.length > 32_000) {
        return content.slice(0, 32_000) + '\n\n... [truncated, file too large]';
      }
      return content;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `Error reading file: ${msg}`;
    }
  },
};
