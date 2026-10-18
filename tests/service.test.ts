import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { HandoffService } from "../server/service";
const resources: Array<{ service: HandoffService; dir: string }> = [];
function create(now?: () => string) {
  const dir = mkdtempSync(join(tmpdir(), "handoff-"));
  const path = join(dir, "state.sqlite");
  const service = new HandoffService({ dbPath: path, mode: "replay", now });
  resources.push({ service, dir });
  return { service, path };
}
afterEach(() => {
  const all = resources.splice(0);
  for (const r of all) r.service.close();
  for (const dir of new Set(all.map((r) => r.dir)))
    rmSync(dir, { recursive: true, force: true });
});
describe("real SQLite workflow transactions", () => {
  it("duplicate observations cannot duplicate the timeline or action", () => {
    const { service } = create();
    service.replay({
      type: "doorstep",
      eventId: "door-1",
      eventType: "motion",
    });
    const before = service.state();
    service.replay({
      type: "doorstep",
      eventId: "door-1",
      eventType: "motion",
    });
    expect(service.state().visits[0].observations).toHaveLength(1);
    expect(service.state().revision).toBe(before.revision);
    service.replay({ type: "advance", minutes: 15 });
    service.tick();
    service.tick();
    expect(
      service.state().timeline.filter((e) => e.type === "task_created"),
    ).toHaveLength(1);
    expect(service.state().visits[0].task?.deadline).toBe(
      "2026-10-18T07:35:00.000Z",
    );
  });
  it("a second claimant cannot steal ownership and restart cannot erase deadlines", () => {
    const { service, path } = create();
    service.replay({ type: "advance", minutes: 15 });
    const taskId = service.state().visits[0].task!.id;
    service.command({
      type: "claim_task",
      actorId: "helper",
      visitId: "morning-visit",
      taskId,
      eta: "2026-10-18T07:33:00.000Z",
    });
    expect(() =>
      service.command({
        type: "claim_task",
        actorId: "coordinator",
        visitId: "morning-visit",
        taskId,
        eta: "2026-10-18T07:34:00.000Z",
      }),
    ).toThrow(/owned/i);
    const deadline = service.state().visits[0].task!.deadline;
    service.close();
    const reopened = new HandoffService({ dbPath: path, mode: "replay" });
    resources.push({ service: reopened, dir: resources[0].dir });
    expect(reopened.state().visits[0].task).toMatchObject({
      ownerId: "helper",
      deadline,
      claimedAt: "2026-10-18T07:27:00.000Z",
    });
    expect(reopened.receipt().visit?.status).toBe("overdue");
  });
  it.each([
    { type: "advance", minutes: -1 },
    { type: "advance", minutes: 1, unknown: true },
    { type: "scenario", scenario: "fake" },
  ])("rejects invalid replay command %j", (input) => {
    const { service } = create();
    expect(() => service.replay(input)).toThrow();
  });
  it("rejects backwards scheduling and unknown actors before appending", () => {
    const { service } = create();
    const revision = service.state().revision;
    expect(() =>
      service.command({
        type: "set_visit",
        actorId: "family",
        visitId: "morning-visit",
        title: "Morning",
        start: "2026-10-18T08:00:00Z",
        end: "2026-10-18T07:00:00Z",
        graceMinutes: 10,
        backupPlan: {
          primaryActorId: "helper",
          backupActorId: "coordinator",
          responseMinutes: 10,
          instructions: "Check in",
        },
      }),
    ).toThrow();
    expect(() =>
      service.command({
        type: "confirm_visit",
        actorId: "stranger",
        visitId: "morning-visit",
        note: "Done",
      }),
    ).toThrow();
    expect(service.state().revision).toBe(revision);
  });
  it("claimed response deadlines still escalate exactly once, and a delay does not erase the task", () => {
    const { service } = create();
    service.replay({ type: "advance", minutes: 15 });
    const taskId = service.state().visits[0].task!.id;
    service.command({
      type: "claim_task",
      actorId: "helper",
      visitId: "morning-visit",
      taskId,
      eta: "2026-10-18T07:33:00Z",
    });
    service.command({
      type: "report_delay",
      actorId: "helper",
      visitId: "morning-visit",
      eta: "2026-10-18T07:50:00Z",
      note: "Delayed, still following up.",
    });
    expect(service.state().visits[0]).toMatchObject({
      status: "overdue",
      task: {
        id: taskId,
        deadline: "2026-10-18T07:35:00.000Z",
        ownerId: "helper",
      },
    });
    service.replay({ type: "advance", minutes: 10 });
    service.tick();
    expect(service.state().visits[0].task).toMatchObject({
      status: "claimed",
      escalatedAt: "2026-10-18T07:35:00.000Z",
    });
    expect(
      service.state().timeline.filter((e) => e.type === "task_escalated"),
    ).toHaveLength(1);
  });
  it("a further confirmation cannot settle a dispute; an explicit recorded follow-up can", () => {
    const { service } = create();
    service.replay({ type: "scenario", scenario: "disputed" });
    service.command({
      type: "confirm_visit",
      actorId: "helper",
      visitId: "morning-visit",
      note: "I think it happened.",
    });
    expect(service.state().visits[0].status).toBe("disputed");
    const taskId = service.state().visits[0].task!.id;
    service.command({
      type: "resolve_task",
      actorId: "coordinator",
      visitId: "morning-visit",
      taskId,
      outcome: "follow_up_recorded",
      note: "Called the resident and arranged another visit; original care remains disputed.",
    });
    expect(service.receipt().visit).toMatchObject({
      status: "resolved",
      task: { status: "resolved" },
    });
    expect(service.receipt().visit!.statements.at(-1)).toMatchObject({
      kind: "outcome",
      outcome: "follow_up_recorded",
      actorId: "coordinator",
    });
    expect(
      service
        .receipt()
        .visit!.statements.filter((s) => s.kind === "not_happened"),
    ).toHaveLength(1);
  });
  it("Ring records cannot enter replay or accept future input at service ingress", () => {
    const { service } = create();
    const event = {
      id: "future",
      deviceId: "door",
      observedAt: "2099-01-01T00:00:00Z",
      receivedAt: "2099-01-01T00:00:00Z",
      source: "ring" as const,
      type: "motion" as const,
      subtype: null,
      description: "Motion",
    };
    const integration = {
      configured: true,
      webhookConfigured: true,
      status: "connected" as const,
      lastSyncAt: "2026-10-18T07:12:00Z",
      lastVerifiedAt: "2026-10-18T07:12:00Z",
      error: null,
      devices: [{ id: "door", name: "Front", coverage: "online" as const }],
    };
    expect(() => service.ingestRing([event], [], integration)).toThrow(
      /separate connected/i,
    );
    service.enterLive();
    expect(() => service.ingestRing([event], [], integration)).toThrow(
      /future/i,
    );
  });
  it("a different discovered camera cannot change the selected camera headline coverage", () => {
    const { service } = create(() => "2026-10-18T07:12:00.000Z");
    service.enterLive();
    const now = service.state().currentTime;
    const devices = [
      { id: "front", name: "Front door", coverage: "online" as const },
      { id: "garden", name: "Garden", coverage: "online" as const },
    ];
    service.ingestRing([], devices, {
      configured: true,
      webhookConfigured: true,
      status: "connected",
      lastSyncAt: now,
      lastVerifiedAt: now,
      error: null,
      devices,
    });
    service.ingestWebhook({
      eventId: "garden-offline",
      deviceId: "garden",
      observedAt: now,
      coverage: "offline",
    });
    expect(service.state().visits[0].coverage.status).toBe("online");
    expect(service.state().integrations.ring.devices).toEqual([
      { id: "front", name: "Front door", coverage: "online" },
      { id: "garden", name: "Garden", coverage: "offline" },
    ]);
    service.ingestWebhook({
      eventId: "front-offline",
      deviceId: "front",
      observedAt: now,
      coverage: "offline",
    });
    expect(service.state().visits[0].coverage.status).toBe("offline");
    expect(service.state().integrations.ring.devices[0].coverage).toBe(
      "offline",
    );
  });
  it("a delayed coverage webhook cannot overwrite a newer sync after an earlier webhook", () => {
    let now = "2026-10-18T07:12:00.000Z";
    const { service } = create(() => now);
    service.enterLive();
    const devices = [
      { id: "front", name: "Front door", coverage: "online" as const },
    ];
    const integration = {
      configured: true,
      webhookConfigured: true,
      status: "connected" as const,
      lastSyncAt: now,
      lastVerifiedAt: now,
      error: null,
      devices,
    };
    service.ingestRing([], devices, integration);
    now = "2026-10-18T07:13:00.000Z";
    service.ingestWebhook({
      eventId: "front-offline-first",
      deviceId: "front",
      observedAt: now,
      coverage: "offline",
    });
    expect(service.state().integrations.ring.devices[0].coverage).toBe(
      "offline",
    );

    now = "2026-10-18T07:15:00.000Z";
    service.ingestRing([], devices, {
      ...integration,
      lastSyncAt: now,
      lastVerifiedAt: now,
    });
    service.ingestWebhook({
      eventId: "front-offline-delayed",
      deviceId: "front",
      observedAt: "2026-10-18T07:14:00.000Z",
      coverage: "offline",
    });
    const state = service.state();
    expect(state.visits[0].coverage.status).toBe("online");
    expect(state.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "webhook",
          detail: "front-offline-delayed",
          observedAt: "2026-10-18T07:14:00.000Z",
        }),
      ]),
    );
    expect(state.integrations.ring.devices[0].coverage).toBe("online");
    expect(
      state.timeline.filter((e) => e.type === "device_coverage"),
    ).toHaveLength(1);
  });
  it.each(["human", "doorstep"])(
    "schedule edits cannot attach old %s evidence to a new expected window",
    (evidence) => {
      const { service } = create();
      if (evidence === "human")
        service.command({
          type: "confirm_visit",
          actorId: "resident",
          visitId: "morning-visit",
          note: "This visit happened.",
        });
      else
        service.replay({
          type: "doorstep",
          eventId: "doorstep-old",
          eventType: "motion",
        });
      const before = service.state();
      const visit = before.visits[0];
      expect(() =>
        service.command({
          type: "set_visit",
          actorId: "family",
          visitId: visit.id,
          title: visit.title,
          start: "2026-10-18T08:00:00Z",
          end: "2026-10-18T08:15:00Z",
          graceMinutes: 10,
          backupPlan: visit.backupPlan,
        }),
      ).toThrow(/schedule.*evidence/i);
      expect(service.state()).toEqual(before);
      expect(() =>
        service.command({
          type: "set_visit",
          actorId: "family",
          visitId: visit.id,
          title: visit.title,
          start: visit.start,
          end: visit.end,
          graceMinutes: 15,
          backupPlan: visit.backupPlan,
        }),
      ).toThrow(/schedule.*evidence/i);
      const updated = service.command({
        type: "set_visit",
        actorId: "family",
        visitId: visit.id,
        title: "Updated title",
        start: visit.start,
        end: visit.end,
        graceMinutes: visit.graceMinutes,
        backupPlan: {
          ...visit.backupPlan,
          instructions: "Updated agreed backup instructions.",
        },
      });
      expect(updated.visits[0]).toMatchObject({
        title: "Updated title",
        start: "2026-10-18T07:00:00.000Z",
        status: evidence === "human" ? "resolved" : "awaiting_confirmation",
      });
      expect(updated.visits[0].statements).toEqual(visit.statements);
      expect(updated.visits[0].observations).toEqual(visit.observations);
    },
  );
  it("delay preserves recorded resolution while a new contrary claim reopens a consistent disputed task", () => {
    const { service } = create();
    service.replay({ type: "scenario", scenario: "disputed" });
    const taskId = service.state().visits[0].task!.id;
    service.command({
      type: "resolve_task",
      actorId: "coordinator",
      visitId: "morning-visit",
      taskId,
      outcome: "follow_up_recorded",
      note: "Arranged a further visit and recorded the result.",
    });
    service.command({
      type: "report_delay",
      actorId: "helper",
      visitId: "morning-visit",
      eta: "2026-10-18T07:50:00Z",
      note: "Further visit delayed.",
    });
    expect(service.state().visits[0]).toMatchObject({
      status: "resolved",
      task: { id: taskId, status: "resolved" },
    });
    service.command({
      type: "report_not_happened",
      actorId: "resident",
      visitId: "morning-visit",
      note: "The recorded follow-up did not happen.",
    });
    expect(service.state().visits[0]).toMatchObject({
      status: "disputed",
      task: { status: "open", reason: "disputed" },
    });
    expect(service.state().visits[0].task!.id).not.toBe(taskId);
  });
});
