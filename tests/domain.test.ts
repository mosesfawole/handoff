import { describe, expect, it } from 'vitest';
import { project, initialSnapshot } from '../server/domain';
describe('independent visit evidence projection', () => {
  it('doorstep activity cannot automatically complete care', () => {
    const snapshot = initialSnapshot('replay');
    snapshot.visits[0].observations.push({ id: 'door-1', deviceId: 'front-door', observedAt: '2026-10-18T07:10:00.000Z', receivedAt: '2026-10-18T07:12:00.000Z', type: 'motion', subtype: null, source: 'replay', description: 'Fictional motion' });
    expect(project(snapshot).visits[0].status).toBe('awaiting_confirmation');
  });
  it('offline coverage cannot change missing confirmation into missed care', () => {
    const snapshot = initialSnapshot('replay');
    snapshot.currentTime = '2026-10-18T07:26:00.000Z';
    snapshot.visits[0].coverage.intervals.push({ start: '2026-10-18T07:20:00.000Z', end: null, status: 'offline', source: 'replay' });
    const state = project(snapshot);
    expect(state.visits[0].status).toBe('overdue');
    expect(state.visits[0].coverage.status).toBe('offline');
  });
  it('a contradiction cannot close a disputed visit', () => {
    const snapshot = initialSnapshot('replay');
    snapshot.visits[0].statements.push(
      { id: 'yes', actorId: 'family', at: '2026-10-18T07:12:00.000Z', source: 'ui', kind: 'confirmed', note: 'Helper said complete.' },
      { id: 'no', actorId: 'resident', at: '2026-10-18T07:13:00.000Z', source: 'ui', kind: 'not_happened', note: 'Nobody came.' }
    );
    expect(project(snapshot).visits[0].status).toBe('disputed');
  });
});
