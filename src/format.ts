import type { Actor, AppState, Visit } from "../shared/types";
export const time = (at: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(at));
export const date = (at: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(at));
export const fullDate = (at: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(at));
export const dateValue = (at: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(at));
export function localIso(day: string, clock: string): string {
  const intended = Date.parse(`${day}T${clock}:00Z`);
  let guess = intended;
  for (let i = 0; i < 3; i++) {
    const parts = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(new Date(guess));
    guess += intended - Date.parse(`${parts.replace(" ", "T")}Z`);
  }
  return new Date(guess).toISOString();
}
export const later = (at: string, minutes: number) =>
  new Date(Date.parse(at) + minutes * 60_000).toISOString();
export const person = (
  state: AppState,
  id: string | null | undefined,
): Actor | undefined => state.actors.find((a) => a.id === id);
export const shortName = (actor: Actor | undefined) =>
  actor?.name.split(" ")[0] ?? "A participant";
export const statusLabel: Record<Visit["status"], string> = {
  scheduled: "Visit planned",
  awaiting_confirmation: "Awaiting confirmation",
  overdue: "Confirmation overdue",
  disputed: "Statements differ",
  resolved: "Outcome recorded",
};
export function outcomeDescription(state: AppState, visit: Visit) {
  const statement = visit.statements.findLast(
    (s) => s.kind === "outcome" || s.kind === "confirmed",
  );
  if (!statement) return "An outcome is still needed.";
  const author = shortName(person(state, statement.actorId));
  if (statement.outcome === "backup_completed")
    return `${author} recorded a backup check-in. The original visit remains unconfirmed.`;
  if (statement.outcome === "follow_up_recorded")
    return `${author} recorded a follow-up. The original visit remains unconfirmed.`;
  return `${author} confirmed that the visit happened. This is a person's statement.`;
}
