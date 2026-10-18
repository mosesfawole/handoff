import type { AppState, Mode, Visit } from "../shared/types";
export const addMinutes = (at: string, minutes: number) =>
  new Date(Date.parse(at) + minutes * 60_000).toISOString();
export function initialSnapshot(
  mode: Mode,
  now = new Date().toISOString(),
): AppState {
  const replay = mode === "replay";
  const currentTime = replay ? "2026-10-18T07:12:00.000Z" : now;
  const start = replay ? "2026-10-18T07:00:00.000Z" : now;
  const end = replay ? "2026-10-18T07:15:00.000Z" : addMinutes(now, 15);
  const visit: Visit = {
    id: replay ? "morning-visit" : "live-visit",
    title: replay
      ? "Morning care visit"
      : "Connected visit — configure your plan",
    start,
    end,
    graceMinutes: 10,
    confirmationDue: addMinutes(end, 10),
    backupPlan: {
      primaryActorId: "helper",
      backupActorId: "coordinator",
      responseMinutes: 10,
      instructions:
        "Check in with the resident. If unavailable, ask the coordinator to arrange a visit.",
    },
    status: "scheduled",
    coverage: {
      status: replay ? "online" : "unknown",
      intervals: [
        {
          start: currentTime,
          end: null,
          status: replay ? "online" : "unknown",
          source: replay ? "replay" : "system",
        },
      ],
    },
    observations: [],
    statements: [],
    task: null,
  };
  return {
    revision: 0,
    mode,
    currentTime,
    household: {
      id: replay ? "fictional-household" : "connected-household",
      name: replay ? "The Rowan household" : "Connected household",
      timezone: "Europe/Berlin",
      fictional: replay,
      consent: replay
        ? "Fictional consenting participants for this replay."
        : "Consent is not verified. Configure this local plan only for a consenting household.",
    },
    actors: [
      {
        id: "family",
        name: replay ? "Alex Rowan" : "Family contact",
        role: "family",
      },
      {
        id: "resident",
        name: replay ? "Jo Rowan" : "Resident",
        role: "resident",
      },
      {
        id: "helper",
        name: replay ? "Sam Ellis" : "Backup helper",
        role: "helper",
      },
      {
        id: "coordinator",
        name: replay ? "Taylor Chen" : "Coordinator",
        role: "coordinator",
      },
    ],
    visits: [visit],
    activeVisitId: visit.id,
    timeline: [],
    metrics: {
      label: replay
        ? "Fictional replay measurements"
        : "Local workflow measurements",
      followUps: 0,
      unresolvedTasks: 0,
      acceptedAfterMinutes: null,
      resolvedAfterMinutes: null,
    },
    integrations: {
      ring: {
        configured: false,
        webhookConfigured: false,
        status: "not_configured",
        lastSyncAt: null,
        lastVerifiedAt: null,
        error: null,
        devices: [],
      },
      mcp: {
        available: true,
        endpoint: "/mcp",
        protocol: "2025-11-25",
        writesConfigured: false,
        label: "Local MCP demonstration; no Alexa session",
      },
    },
  };
}
export function project(snapshot: AppState): AppState {
  const state = structuredClone(snapshot);
  for (const visit of state.visits) {
    visit.confirmationDue = addMinutes(visit.end, visit.graceMinutes);
    const latestOutcomeIndex = visit.statements.findLastIndex(
      (s) => s.kind === "outcome",
    );
    const relevant = visit.statements
      .slice(latestOutcomeIndex + 1)
      .filter((s) => s.kind === "confirmed" || s.kind === "not_happened");
    const yes = relevant.some((s) => s.kind === "confirmed");
    const no = relevant.some((s) => s.kind === "not_happened");
    const resolved = latestOutcomeIndex >= 0 && relevant.length === 0;
    visit.status =
      (yes && no) || (latestOutcomeIndex >= 0 && no)
        ? "disputed"
        : resolved || (yes && !no)
          ? "resolved"
          : Date.parse(state.currentTime) >= Date.parse(visit.confirmationDue)
            ? "overdue"
            : Date.parse(state.currentTime) >= Date.parse(visit.start)
              ? "awaiting_confirmation"
              : "scheduled";
    visit.coverage.status =
      [...visit.coverage.intervals]
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        .at(-1)?.status ?? "unknown";
  }
  const tasks = state.visits.flatMap((v) => (v.task ? [v.task] : []));
  state.metrics.followUps = state.timeline.filter(
    (e) => e.type === "task_created",
  ).length;
  state.metrics.unresolvedTasks = tasks.filter(
    (t) => t.status !== "resolved",
  ).length;
  const task = state.visits.find((v) => v.id === state.activeVisitId)?.task;
  state.metrics.acceptedAfterMinutes = task?.claimedAt
    ? (Date.parse(task.claimedAt) - Date.parse(task.createdAt)) / 60_000
    : null;
  state.metrics.resolvedAfterMinutes = task?.resolvedAt
    ? (Date.parse(task.resolvedAt) - Date.parse(task.createdAt)) / 60_000
    : null;
  return state;
}
