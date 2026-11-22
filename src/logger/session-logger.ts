/**
 * Abror Harness — Session Logger
 *
 * Records every step of the agent (thoughts, tool calls, results)
 * into memory and optionally to disk. Fully driven by the Event Bus.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { EventBus } from '../core/event-bus.js';
import type { HarnessEvent, LogEntry } from '../core/types.js';

export class SessionLogger {
  private entries = new Map<string, LogEntry[]>();
  private persistDir: string | null;

  constructor(
    private bus: EventBus,
    options: { persistDir?: string } = {}
  ) {
    this.persistDir = options.persistDir ?? null;
    this.wire();
  }

  private wire(): void {
    this.bus.onAny(async (event) => {
      if (!('sessionId' in event) || !event.sessionId) return;

      const entry = this.toEntry(event);
      if (!entry) return;

      const list = this.entries.get(event.sessionId) ?? [];
      list.push(entry);
      this.entries.set(event.sessionId, list);

      // Also re-emit as logger:entry so other plugins can react
      await this.bus.emit({
        type: 'logger:entry',
        sessionId: event.sessionId,
        entry,
      });
    });

    this.bus.on('session:end', async (e) => {
      if (this.persistDir) {
        await this.flush(e.sessionId);
      }
    });
  }

  private toEntry(event: HarnessEvent): LogEntry | null {
    const ts = new Date().toISOString();

    switch (event.type) {
      case 'session:start':
        return { timestamp: ts, type: 'info', content: { task: event.task } };
      case 'agent:think':
        return { timestamp: ts, type: 'thought', content: event.thought };
      case 'agent:tool_call':
        return { timestamp: ts, type: 'tool_call', content: event.toolCall };
      case 'agent:tool_result':
        return { timestamp: ts, type: 'tool_result', content: event.result };
      case 'agent:message':
        return { timestamp: ts, type: 'message', content: event.message };
      case 'error':
        return {
          timestamp: ts,
          type: 'error',
          content: typeof event.error === 'string' ? event.error : event.error.message,
        };
      default:
        return null;
    }
  }

  getEntries(sessionId: string): LogEntry[] {
    return this.entries.get(sessionId) ?? [];
  }

  async flush(sessionId: string): Promise<void> {
    if (!this.persistDir) return;
    await mkdir(this.persistDir, { recursive: true });
    const path = join(this.persistDir, `${sessionId}.json`);
    const data = this.entries.get(sessionId) ?? [];
    await writeFile(path, JSON.stringify(data, null, 2), 'utf-8');
  }
}
