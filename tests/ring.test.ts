import { afterEach, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { createHmac } from "node:crypto";
import { RingAdapter, normalizeWebhook, verifySignature } from "../server/ring";
const servers: Server[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
const now = "2026-10-18T07:12:00.000Z";
async function fixture(
  handler: (path: string) => { status?: number; body: unknown },
) {
  const requests: Array<{ path: string; auth: string | undefined }> = [];
  const s = createServer((req, res) => {
    requests.push({ path: req.url!, auth: req.headers.authorization });
    const response = handler(req.url!);
    res.writeHead(response.status ?? 200, {
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(response.body));
  });
  servers.push(s);
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const port = (s.address() as { port: number }).port;
  return { requests, baseUrl: `http://127.0.0.1:${port}` };
}
describe("Ring adapter boundary tests — local HTTP fixtures, not live verification", () => {
  it("constructs documented bearer requests and decodes JSON:API status/history", async () => {
    const f = await fixture((path) =>
      path === "/v1/devices"
        ? {
            body: {
              data: [
                {
                  type: "devices",
                  id: "door/a",
                  attributes: { name: "Front door" },
                },
              ],
            },
          }
        : path.endsWith("/status")
          ? {
              body: {
                data: {
                  type: "device-status",
                  id: "door/a.status",
                  attributes: { online: false },
                },
              },
            }
          : {
              body: {
                data: [
                  {
                    type: "events",
                    id: "event-1",
                    attributes: {
                      event_type: "motion.human",
                      start: 1792307400000,
                    },
                  },
                ],
              },
            },
    );
    const result = await new RingAdapter({
      token: "fixture-token",
      baseUrl: f.baseUrl,
      now: () => now,
    }).sync();
    expect(f.requests).toEqual([
      { path: "/v1/devices", auth: "Bearer fixture-token" },
      { path: "/v1/devices/door%2Fa/status", auth: "Bearer fixture-token" },
      {
        path: "/v1/history/devices/door%2Fa/events",
        auth: "Bearer fixture-token",
      },
    ]);
    expect(result.devices).toEqual([
      { id: "door/a", name: "Front door", coverage: "offline" },
    ]);
    expect(result.events[0]).toMatchObject({
      source: "ring",
      type: "motion",
      observedAt: "2026-10-18T07:10:00.000Z",
      receivedAt: now,
      subtype: "human",
    });
  });
  it("returns a controlled expired-token error without leaking response content", async () => {
    const f = await fixture(() => ({
      status: 401,
      body: { token: "secret-server-echo" },
    }));
    await expect(
      new RingAdapter({ token: "fixture-token", baseUrl: f.baseUrl }).sync(),
    ).rejects.toThrow("Ring access token expired or unauthorized");
  });
  it("rejects malformed discovery instead of presenting a successful empty connection", async () => {
    const f = await fixture(() => ({ body: { devices: [] } }));
    await expect(
      new RingAdapter({ token: "fixture-token", baseUrl: f.baseUrl }).sync(),
    ).rejects.toThrow(/malformed/i);
  });
  it("verifies raw-body HMAC and keeps unknown motion subtypes as observations", () => {
    const raw = Buffer.from(
      '{ "meta": {"version":"1.1","time":"2026-10-18T07:12:00Z","request_id":"request-1","account_id":"account-1"}, "data":{"type":"motion_detected","id":"motion-1","attributes":{"source":"door-1","source_type":"devices","timestamp":1792307400000,"sub_type":"new_subtype"}} }',
    );
    const signature =
      "sha256=" +
      createHmac("sha256", "fixture-secret").update(raw).digest("hex");
    expect(verifySignature(raw, signature, "fixture-secret")).toBe(true);
    expect(
      verifySignature(
        Buffer.from(raw.toString().replace("motion-1", "motion-2")),
        signature,
        "fixture-secret",
      ),
    ).toBe(false);
    expect(verifySignature(raw, "bad", "fixture-secret")).toBe(false);
    expect(
      normalizeWebhook(JSON.parse(raw.toString()), now).observation,
    ).toMatchObject({
      type: "motion",
      subtype: "new_subtype",
      source: "ring",
      observedAt: "2026-10-18T07:10:00.000Z",
    });
  });
  it("rejects future event time", () => {
    expect(() =>
      normalizeWebhook(
        {
          meta: { version: "1.1", time: now, request_id: "r", account_id: "a" },
          data: {
            type: "button_press",
            id: "future",
            attributes: {
              source: "d",
              source_type: "devices",
              timestamp: 1792308000000,
            },
          },
        },
        now,
      ),
    ).toThrow(/future/i);
  });
  it("an event occurring during a history request is valid at its actual receipt time", async () => {
    let clock = "2026-10-18T07:12:00.000Z";
    const f = await fixture((path) => {
      if (path === "/v1/devices")
        return {
          body: {
            data: [
              {
                type: "devices",
                id: "front",
                attributes: { name: "Front door" },
              },
            ],
          },
        };
      if (path.endsWith("/status"))
        return {
          body: {
            data: {
              type: "device-status",
              id: "front.status",
              attributes: { online: true },
            },
          },
        };
      clock = "2026-10-18T07:13:00.000Z";
      return {
        body: {
          data: [
            {
              type: "events",
              id: "during-sync",
              attributes: { event_type: "ding", start: 1792307550000 },
            },
          ],
        },
      };
    });
    const result = await new RingAdapter({
      token: "fixture-token",
      baseUrl: f.baseUrl,
      now: () => clock,
    }).sync();
    expect(result.verifiedAt).toBe("2026-10-18T07:13:00.000Z");
    expect(result.events[0]).toMatchObject({
      observedAt: "2026-10-18T07:12:30.000Z",
      receivedAt: "2026-10-18T07:13:00.000Z",
      type: "doorbell",
    });
  });
});
