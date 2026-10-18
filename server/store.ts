import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AppState, Mode, TimelineEntry } from '../shared/types';
import { initialSnapshot } from './domain';

/** A transaction serializes state transitions and records an immutable audit journal. */
export class Store {
  private db: DatabaseSync;
  private closed = false;
  constructor(path: string, mode: Mode, now: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS snapshots (mode TEXT PRIMARY KEY, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS events (sequence INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL, UNIQUE(mode,event_id));
      CREATE TRIGGER IF NOT EXISTS immutable_events_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'append-only events'); END;
      CREATE TRIGGER IF NOT EXISTS immutable_events_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'append-only events'); END;`);
    this.ensure(mode, now);
  }
  ensure(mode: Mode, now: string) { this.db.prepare('INSERT OR IGNORE INTO snapshots (mode,payload) VALUES (?,?)').run(mode, JSON.stringify(initialSnapshot(mode, now))); }
  read(mode: Mode): AppState { const row = this.db.prepare('SELECT payload FROM snapshots WHERE mode=?').get(mode) as { payload: string }; return JSON.parse(row.payload) as AppState; }
  transact(mode: Mode, mutate: (state: AppState) => void): AppState {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.read(mode); const before = JSON.stringify(state); const prior = new Set(state.timeline.map(e => e.id));
      mutate(state);
      if (before !== JSON.stringify(state)) {
        state.revision++;
        for (const entry of state.timeline.filter(e => !prior.has(e.id))) { entry.revision = state.revision; this.append(mode, entry); }
        this.db.prepare('UPDATE snapshots SET payload=? WHERE mode=?').run(JSON.stringify(state), mode);
      }
      this.db.exec('COMMIT'); return state;
    } catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private append(mode: Mode, entry: TimelineEntry) { this.db.prepare('INSERT INTO events (mode,event_id,payload) VALUES (?,?,?)').run(mode, entry.id, JSON.stringify(entry)); }
  close() { if (!this.closed) { this.closed = true; this.db.close(); } }
}
