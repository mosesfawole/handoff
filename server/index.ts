import { resolve } from 'node:path';
import { HandoffService } from './service';
import { createApp } from './app';
const service = new HandoffService({ dbPath: resolve(process.env.HANDOFF_DB ?? 'data/handoff.sqlite'), mode: process.env.HANDOFF_MODE === 'live' ? 'live' : 'replay', ringToken: process.env.RING_ACCESS_TOKEN?.trim(), webhookSecret: process.env.RING_WEBHOOK_SECRET?.trim(), mcpToken: process.env.HANDOFF_MCP_TOKEN?.trim() });
const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port');
const server = createApp(service).listen(port, '127.0.0.1', () => console.log(`Handoff local server: http://localhost:${port}`));
const worker = setInterval(() => service.tick(), 5_000); worker.unref();
function stop() { clearInterval(worker); server.closeAllConnections(); server.close(() => { service.close(); process.exit(0); }); }
process.once('SIGINT', stop); process.once('SIGTERM', stop);
