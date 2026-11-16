import { describe, expect, it } from 'vitest';
import {
  CANDIDATES,
  ELECTION,
  INITIAL_VOTERS,
  createInitialState,
} from '../../src/features/election/data';
import { encodeInvitation, findVoterByQr, transition } from '../../src/features/election/engine';
import type { ElectionState } from '../../src/features/election/types';

function registerVoter(state: ElectionState, voterId: string): ElectionState {
  return transition(
    transition(state, { type: 'SCREEN', voterId, invitationChecked: true, identityChecked: true }),
    { type: 'REGISTER', voterId, identityChecked: true, inkFree: true },
  );
}

function readyVoter(state: ElectionState, voterId: string): ElectionState {
  const registered = registerVoter(state, voterId);
  const called = transition(registered, { type: 'CALL', voterId });
  return transition(called, {
    type: 'SIGN',
    voterId,
    signature: `typed:${called.voters.find((voter) => voter.id === voterId)!.name}`,
  });
}

const RECEIPT_1 = '7b8efca1-95eb-4821-8ed4-40ed126654f1';
const RECEIPT_2 = '7b8efca1-95eb-4821-8ed4-40ed126654f2';
const TIMESTAMP = '2026-11-22T01:00:00.000Z';

describe('completion', () => {
  it('finishes only a voted voter after all three physical checks', () => {
    const ready = readyVoter(createInitialState(), 'voter-001');
    const action = {
      type: 'COMPLETE' as const,
      voterId: 'voter-001',
      receiptDeposited: true,
      invitationReturned: true,
      fingerInked: true,
    };
    expect(() => transition(ready, action)).toThrow(/tahap/i);
    const voted = transition(ready, {
      type: 'VOTE',
      voterId: 'voter-001',
      candidateId: CANDIDATES[0].id,
      receiptId: RECEIPT_1,
      timestamp: TIMESTAMP,
    });
    expect(() => transition(voted, { ...action, receiptDeposited: false })).toThrow(/bukti/i);
    expect(() => transition(voted, { ...action, invitationReturned: false })).toThrow(/undangan/i);
    expect(() => transition(voted, { ...action, fingerInked: false })).toThrow(/tinta/i);
    const completed = transition(voted, action);
    expect(completed.voters[0]).toMatchObject({
      stage: 'completed',
      completedAt: expect.any(String),
    });
    expect(new Date(completed.voters[0].completedAt!).toISOString()).toBe(
      completed.voters[0].completedAt,
    );
    expect(transition(voted, action)).toEqual(completed);
    expect(completed.totals).toEqual(voted.totals);
    expect(() => transition(completed, action)).toThrow(/tahap/i);
    expect(voted.voters[0].stage).toBe('voted');
  });
});

describe('voting', () => {
  it('records only aggregate votes once after signing, with anonymous UUID receipts', () => {
    const state = readyVoter(createInitialState(), 'voter-001');
    const action = {
      type: 'VOTE' as const,
      voterId: 'voter-001',
      candidateId: CANDIDATES[0].id,
      receiptId: RECEIPT_1,
      timestamp: TIMESTAMP,
    };
    const snapshot = structuredClone(state);
    const voted = transition(state, action);
    expect(voted.voters[0]).toMatchObject({
      stage: 'voted',
      receiptId: RECEIPT_1,
      votedAt: TIMESTAMP,
    });
    expect(voted.totals).toEqual({ [CANDIDATES[0].id]: 1, [CANDIDATES[1].id]: 0 });
    expect(Object.keys(voted.voters[0]).sort()).toEqual(Object.keys(INITIAL_VOTERS[0]).sort());
    expect(voted.voters[0]).not.toHaveProperty('candidateId');
    expect(state).toEqual(snapshot);
    expect(transition(state, action)).toEqual(voted);
    expect(() => transition(voted, action)).toThrow(/tahap/i);
    expect(() => transition(createInitialState(), action)).toThrow(/tahap/i);
    const unsigned = structuredClone(state);
    unsigned.voters[0].signature = null;
    expect(() => transition(unsigned, action)).toThrow(/tanda tangan/i);
    expect(() => transition(state, { ...action, candidateId: 'unknown' })).toThrow(/calon/i);
    for (const receiptId of [
      '',
      'voter-001',
      'CT26-A7K2P9',
      '00000000-0000-0000-0000-000000000000',
    ]) {
      expect(() => transition(state, { ...action, receiptId })).toThrow(/bukti/i);
    }
    for (const timestamp of ['', 'today', '2026-02-30T01:00:00.000Z', '2026-11-22']) {
      expect(() => transition(state, { ...action, timestamp })).toThrow(/waktu/i);
    }
    const nextReady = readyVoter(voted, 'voter-002');
    expect(() => transition(nextReady, { ...action, voterId: 'voter-002' })).toThrow(/bukti/i);
    const second = transition(nextReady, {
      ...action,
      voterId: 'voter-002',
      candidateId: CANDIDATES[1].id,
      receiptId: RECEIPT_2,
    });
    expect(Object.values(second.totals).reduce((a, b) => a + b, 0)).toBe(2);
  });

  it('allows direct kiosk voting with auto-checkin from invited stage', () => {
    const state = createInitialState();
    const action = {
      type: 'KIOSK_VOTE' as const,
      voterId: 'voter-001',
      candidateId: CANDIDATES[0].id,
      receiptId: RECEIPT_1,
      timestamp: TIMESTAMP,
    };
    const voted = transition(state, action);
    expect(voted.voters[0]).toMatchObject({
      stage: 'voted',
      queueNumber: 1,
      signature: 'typed:Siti Aminah',
      receiptId: RECEIPT_1,
      votedAt: TIMESTAMP,
    });
    expect(voted.totals[CANDIDATES[0].id]).toBe(1);
    expect(() => transition(voted, action)).toThrow(/sudah menggunakan hak pilih/i);
  });
});

describe('signatures', () => {
  it('allows only a bounded PNG or exact full demo name from the called stage', () => {
    const registered = registerVoter(createInitialState(), 'voter-001');
    const action = { type: 'SIGN' as const, voterId: 'voter-001', signature: 'typed:Siti Aminah' };
    expect(() => transition(registered, action)).toThrow(/tahap/i);
    const called = transition(registered, { type: 'CALL', voterId: 'voter-001' });
    for (const signature of [
      '',
      '  ',
      'Siti Aminah',
      'typed:Siti',
      'typed:Wrong Name',
      'data:text/html;base64,abcd',
      'data:image/png;base64,not-valid!',
      `data:image/png;base64,${'A'.repeat(300_000)}`,
    ]) {
      expect(() => transition(called, { ...action, signature })).toThrow(/tanda tangan/i);
    }
    const ready = transition(called, action);
    expect(ready.voters[0]).toMatchObject({ stage: 'ready', signature: action.signature });
    expect(() => transition(ready, action)).toThrow(/tahap/i);
    const png =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1kAAAAASUVORK5CYII=';
    expect(transition(called, { ...action, signature: png }).voters[0].signature).toBe(png);
    const waiting = registerVoter(ready, 'voter-002');
    expect(transition(waiting, { type: 'CALL', voterId: 'voter-002' }).voters[1].stage).toBe(
      'called',
    );
  });
});

describe('FIFO calls', () => {
  it('calls the first registered voter and never overlaps an unfinished call', () => {
    let state = registerVoter(createInitialState(), 'voter-002');
    state = registerVoter(state, 'voter-001');
    expect(() => transition(state, { type: 'CALL', voterId: 'voter-003' })).toThrow(/tahap/i);
    expect(() => transition(state, { type: 'CALL', voterId: 'voter-001' })).toThrow(/antrean/i);
    const called = transition(state, { type: 'CALL', voterId: 'voter-002' });
    expect(called.voters[1].stage).toBe('called');
    expect(() => transition(called, { type: 'CALL', voterId: 'voter-002' })).toThrow(/tahap/i);
    expect(() => transition(called, { type: 'CALL', voterId: 'voter-001' })).toThrow(/panggilan/i);
  });
});

describe('registration', () => {
  it('registers only screened, checked, ink-free voters with a monotonic queue', () => {
    const initial = createInitialState();
    const register = {
      type: 'REGISTER' as const,
      voterId: initial.voters[0].id,
      identityChecked: true,
      inkFree: true,
    };
    expect(() => transition(initial, register)).toThrow(/tahap/i);
    const screened = transition(initial, {
      type: 'SCREEN',
      voterId: register.voterId,
      invitationChecked: true,
      identityChecked: true,
    });
    expect(() => transition(screened, { ...register, identityChecked: false })).toThrow(
      /identitas/i,
    );
    expect(() => transition(screened, { ...register, inkFree: false })).toThrow(/tinta/i);
    const first = transition(screened, register);
    expect(first.voters[0]).toMatchObject({
      stage: 'registered',
      queueNumber: 1,
      registeredAt: expect.any(String),
    });
    expect(new Date(first.voters[0].registeredAt!).toISOString()).toBe(
      first.voters[0].registeredAt,
    );
    expect(transition(screened, register)).toEqual(first);
    expect(() => transition(first, register)).toThrow(/tahap/i);
    const other = transition(first, {
      type: 'SCREEN',
      voterId: first.voters[1].id,
      invitationChecked: true,
      identityChecked: true,
    });
    other.voters[0].queueNumber = 8;
    const second = transition(other, { ...register, voterId: other.voters[1].id });
    expect(second.voters[1].queueNumber).toBe(9);
  });
});

describe('screening', () => {
  it('screens an invited voter immutably only after both physical checks', () => {
    const state = createInitialState();
    const snapshot = structuredClone(state);
    const voterId = state.voters[0].id;
    expect(() =>
      transition(state, {
        type: 'SCREEN',
        voterId,
        invitationChecked: false,
        identityChecked: true,
      }),
    ).toThrow(/undangan/i);
    expect(() =>
      transition(state, {
        type: 'SCREEN',
        voterId,
        invitationChecked: true,
        identityChecked: false,
      }),
    ).toThrow(/identitas/i);
    expect(() =>
      transition(state, {
        type: 'SCREEN',
        voterId: 'missing',
        invitationChecked: true,
        identityChecked: true,
      }),
    ).toThrow(/tidak ditemukan/i);
    const next = transition(state, {
      type: 'SCREEN',
      voterId,
      invitationChecked: true,
      identityChecked: true,
    });
    expect(next.voters[0].stage).toBe('screened');
    expect(next).not.toBe(state);
    expect(next.voters).not.toBe(state.voters);
    expect(state).toEqual(snapshot);
    expect(() =>
      transition(next, { type: 'SCREEN', voterId, invitationChecked: true, identityChecked: true }),
    ).toThrow(/tahap/i);
  });
});

describe('invitation lookup', () => {
  it('accepts only the exact invitation QR or manual code, case-insensitively', () => {
    const state = createInitialState();
    const voter = state.voters[0];
    expect(encodeInvitation(voter)).toBe(`PILKADES:CT-2026:UND:${voter.invitationCode}`);
    for (const input of [
      voter.invitationCode,
      `  ${voter.invitationCode.toLowerCase()}  `,
      encodeInvitation(voter),
      ` ${encodeInvitation(voter).toLowerCase()} `,
    ]) {
      expect(findVoterByQr(state, input)).toEqual(voter);
    }
    for (const input of [
      '',
      'A7K2P9',
      voter.id,
      voter.identity,
      `https://example.test/${voter.invitationCode}`,
      `PILKADES:CT-2026:BUKTI:${voter.invitationCode}`,
      `PILKADES:OTHER:UND:${voter.invitationCode}`,
      `${encodeInvitation(voter)}:extra`,
      'CT26-ZZZZZZ',
    ]) {
      expect(findVoterByQr(state, input)).toBeNull();
    }
  });
});

describe('demo fixtures', () => {
  it('creates an isolated six-person fictional election with two candidates', () => {
    const state = createInitialState();
    expect(ELECTION).toEqual({
      id: 'CT-2026',
      village: 'Cikaum Timur',
      district: 'Cikaum',
      regency: 'Subang',
      tps: 'TPS 001',
      location: 'Balai Desa Cikaum Timur',
      dateLabel: 'Minggu, 22 November 2026',
      timeLabel: '07.00 - 13.00 WIB',
    });
    expect(
      CANDIDATES.map(({ name, number, photo, description }) => ({
        name,
        number,
        photo,
        description,
      })),
    ).toEqual([
      {
        name: 'Upin',
        number: 'A',
        photo: '/images/calon-upin.jpg?v=3',
        description: 'Calon kuwu simulasi Upin',
      },
      {
        name: 'Ipin',
        number: 'B',
        photo: '/images/calon-ipin.jpg?v=3',
        description: 'Calon kuwu simulasi Ipin',
      },
    ]);
    expect(state.voters[0].name).toBe('Siti Aminah');
    expect(state.version).toBe(1);
    expect(state.voters).toHaveLength(6);
    expect(state.totals).toEqual(
      Object.fromEntries(CANDIDATES.map((candidate) => [candidate.id, 0])),
    );
    expect(new Set(state.voters.map((voter) => voter.invitationCode)).size).toBe(6);
    state.voters.forEach((voter, index) => {
      expect(voter).toEqual({
        id: `voter-${String(index + 1).padStart(3, '0')}`,
        name: expect.any(String),
        identity: `DEMO-${String(index + 1).padStart(4, '0')}`,
        address: expect.any(String),
        invitationCode: expect.stringMatching(/^CT26-[A-Z0-9]{6}$/),
        stage: 'invited',
        queueNumber: null,
        signature: null,
        receiptId: null,
        registeredAt: null,
        votedAt: null,
        completedAt: null,
      });
    });
    state.voters[0].name = 'Changed only this copy';
    state.totals[CANDIDATES[0].id] = 9;
    expect(createInitialState().voters[0].name).toBe(INITIAL_VOTERS[0].name);
    expect(createInitialState().totals[CANDIDATES[0].id]).toBe(0);
  });
});
