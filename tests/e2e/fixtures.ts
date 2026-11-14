import { createInitialState } from '../../src/features/election/data';
import { transition } from '../../src/features/election/engine';
import { CANDIDATES } from '../../src/features/election/data';
export const storageKey = 'cikaum-timur-election-v1';
export function readyFixture() {
  let state = createInitialState();
  const voterId = state.voters[0].id;
  state = transition(state, {
    type: 'SCREEN',
    voterId,
    invitationChecked: true,
    identityChecked: true,
  });
  state = transition(state, { type: 'REGISTER', voterId, identityChecked: true, inkFree: true });
  state = transition(state, { type: 'CALL', voterId });
  return transition(state, { type: 'SIGN', voterId, signature: 'typed:Siti Aminah' });
}
export function votedFixture(receiptId: string) {
  return transition(readyFixture(), {
    type: 'VOTE',
    voterId: 'voter-001',
    candidateId: CANDIDATES[0].id,
    receiptId,
    timestamp: '2026-11-22T01:00:00.000Z',
  });
}
