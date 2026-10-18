import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { CoverageStatus, DoorstepObservation } from "../shared/types";
export class RingError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const resource = z.object({
  id: z.string().min(1),
  type: z.string(),
  attributes: z.record(z.string(), z.unknown()),
});
const collection = z.object({ data: z.array(resource) });
const individual = z.object({ data: resource });
const motionTypes = new Set([
  "motion",
  "motion.human",
  "motion.general",
  "motion.vehicle",
  "motion.package",
  "motion.animal",
]);
function eventTime(value: unknown, now: string): string {
  // Ring event history and webhook timestamp values are Unix milliseconds.
  const date =
    typeof value === "number" && Number.isFinite(value)
      ? new Date(value)
      : typeof value === "string"
        ? new Date(value)
        : new Date(NaN);
  if (!Number.isFinite(date.getTime()))
    throw new RingError(502, "Malformed Ring event timestamp");
  if (date.getTime() > Date.parse(now))
    throw new RingError(400, "Ring event timestamp is in the future");
  return date.toISOString();
}
function observation(
  id: string,
  deviceId: string,
  eventType: string,
  subtype: string | null,
  at: string,
  now: string,
): DoorstepObservation {
  const type =
    eventType === "ding" || eventType === "button_press"
      ? "doorbell"
      : eventType === "motion_detected" ||
          motionTypes.has(eventType) ||
          eventType.startsWith("motion.")
        ? "motion"
        : "unknown";
  return {
    id,
    deviceId,
    observedAt: at,
    receivedAt: now,
    type,
    subtype,
    source: "ring",
    description: `${type === "doorbell" ? "Doorbell button activity" : type === "motion" ? "Camera motion activity" : "Unrecognized device event"} observed by Ring. Identity, entry and care remain unconfirmed.`,
  };
}
export interface RingSync {
  devices: Array<{ id: string; name: string; coverage: CoverageStatus }>;
  events: DoorstepObservation[];
  verifiedAt: string;
}
export class RingAdapter {
  private baseUrl: string;
  private now: () => string;
  constructor(
    private options: {
      token: string;
      baseUrl?: string;
      now?: () => string;
      transport?: typeof fetch;
    },
  ) {
    this.baseUrl = options.baseUrl ?? "https://api.amazonvision.com";
    this.now = options.now ?? (() => new Date().toISOString());
  }
  private async get(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await (this.options.transport ?? fetch)(this.baseUrl + path, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.options.token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
        redirect: "error",
      });
    } catch {
      throw new RingError(502, "Ring API request could not be completed");
    }
    if (response.status === 401)
      throw new RingError(401, "Ring access token expired or unauthorized");
    if (!response.ok)
      throw new RingError(
        response.status,
        `Ring API returned HTTP ${response.status}`,
      );
    try {
      return await response.json();
    } catch {
      throw new RingError(502, "Malformed Ring JSON response");
    }
  }
  async sync(): Promise<RingSync> {
    const devices = collection.safeParse(await this.get("/v1/devices"));
    if (!devices.success)
      throw new RingError(502, "Malformed Ring discovery response");
    if (devices.data.data.length > 50)
      throw new RingError(502, "Too many devices for this local prototype");
    const result: RingSync = {
      devices: [],
      events: [],
      verifiedAt: this.now(),
    };
    for (const device of devices.data.data) {
      const deviceId = encodeURIComponent(device.id);
      const status = individual.safeParse(
        await this.get(`/v1/devices/${deviceId}/status`),
      );
      if (
        !status.success ||
        typeof status.data.data.attributes.online !== "boolean"
      )
        throw new RingError(502, "Malformed Ring device status");
      result.devices.push({
        id: device.id,
        name:
          typeof device.attributes.name === "string"
            ? device.attributes.name
            : "Ring device",
        coverage: status.data.data.attributes.online ? "online" : "offline",
      });
      const history = collection.safeParse(
        await this.get(`/v1/history/devices/${deviceId}/events`),
      );
      const receivedAt = this.now();
      if (!history.success)
        throw new RingError(502, "Malformed Ring event history");
      for (const event of history.data.data) {
        if (typeof event.attributes.event_type !== "string")
          throw new RingError(502, "Malformed Ring event type");
        const eventType = event.attributes.event_type;
        const subtype = eventType.startsWith("motion.")
          ? eventType.slice(7)
          : null;
        result.events.push(
          observation(
            event.id,
            device.id,
            eventType,
            subtype,
            eventTime(event.attributes.start, receivedAt),
            receivedAt,
          ),
        );
      }
    }
    result.verifiedAt = this.now();
    return result;
  }
}
export function verifySignature(
  raw: Buffer,
  signature: string | undefined,
  secret: string | undefined,
): boolean {
  if (!secret || !signature || !/^sha256=[a-fA-F0-9]{64}$/.test(signature))
    return false;
  const expected = createHmac("sha256", secret).update(raw).digest();
  const supplied = Buffer.from(signature.slice(7), "hex");
  return (
    supplied.length === expected.length && timingSafeEqual(expected, supplied)
  );
}
const webhook = z.object({
  meta: z.object({
    version: z.literal("1.1"),
    time: z.string(),
    request_id: z.string().min(1),
    account_id: z.string().min(1),
  }),
  data: resource,
});
export interface NormalizedWebhook {
  eventId: string;
  deviceId: string;
  observedAt: string;
  observation?: DoorstepObservation;
  coverage?: CoverageStatus;
}
export function normalizeWebhook(
  body: unknown,
  now: string,
): NormalizedWebhook {
  const parsed = webhook.safeParse(body);
  if (!parsed.success) throw new RingError(400, "Malformed Ring webhook");
  const { data } = parsed.data;
  const attrs = data.attributes;
  if (typeof attrs.source !== "string" || attrs.source_type !== "devices")
    throw new RingError(400, "Unsupported Ring webhook source");
  const at = eventTime(attrs.timestamp, now);
  const result: NormalizedWebhook = {
    eventId: data.id,
    deviceId: attrs.source,
    observedAt: at,
  };
  if (data.type === "device_offline" || data.type === "device_removed")
    result.coverage = "offline";
  else if (data.type === "device_online") result.coverage = "online";
  else
    result.observation = observation(
      data.id,
      attrs.source,
      data.type,
      typeof attrs.sub_type === "string" ? attrs.sub_type : null,
      at,
      now,
    );
  return result;
}
