import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import {
  commandSchema,
  replaySchema,
  type AppState,
  type Mode,
  type VisitReceipt,
  type EvidenceSource,
  type DoorstepObservation,
  type CoverageStatus,
  type IntegrationStatus,
} from "../shared/types";
import { Store } from "./store";
import { addMinutes, initialSnapshot, project } from "./domain";
import type { NormalizedWebhook } from "./ring";
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "invalid_command",
  ) {
    super(message);
  }
}
export interface ServiceOptions {
  dbPath: string;
  mode: Mode;
  now?: () => string;
  ringToken?: string;
  webhookSecret?: string;
  mcpToken?: string;
}
export class HandoffService {
  readonly events = new EventEmitter();
  readonly options: ServiceOptions;
  private store: Store;
  private mode: Mode;
  private now: () => string;
  constructor(options: ServiceOptions) {
    this.options = options;
    this.mode = options.mode;
    this.now = options.now ?? (() => new Date().toISOString());
    this.store = new Store(options.dbPath, this.mode, this.now());
    this.tick();
  }
  get currentMode() {
    return this.mode;
  }
  state(): AppState {
    const state = project(this.store.read(this.mode));
    state.integrations.ring.configured = Boolean(this.options.ringToken);
    state.integrations.ring.webhookConfigured = Boolean(
      this.options.webhookSecret,
    );
    if (!this.options.ringToken)
      state.integrations.ring.status = "not_configured";
    else if (state.integrations.ring.status === "not_configured")
      state.integrations.ring.status = "not_verified";
    state.integrations.mcp.writesConfigured = Boolean(this.options.mcpToken);
    return state;
  }
  private update(mutate: (state: AppState) => void) {
    const revision = this.state().revision;
    this.store.transact(this.mode, (s) => {
      if (this.mode === "live") s.currentTime = this.now();
      mutate(s);
      this.evaluate(s);
    });
    const result = this.state();
    if (revision !== result.revision) this.events.emit("state", result);
    return result;
  }
  private log(
    s: AppState,
    type: string,
    title: string,
    detail: string,
    source: EvidenceSource,
    actorId: string | null = null,
    observedAt?: string,
  ) {
    s.timeline.push({
      id: randomUUID(),
      revision: 0,
      at: s.currentTime,
      visitId: s.activeVisitId,
      type,
      source,
      actorId,
      title,
      detail,
      ...(observedAt ? { observedAt } : {}),
    });
  }
  private evaluate(s: AppState) {
    for (const view of project(s).visits) {
      const visit = s.visits.find((v) => v.id === view.id)!;
      if (
        (view.status === "overdue" || view.status === "disputed") &&
        (!visit.task || visit.task.status === "resolved")
      ) {
        const createdAt =
          view.status === "overdue" ? view.confirmationDue : s.currentTime;
        visit.task = {
          id: randomUUID(),
          visitId: visit.id,
          reason:
            view.status === "disputed" ? "disputed" : "confirmation_overdue",
          createdAt,
          status: "open",
          ownerId: null,
          claimedAt: null,
          eta: null,
          deadline: addMinutes(createdAt, visit.backupPlan.responseMinutes),
          escalatedAt: null,
          escalationActorId: visit.backupPlan.backupActorId,
          resolvedAt: null,
          resolution: null,
        };
        this.log(
          s,
          "task_created",
          "Follow-up needed",
          view.status === "disputed"
            ? "Conflicting human statements require an explicit outcome."
            : "Confirmation deadline passed. The visit remains unconfirmed.",
          "system",
        );
      }
      if (
        visit.task &&
        visit.task.status !== "resolved" &&
        !visit.task.escalatedAt &&
        Date.parse(s.currentTime) >= Date.parse(visit.task.deadline)
      ) {
        visit.task.escalatedAt = visit.task.deadline;
        this.log(
          s,
          "task_escalated",
          "Response deadline passed",
          "The task remains open. The agreed backup contact is next; no external message was sent.",
          "system",
        );
      }
    }
  }
  command(input: unknown, source: "ui" | "mcp" = "ui"): AppState {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success)
      throw new ServiceError(
        400,
        "Command does not match the required schema.",
      );
    const c = parsed.data;
    return this.update((s) => {
      const actor = s.actors.find((a) => a.id === c.actorId);
      if (!actor) throw new ServiceError(400, "Unknown actor");
      const v = s.visits.find((v) => v.id === c.visitId);
      if (!v) throw new ServiceError(404, "Visit not found");
      if (c.type === "set_visit") {
        if (!["family", "coordinator"].includes(actor.role))
          throw new ServiceError(
            403,
            "Only the family or coordinator can edit the plan",
          );
        if (Date.parse(c.end) <= Date.parse(c.start))
          throw new ServiceError(400, "Visit end must follow its start");
        if (
          ![c.backupPlan.primaryActorId, c.backupPlan.backupActorId].every(
            (id) => s.actors.some((a) => a.id === id),
          )
        )
          throw new ServiceError(400, "Unknown backup contact");
        if (v.task && v.task.status !== "resolved")
          throw new ServiceError(
            409,
            "Record the current outcome before changing this visit plan",
          );
        const scheduleChanged =
          Date.parse(c.start) !== Date.parse(v.start) ||
          Date.parse(c.end) !== Date.parse(v.end) ||
          c.graceMinutes !== v.graceMinutes;
        if (
          scheduleChanged &&
          (v.observations.length > 0 || v.statements.length > 0)
        )
          throw new ServiceError(
            409,
            "Cannot change the visit schedule after evidence is recorded. This local prototype keeps one visit window; reset replay for a new scenario.",
            "schedule_has_evidence",
          );
        Object.assign(v, {
          title: c.title,
          start: new Date(c.start).toISOString(),
          end: new Date(c.end).toISOString(),
          graceMinutes: c.graceMinutes,
          backupPlan: c.backupPlan,
        });
        this.log(
          s,
          c.type,
          "Visit plan updated",
          c.backupPlan.instructions,
          source,
          c.actorId,
        );
        return;
      }
      if (
        c.type === "claim_task" ||
        c.type === "release_task" ||
        c.type === "resolve_task"
      ) {
        const t = v.task;
        if (!t || t.id !== c.taskId || t.status === "resolved")
          throw new ServiceError(409, "No open task with this ID");
        if (c.type === "claim_task") {
          if (t.ownerId && t.ownerId !== c.actorId)
            throw new ServiceError(
              409,
              `Task is owned by ${s.actors.find((a) => a.id === t.ownerId)?.name}`,
              "task_owned",
            );
          if (
            Date.parse(c.eta) < Date.parse(s.currentTime) ||
            Date.parse(c.eta) > Date.parse(addMinutes(s.currentTime, 240))
          )
            throw new ServiceError(400, "ETA must be in the next four hours");
          if (t.ownerId === c.actorId) return;
          t.ownerId = c.actorId;
          t.claimedAt = s.currentTime;
          t.eta = new Date(c.eta).toISOString();
          t.status = "claimed";
          this.log(
            s,
            c.type,
            "Responsibility accepted",
            "An owner accepted the follow-up. An outcome is still needed.",
            source,
            c.actorId,
          );
          return;
        }
        if (t.ownerId !== c.actorId && actor.role !== "coordinator")
          throw new ServiceError(
            403,
            "Only the task owner or coordinator can update this task",
          );
        if (c.type === "release_task") {
          t.ownerId = null;
          t.eta = null;
          t.status = "open";
          this.log(
            s,
            c.type,
            "Responsibility released",
            c.note,
            source,
            c.actorId,
          );
          return;
        }
        t.status = "resolved";
        t.resolvedAt = s.currentTime;
        t.resolution = c.note;
        v.statements.push({
          id: randomUUID(),
          actorId: c.actorId,
          at: s.currentTime,
          source,
          kind: "outcome",
          note: c.note,
          outcome: c.outcome,
        });
        this.log(s, c.type, "Outcome recorded", c.note, source, c.actorId);
        return;
      }
      if (
        c.type === "report_delay" &&
        (Date.parse(c.eta) <= Date.parse(s.currentTime) ||
          Date.parse(c.eta) > Date.parse(addMinutes(s.currentTime, 1440)))
      )
        throw new ServiceError(400, "Delay ETA must be within the next day");
      v.statements.push({
        id: randomUUID(),
        actorId: c.actorId,
        at: s.currentTime,
        source,
        kind:
          c.type === "confirm_visit"
            ? "confirmed"
            : c.type === "report_not_happened"
              ? "not_happened"
              : "delay",
        note: c.note,
        ...(c.type === "report_delay"
          ? { eta: new Date(c.eta).toISOString() }
          : {}),
      });
      const view = project(s).visits.find((v) => v.id === c.visitId)!;
      if (
        view.status === "resolved" &&
        v.task &&
        v.task.status !== "resolved"
      ) {
        v.task.status = "resolved";
        v.task.resolvedAt = s.currentTime;
        v.task.resolution = c.note;
      }
      this.log(
        s,
        c.type,
        c.type === "confirm_visit"
          ? "Human confirmation recorded"
          : c.type === "report_not_happened"
            ? "Visit reported not happened"
            : "Delay reported",
        c.note,
        source,
        c.actorId,
      );
    });
  }
  replay(input: unknown): AppState {
    const parsed = replaySchema.safeParse(input);
    if (!parsed.success) throw new ServiceError(400, "Invalid replay command");
    const c = parsed.data;
    if (this.mode !== "replay")
      throw new ServiceError(
        409,
        "Replay cannot enter the connected household",
      );
    return this.update((s) => {
      if (c.type === "scenario") {
        const previous = s.timeline;
        const revision = s.revision;
        const integrations = s.integrations;
        Object.assign(s, initialSnapshot("replay"), {
          revision,
          timeline: previous,
          integrations,
        });
        this.log(
          s,
          "scenario",
          "Fictional replay reset",
          `${c.scenario} scenario — synthetic participants and evidence.`,
          "replay",
        );
        if (c.scenario === "outage")
          s.visits[0].coverage.intervals = [
            {
              start: s.currentTime,
              end: null,
              status: "offline",
              source: "replay",
            },
          ];
        if (c.scenario === "normal")
          s.visits[0].statements.push({
            id: randomUUID(),
            actorId: "resident",
            at: s.currentTime,
            source: "replay",
            kind: "confirmed",
            note: "Fictional resident confirms the visit happened.",
          });
        if (c.scenario === "disputed")
          s.visits[0].statements.push(
            {
              id: randomUUID(),
              actorId: "family",
              at: s.currentTime,
              source: "replay",
              kind: "confirmed",
              note: "Fictional family reports completion.",
            },
            {
              id: randomUUID(),
              actorId: "resident",
              at: s.currentTime,
              source: "replay",
              kind: "not_happened",
              note: "Fictional resident reports nobody came.",
            },
          );
      } else if (c.type === "advance") {
        s.currentTime = addMinutes(s.currentTime, c.minutes);
        this.log(
          s,
          "clock_advanced",
          "Replay clock advanced",
          `${c.minutes} minutes, fictional clock.`,
          "replay",
        );
      } else if (c.type === "coverage")
        this.coverage(s, c.status, "replay", s.currentTime);
      else
        this.observation(s, {
          id: c.eventId,
          deviceId: "front-door",
          observedAt: c.observedAt
            ? new Date(c.observedAt).toISOString()
            : s.currentTime,
          receivedAt: s.currentTime,
          type: c.eventType,
          subtype: null,
          source: "replay",
          description:
            "Fictional doorstep activity; identity and care remain unconfirmed.",
        });
    });
  }
  private coverage(
    s: AppState,
    status: CoverageStatus,
    source: "replay" | "ring",
    at: string,
  ) {
    const v = s.visits.find((v) => v.id === s.activeVisitId)!;
    const latest = v.coverage.intervals.at(-1);
    if (
      latest?.status === status ||
      (latest && Date.parse(at) < Date.parse(latest.start))
    )
      return;
    if (latest) latest.end = at;
    v.coverage.intervals.push({ start: at, end: null, status, source });
    this.log(
      s,
      "coverage",
      `Camera coverage ${status}`,
      "Coverage does not establish whether care happened.",
      source,
      null,
      at,
    );
  }
  private observation(s: AppState, event: DoorstepObservation) {
    const v = s.visits.find((v) => v.id === s.activeVisitId)!;
    if (v.observations.some((e) => e.id === event.id)) return;
    v.observations.push(event);
    this.log(
      s,
      "doorstep",
      "Doorstep activity observed",
      event.description,
      event.source,
      null,
      event.observedAt,
    );
  }
  ingestRing(
    events: DoorstepObservation[],
    statuses: Array<{ id: string; coverage: CoverageStatus }>,
    integration: IntegrationStatus["ring"],
  ): AppState {
    if (this.mode !== "live")
      throw new ServiceError(
        409,
        "Ring events must use the separate connected household",
      );
    const now = this.now();
    if (
      events.some(
        (event) =>
          event.source !== "ring" ||
          !Number.isFinite(Date.parse(event.observedAt)) ||
          Date.parse(event.observedAt) > Date.parse(now),
      )
    )
      throw new ServiceError(
        400,
        "Ring observation time is invalid or in the future",
      );
    return this.update((s) => {
      s.integrations.ring = integration;
      const selected = statuses[0];
      this.coverage(s, selected?.coverage ?? "unknown", "ring", s.currentTime);
      for (const event of events) this.observation(s, event);
      this.log(
        s,
        "ring_sync",
        "Ring API verified",
        "Server-side device discovery, status and event-history requests succeeded. Coverage is the current status of the first discovered device; past continuity remains unknown.",
        "ring",
      );
    });
  }
  ingestWebhook(event: NormalizedWebhook): AppState {
    if (this.mode !== "live")
      throw new ServiceError(
        409,
        "Ring events must use the separate connected household",
      );
    if (
      !this.state().integrations.ring.devices.some(
        (d) => d.id === event.deviceId,
      )
    )
      throw new ServiceError(
        403,
        "Webhook device is outside the connected scope",
      );
    if (
      !Number.isFinite(Date.parse(event.observedAt)) ||
      Date.parse(event.observedAt) > Date.parse(this.now())
    )
      throw new ServiceError(
        400,
        "Ring observation time is invalid or in the future",
      );
    return this.update((s) => {
      if (
        s.timeline.some(
          (e) => e.type === "webhook" && e.detail === event.eventId,
        )
      )
        return;
      if (event.observation) this.observation(s, event.observation);
      if (event.coverage) {
        const priorDeviceTime =
          s.timeline
            .filter(
              (e) =>
                e.type === "device_coverage" && e.detail === event.deviceId,
            )
            .map((e) => Date.parse(e.observedAt ?? e.at))
            .reduce(
              (latest, time) => Math.max(latest, time),
              s.integrations.ring.lastVerifiedAt
                ? Date.parse(s.integrations.ring.lastVerifiedAt)
                : -Infinity,
            );
        if (Date.parse(event.observedAt) >= priorDeviceTime) {
          const device = s.integrations.ring.devices.find(
            (d) => d.id === event.deviceId,
          )!;
          device.coverage = event.coverage;
          this.log(
            s,
            "device_coverage",
            `Device coverage ${event.coverage}`,
            event.deviceId,
            "ring",
            null,
            event.observedAt,
          );
          if (s.integrations.ring.devices[0]?.id === event.deviceId)
            this.coverage(s, event.coverage, "ring", event.observedAt);
        }
      }
      this.log(
        s,
        "webhook",
        "Signed Ring webhook received",
        event.eventId,
        "ring",
        null,
        event.observedAt,
      );
    });
  }
  enterLive() {
    this.mode = "live";
    this.store.ensure("live", this.now());
    this.tick();
    this.events.emit("state", this.state());
  }
  enterReplay() {
    this.mode = "replay";
    this.store.ensure("replay", this.now());
    this.events.emit("state", this.state());
  }
  integrationFailure(status: "expired" | "error", error: string) {
    return this.update((s) => {
      s.integrations.ring.status = status;
      s.integrations.ring.error = error;
      s.integrations.ring.lastSyncAt = this.now();
      if (s.mode === "live") this.coverage(s, "unknown", "ring", s.currentTime);
    });
  }
  tick() {
    this.update(() => {});
  }
  receipt(): VisitReceipt {
    const s = this.state();
    const visit = s.visits.find((v) => v.id === s.activeVisitId) ?? null;
    return {
      generatedAt: s.currentTime,
      mode: s.mode,
      fictional: s.household.fictional,
      household: s.household,
      visit,
      actors: s.actors,
      timeline: s.timeline.filter((e) => e.visitId === s.activeVisitId),
      unknowns: [
        "Camera activity does not prove identity, entry, completed care or safety.",
        "Current camera status does not certify past continuous coverage.",
        ...(visit?.coverage.status !== "online"
          ? ["Camera coverage is unavailable or unknown."]
          : []),
        ...(visit?.status !== "resolved"
          ? ["The visit outcome has not been settled."]
          : []),
      ],
      evidenceRule:
        "Observed doorstep activity and human statements are separate evidence. Only people record visit outcomes.",
    };
  }
  close() {
    this.store.close();
    this.events.removeAllListeners();
  }
}
