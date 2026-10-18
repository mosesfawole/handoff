import { z } from 'zod';

export type Mode = 'replay' | 'live';
export type ActorRole = 'family' | 'resident' | 'helper' | 'coordinator';
export interface Actor { id: string; name: string; role: ActorRole; }
export type VisitStatus = 'scheduled' | 'awaiting_confirmation' | 'overdue' | 'disputed' | 'resolved';
export type CoverageStatus = 'online' | 'offline' | 'unknown';
export type EvidenceSource = 'replay' | 'ring' | 'ui' | 'mcp' | 'system';
export interface CoverageInterval { start: string; end: string | null; status: CoverageStatus; source: EvidenceSource; }
export interface DoorstepObservation { id: string; deviceId: string; observedAt: string; receivedAt: string; type: 'motion' | 'doorbell' | 'unknown'; subtype: string | null; source: 'replay' | 'ring'; description: string; }
export interface HumanStatement { id: string; actorId: string; at: string; source: 'ui' | 'mcp' | 'replay'; kind: 'confirmed' | 'not_happened' | 'delay' | 'outcome'; note: string; outcome?: 'visit_confirmed' | 'backup_completed' | 'follow_up_recorded'; eta?: string; }
export interface BackupPlan { primaryActorId: string; backupActorId: string; responseMinutes: number; instructions: string; }
export interface FollowUpTask { id: string; visitId: string; reason: 'confirmation_overdue' | 'disputed'; createdAt: string; status: 'open' | 'claimed' | 'resolved'; ownerId: string | null; claimedAt: string | null; eta: string | null; deadline: string; escalatedAt: string | null; escalationActorId: string; resolvedAt: string | null; resolution: string | null; }
export interface Visit { id: string; title: string; start: string; end: string; graceMinutes: number; confirmationDue: string; backupPlan: BackupPlan; status: VisitStatus; coverage: { status: CoverageStatus; intervals: CoverageInterval[] }; observations: DoorstepObservation[]; statements: HumanStatement[]; task: FollowUpTask | null; }
export interface TimelineEntry { id: string; revision: number; at: string; observedAt?: string; visitId: string | null; type: string; source: EvidenceSource; actorId: string | null; title: string; detail: string; }
export interface IntegrationStatus { ring: { configured: boolean; webhookConfigured: boolean; status: 'not_configured' | 'not_verified' | 'connected' | 'expired' | 'error'; lastSyncAt: string | null; lastVerifiedAt: string | null; error: string | null; devices: Array<{ id: string; name: string; coverage: CoverageStatus }> }; mcp: { available: true; endpoint: '/mcp'; protocol: '2025-11-25'; writesConfigured: boolean; label: string }; }
export interface AppState { revision: number; mode: Mode; currentTime: string; household: { id: string; name: string; timezone: 'Europe/Berlin'; fictional: boolean; consent: string }; actors: Actor[]; visits: Visit[]; activeVisitId: string | null; timeline: TimelineEntry[]; metrics: { label: string; followUps: number; unresolvedTasks: number; acceptedAfterMinutes: number | null; resolvedAfterMinutes: number | null }; integrations: IntegrationStatus; }
export interface VisitReceipt { generatedAt: string; mode: Mode; fictional: boolean; household: AppState['household']; visit: Visit | null; actors: Actor[]; timeline: TimelineEntry[]; unknowns: string[]; evidenceRule: string; }

const id = z.string().trim().min(1).max(120);
const text = z.string().trim().min(1).max(2000);
const iso = z.iso.datetime({ offset: true });
const base = { actorId: id, visitId: id };
const backup = z.strictObject({ primaryActorId: id, backupActorId: id, responseMinutes: z.number().int().min(1).max(240), instructions: text });
export const commandSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('set_visit'), ...base, title: text, start: iso, end: iso, graceMinutes: z.number().int().min(0).max(180), backupPlan: backup }),
  z.strictObject({ type: z.literal('confirm_visit'), ...base, note: text }),
  z.strictObject({ type: z.literal('report_not_happened'), ...base, note: text }),
  z.strictObject({ type: z.literal('report_delay'), ...base, note: text, eta: iso }),
  z.strictObject({ type: z.literal('claim_task'), ...base, taskId: id, eta: iso }),
  z.strictObject({ type: z.literal('resolve_task'), ...base, taskId: id, outcome: z.enum(['visit_confirmed', 'backup_completed', 'follow_up_recorded']), note: text }),
  z.strictObject({ type: z.literal('release_task'), ...base, taskId: id, note: text })
]);
export type Command = z.infer<typeof commandSchema>;
export const replaySchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('scenario'), scenario: z.enum(['overdue', 'outage', 'disputed', 'normal']) }),
  z.strictObject({ type: z.literal('advance'), minutes: z.number().int().min(1).max(1440) }),
  z.strictObject({ type: z.literal('doorstep'), eventId: id, observedAt: iso.optional(), eventType: z.enum(['motion', 'doorbell', 'unknown']).default('motion') }),
  z.strictObject({ type: z.literal('coverage'), status: z.enum(['online', 'offline', 'unknown']) })
]);
export type ReplayCommand = z.infer<typeof replaySchema>;
export interface ApiError { error: string; code: string; }
