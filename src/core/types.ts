/**
 * Abror Harness — Core Types
 * Shared contracts between all modules ( (plugins).
 */

/** Message role in conversation */
export type Role = 'system' | 'user' | 'assistant' | 'tool';

/** Single message in the conversation history */
export interface Message {
  role: Role;
  content: string;
  /** Present when role === 'tool' */
  tool_call_id?: string;
  name?: string;
  /** Present when the model wants to call tools */
  tool_calls?: ToolCall[];
}

/** Tool call requested by the LLM */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/** Tool definition exposed to the LLM */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

/** Result returned by a tool after execution */
export interface ToolResult {
  tool_call_id: string;
  name: string;
  content: string;
  is_error?: boolean;
}

/** Contract every tool plugin must implement */
export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute(args: Record<string, unknown>): Promise<string>;
}

/** Contract every LLM adapter must implement */
export interface LLMAdapter {
  readonly name: string;
  chat(
    messages: Message[],
    tools?: ToolDefinition[],
    options?: { temperature?: number; max_tokens?: number }
  ): Promise<Message>;
}

/** Events emitted by the system (Event Bus) */
export type HarnessEvent =
  | { type: 'session:start'; sessionId: string; task: string }
  | { type: 'session:end'; sessionId: string; answer: string }
  | { type: 'agent:think'; sessionId: string; thought?: string }
  | { type: 'agent:tool_call'; sessionId: string; toolCall: ToolCall }
  | { type: 'agent:tool_result'; sessionId: string; result: ToolResult }
  | { type: 'agent:message'; sessionId: string; message: Message }
  | { type: 'logger:entry'; sessionId: string; entry: LogEntry }
  | { type: 'error'; sessionId?: string; error: Error | string };

/** Single log entry written by SessionLogger */
export interface LogEntry {
  timestamp: string;
  type: 'thought' | 'tool_call' | 'tool_result' | 'message' | 'error' | 'info';
  content: unknown;
}

/** Session state passed around the agent loop */
export interface Session {
  id: string;
  messages: Message[];
  startedAt: Date;
}
