/**
 * Abror Harness — Tool Registry
 *
 * Central registry of available tools. Tools are plugins:
 * register them and they become available to the Agent Loop.
 */

import type { Tool, ToolDefinition } from '../core/types.js';

export class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  /** Convert registered tools into OpenAI-style definitions for the LLM */
  toDefinitions(): ToolDefinition[] {
    return this.list().map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  async execute(name: string, args: Record<string, unknown>): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Error: unknown tool "${name}"`;
    }
    try {
      return await tool.execute(args);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return `Error executing tool "${name}": ${message}`;
    }
  }
}
