import type { AppState, TimelineEntry } from "../../shared/types";
import { date, person, time } from "../format";
import { Icon } from "./Icon";
export function Journal({
  state,
  complete = false,
}: {
  state: AppState;
  complete?: boolean;
}) {
  const lastReset = state.timeline.findLastIndex((e) => e.type === "scenario");
  const entries = (
    complete ? state.timeline : state.timeline.slice(Math.max(0, lastReset))
  )
    .filter((e) => complete || e.type !== "clock_advanced")
    .sort(
      (a, b) =>
        Date.parse(a.observedAt ?? a.at) - Date.parse(b.observedAt ?? b.at),
    );
  function source(entry: TimelineEntry) {
    return entry.source === "ui" || entry.source === "mcp"
      ? "Person"
      : entry.source === "ring"
        ? "Ring"
        : entry.source === "replay"
          ? "Replay"
          : "System";
  }
  return (
    <section className="journal" aria-label="Evidence journal">
      <div className="section-heading">
        <div>
          <p className="eyebrow">The record, in order</p>
          <h2>Evidence journal</h2>
        </div>
        <span className="quiet">{entries.length} entries</span>
      </div>
      <ol className="journal-list">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className={`journal-entry source-${source(entry).toLowerCase()}`}
          >
            <div className="journal-time">
              <time dateTime={entry.observedAt ?? entry.at}>
                {time(entry.observedAt ?? entry.at)}
              </time>
              {complete && <span>{date(entry.observedAt ?? entry.at)}</span>}
            </div>
            <div className="journal-dot">
              <Icon
                name={
                  source(entry) === "Person"
                    ? "person"
                    : source(entry) === "Ring"
                      ? "camera"
                      : entry.type === "scenario"
                        ? "reset"
                        : "clock"
                }
                size={15}
              />
            </div>
            <div className="journal-content">
              <div className="entry-meta">
                <span className="source-chip">{source(entry)}</span>
                <span>
                  {person(state, entry.actorId)?.name ??
                    (source(entry) === "System"
                      ? "Handoff workflow"
                      : source(entry) === "Ring"
                        ? "Connected device"
                        : "Fictional scenario")}
                </span>
              </div>
              <h3>
                {entry.title === "Outcome recorded"
                  ? "Recorded outcome"
                  : entry.title}
              </h3>
              <p>{entry.detail}</p>
              {entry.observedAt && entry.observedAt !== entry.at && (
                <p className="quiet">
                  Observed {time(entry.observedAt)} · received {time(entry.at)}.
                  Original observation time retained.
                </p>
              )}
              {entry.source === "mcp" && (
                <p className="quiet">Recorded through local MCP</p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {!entries.length && (
        <div className="empty-state">
          <Icon name="receipt" />
          <p>
            Nothing has been recorded yet. A person's confirmation will appear
            here with its author and time.
          </p>
        </div>
      )}
    </section>
  );
}
