/**
 * Abror Harness — Agent Loop
 *
 * The "brain" of the system.
 * Receives a user task → talks to the LLM → executes tools → repeats until done.
 *
 * Design notes (inspired by DeepSeek Harness / LangGraph / AutoGen):
 * - Fully event-driven via EventBus
 * - LLM and Tools are injected (plugins)
 * - Conversation history is the single source of truth
 * - Max iterations prevent infinite loops
 */

import { randomUUID } from 'node:crypto';
import type { EventBus } from '../core/event-bus.js';
import type { LLMAdapter, Message, Session, ToolCall } from '../core/types.js';
import type { ToolRegistry } from '../tools/registry.js';

export interface AgentLoopOptions {
  maxIterations?: number;
  systemPrompt?: string;
}

const DEFAULT_SYSTEM = `You are Abror Harness, a helpful AI agent with access to tools.
When you need information or to perform an action, call the appropriate tool.
After receiving tool results, reason about them and either call more tools or give the final answer.
Be concise and practical. Prefer using tools over guessing.`;

export class AgentLoop {
  constructor(
    private llm: LLMAdapter,
    private tools: ToolRegistry,
    private bus: EventBus,
    private options: AgentLoopOptions = {}
  ) {}

  /**
   * Run a full agent session for the given user task.
   * Returns the final natural-language answer.
   */
  async run(task: string): Promise<string> {
    const sessionId = randomUUID();
    const maxIter = this.options.maxIterations ?? 12;

    const session: Session = {
      id: sessionId,
      messages: [
        {
          role: 'system',
          content: this.options.systemPrompt ?? DEFAULT_SYSTEM,
        },
        { role: 'user', content: task },
      ],
      startedAt: new Date(),
    };

    await this.bus.emit({ type: 'session:start', sessionId, task });

    let iterations = 0;

    while (iterations < maxIter) {
      iterations += 1;

      // 1. Ask the model
      const reply = await this.llm.chat(
        session.messages,
        this.tools.toDefinitions()
      );

      await this.bus.emit({
        type: 'agent:message',
        sessionId,
        message: reply,
      });

      // 2. If the model wants tools → execute them
      if (reply.tool_calls && reply.tool_calls.length > 0) {
        // Add the assistant message that requested tools
        session.messages.push(reply);

        for (const tc of reply.tool_calls) {
          await this.bus.emit({
            type: 'agent:tool_call',
            sessionId,
            toolCall: tc,
          });

          const resultContent = await this.executeTool(tc);

          const toolMsg: Message = {
            role: 'tool',
            tool_call_id: tc.id,
            name: tc.function.name,
            content: resultContent,
          };

          session.messages.push(toolMsg);

          await this.bus.emit({
            type: 'agent:tool_result',
            sessionId,
            result: {
              tool_call_id: tc.id,
              name: tc.function.name,
              content: resultContent,
            },
          });
        }

        // Continue the loop so the model can see the results
        continue;
      }

      // 3. No tool calls → we have a final answer
      const answer = reply.content?.trim() || '(empty response)';
      session.messages.push(reply);

      await this.bus.emit({
        type: 'session:end',
        sessionId,
        answer,
      });

      return answer;
    }

    const fallback = `Reached maximum iterations (${maxIter}). Last messages may contain partial results.`;
    await this.bus.emit({
      type: 'session:end',
      sessionId,
      answer: fallback,
    });
    return fallback;
  }

  private async executeTool(tc: ToolCall): Promise<string> {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments || '{}');
    } catch {
      return `Error: invalid JSON arguments for tool ${tc.function.name}`;
    }
    return this.tools.execute(tc.function.name, args);
  }
}
