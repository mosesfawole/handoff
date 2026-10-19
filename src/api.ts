import type {
  AppState,
  Command,
  ReplayCommand,
  VisitReceipt,
} from "../shared/types";

export class RequestError extends Error {
  constructor(
    message: string,
    public code = "request_failed",
  ) {
    super(message);
  }
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      path,
      body === undefined
        ? { cache: "no-store" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
    );
  } catch {
    throw new RequestError(
      "The local server could not be reached. Check the connection and try again.",
    );
  }
  const data = await response.json();
  if (!response.ok)
    throw new RequestError(
      data.error ?? "The request was rejected.",
      data.code,
    );
  return data as T;
}
export const api = {
  state: () => request<AppState>("/api/state"),
  command: (command: Command) => request<AppState>("/api/commands", command),
  replay: (command: ReplayCommand) => request<AppState>("/api/replay", command),
  receipt: () => request<VisitReceipt>("/api/receipt"),
  ringSync: () => request<AppState>("/api/ring/sync", {}),
};
let rpcId = 0;
export async function mcpRequest(
  method: string,
  params?: unknown,
): Promise<Record<string, any>> {
  const response = await fetch("/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-11-25",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcId,
      method,
      ...(params === undefined ? {} : { params }),
    }),
  });
  const data = await response.json();
  if (!response.ok || data.error)
    throw new RequestError(
      data.error?.message ?? data.error ?? "MCP request was rejected.",
    );
  return data.result;
}
