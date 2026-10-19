import { useState } from "react";
import type { AppState, Command, Visit } from "../../shared/types";
import { dateValue, localIso, time } from "../format";
import { Icon } from "./Icon";
export function PlanEditor({
  state,
  visit,
  actorId,
  editable,
  busy,
  onReview,
}: {
  state: AppState;
  visit: Visit;
  actorId: string;
  editable: boolean;
  busy: boolean;
  onReview: (command: Command) => void;
}) {
  const [day, setDay] = useState(dateValue(visit.start));
  const [start, setStart] = useState(time(visit.start));
  const [end, setEnd] = useState(time(visit.end));
  const [title, setTitle] = useState(visit.title);
  const [grace, setGrace] = useState(visit.graceMinutes);
  const [primary, setPrimary] = useState(visit.backupPlan.primaryActorId);
  const [backup, setBackup] = useState(visit.backupPlan.backupActorId);
  const [response, setResponse] = useState(visit.backupPlan.responseMinutes);
  const [instructions, setInstructions] = useState(
    visit.backupPlan.instructions,
  );
  return (
    <section className="plan-page">
      <div className="page-intro">
        <p className="eyebrow">An agreement before an alert</p>
        <h1>The household plan.</h1>
        <p>
          One expected visit. A confirmation window. People who know what to do
          next.
        </p>
      </div>
      {!editable && (
        <div className="info-note">
          <Icon name="person" />
          Family and coordinator demo views can edit the agreed plan.
        </div>
      )}
      <form
        className="plan-form"
        onSubmit={(e) => {
          e.preventDefault();
          onReview({
            type: "set_visit",
            actorId,
            visitId: visit.id,
            title,
            start: localIso(day, start),
            end: localIso(day, end),
            graceMinutes: grace,
            backupPlan: {
              primaryActorId: primary,
              backupActorId: backup,
              responseMinutes: response,
              instructions,
            },
          });
        }}
      >
        <fieldset disabled={!editable || busy}>
          <legend>
            <span>01</span> The expected visit
          </legend>
          <label>
            Visit title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={2000}
            />
          </label>
          <div className="form-grid">
            <label>
              Date
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                required
              />
            </label>
            <label>
              Window starts
              <input
                type="time"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </label>
            <label>
              Window ends
              <input
                type="time"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </label>
          </div>
          <label>
            Confirmation grace (minutes)
            <input
              type="number"
              min="0"
              max="180"
              value={grace}
              onChange={(e) => setGrace(Number(e.target.value))}
              required
            />
          </label>
          <p className="field-help">
            All times are Europe/Berlin. Confirmation is due after the visit
            window plus this grace period.
          </p>
          {(visit.statements.length > 0 || visit.observations.length > 0) && (
            <p className="field-help limitation">
              Evidence exists for this visit. Its timing cannot be repurposed;
              title, contacts and instructions remain editable. Reset fictional
              replay to try a new window.
            </p>
          )}
        </fieldset>
        <fieldset disabled={!editable || busy}>
          <legend>
            <span>02</span> The backup agreement
          </legend>
          <div className="form-grid two">
            <label>
              First follow-up contact
              <select
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
              >
                {state.actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.role}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Next contact
              <select
                value={backup}
                onChange={(e) => setBackup(e.target.value)}
              >
                {state.actors.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.role}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Response window (minutes)
            <input
              type="number"
              min="1"
              max="240"
              value={response}
              onChange={(e) => setResponse(Number(e.target.value))}
              required
            />
          </label>
          <label>
            Agreed instructions
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={4}
              required
              maxLength={2000}
            />
          </label>
          <p className="field-help">
            The next contact is recorded when the response deadline passes. This
            local prototype does not send external messages.
          </p>
        </fieldset>
        {editable && (
          <div className="form-footer">
            <p>Changes enter the journal with your name.</p>
            <button type="submit" className="button primary" disabled={busy}>
              Review plan
              <Icon name="arrow" />
            </button>
          </div>
        )}
      </form>
      <div className="consent-note">
        <Icon name="person" />
        <p>{state.household.consent}</p>
      </div>
    </section>
  );
}
