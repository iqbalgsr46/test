'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { useElection } from '@/features/election/election-provider';
import { Receipt } from './receipt';

interface PrintReceiptClientProps {
  id: string;
}

export function PrintReceiptClient({ id }: PrintReceiptClientProps) {
  const { state, isLoaded, error } = useElection();

  if (error) {
    return (
      <main className="mx-auto max-w-md p-6 sm:p-10">
        <Notice tone="error">{error}</Notice>
        <div className="mt-4">
          <Link href="/" className="button" data-variant="secondary">
            Kembali ke Bilik Suara
          </Link>
        </div>
      </main>
    );
  }

  if (!isLoaded) {
    return (
      <main className="mx-auto max-w-md p-6 sm:p-10">
        <Notice>Memuat bukti pemilihan...</Notice>
      </main>
    );
  }

  const voter = state.voters.find((v) => v.id === id || v.receiptId === id);
  const receiptId = voter && ['voted', 'completed'].includes(voter.stage) ? voter.receiptId : null;

  if (!receiptId) {
    return (
      <main className="mx-auto max-w-md p-6 sm:p-10">
        <Notice tone="error">
          Bukti pemilihan tidak ditemukan atau pemilih belum selesai memilih.
        </Notice>
        <div className="mt-4">
          <Link href="/" className="button" data-variant="secondary">
            Kembali ke Bilik Suara
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f6f7f2] py-6 print:min-h-0 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-6 flex max-w-[420px] flex-wrap items-center justify-between gap-3 px-4">
        <Link href="/" className="button" data-variant="secondary">
          Kembali ke Bilik Suara
        </Link>
        <Button onClick={() => window.print()}>Cetak bukti</Button>
      </div>

      <main className="print-stage px-4 print:p-0">
        <Receipt receiptId={receiptId} />
      </main>
    </div>
  );
}
