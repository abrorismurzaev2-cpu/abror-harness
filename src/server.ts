/**
 * Abror Harness — Production Server
 * Express + WebSocket. Serves the beautiful React UI and runs the agent.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

import { EventBus } from './core/event-bus.js';
import { DeepSeekAdapter } from './llm/deepseek.js';
import { ToolRegistry } from './tools/registry.js';
import { readFileTool } from './tools/read-file.js';
import { executeBashTool } from './tools/execute-bash.js';
import { AgentLoop } from './agent/loop.js';
import { SessionLogger } from './logger/session-logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3080;

// ── Core wiring ────────────────────────────────────────────────────────
const bus = new EventBus();
const apiKey = process.env.DEEPSEEK_API_KEY;

if (!apiKey) {
  console.error('❌  DEEPSEEK_API_KEY is missing. Set it in .env');
  process.exit(1);
}

const llm = new DeepSeekAdapter({
  apiKey,
  baseURL: process.env.DEEPSEEK_BASE_URL,
  model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
});

const tools = new ToolRegistry();
tools.register(readFileTool);
tools.register(executeBashTool);

new SessionLogger(bus, { persistDir: './sessions' });

const agent = new AgentLoop(llm, tools, bus, { maxIterations: 15 });

// ── Express + static ───────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', name: 'Abror Harness', version: '0.2.0' });
});

// REST fallback (non-streaming)
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' });
  }
  try {
    const answer = await agent.run(message);
    res.json({ answer });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Agent error' });
  }
});

// Serve built React app in production
const webDist = join(__dirname, '../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get('*', (_req, res) => {
    res.sendFile(join(webDist, 'index.html'));
  });
}

const server = createServer(app);

// ── WebSocket for live agent events ────────────────────────────────────
const wss = new WebSocketServer({ server, path: '/ws' });

interface ClientMsg {
  type: 'chat';
  message: string;
  sessionId?: string;
}

wss.on('connection', (ws: WebSocket) => {
  console.log('🔌  Client connected');

  const unsub = bus.onAny(async (event) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
    }
  });

  ws.on('message', async (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as ClientMsg;
      if (data.type === 'chat' && data.message?.trim()) {
        const answer = await agent.run(data.message.trim());
        ws.send(JSON.stringify({
          type: 'chat:reply',
          answer,
        }));
      }
    } catch (err: any) {
      ws.send(JSON.stringify({
        type: 'error',
        error: err.message || 'Unknown error',
      }));
    }
  });

  ws.on('close', () => {
    unsub();
    console.log('🔌  Client disconnected');
  });
});

// ── Start ──────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log('');
  console.log('  ╔══════════════════════════════════════════════╗');
  console.log('  ║         Abror Harness  v0.2.0                ║');
  console.log('  ║   Beautiful • Event-driven • Plugin-based    ║');
  console.log('  ╚══════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ➜  Local:   http://localhost:${PORT}`);
  console.log(`  ➜  Network: http://0.0.0.0:${PORT}`);
  console.log('');
  if (!existsSync(webDist)) {
    console.log('  ℹ  Frontend not built yet. Run:  npm run dev');
  }
  console.log('');
});
