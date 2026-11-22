/**
 * Abror Harness — Event Bus (Core)
 *
 * Lightweight typed pub/sub that decouples all modules.
 * Inspired by Cordis services/events and AutoGen actor messaging.
 *
 * Usage:
 *   bus.on('agent:tool_call', (e) => console.log(e.toolCall));
 *   bus.emit({ type: 'agent:tool_call', sessionId, toolCall });
 */

import type { HarnessEvent } from './types.js';

type EventHandler<T extends HarnessEvent = HarnessEvent> = (event: T) => void | Promise<void>;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();

  /**
   * Subscribe to a specific event type.
   * Returns an unsubscribe function.
   */
  on<T extends HarnessEvent['type']>(
    type: T,
    handler: EventHandler<Extract<HarnessEvent, { type: T }>>
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler);
    };
  }

  /**
   * Subscribe to every event (useful for loggers / tracers).
   */
  onAny(handler: EventHandler): () => void {
    const key = '*';
    if (!this.handlers.has(key)) {
      this.handlers.set(key, new Set());
    }
    this.handlers.get(key)!.add(handler);
    return () => this.handlers.get(key)?.delete(handler);
  }

  /**
   * Emit an event to all matching subscribers.
   * Handlers are called sequentially; errors in one do not stop others.
   */
  async emit(event: HarnessEvent): Promise<void> {
    const specific = this.handlers.get(event.type) ?? new Set();
    const any = this.handlers.get('*') ?? new Set();

    const all = [...specific, ...any];

    for (const handler of all) {
      try {
        await handler(event);
      } catch (err) {
        // Never let a subscriber crash the bus
        console.error(`[EventBus] Handler error for ${event.type}:`, err);
      }
    }
  }

  /** Remove all listeners (useful in tests) */
  clear(): void {
    this.handlers.clear();
  }
}

/** Global singleton used by the default wiring */
export const bus = new EventBus();
