#!/usr/bin/env node
/**
 * Abror Harness — CLI Entry Point
 *
 * Simple interactive REPL so you can talk to the agent in the terminal.
 *
 * Usage:
 *   npm run dev
 *   # or after build:
 *   node dist/index.js
 *
 * Environment:
 *   DEEPSEEK_API_KEY   (required)
 *   DEEPSEEK_BASE_URL  (optional)
 *   DEEPSEEK_MODEL     (optional)
 */

import 'dotenv/config';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

import { bus } from './core/event-bus.js';
import { DeepSeekAdapter } from './llm/deepseek.js';
import { ToolRegistry } from './tools/registry.js';
import { readFileTool } from './tools/read-file.js';
import { executeBashTool } from './tools/execute-bash.js';
import { AgentLoop } from './agent/loop.js';
import { SessionLogger } from './logger/session-logger.js';

async function main() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    console.error('❌  DEEPSEEK_API_KEY is not set. Copy .env.example → .env and fill it in.');
    process.exit(1);
  }

  // ── Wire modules (plugins) ──────────────────────────────────────────
  const llm = new DeepSeekAdapter({
    apiKey,
    baseURL: process.env.DEEPSEEK_BASE_URL,
    model: process.env.DEEPSEEK_MODEL,
  });

  const tools = new ToolRegistry();
  tools.register(readFileTool);
  tools.register(executeBashTool);

  // Optional: persist session logs to ./sessions
  new SessionLogger(bus, { persistDir: './sessions' });

  // Pretty console tracer
  bus.on('session:start', (e) => {
    console.log(`\n🚀  Session ${e.sessionId.slice(0, 8)} started`);
    console.log(`    Task: ${e.task}\n`);
  });

  bus.on('agent:tool_call', (e) => {
    const args = e.toolCall.function.arguments;
    console.log(`🔧  Tool call → ${e.toolCall.function.name}(${args})`);
  });

  bus.on('agent:tool_result', (e) => {
    const preview = e.result.content.slice(0, 200).replace(/\n/g, ' ');
    console.log(`   ↳ ${preview}${e.result.content.length > 200 ? '…' : ''}\n`);
  });

  bus.on('session:end', (e) => {
    console.log(`✅  Session finished\n`);
  });

  bus.on('error', (e) => {
    console.error('💥  Error:', e.error);
  });

  const agent = new AgentLoop(llm, tools, bus, {
    maxIterations: 15,
  });

  // ── Interactive REPL ────────────────────────────────────────────────
  const rl = readline.createInterface({ input, output });

  console.log('═══════════════════════════════════════════════════');
  console.log('   Abror Harness  v0.1.0  (MVP)');
  console.log('   Event-driven • Plugin-based • TypeScript');
  console.log('═══════════════════════════════════════════════════');
  console.log('Type your task and press Enter.  "exit" or Ctrl+C to quit.\n');

  while (true) {
    let userInput: string;
    try {
      userInput = (await rl.question('you › ')).trim();
    } catch {
      // Ctrl+C / EOF
      break;
    }

    if (!userInput) continue;
    if (['exit', 'quit', 'q'].includes(userInput.toLowerCase())) {
      console.log('Bye 👋');
      break;
    }

    try {
      const answer = await agent.run(userInput);
      console.log(`\nabror › ${answer}\n`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n💥  ${msg}\n`);
      await bus.emit({ type: 'error', error: msg });
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
