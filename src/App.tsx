import { useEffect, useState } from "react";
import type {
  ActorRole,
  AppState,
  Command,
  ReplayCommand,
  VisitReceipt,
} from "../shared/types";
import { api } from "./api";
import {
  date,
  fullDate,
  later,
  localIso,
  dateValue,
  outcomeDescription,
  person,
  shortName,
  statusLabel,
  time,
} from "./format";
import { BrandMark, Icon, type IconName } from "./components/Icon";
import { Modal } from "./components/Modal";
import { Journal } from "./components/Journal";
import { PlanEditor } from "./components/PlanEditor";
import { Integrations } from "./components/Integrations";

type Page = "today" | "plan" | "receipt" | "integrations";
type Dialog =
  | "claim"
  | "outcome"
  | "confirmed"
  | "not_happened"
  | "delay"
  | "release"
  | "reset"
  | "plan";
const pages: { key: Page; name: string; icon: IconName }[] = [
  { key: "today", name: "Today", icon: "today" },
  { key: "plan", name: "Care plan", icon: "plan" },
  { key: "receipt", name: "Receipt", icon: "receipt" },
  { key: "integrations", name: "Integrations", icon: "settings" },
];
export default function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [page, setPage] = useState<Page>("today");
  const [role, setRole] = useState<ActorRole>("family");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pendingPlan, setPendingPlan] = useState<Command | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [receipt, setReceipt] = useState<VisitReceipt | null>(null);
  const [scenario, setScenario] = useState<
    "overdue" | "outage" | "disputed" | "normal"
  >("overdue");
  const [compact, setCompact] = useState(
    () => window.matchMedia("(max-width: 980px)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(max-width: 980px)");
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    void api
      .state()
      .then((next) =>
        setState((previous) =>
          !previous ||
          previous.mode !== next.mode ||
          next.revision >= previous.revision
            ? next
            : previous,
        ),
      )
      .catch((e) => setError(e.message));
    const events = new EventSource("/api/events");
    events.addEventListener("state", (event) => {
      const next = JSON.parse((event as MessageEvent).data) as AppState;
      setState((previous) =>
        !previous ||
        previous.mode !== next.mode ||
        next.revision >= previous.revision
          ? next
          : previous,
      );
      setConnected(true);
    });
    events.onerror = () => setConnected(false);
    return () => events.close();
  }, []);
  useEffect(() => {
    if (page === "receipt" && state)
      void api
        .receipt()
        .then(setReceipt)
        .catch((e) => setError(e.message));
  }, [page, state?.revision, state?.mode]);
  async function perform(
    action: () => Promise<AppState>,
    message?: string,
    close = false,
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await action();
      setState(next);
      if (message) setNotice(message);
      if (close) setDialog(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The action could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }
  function open(next: Dialog) {
    setError(null);
    setNotice(null);
    setDialog(next);
  }
  function navigate(next: Page) {
    setPage(next);
    setError(null);
    setNotice(null);
    window.scrollTo({ top: 0 });
  }
  function replay(command: ReplayCommand) {
    void perform(() => api.replay(command));
  }
  if (!state)
    return (
      <div className="loading-screen">
        <BrandMark />
        <h1>Handoff</h1>
        <p>{error ?? "Opening the household journal…"}</p>
        {error && (
          <button
            className="button primary"
            onClick={() =>
              void api
                .state()
                .then(setState)
                .catch((e) => setError(e.message))
            }
          >
            Try again
          </button>
        )}
      </div>
    );
  const visit = state.visits.find((v) => v.id === state.activeVisitId);
  if (!visit)
    return (
      <div className="loading-screen">
        <h1>No active visit</h1>
        <button
          className="button primary"
          onClick={() => replay({ type: "scenario", scenario: "overdue" })}
        >
          Return to fictional replay
        </button>
      </div>
    );
  const actor = state.actors.find((a) => a.role === role)!;
  const task = visit.task;
  const owner = person(state, task?.ownerId);
  const canRecord =
    task &&
    task.status !== "resolved" &&
    (task.ownerId === actor.id || role === "coordinator");
  const status = statusLabel[visit.status];
  const resolved = visit.status === "resolved";
  const title = resolved
    ? "An outcome, carried through."
    : visit.status === "disputed"
      ? "Two accounts. One next step."
      : task?.status === "claimed"
        ? "Someone owns the next step."
        : "A visit planned.\nAn outcome still open.";
  const primaryContact = person(state, visit.backupPlan.primaryActorId);
  const nextContact = person(state, visit.backupPlan.backupActorId);
  const modalTitles: Record<Dialog, string> = {
    claim: "Take responsibility for the follow-up.",
    outcome:
      visit.status === "disputed"
        ? "Resolve the differing statements."
        : "Record what happened.",
    confirmed: "You’re confirming the visit happened.",
    not_happened: "You’re reporting that nobody came.",
    delay: "Record a delay.",
    release: "Release the follow-up.",
    reset: "Start a fictional replay.",
    plan: "Review the household plan.",
  };
  const submitLabels: Record<Dialog, string> = {
    claim: "Confirm acceptance",
    outcome: "Save outcome",
    confirmed: "Record statement",
    not_happened: "Record statement",
    delay: "Record delay",
    release: "Release responsibility",
    reset: "Start fictional replay",
    plan: "Save plan",
  };
  function submit(form: FormData) {
    if (!dialog || !visit) return;
    const base = { actorId: actor.id, visitId: visit.id };
    const note = String(form.get("note") ?? "").trim();
    const eta = () =>
      localIso(dateValue(state!.currentTime), String(form.get("eta")));
    if (dialog === "reset") {
      void perform(
        () => api.replay({ type: "scenario", scenario }),
        "Fictional replay started",
        true,
      );
      return;
    }
    if (dialog === "plan" && pendingPlan) {
      void perform(() => api.command(pendingPlan), "Plan saved", true);
      return;
    }
    let command: Command;
    if (dialog === "claim")
      command = { type: "claim_task", ...base, taskId: task!.id, eta: eta() };
    else if (dialog === "outcome")
      command = {
        type: "resolve_task",
        ...base,
        taskId: task!.id,
        note,
        outcome: String(form.get("outcome")) as
          | "visit_confirmed"
          | "backup_completed"
          | "follow_up_recorded",
      };
    else if (dialog === "release")
      command = { type: "release_task", ...base, taskId: task!.id, note };
    else if (dialog === "delay")
      command = { type: "report_delay", ...base, note, eta: eta() };
    else
      command = {
        type: dialog === "confirmed" ? "confirm_visit" : "report_not_happened",
        ...base,
        note,
      };
    void perform(() => api.command(command), undefined, true);
  }
  async function downloadReceipt() {
    setBusy(true);
    setError(null);
    try {
      const value = await api.receipt();
      setReceipt(value);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(value, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `handoff-receipt-${dateValue(state!.currentTime)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Receipt could not be downloaded.",
      );
    } finally {
      setBusy(false);
    }
  }
  const actions = (
    <>
      {role === "resident" ? (
        <div className="resident-actions">
          <p className="eyebrow">Your own account</p>
          <h2>{shortName(actor)}, did the visit happen?</h2>
          <p>
            You can record what you experienced. Your statement is kept
            alongside other evidence.
          </p>
          <button
            className="button primary resident-button"
            disabled={busy}
            onClick={() => open("confirmed")}
          >
            <Icon name="check" />
            The visit happened
          </button>
          <button
            className="button secondary resident-button"
            disabled={busy}
            onClick={() => open("not_happened")}
          >
            <Icon name="person" />
            Nobody came
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => open("delay")}
          >
            Someone is running late
            <Icon name="arrow" />
          </button>
        </div>
      ) : (
        <div className={`next-action ${resolved ? "completed" : ""}`}>
          <div className="card-top">
            <p className="eyebrow">
              {resolved ? "Recorded by a person" : "Next accountable action"}
            </p>
            <Icon name={resolved ? "check" : "arrow"} />
          </div>
          <h2>
            {resolved
              ? "The outcome is on record."
              : task?.status === "claimed"
                ? "Outcome still open"
                : visit.status === "disputed"
                  ? "Bring the accounts together."
                  : task
                    ? "Put a person on the follow-up."
                    : "Ask for a human confirmation."}
          </h2>
          <p>
            {resolved
              ? outcomeDescription(state, visit)
              : task?.status === "claimed"
                ? `${shortName(owner)} is following up. ETA ${task.eta ? time(task.eta) : "not recorded"}. Acceptance is recorded; an outcome is still needed.`
                : visit.status === "disputed"
                  ? "The statements differ. The task owner or coordinator must record an explicit outcome."
                  : task
                    ? `${shortName(primaryContact)} is the agreed first contact. The visit remains unconfirmed until a person records what happened.`
                    : `Confirmation is due at ${time(visit.confirmationDue)}. Doorstep activity cannot confirm a completed visit.`}
          </p>
          {task && !resolved && (
            <div className="deadline-row">
              <Icon name="clock" />
              <span>
                Response deadline <strong>{time(task.deadline)}</strong>
              </span>
            </div>
          )}
          {task?.escalatedAt && task.status !== "resolved" && (
            <div className="escalation">
              <strong>Response deadline passed</strong>
              <p>
                {shortName(person(state, task.escalationActorId))} is the agreed
                next contact. No external message was sent.
              </p>
            </div>
          )}
          {!resolved &&
            task &&
            !task.ownerId &&
            (role === "helper" ||
              role === "coordinator" ||
              role === "family") && (
              <button
                className="button primary"
                disabled={busy}
                onClick={() => open("claim")}
              >
                Accept follow-up
                <Icon name="arrow" />
              </button>
            )}
          {canRecord && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => open("outcome")}
            >
              {visit.status === "disputed"
                ? "Resolve disagreement"
                : "Record outcome"}
              <Icon name="arrow" />
            </button>
          )}
          {!resolved && !task && role !== "helper" && (
            <button
              className="button primary"
              disabled={busy}
              onClick={() => setRole("resident")}
            >
              Open resident view
              <Icon name="arrow" />
            </button>
          )}
          {!resolved && !task && role === "helper" && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => open("delay")}
            >
              Report a delay
              <Icon name="clock" />
            </button>
          )}
          {task?.ownerId && task.status !== "resolved" && !canRecord && (
            <div className="owner-note">
              <Icon name="person" />
              {owner?.name} owns this follow-up.
            </div>
          )}
          {canRecord && task?.ownerId && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => open("release")}
            >
              Release responsibility
            </button>
          )}
          {resolved && (
            <button
              className="button secondary"
              onClick={() => navigate("receipt")}
            >
              View the receipt
              <Icon name="receipt" />
            </button>
          )}
        </div>
      )}
    </>
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("today");
          }}
        >
          <BrandMark />
          <span>Handoff</span>
        </a>
        <p className="brand-line">Care, carried through.</p>
        <div className="household-label">
          <span className="avatar">
            {state.household.fictional ? "R" : "H"}
          </span>
          <div>
            <strong>
              {state.household.fictional
                ? "Rowan household"
                : "Connected household"}
            </strong>
            <span>
              {state.household.fictional
                ? "Fictional participants"
                : "Local connected records"}
            </span>
          </div>
        </div>
        <nav aria-label="Workspace">
          {pages.slice(0, 3).map((item) => (
            <button
              key={item.key}
              aria-current={page === item.key ? "page" : undefined}
              onClick={() => navigate(item.key)}
            >
              <Icon name={item.icon} />
              {item.name}
              {item.key === "today" && task && task.status !== "resolved" && (
                <span className="nav-dot" />
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="evidence-rule">
            <Icon name="link" />
            <p>
              A doorstep event is evidence of activity.
              <br />
              <strong>A person confirms the outcome.</strong>
            </p>
          </div>
          <button
            className={`integration-nav ${page === "integrations" ? "active" : ""}`}
            onClick={() => navigate("integrations")}
          >
            <Icon name="settings" />
            Integrations
            <Icon name="arrow" size={16} />
          </button>
          <p className="local-label">LOCAL PROTOTYPE · 01</p>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mode-clock">
            <span className={`mode-tag ${state.mode}`}>
              <span />
              {state.mode === "replay" ? "Fictional replay" : "Live records"}
            </span>
            <div className="clock-label">
              <Icon name="clock" size={15} />
              <time>{time(state.currentTime)}</time>
              <span>
                {state.mode === "replay"
                  ? "paused · Berlin"
                  : "real time · Berlin"}
              </span>
            </div>
          </div>
          <label className="role-select">
            Demo view
            <select
              aria-label="Demo view"
              value={role}
              onChange={(e) => {
                setRole(e.target.value as ActorRole);
                setError(null);
                setNotice(null);
              }}
            >
              {state.actors.map((a) => (
                <option key={a.role} value={a.role}>
                  {a.role[0].toUpperCase() + a.role.slice(1)} · {a.name}
                </option>
              ))}
            </select>
          </label>
        </header>
        <div className="main-content">
          <div className="workspace-heading">
            <p>{state.household.name}</p>
            <span className={`stream-status ${connected ? "connected" : ""}`}>
              <span />
              {connected ? "Updates connected" : "Reconnecting updates…"}
            </span>
          </div>
          {error && !dialog && (
            <div className="error page-error" role="alert">
              <Icon name="warning" />
              <p>{error}</p>
              <button
                className="icon-button"
                aria-label="Dismiss error"
                onClick={() => setError(null)}
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              <Icon name="check" />
              {notice}
            </div>
          )}
          {state.mode === "live" && (
            <div className="live-banner">
              <span>
                Live household records · synthetic controls are in fictional
                replay.
              </span>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => open("reset")}
              >
                Return to fictional replay
                <Icon name="reset" />
              </button>
            </div>
          )}
          {page === "today" && (
            <div className="today-grid">
              <article className="visit-story">
                <div className="story-intro">
                  <p className="eyebrow">
                    {fullDate(visit.start)} ·{" "}
                    {role === "resident"
                      ? "Resident"
                      : role === "helper"
                        ? "Helper"
                        : role === "coordinator"
                          ? "Coordinator"
                          : "Family"}{" "}
                    view
                  </p>
                  <h1>{compact && role === "helper" ? (resolved ? "Your outcome is on record." : "Your next handoff.") : compact && role === "resident" ? "Your morning visit." : title}</h1>
                  <p className="story-subtitle">
                    {role === "helper"
                      ? `${actor.name} · Keep the handoff moving, then record what happened.`
                      : role === "coordinator"
                        ? "Keep the agreement clear, and make room for differing accounts."
                        : `For ${shortName(state.actors.find((a) => a.role === "resident"))}. A shared record of what was expected, observed and said.`}
                  </p>
                </div>
                <div className="visit-summary">
                  <div>
                    <p className="eyebrow">Expected visit</p>
                    <h2>{visit.title}</h2>
                  </div>
                  <div className="visit-window">
                    <strong>
                      {time(visit.start)}
                      <span>—</span>
                      {time(visit.end)}
                    </strong>
                    <span>Confirm by {time(visit.confirmationDue)}</span>
                  </div>
                </div>
                <div className="progression" aria-label="Visit progression">
                  {["Planned", "Confirmation", "Follow-up", "Outcome"].map(
                    (step, i) => (
                      <div
                        key={step}
                        className={
                          i === 0 ||
                          (i === 1 &&
                            visit.status !== "disputed" &&
                            visit.statements.some(
                              (s) =>
                                s.kind === "confirmed" ||
                                s.outcome === "visit_confirmed",
                            )) ||
                          (i === 2 && task?.status === "resolved") ||
                          (i === 3 && resolved)
                            ? "done"
                            : (i === 1 && !task && !resolved) ||
                                (i === 2 && task && !resolved)
                              ? "current"
                              : ""
                        }
                      >
                        <span>
                          {i === 0 || (i === 3 && resolved) ? (
                            <Icon name="check" size={13} />
                          ) : (
                            `0${i + 1}`
                          )}
                        </span>
                        <p>{step}</p>
                      </div>
                    ),
                  )}
                </div>
                <div className={`visit-status ${resolved ? "green" : "amber"}`}>
                  <span className="status-dot" />
                  <strong>{status}</strong>
                  <span>
                    {resolved
                      ? "A human account, preserved."
                      : visit.status === "disputed"
                        ? "Explicit resolution needed."
                        : task?.status === "claimed"
                          ? "A person owns the follow-up."
                          : "The outcome remains unknown."}
                  </span>
                </div>
                {compact && <div className="mobile-action">{actions}</div>}
                <section
                  className="evidence-overview"
                  aria-label="What we know"
                >
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Keep the signals separate</p>
                      <h2>What we know</h2>
                    </div>
                  </div>
                  <div className="evidence-grid">
                    <div className="evidence-block">
                      <div className="evidence-block-title">
                        <Icon name="camera" />
                        <strong>Doorstep activity</strong>
                      </div>
                      <p>
                        {visit.observations.length
                          ? resolved
                            ? "Doorstep activity was observed. The human account is recorded separately."
                            : visit.status === "disputed"
                              ? "Doorstep activity was observed. The human accounts still differ."
                              : visit.statements.some(
                                    (s) => s.kind === "confirmed",
                                  )
                                ? "Doorstep activity was observed. Human confirmation is a separate statement."
                                : "Doorstep activity was observed. Nobody has confirmed the visit yet."
                          : "No doorstep activity recorded."}
                      </p>
                      {visit.observations.length > 0 && (
                        <span className="quiet">
                          {visit.observations.length}{" "}
                          {state.mode === "replay"
                            ? "fictional observations"
                            : "Ring observations"}{" "}
                          · latest {time(visit.observations.at(-1)!.observedAt)}
                        </span>
                      )}
                      <p className="field-help">
                        Activity alone cannot establish identity or completed
                        care.
                      </p>
                    </div>
                    <div className="evidence-block">
                      <div className="evidence-block-title">
                        <span
                          className={`coverage-dot ${visit.coverage.status}`}
                        />
                        <strong>Camera {visit.coverage.status}</strong>
                      </div>
                      <p>
                        {visit.coverage.status === "offline"
                          ? "The camera is offline. We need a person's confirmation."
                          : visit.coverage.status === "unknown"
                            ? "Camera coverage is unknown. Ask a person about the visit."
                            : "Current coverage is online. Earlier continuity is not established."}
                      </p>
                      <span className="quiet">
                        {state.mode === "replay"
                          ? "Fictional camera status"
                          : "First discovered device · current status"}
                      </span>
                    </div>
                  </div>
                  <div className="statements-preview">
                    <div className="evidence-block-title">
                      <Icon name="person" />
                      <strong>Human statements</strong>
                      <span className="count-tag">
                        {visit.statements.length}
                      </span>
                    </div>
                    {visit.statements.length ? (
                      <ul>
                        {visit.statements.map((statement) => (
                          <li key={statement.id}>
                            <div>
                              <strong>
                                {person(state, statement.actorId)?.name}
                              </strong>
                              <time dateTime={statement.at}>
                                {time(statement.at)}
                              </time>
                              <span className="source-chip">
                                {statement.source === "replay"
                                  ? "Replay"
                                  : "Person"}
                              </span>
                            </div>
                            <p>{statement.note}</p>
                            {statement.eta && (
                              <span className="quiet">
                                Reported ETA {time(statement.eta)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No one has confirmed the visit yet.</p>
                    )}
                  </div>
                </section>
                <Journal state={state} />
              </article>
              <aside className="right-column">
                {!compact && <div className="desktop-action">{actions}</div>}
                <section className="household-plan">
                  <div className="section-heading">
                    <div>
                      <p className="eyebrow">Agreed in advance</p>
                      <h2>The backup plan</h2>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Open household plan"
                      onClick={() => navigate("plan")}
                    >
                      <Icon name="arrow" />
                    </button>
                  </div>
                  <div className="contact-row">
                    <span className="avatar small">
                      {shortName(primaryContact)[0]}
                    </span>
                    <div>
                      <strong>{primaryContact?.name}</strong>
                      <span>First follow-up contact</span>
                    </div>
                    <span className="contact-number">01</span>
                  </div>
                  <div className="contact-row">
                    <span className="avatar small cream">
                      {shortName(nextContact)[0]}
                    </span>
                    <div>
                      <strong>{nextContact?.name}</strong>
                      <span>
                        Next contact · after {visit.backupPlan.responseMinutes}{" "}
                        min
                      </span>
                    </div>
                    <span className="contact-number">02</span>
                  </div>
                  <p className="plan-instructions">
                    {visit.backupPlan.instructions}
                  </p>
                  <button
                    className="text-button"
                    onClick={() => navigate("plan")}
                  >
                    View agreed plan
                    <Icon name="arrow" size={17} />
                  </button>
                </section>
                <section className="measurement-card">
                  <p className="eyebrow">{state.metrics.label}</p>
                  <div>
                    <strong>{state.metrics.unresolvedTasks}</strong>
                    <span>
                      open follow-up
                      {state.metrics.unresolvedTasks === 1 ? "" : "s"}
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Accepted after</dt>
                      <dd>
                        {state.metrics.acceptedAfterMinutes === null
                          ? "—"
                          : `${state.metrics.acceptedAfterMinutes} min`}
                      </dd>
                    </div>
                    <div>
                      <dt>Outcome after</dt>
                      <dd>
                        {state.metrics.resolvedAfterMinutes === null
                          ? "—"
                          : `${state.metrics.resolvedAfterMinutes} min`}
                      </dd>
                    </div>
                  </dl>
                  <p>
                    Measured from the follow-up's creation. No clinical or
                    safety claim.
                  </p>
                </section>
              </aside>
            </div>
          )}
          {page === "plan" && (
            <PlanEditor
              key={`${visit.id}-${state.mode}-${state.timeline.findLast((e) => e.type === "scenario")?.id ?? "initial"}`}
              state={state}
              visit={visit}
              actorId={actor.id}
              editable={role === "family" || role === "coordinator"}
              busy={busy}
              onReview={(command) => {
                setPendingPlan(command);
                open("plan");
              }}
            />
          )}
          {page === "receipt" && (
            <section className="receipt-page">
              <div className="page-intro">
                <p className="eyebrow">A shared, durable account</p>
                <h1>The visit receipt.</h1>
                <p>
                  What was expected, what people recorded, and what remains
                  unknown.
                </p>
              </div>
              <div className="receipt-document">
                <div className="receipt-heading">
                  <div className="brand">
                    <BrandMark />
                    <span>Handoff</span>
                  </div>
                  <span className="mode-tag">
                    {state.mode === "replay"
                      ? "Fictional replay receipt"
                      : "Local connected receipt"}
                  </span>
                </div>
                <p className="eyebrow">
                  {state.household.name} · {date(visit.start)}
                </p>
                <h2>{visit.title}</h2>
                <div className="receipt-outcome">
                  <span className={`pill ${resolved ? "green" : "amber"}`}>
                    {status}
                  </span>
                  <p>
                    {resolved
                      ? outcomeDescription(state, visit)
                      : "An outcome has not been confirmed."}
                  </p>
                </div>
                <dl className="receipt-facts">
                  <div>
                    <dt>Expected window</dt>
                    <dd>
                      {time(visit.start)}–{time(visit.end)} · Berlin
                    </dd>
                  </div>
                  <div>
                    <dt>Confirmation due</dt>
                    <dd>{time(visit.confirmationDue)}</dd>
                  </div>
                  <div>
                    <dt>Follow-up owner</dt>
                    <dd>{owner?.name ?? "No owner recorded"}</dd>
                  </div>
                  <div>
                    <dt>Camera coverage</dt>
                    <dd>{visit.coverage.status} · current status only</dd>
                  </div>
                </dl>
                <h3>Human accounts</h3>
                {visit.statements.length ? (
                  visit.statements.map((s) => (
                    <div className="receipt-statement" key={s.id}>
                      <div>
                        <strong>{person(state, s.actorId)?.name}</strong>
                        <span>
                          {date(s.at)} · {time(s.at)} ·{" "}
                          {s.source === "replay" ? "Replay" : "Person"}
                        </span>
                      </div>
                      <p>{s.note}</p>
                      {s.outcome && (
                        <p className="quiet">
                          Recorded outcome: {s.outcome.replaceAll("_", " ")}
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="quiet">No human statements recorded.</p>
                )}
                <h3>What remains unknown</h3>
                <ul className="unknown-list">
                  {receipt?.unknowns.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <div className="receipt-rule">
                  <Icon name="link" />
                  <p>
                    {receipt?.evidenceRule ??
                      "A doorstep event is evidence of activity. A person confirms the outcome."}
                  </p>
                </div>
                <div className="receipt-download">
                  <span>
                    {receipt
                      ? `Generated ${date(receipt.generatedAt)} · ${time(receipt.generatedAt)} Berlin`
                      : "Loading current receipt…"}
                  </span>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void downloadReceipt()}
                  >
                    Download receipt
                    <Icon name="download" />
                  </button>
                </div>
              </div>
              <Journal state={state} complete />
            </section>
          )}
          {page === "integrations" && (
            <Integrations
              key={state.mode}
              state={state}
              busy={busy}
              onRing={() => void perform(api.ringSync)}
              onReplay={() => open("reset")}
              onError={setError}
            />
          )}
          {state.mode === "replay" && (
            <section className="replay-lab" aria-label="Replay controls">
              <div className="lab-heading">
                <span className="lab-icon">
                  <Icon name="reset" />
                </span>
                <div>
                  <p className="eyebrow">Try the handoff</p>
                  <h2>Fictional replay lab</h2>
                  <p>
                    Paused clock. Synthetic people and events. Your actions
                    persist until reset.
                  </p>
                </div>
              </div>
              <div className="lab-controls">
                <label>
                  Replay scenario
                  <select
                    value={scenario}
                    onChange={(e) =>
                      setScenario(e.target.value as typeof scenario)
                    }
                  >
                    <option value="overdue">Missing confirmation</option>
                    <option value="outage">Camera outage</option>
                    <option value="disputed">Differing statements</option>
                    <option value="normal">Visit confirmed</option>
                  </select>
                </label>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => open("reset")}
                >
                  Reset replay
                  <Icon name="reset" size={17} />
                </button>
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => replay({ type: "advance", minutes: 15 })}
                >
                  Advance 15 minutes
                  <Icon name="clock" size={17} />
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    replay({
                      type: "doorstep",
                      eventId: crypto.randomUUID(),
                      eventType: "motion",
                    })
                  }
                >
                  Add doorstep activity
                  <Icon name="camera" size={17} />
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() =>
                    replay({
                      type: "coverage",
                      status:
                        visit.coverage.status === "offline"
                          ? "online"
                          : "offline",
                    })
                  }
                >
                  {visit.coverage.status === "offline"
                    ? "Set camera online"
                    : "Set camera offline"}
                  <Icon name="camera" size={17} />
                </button>
              </div>
            </section>
          )}
          <footer className="workspace-footer">
            <span>Care, carried through.</span>
            <p>Local prototype · Demo roles are views, not authentication.</p>
          </footer>
        </div>
      </div>
      <nav className="bottom-nav" aria-label="Mobile workspace">
        {pages.map((item) => (
          <button
            key={item.key}
            aria-current={page === item.key ? "page" : undefined}
            onClick={() => navigate(item.key)}
          >
            <Icon name={item.icon} />
            <span>{item.name}</span>
          </button>
        ))}
      </nav>
      {dialog && (
        <Modal
          key={dialog}
          title={modalTitles[dialog]}
          eyebrow={
            dialog === "reset" ? "Replay controls" : "Review before recording"
          }
          busy={busy}
          error={error}
          onClose={() => {
            setDialog(null);
            setError(null);
          }}
          onSubmit={submit}
          submitLabel={submitLabels[dialog]}
        >
          {dialog !== "reset" && (
            <div className="record-author">
              <span className="avatar small">{shortName(actor)[0]}</span>
              <div>
                <strong>{actor.name}</strong>
                <span>
                  {role} demo view · {time(state.currentTime)} Berlin
                </span>
              </div>
            </div>
          )}
          {dialog === "claim" && (
            <>
              <p>
                Accepting gives this follow-up one owner. You will record the
                outcome separately after checking in.
              </p>
              <label>
                Arrival time
                <input
                  name="eta"
                  type="time"
                  defaultValue={time(later(state.currentTime, 6))}
                  required
                />
              </label>
              <p className="field-help">
                Today, Berlin time. ETA must be within the next four hours. The
                agreed response deadline remains {time(task!.deadline)}.
              </p>
            </>
          )}
          {dialog === "outcome" && (
            <>
              <p>
                Choose what you can substantiate. Your note remains alongside
                earlier statements, including any disagreement.
              </p>
              <label>
                Outcome
                <select name="outcome" defaultValue="backup_completed">
                  <option value="backup_completed">
                    Backup check-in completed
                  </option>
                  <option value="visit_confirmed">
                    Original visit confirmed
                  </option>
                  <option value="follow_up_recorded">
                    Follow-up recorded · original visit unconfirmed
                  </option>
                </select>
              </label>
              <label>
                What happened?
                <textarea
                  name="note"
                  rows={4}
                  required
                  maxLength={2000}
                  placeholder="Describe the check-in, who you spoke with, and what remains unknown."
                />
              </label>
            </>
          )}
          {(dialog === "confirmed" || dialog === "not_happened") && (
            <>
              <p>
                {dialog === "confirmed"
                  ? "This records your explicit statement that the planned visit happened. Doorstep activity alone is not enough."
                  : "This records your account that the visit did not happen. It may differ from another person’s statement and require follow-up."}
              </p>
              <label>
                Your note
                <textarea
                  name="note"
                  rows={4}
                  required
                  maxLength={2000}
                  defaultValue={
                    dialog === "confirmed"
                      ? "I confirm the planned visit happened."
                      : "Nobody came during the expected visit window."
                  }
                />
              </label>
            </>
          )}
          {dialog === "delay" && (
            <>
              <p>
                A delay note does not extend the original confirmation deadline
                or resolve an open follow-up.
              </p>
              <label>
                Arrival time
                <input
                  name="eta"
                  type="time"
                  defaultValue={time(later(state.currentTime, 15))}
                  required
                />
              </label>
              <label>
                Your note
                <textarea
                  name="note"
                  rows={3}
                  required
                  maxLength={2000}
                  placeholder="What delay has been reported?"
                />
              </label>
            </>
          )}
          {dialog === "release" && (
            <>
              <p>
                The follow-up will reopen without an owner. Keep a clear reason
                in the shared record.
              </p>
              <label>
                Your note
                <textarea name="note" rows={3} required maxLength={2000} />
              </label>
            </>
          )}
          {dialog === "reset" && (
            <>
              <p>
                Start the{" "}
                <strong>
                  {scenario === "overdue"
                    ? "missing confirmation"
                    : scenario === "disputed"
                      ? "differing statements"
                      : scenario === "normal"
                        ? "visit confirmed"
                        : "camera outage"}
                </strong>{" "}
                scenario at 09:12 Berlin. Fictional statements, observations and
                current tasks reset. Reset boundaries remain in the audit
                journal.
              </p>
              <div className="info-note">
                <Icon name="receipt" />
                Connected household records remain stored separately.
              </div>
            </>
          )}
          {dialog === "plan" && pendingPlan?.type === "set_visit" && (
            <>
              <p>Record this agreement for the current visit.</p>
              <dl className="review-facts">
                <div>
                  <dt>Visit</dt>
                  <dd>{pendingPlan.title}</dd>
                </div>
                <div>
                  <dt>Expected</dt>
                  <dd>
                    {date(pendingPlan.start)} · {time(pendingPlan.start)}–
                    {time(pendingPlan.end)}
                  </dd>
                </div>
                <div>
                  <dt>Confirmation grace</dt>
                  <dd>{pendingPlan.graceMinutes} minutes</dd>
                </div>
                <div>
                  <dt>Follow-up contacts</dt>
                  <dd>
                    {person(state, pendingPlan.backupPlan.primaryActorId)?.name}
                    , then{" "}
                    {person(state, pendingPlan.backupPlan.backupActorId)?.name}
                  </dd>
                </div>
                <div>
                  <dt>Instructions</dt>
                  <dd>{pendingPlan.backupPlan.instructions}</dd>
                </div>
              </dl>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
