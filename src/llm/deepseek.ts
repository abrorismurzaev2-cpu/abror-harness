/**
 * Abror Harness — DeepSeek LLM Adapter
 *
 * Uses the official OpenAI SDK against DeepSeek's OpenAI-compatible endpoint.
 * Easily swappable with any other OpenAI-compatible provider (Ollama, OpenAI, etc.).
 */

import OpenAI from 'openai';
import type { LLMAdapter, Message, ToolDefinition } from '../core/types.js';

export interface DeepSeekConfig {
  apiKey: string;
  baseURL?: string;
  model?: string;
}

export class DeepSeekAdapter implements LLMAdapter {
  readonly name = 'deepseek';
  private client: OpenAI;
  private model: string;

  constructor(config: DeepSeekConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL ?? 'https://api.deepseek.com',
    });
    this.model = config.model ?? 'deepseek-chat';
  }

  async chat(
    messages: Message[],
    tools?: ToolDefinition[],
    options: { temperature?: number; max_tokens?: number } = {}
  ): Promise<Message> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
      tools: tools as OpenAI.Chat.ChatCompletionTool[] | undefined,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.max_tokens ?? 4096,
    });

    const choice = response.choices[0];
    if (!choice) {
      throw new Error('DeepSeek returned empty choices');
    }

    const msg = choice.message;

    return {
      role: 'assistant',
      content: msg.content ?? '',
      tool_calls: msg.tool_calls?.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      })),
    };
  }
}
