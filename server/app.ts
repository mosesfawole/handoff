import express, { type Request, type Response, type NextFunction } from 'express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { HandoffService, ServiceError } from './service';
import { RingAdapter, RingError, normalizeWebhook, verifySignature } from './ring';
import { registerMcp } from './mcp';
export interface AppOptions { ringAdapter?: RingAdapter; clientPath?: string; }
export function createApp(service: HandoffService, options: AppOptions = {}) {
  const app = express(); app.disable('x-powered-by');
  app.use((req, res, next) => {
    const hostname = req.hostname.toLowerCase();
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname)) { res.status(403).json({ error: 'Loopback host required', code: 'invalid_host' }); return; }
    if (req.path !== '/api/webhooks/ring' && req.headers.origin) {
      try { const origin = new URL(req.headers.origin); if (!['http:', 'https:'].includes(origin.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname) || ![req.headers.host?.split(':').at(-1), '5173'].includes(origin.port)) throw new Error(); }
      catch { res.status(403).json({ error: 'Same-origin local access required', code: 'invalid_origin' }); return; }
    }
    res.set('Cache-Control', 'no-store'); next();
  });
  app.post('/api/webhooks/ring', express.raw({ type: 'application/json', limit: '256kb' }), (req, res) => {
    if (!Buffer.isBuffer(req.body) || !verifySignature(req.body, req.header('X-Signature'), service.options.webhookSecret)) throw new ServiceError(401, 'Invalid Ring webhook signature', 'invalid_signature');
    if (service.currentMode !== 'live') throw new ServiceError(409, 'Connect Ring to the separate live household before receiving events');
    let body: unknown; try { body = JSON.parse(req.body.toString('utf8')); } catch { throw new ServiceError(400, 'Invalid JSON'); }
    const event = normalizeWebhook(body, new Date().toISOString());
    service.ingestWebhook(event); res.json({ accepted: true });
  });
  app.use(express.json({ limit: '64kb' }));
  app.get('/api/state', (_req, res) => { service.tick(); res.json(service.state()); });
  app.get('/api/receipt', (_req, res) => res.json(service.receipt()));
  app.get('/api/integrations', (_req, res) => res.json(service.state().integrations));
  app.post('/api/commands', (req, res) => res.json(service.command(req.body)));
  app.post('/api/replay', (req, res) => { if (req.body?.type === 'scenario') service.enterReplay(); res.json(service.replay(req.body)); });
  app.get('/api/events', (req, res) => {
    res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' }); res.flushHeaders();
    const send = (state: unknown) => res.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
    send(service.state()); const listener = (state: unknown) => send(state); service.events.on('state', listener);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 20_000); heartbeat.unref();
    req.on('close', () => { clearInterval(heartbeat); service.events.off('state', listener); });
  });
  app.post('/api/ring/sync', async (req, res) => {
    if (req.body && Object.keys(req.body).length) throw new ServiceError(400, 'Ring sync accepts no browser credentials');
    if (!service.options.ringToken && !options.ringAdapter) throw new ServiceError(409, 'Ring token is not configured on the server', 'ring_not_configured');
    try {
      const adapter = options.ringAdapter ?? new RingAdapter({ token: service.options.ringToken! });
      const result = await adapter.sync(); service.enterLive();
      res.json(service.ingestRing(result.events, result.devices, { configured: true, webhookConfigured: Boolean(service.options.webhookSecret), status: 'connected', lastSyncAt: result.verifiedAt, lastVerifiedAt: result.verifiedAt, error: null, devices: result.devices }));
    } catch (error) { if (error instanceof RingError) { service.integrationFailure(error.status === 401 ? 'expired' : 'error', error.message); throw new ServiceError(error.status === 401 ? 401 : 502, error.message, 'ring_sync_failed'); } throw error; }
  });
  registerMcp(app, service);
  const clientPath = options.clientPath ?? resolve('dist');
  if (existsSync(clientPath)) { app.use(express.static(clientPath)); app.get('/{*path}', (req, res) => { if (req.path.startsWith('/api/')) res.status(404).json({ error: 'API route not found', code: 'not_found' }); else res.sendFile(resolve(clientPath, 'index.html')); }); }
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (res.headersSent) return;
    if (error instanceof ServiceError) { res.status(error.status).json({ error: error.message, code: error.code }); return; }
    if (error instanceof SyntaxError) { res.status(400).json({ error: 'Malformed JSON', code: 'invalid_json' }); return; }
    res.status(500).json({ error: 'Local request failed', code: 'internal_error' });
  });
  return app;
}
