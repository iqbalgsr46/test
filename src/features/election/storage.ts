import { CANDIDATES, INITIAL_VOTERS, createInitialState } from './data';
import { isIsoTimestamp, isReceiptId, isValidSignature, transition } from './engine';
import type { ElectionAction, ElectionState } from './types';

export const STORAGE_KEY = 'cikaum-timur-election-v1';
export const ELECTION_LOCK_KEY = `${STORAGE_KEY}:write`;

export interface ElectionLocks {
  request<T>(name: string, callback: () => T | Promise<T>): Promise<T>;
}

type Publish = (state: ElectionState) => void;

function requireLocks(locks: ElectionLocks | undefined): ElectionLocks {
  if (!locks || typeof locks.request !== 'function') {
    throw new Error(
      'Browser ini tidak mendukung Web Locks. Gunakan browser modern pada localhost atau HTTPS; perubahan demo dinonaktifkan untuk mencegah data ganda.',
    );
  }
  return locks;
}

/** Only coordinates cooperative tabs on this browser origin; not a server or election ledger. */
export async function commitElectionAction(
  storage: ElectionStorage,
  locks: ElectionLocks | undefined,
  action: ElectionAction,
  publish?: Publish,
): Promise<ElectionState> {
  return requireLocks(locks).request(ELECTION_LOCK_KEY, () => {
    const next = transition(readElectionState(storage), action);
    writeElectionState(storage, next);
    // Publish inside the lock, only after persistence succeeds, never from a stale React closure.
    publish?.(next);
    return next;
  });
}

/** Call only after the UI has explicitly confirmed resetting this local demo. */
export async function resetElectionState(
  storage: ElectionStorage,
  locks: ElectionLocks | undefined,
  publish?: Publish,
): Promise<ElectionState> {
  return requireLocks(locks).request(ELECTION_LOCK_KEY, () => {
    const next = createInitialState();
    writeElectionState(storage, next);
    publish?.(next);
    return next;
  });
}

export interface ElectionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const CORRUPT_MESSAGE =
  'Data simulasi tersimpan rusak atau tidak sah. Data tidak direset otomatis; gunakan reset demo secara eksplisit.';
const STAGES = ['invited', 'screened', 'registered', 'called', 'ready', 'voted', 'completed'];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireValid(condition: unknown): asserts condition {
  if (!condition) throw new Error(CORRUPT_MESSAGE);
}

function exactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return (
    Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
  );
}

/** Shape checks cannot make localStorage trustworthy. This is a local demo only. */
export function validateElectionState(value: unknown): ElectionState {
  requireValid(record(value) && exactKeys(value, ['version', 'voters', 'totals']));
  requireValid(
    value.version === 1 &&
      Array.isArray(value.voters) &&
      value.voters.length === INITIAL_VOTERS.length,
  );
  requireValid(
    record(value.totals) &&
      exactKeys(
        value.totals,
        CANDIDATES.map((candidate) => candidate.id),
      ),
  );
  for (const count of Object.values(value.totals))
    requireValid(
      typeof count === 'number' &&
        Number.isSafeInteger(count) &&
        count >= 0 &&
        count <= INITIAL_VOTERS.length,
    );
  const seen = new Set<string>();
  const queues = new Set<number>();
  const receipts = new Set<string>();
  let votedCount = 0;
  let calledCount = 0;
  for (const voter of value.voters) {
    requireValid(record(voter) && exactKeys(voter, Object.keys(INITIAL_VOTERS[0])));
    const seed = INITIAL_VOTERS.find((item) => item.id === voter.id);
    requireValid(seed && !seen.has(seed.id));
    seen.add(seed.id);
    requireValid(
      voter.name === seed.name &&
        voter.identity === seed.identity &&
        voter.address === seed.address &&
        voter.invitationCode === seed.invitationCode,
    );
    requireValid(typeof voter.stage === 'string' && STAGES.includes(voter.stage));
    const stage = STAGES.indexOf(voter.stage);
    if (stage >= 2) {
      requireValid(
        typeof voter.queueNumber === 'number' &&
          Number.isSafeInteger(voter.queueNumber) &&
          voter.queueNumber > 0 &&
          !queues.has(voter.queueNumber),
      );
      queues.add(voter.queueNumber);
      requireValid(isIsoTimestamp(voter.registeredAt));
    } else {
      requireValid(voter.queueNumber === null && voter.registeredAt === null);
    }
    requireValid(
      stage >= 4 ? isValidSignature(voter.signature, seed.name) : voter.signature === null,
    );
    if (stage >= 5) {
      requireValid(isReceiptId(voter.receiptId) && !receipts.has(voter.receiptId.toLowerCase()));
      receipts.add(voter.receiptId.toLowerCase());
      requireValid(isIsoTimestamp(voter.votedAt));
      votedCount++;
    } else {
      requireValid(voter.receiptId === null && voter.votedAt === null);
    }
    if (stage === 6) {
      requireValid(
        isIsoTimestamp(voter.completedAt) &&
          isIsoTimestamp(voter.votedAt) &&
          Date.parse(voter.completedAt) >= Date.parse(voter.votedAt),
      );
    } else {
      requireValid(voter.completedAt === null);
    }
    if (stage === 3) calledCount++;
  }
  requireValid(calledCount <= 1);
  requireValid(
    Object.values(value.totals).reduce<number>((sum, count) => sum + (count as number), 0) ===
      votedCount,
  );
  return value as unknown as ElectionState;
}

export function readElectionState(storage: ElectionStorage): ElectionState {
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    throw new Error(
      'Penyimpanan lokal tidak dapat dibaca. Izinkan penyimpanan browser untuk demo ini.',
    );
  }
  if (raw === null) return createInitialState();
  try {
    return validateElectionState(JSON.parse(raw));
  } catch {
    throw new Error(CORRUPT_MESSAGE);
  }
}

export function writeElectionState(storage: ElectionStorage, state: ElectionState): void {
  validateElectionState(state);
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    throw new Error(
      'Gagal menyimpan data simulasi. Periksa izin dan kapasitas penyimpanan browser; tindakan belum diterapkan.',
    );
  }
}
