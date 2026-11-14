import type { Candidate, ElectionState, Voter } from './types';

/** Fictional, local-only demonstration. Never use this fixture for an election. */
export const ELECTION = {
  id: 'CT-2026',
  village: 'Cikaum Timur',
  district: 'Cikaum',
  regency: 'Subang',
  tps: 'TPS 001',
  location: 'Balai Desa Cikaum Timur',
  dateLabel: 'Minggu, 22 November 2026',
  timeLabel: '07.00 - 13.00 WIB',
} as const;

export const CANDIDATES: Candidate[] = [
  {
    id: 'candidate-01',
    number: '01',
    name: 'Ahmad Hidayat',
    description: 'Calon kuwu simulasi',
    photo: '/images/calon-01.jpg?v=2',
  },
  {
    id: 'candidate-02',
    number: '02',
    name: 'Dedi Kurniawan',
    description: 'Calon kuwu simulasi',
    photo: '/images/calon-02.jpg?v=2',
  },
];

const demoPeople = [
  ['Siti Aminah', 'RT 01 / RW 01, alamat simulasi', 'CT26-A7K2P9'],
  ['Warga Demo Dua', 'RT 02 / RW 01, alamat simulasi', 'CT26-B8L3Q6'],
  ['Warga Demo Tiga', 'RT 03 / RW 01, alamat simulasi', 'CT26-C9M4R7'],
  ['Warga Demo Empat', 'RT 01 / RW 02, alamat simulasi', 'CT26-D2N5S8'],
  ['Warga Demo Lima', 'RT 02 / RW 02, alamat simulasi', 'CT26-E3P6T9'],
  ['Warga Demo Enam', 'RT 03 / RW 02, alamat simulasi', 'CT26-F4Q7U2'],
] as const;

export const INITIAL_VOTERS: Voter[] = demoPeople.map(([name, address, invitationCode], index) => ({
  id: `voter-${String(index + 1).padStart(3, '0')}`,
  name,
  identity: `DEMO-${String(index + 1).padStart(4, '0')}`,
  address,
  invitationCode,
  stage: 'invited',
  queueNumber: null,
  signature: null,
  receiptId: null,
  registeredAt: null,
  votedAt: null,
  completedAt: null,
}));

export function createInitialState(): ElectionState {
  return {
    version: 1,
    voters: INITIAL_VOTERS.map((voter) => ({ ...voter })),
    totals: Object.fromEntries(CANDIDATES.map((candidate) => [candidate.id, 0])),
  };
}
