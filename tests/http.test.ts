import { afterEach, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { HandoffService } from '../server/service';
import { createApp } from '../server/app';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createHmac } from 'node:crypto';
const services: HandoffService[] = []; const servers: Server[] = []; const clients: Client[] = [];
afterEach(async () => { for (const c of clients.splice(0)) await c.close(); for (const s of servers.splice(0)) { s.closeAllConnections(); await new Promise<void>(r => s.close(() => r())); } for (const s of services.splice(0)) s.close(); });
async function setup(token?: string, mode: 'replay' | 'live' = 'replay') { const service = new HandoffService({ dbPath: ':memory:', mode, mcpToken: token }); services.push(service); const app = createApp(service); const server = app.listen(0, '127.0.0.1'); servers.push(server); await new Promise<void>(r => server.once('listening', r)); const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`; return { service, base }; }
async function connect(base: string, token?: string) { const client = new Client({ name: 'handoff-integration-test', version: '1.0.0' }); clients.push(client); const transport = new StreamableHTTPClientTransport(new URL(base + '/mcp'), { requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : {} }); await client.connect(transport); return client; }
it('HTTP returns 409 when another helper tries to steal a task and rejects foreign-origin writes', async () => {
  const { base, service } = await setup(); service.replay({ type: 'advance', minutes: 15 }); const taskId = service.state().visits[0].task!.id;
  const post = (actorId: string, origin?: string) => fetch(base + '/api/commands', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ type: 'claim_task', actorId, visitId: 'morning-visit', taskId, eta: '2026-10-18T07:33:00Z' }) });
  expect((await post('helper')).status).toBe(200); expect((await post('coordinator')).status).toBe(409); expect((await post('family', 'https://foreign.example')).status).toBe(403);
  const receipt = await (await fetch(base + '/api/receipt')).json(); expect(receipt.visit.task.ownerId).toBe('helper'); expect(receipt.fictional).toBe(true);
});
it('SDK initializes MCP 2025-11-25, lists tools and reads fictional receipts', async () => {
  const { base } = await setup(); const client = await connect(base);
  expect((await client.listTools()).tools.map(t => t.name)).toContain('read_receipt');
  const result = await client.callTool({ name: 'read_receipt', arguments: {} }); expect(JSON.parse((result.content as Array<{ text: string }>)[0].text).fictional).toBe(true);
});
it('MCP mutations require bearer auth and authenticated tools use the real shared workflow', async () => {
  const { base, service } = await setup('test-bearer'); service.replay({ type: 'advance', minutes: 15 }); const taskId = service.state().visits[0].task!.id;
  const anon = await connect(base); const denied = await anon.callTool({ name: 'claim_task', arguments: { actorId: 'helper', visitId: 'morning-visit', taskId, eta: '2026-10-18T07:33:00Z' } }); expect(denied.isError).toBe(true); expect(service.state().visits[0].task?.ownerId).toBeNull();
  const authenticated = await connect(base, 'test-bearer'); expect((await authenticated.callTool({ name: 'claim_task', arguments: { actorId: 'helper', visitId: 'morning-visit', taskId, eta: '2026-10-18T07:33:00Z' } })).isError).not.toBe(true);
  expect(service.state().visits[0].status).toBe('overdue');
  await authenticated.callTool({ name: 'confirm_visit', arguments: { actorId: 'resident', visitId: 'morning-visit', note: 'I confirm the visit happened.' } }); expect(service.state().visits[0].status).toBe('resolved'); expect(service.state().visits[0].statements[0].source).toBe('mcp');
});
it('MCP cannot expose connected records to anonymous clients', async () => { const { base } = await setup('test-bearer', 'live'); await expect(connect(base)).rejects.toThrow(); const client = await connect(base, 'test-bearer'); const receipt = await client.callTool({ name: 'read_receipt', arguments: {} }); expect(JSON.parse((receipt.content as Array<{ text: string }>)[0].text).fictional).toBe(false); });
it('HTTP webhook verifies raw body and keeps late coverage from rewriting the latest status', async () => {
  const now = '2026-10-18T07:12:00.000Z';
  const service = new HandoffService({ dbPath: ':memory:', mode: 'live', now: () => now, webhookSecret: 'fixture-secret' }); services.push(service);
  service.ingestRing([], [{ id: 'door', coverage: 'online' }], { configured: true, webhookConfigured: true, status: 'connected', lastSyncAt: now, lastVerifiedAt: now, error: null, devices: [{ id: 'door', name: 'Door', coverage: 'online' }] });
  const server = createApp(service).listen(0, '127.0.0.1'); servers.push(server); await new Promise<void>(r => server.once('listening', r)); const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const raw = '{ "meta":{"version":"1.1","time":"2026-10-18T07:12:00Z","request_id":"r1","account_id":"a1"},"data":{"id":"offline-1","type":"device_offline","attributes":{"source":"door","source_type":"devices","timestamp":1792307100000}} }';
  const signature = 'sha256=' + createHmac('sha256', 'fixture-secret').update(raw).digest('hex');
  const send = (signature: string) => fetch(base + '/api/webhooks/ring', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signature }, body: raw });
  expect((await send('sha256=' + '0'.repeat(64))).status).toBe(401); expect((await send(signature)).status).toBe(200); expect((await send(signature)).status).toBe(200);
  expect(service.state().visits[0].coverage.status).toBe('online');
  expect(service.state().timeline.filter(e => e.type === 'webhook')).toHaveLength(1);
});
