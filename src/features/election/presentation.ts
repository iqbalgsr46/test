import type { Stage } from './types';
export const STAGE_LABELS: Record<Stage, string> = {
  invited: 'Belum hadir',
  screened: 'Lolos pemeriksaan',
  registered: 'Menunggu panggilan',
  called: 'Dipanggil',
  ready: 'Siap memilih',
  voted: 'Sudah memilih',
  completed: 'Selesai',
};
export function queueLabel(number: number | null) {
  return number === null ? 'Belum terdaftar' : `A${String(number).padStart(3, '0')}`;
}
