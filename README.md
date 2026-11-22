# Abror Harness

**Modular, event-driven AI agent framework** — MVP.

> Inspired by DeepSeek Harness (Cordis “everything is a plugin”), LangGraph (stateful loops), and AutoGen (actor / event messaging).

```
Agent = Model + Harness
```

Abror Harness gives a language model the ability to understand its environment, call tools, keep a session log, and produce a final answer — all through clean, swappable modules connected by an Event Bus.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLI / UI                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Agent Loop                              │
│         (think → tool call → observe → answer)              │
└──────────┬──────────────────────────────┬───────────────────┘
           │                              │
┌──────────▼──────────┐        ┌──────────▼──────────┐
│   LLM Adapters      │        │   Tool Registry     │
│  • DeepSeek         │        │  • read_file        │
│  • (OpenAI / Ollama)│        │  • execute_bash     │
└─────────────────────┘        └─────────────────────┘
           │                              │
           └──────────────┬───────────────┘
                          │
                ┌─────────▼─────────┐
                │    Event Bus      │  ← Core
                │  (typed pub/sub)  │
                └─────────┬─────────┘
                          │
                ┌─────────▼─────────┐
                │  Session Logger   │
                └───────────────────┘
```

### Key design patterns

| Pattern | Source of inspiration | How it is used in Abror |
|---------|-----------------------|-------------------------|
| Everything is a plugin | DeepSeek Harness / Cordis | LLM, Tools, Logger, even the loop can be replaced |
| Event-driven | Cordis events, AutoGen actors | `EventBus` decouples every module |
| Layer separation | All modern frameworks | Core / LLM / Tools / Agent / Logger |
| Explicit agent loop | LangGraph, classic ReAct | Clear think → act → observe cycle with max iterations |
| Session traceability | DeepSeek session log | Every thought, tool call and result is logged |

---

## Project structure

```
abror-harness/
├── package.json
├── tsconfig.json
├── .env.example
├── README.md
└── src/
    ├── index.ts              # CLI entry point
    ├── core/
    │   ├── event-bus.ts      # Typed Event Bus
    │   └── types.ts          # Shared contracts
    ├── llm/
    │   └── deepseek.ts       # DeepSeek (OpenAI-compatible) adapter
    ├── tools/
    │   ├── registry.ts       # Tool registry
    │   ├── read-file.ts
    │   └── execute-bash.ts
    ├── agent/
    │   └── loop.ts           # Agent Loop (the brain)
    └── logger/
        └── session-logger.ts
```

---

## Quick start

### 1. Install

```bash
git clone https://github.com/abrorismurzaev2-cpu/abror-harness.git
cd abror-harness
npm install
```

### 2. Configure API key

```bash
cp .env.example .env
# Edit .env and set:
# DEEPSEEK_API_KEY=sk-...
```

You can get a DeepSeek key at [platform.deepseek.com](https://platform.deepseek.com).

### 3. Run (development)

```bash
npm run dev
```

Or after building:

```bash
npm run build
npm start
```

### Example session

```
you › What files are in the current directory? Summarize package.json

🚀  Session a1b2c3d4 started
    Task: What files are in the current directory? Summarize package.json

🔧  Tool call → execute_bash({"command":"ls -la"})
   ↳ total 48  drwxr-xr-x  ...

🔧  Tool call → read_file({"path":"package.json"})
   ↳ { "name": "abror-harness", ... }

✅  Session finished

abror › The directory contains the Abror Harness source tree.
        package.json defines a TypeScript project named "abror-harness"
        with scripts for build, start and a CLI entry point...
```

---

## Extending the framework

### Add a new tool

```ts
// src/tools/my-tool.ts
import type { Tool } from '../core/types.js';

export const myTool: Tool = {
  name: 'my_tool',
  description: 'Does something useful',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string' },
    },
    required: ['input'],
  },
  async execute(args) {
    return `You said: ${args.input}`;
  },
};

// Then in index.ts:
tools.register(myTool);
```

### Add another LLM provider

Implement the `LLMAdapter` interface (see `src/llm/deepseek.ts`) and inject it into `AgentLoop`.

### React UI (future)

The Event Bus already emits everything needed for a live UI. A React frontend can subscribe to the same events (via WebSocket or SSE) and render the agent’s thoughts and tool calls in real time. The core remains framework-agnostic.

---

## License

MIT
