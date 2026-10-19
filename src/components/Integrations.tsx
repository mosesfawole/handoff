import { useState } from "react";
import type { AppState } from "../../shared/types";
import { mcpRequest } from "../api";
import { date, time } from "../format";
import { Icon } from "./Icon";
interface Tool {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: { readOnlyHint?: boolean };
}
export function Integrations({
  state,
  busy,
  onRing,
  onReplay,
  onError,
}: {
  state: AppState;
  busy: boolean;
  onRing: () => void;
  onReplay: () => void;
  onError: (error: string) => void;
}) {
  const ring = state.integrations.ring;
  const [tools, setTools] = useState<Tool[]>([]);
  const [selected, setSelected] = useState("read_receipt");
  const [protocol, setProtocol] = useState<string | null>(null);
  const [response, setResponse] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const tool = tools.find((t) => t.name === selected);
  async function connect() {
    setLoading(true);
    try {
      const initialized = await mcpRequest("initialize", {
        protocolVersion: "2025-11-25",
        capabilities: {},
        clientInfo: { name: "handoff-browser-explorer", version: "0.1.0" },
      });
      setProtocol(initialized.protocolVersion);
      const listed = await mcpRequest("tools/list");
      setTools(listed.tools);
      setResponse(JSON.stringify(initialized, null, 2));
    } catch (e) {
      onError(e instanceof Error ? e.message : "MCP connection failed.");
    } finally {
      setLoading(false);
    }
  }
  async function run() {
    setLoading(true);
    try {
      const result = await mcpRequest("tools/call", {
        name: selected,
        arguments: {},
      });
      setResponse(JSON.stringify(result, null, 2));
    } catch (e) {
      onError(e instanceof Error ? e.message : "MCP read failed.");
    } finally {
      setLoading(false);
    }
  }
  const ringLabels = {
    not_configured: "Not configured",
    not_verified: "Configured · unverified",
    connected: "Connected",
    expired: "Credential expired",
    error: "Connection error",
  };
  return (
    <section className="integration-page">
      <div className="page-intro">
        <p className="eyebrow">Evidence, with its boundaries</p>
        <h1>Connected with care.</h1>
        <p>
          Real server connections. Clear provenance. A person still confirms the
          outcome.
        </p>
      </div>
      <div className="integration-card">
        <div className="integration-heading">
          <span className="integration-icon">
            <Icon name="camera" size={25} />
          </span>
          <div>
            <h2>Ring</h2>
            <p>Device discovery, current status and event history</p>
          </div>
          <span
            className={`pill ${ring.status === "connected" ? "green" : "amber"}`}
          >
            {ringLabels[ring.status]}
          </span>
        </div>
        <p>
          A successful check opens separate live household records. Current
          camera coverage cannot establish who visited, what care happened, or
          earlier coverage.
        </p>
        <dl className="connection-facts">
          <div>
            <dt>Server credential</dt>
            <dd>
              {ring.configured ? "Configured on server" : "Not configured"}
            </dd>
          </div>
          <div>
            <dt>Last verification</dt>
            <dd>
              {ring.lastVerifiedAt
                ? `${date(ring.lastVerifiedAt)} · ${time(ring.lastVerifiedAt)}`
                : "No successful check recorded"}
            </dd>
          </div>
          <div>
            <dt>Signed webhook</dt>
            <dd>
              {ring.webhookConfigured
                ? "Secret configured · HMAC checked at ingress"
                : "Not configured"}
            </dd>
          </div>
        </dl>
        {ring.devices.length > 0 && (
          <ul className="device-list">
            {ring.devices.map((device, i) => (
              <li key={device.id}>
                <Icon name="camera" />
                <div>
                  <strong>{device.name}</strong>
                  <span>
                    {i === 0
                      ? "Selected for headline coverage"
                      : "Additional discovered device"}
                  </span>
                </div>
                <span
                  className={`pill ${device.coverage === "online" ? "green" : "amber"}`}
                >
                  {device.coverage}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="field-help">
          {state.mode === "live"
            ? `${state.visits.flatMap((v) => v.observations).filter((o) => o.source === "ring").length} Ring observations in the connected visit. Empty history is not evidence of a missed visit.`
            : "Replay doorstep events are fictional and never described as Ring events."}
        </p>
        {ring.error && <div className="error">{ring.error}</div>}
        <div className="integration-actions">
          <button className="button primary" disabled={busy} onClick={onRing}>
            {busy ? "Checking…" : "Check Ring connection"}
            <Icon name="arrow" />
          </button>
          {state.mode === "live" && (
            <button
              className="button secondary"
              onClick={onReplay}
              disabled={busy}
            >
              Return to fictional replay
            </button>
          )}
        </div>
        <details>
          <summary>Local connection setup</summary>
          <p>
            Put <code>RING_ACCESS_TOKEN</code> in the ignored <code>.env</code>{" "}
            file on the server, then restart it. Use{" "}
            <code>RING_WEBHOOK_SECRET</code> for signed webhook ingress.
            Credentials never belong in this browser. Account linking and
            automatic token refresh are outside this local prototype.
          </p>
        </details>
      </div>
      <div className="integration-card">
        <div className="integration-heading">
          <span className="integration-icon">
            <Icon name="link" size={25} />
          </span>
          <div>
            <h2>Local MCP explorer</h2>
            <p>Actual Streamable HTTP · {state.integrations.mcp.endpoint}</p>
          </div>
        </div>
        <p>
          {state.integrations.mcp.label}. Anonymous reads expose fictional
          replay only. Live records and all mutation tools require a
          server-configured bearer token.
        </p>
        <div className="protocol-facts">
          <span>Protocol {protocol ?? state.integrations.mcp.protocol}</span>
          <span>
            {state.integrations.mcp.writesConfigured
              ? "Write credential configured on server"
              : "Write credential not configured"}
          </span>
        </div>
        {state.mode === "live" && (
          <div className="info-note">
            <Icon name="warning" />
            Connected records require bearer authorization. Return to replay to
            explore anonymous tools.
          </div>
        )}
        <button
          className="button secondary"
          onClick={() => void connect()}
          disabled={loading}
        >
          {loading ? "Requesting…" : "Connect local MCP"}
          <Icon name="link" />
        </button>
        {tools.length > 0 && (
          <div className="tool-explorer">
            <p className="eyebrow">{tools.length} tools discovered</p>
            <label>
              MCP tool
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                {tools.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <p>{tool?.description}</p>
            {tool?.annotations?.readOnlyHint ? (
              <button
                className="button primary"
                disabled={loading}
                onClick={() => void run()}
              >
                Run read tool
                <Icon name="arrow" />
              </button>
            ) : (
              <div className="authorization-note">
                <strong>Bearer authorization required</strong>
                <p>
                  This is an actual mutation schema. Use an authorized MCP
                  client on the server; the browser does not receive the token.
                </p>
              </div>
            )}
            <details>
              <summary>Tool input schema</summary>
              <pre>{JSON.stringify(tool?.inputSchema, null, 2)}</pre>
            </details>
          </div>
        )}
        {response && (
          <div className="protocol-response">
            <p className="eyebrow">Actual JSON-RPC response</p>
            <pre aria-label="Protocol response">{response}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
