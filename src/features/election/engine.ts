import { CANDIDATES } from './data';
import type { ElectionAction, ElectionState, Stage, Voter } from './types';

export const MAX_SIGNATURE_LENGTH = 200_000;

export function isValidSignature(signature: unknown, name: string): signature is string {
  if (typeof signature !== 'string' || signature.length > MAX_SIGNATURE_LENGTH) return false;
  if (signature === `typed:${name}`) return true;
  const prefix = 'data:image/png;base64,';
  if (!signature.startsWith(prefix)) return false;
  const base64 = signature.slice(prefix.length);
  return (
    base64.startsWith('iVBORw0KGgo') &&
    base64.length >= 44 &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64)
  );
}

export function isReceiptId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second, offsetHour = '0', offsetMinute = '0'] = parts;
  const days = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  return (
    Number(month) >= 1 &&
    Number(month) <= 12 &&
    Number(day) >= 1 &&
    Number(day) <= days &&
    Number(hour) <= 23 &&
    Number(minute) <= 59 &&
    Number(second) <= 59 &&
    Number(offsetHour) <= 23 &&
    Number(offsetMinute) <= 59
  );
}

export class BusinessRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BusinessRuleError';
  }
}

function requireStage(voter: Voter, expected: Stage): void {
  if (voter.stage !== expected) {
    throw new BusinessRuleError(
      `Tahap pemilih tidak sesuai. Diperlukan tahap ${expected}; saat ini ${voter.stage}.`,
    );
  }
}

export function transition(state: ElectionState, action: ElectionAction): ElectionState {
  const voter = state.voters.find((item) => item.id === action.voterId);
  if (!voter) throw new BusinessRuleError('Pemilih demo tidak ditemukan.');
  let updated: Voter;
  let totals = state.totals;
  switch (action.type) {
    case 'SCREEN': {
      requireStage(voter, 'invited');
      if (action.invitationChecked !== true)
        throw new BusinessRuleError('Undangan harus diperiksa terlebih dahulu.');
      if (action.identityChecked !== true)
        throw new BusinessRuleError('Identitas demo harus diperiksa terlebih dahulu.');
      updated = { ...voter, stage: 'screened' };
      break;
    }
    case 'REGISTER': {
      requireStage(voter, 'screened');
      if (action.identityChecked !== true)
        throw new BusinessRuleError('Identitas demo harus diperiksa terlebih dahulu.');
      if (action.inkFree !== true)
        throw new BusinessRuleError('Jari pemilih harus dipastikan bebas tinta.');
      const queueNumber = Math.max(0, ...state.voters.map((item) => item.queueNumber ?? 0)) + 1;
      if (!Number.isSafeInteger(queueNumber))
        throw new BusinessRuleError('Nomor antrean tidak valid.');
      // REGISTER has no clock input: a logical demo time keeps the reducer pure.
      const registeredAt = new Date(
        Date.parse('2026-11-22T00:00:00.000Z') + queueNumber * 1000,
      ).toISOString();
      updated = { ...voter, stage: 'registered', queueNumber, registeredAt };
      break;
    }
    case 'CALL': {
      requireStage(voter, 'registered');
      if (state.voters.some((item) => item.stage === 'called'))
        throw new BusinessRuleError(
          'Selesaikan panggilan sebelumnya sebelum memanggil antrean berikutnya.',
        );
      const first = state.voters
        .filter((item) => item.stage === 'registered')
        .reduce((earliest, item) =>
          (item.queueNumber ?? Infinity) < (earliest.queueNumber ?? Infinity) ? item : earliest,
        );
      if (first.id !== voter.id)
        throw new BusinessRuleError('Panggil pemilih sesuai urutan antrean pendaftaran.');
      updated = { ...voter, stage: 'called' };
      break;
    }
    case 'SIGN': {
      requireStage(voter, 'called');
      if (!isValidSignature(action.signature, voter.name))
        throw new BusinessRuleError(
          'Tanda tangan harus berupa gambar PNG atau nama lengkap pemilih demo yang sesuai (maksimal 200 KB).',
        );
      updated = { ...voter, stage: 'ready', signature: action.signature };
      break;
    }
    case 'VOTE': {
      requireStage(voter, 'ready');
      if (!isValidSignature(voter.signature, voter.name))
        throw new BusinessRuleError('Tanda tangan pemilih belum sah.');
      if (!CANDIDATES.some((candidate) => candidate.id === action.candidateId))
        throw new BusinessRuleError('Calon simulasi tidak ditemukan.');
      if (!isReceiptId(action.receiptId))
        throw new BusinessRuleError('Nomor bukti harus berupa UUID acak yang sah.');
      const receiptId = action.receiptId.toLowerCase();
      if (state.voters.some((item) => item.receiptId?.toLowerCase() === receiptId))
        throw new BusinessRuleError('Nomor bukti sudah digunakan.');
      if (!isIsoTimestamp(action.timestamp))
        throw new BusinessRuleError('Waktu pemungutan suara harus dalam format ISO yang sah.');
      updated = { ...voter, stage: 'voted', receiptId, votedAt: action.timestamp };
      // Never attach a candidate choice to a voter or a receipt.
      totals = { ...totals, [action.candidateId]: totals[action.candidateId] + 1 };
      break;
    }
    case 'COMPLETE': {
      requireStage(voter, 'voted');
      if (action.receiptDeposited !== true)
        throw new BusinessRuleError('Bukti harus dimasukkan ke kotak terlebih dahulu.');
      if (action.invitationReturned !== true)
        throw new BusinessRuleError('Undangan harus dikembalikan terlebih dahulu.');
      if (action.fingerInked !== true)
        throw new BusinessRuleError('Jari harus diberi tinta terlebih dahulu.');
      if (!isIsoTimestamp(voter.votedAt))
        throw new BusinessRuleError('Waktu pemungutan suara tidak sah.');
      // A logical completion time is deterministic; this is not a real audit clock.
      updated = {
        ...voter,
        stage: 'completed',
        completedAt: new Date(Date.parse(voter.votedAt) + 1).toISOString(),
      };
      break;
    }
    case 'KIOSK_VOTE': {
      if (voter.stage === 'voted' || voter.stage === 'completed') {
        throw new BusinessRuleError(
          'Pemilih sudah menggunakan hak pilih. Undangan ini tidak dapat digunakan kembali.',
        );
      }
      if (!CANDIDATES.some((candidate) => candidate.id === action.candidateId))
        throw new BusinessRuleError('Calon simulasi tidak ditemukan.');
      if (!isReceiptId(action.receiptId))
        throw new BusinessRuleError('Nomor bukti harus berupa UUID acak yang sah.');
      const receiptId = action.receiptId.toLowerCase();
      if (state.voters.some((item) => item.receiptId?.toLowerCase() === receiptId))
        throw new BusinessRuleError('Nomor bukti sudah digunakan.');
      if (!isIsoTimestamp(action.timestamp))
        throw new BusinessRuleError('Waktu pemungutan suara harus dalam format ISO yang sah.');

      const queueNumber =
        voter.queueNumber ?? Math.max(0, ...state.voters.map((item) => item.queueNumber ?? 0)) + 1;
      const registeredAt = voter.registeredAt ?? action.timestamp;
      const signature = voter.signature ?? `typed:${voter.name}`;

      updated = {
        ...voter,
        stage: 'voted',
        queueNumber,
        registeredAt,
        signature,
        receiptId,
        votedAt: action.timestamp,
      };
      totals = { ...totals, [action.candidateId]: totals[action.candidateId] + 1 };
      break;
    }
    default:
      throw new BusinessRuleError('Tindakan simulasi tidak dikenal.');
  }
  return {
    ...state,
    totals,
    voters: state.voters.map((item) => (item.id === voter.id ? updated : item)),
  };
}

const INVITATION_PREFIX = 'PILKADES:CT-2026:UND:';

export function encodeInvitation(voter: Voter): string {
  return `${INVITATION_PREFIX}${voter.invitationCode}`;
}

export function findVoterByQr(state: ElectionState, input: string): Voter | null {
  const normalized = input.trim().toUpperCase();
  const code = normalized.startsWith(INVITATION_PREFIX)
    ? normalized.slice(INVITATION_PREFIX.length)
    : normalized;
  if (!/^CT26-[A-Z0-9]{6}$/.test(code)) return null;
  return state.voters.find((voter) => voter.invitationCode === code) ?? null;
}
