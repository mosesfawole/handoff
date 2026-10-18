import type { Express, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { commandSchema } from '../shared/types';
import { timingSafeEqual } from 'node:crypto';
import type { HandoffService } from './service';
export function authorized(req: Request, token?: string): boolean { if (!token || !req.headers.authorization?.startsWith('Bearer ')) return false; const supplied = Buffer.from(req.headers.authorization.slice(7)); const expected = Buffer.from(token); return supplied.length === expected.length && timingSafeEqual(supplied, expected); }
function jsonResult(data: unknown) { return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }; }
/** Stateless transport: each POST uses the SDK protocol stack; authorization is per request. */
export function registerMcp(app: Express, service: HandoffService) {
  app.post('/mcp', async (req, res) => {
    const authenticated = authorized(req, service.options.mcpToken);
    if (service.currentMode === 'live' && !authenticated) { res.status(401).json({ error: 'Bearer authentication is required for connected records' }); return; }
    const server = new McpServer({ name: 'handoff-local', version: '0.1.0' });
    server.registerTool('read_receipt', { description: 'Read a visit receipt. Anonymous local access exposes fictional replay only.', inputSchema: {}, annotations: { readOnlyHint: true } }, async () => service.currentMode === 'live' && !authenticated ? { ...jsonResult({ error: 'Bearer authentication required' }), isError: true } : jsonResult(service.receipt()));
    server.registerTool('read_state', { description: 'Read distinct observations, human statements, task ownership and deadlines.', inputSchema: {}, annotations: { readOnlyHint: true } }, async () => service.currentMode === 'live' && !authenticated ? { ...jsonResult({ error: 'Bearer authentication required' }), isError: true } : jsonResult(service.state()));
    for (const schema of commandSchema.options) {
      const name = schema.shape.type.value;
      const { type: _type, ...inputSchema } = schema.shape;
      server.registerTool(name, { description: `${name}: an explicit, actor-scoped update to the local care coordination record. Requires bearer authorization.`, inputSchema, annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false } }, async (args: Record<string, unknown>) => {
        if (!authenticated) return { ...jsonResult({ error: 'Bearer authentication required for mutation tools' }), isError: true };
        try { return jsonResult(service.command({ ...args, type: name }, 'mcp')); } catch (error) { return { ...jsonResult({ error: error instanceof Error ? error.message : 'Command rejected' }), isError: true }; }
      });
    }
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void server.close(); });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });
  const unsupported = (_req: Request, res: Response) => res.status(405).set('Allow', 'POST').json({ error: 'Stateless Streamable HTTP uses POST' });
  app.get('/mcp', unsupported); app.delete('/mcp', unsupported);
}
