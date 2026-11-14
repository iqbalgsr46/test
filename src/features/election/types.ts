export type Stage =
  'invited' | 'screened' | 'registered' | 'called' | 'ready' | 'voted' | 'completed';

export interface Voter {
  id: string;
  name: string;
  identity: string;
  address: string;
  invitationCode: string;
  stage: Stage;
  queueNumber: number | null;
  signature: string | null;
  receiptId: string | null;
  registeredAt: string | null;
  votedAt: string | null;
  completedAt: string | null;
}

export interface Candidate {
  id: string;
  number: string;
  name: string;
  description: string;
  photo: string;
}

export interface ElectionState {
  version: 1;
  voters: Voter[];
  totals: Record<string, number>;
}

export type ElectionAction =
  | { type: 'SCREEN'; voterId: string; invitationChecked: boolean; identityChecked: boolean }
  | { type: 'REGISTER'; voterId: string; identityChecked: boolean; inkFree: boolean }
  | { type: 'CALL'; voterId: string }
  | { type: 'SIGN'; voterId: string; signature: string }
  | { type: 'VOTE'; voterId: string; candidateId: string; receiptId: string; timestamp: string }
  | {
      type: 'COMPLETE';
      voterId: string;
      receiptDeposited: boolean;
      invitationReturned: boolean;
      fingerInked: boolean;
    }
  | {
      type: 'KIOSK_VOTE';
      voterId: string;
      candidateId: string;
      receiptId: string;
      timestamp: string;
    };
