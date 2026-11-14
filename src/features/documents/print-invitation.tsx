'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { useElection } from '@/features/election/election-provider';
import { InvitationDocument } from './invitation-document';

interface PrintInvitationClientProps {
  id: string;
}

export function PrintInvitationClient({ id }: PrintInvitationClientProps) {
  const { state, isLoaded, error } = useElection();

  if (error) {
    return (
      <main className="mx-auto max-w-2xl p-6 sm:p-10">
        <Notice tone="error">{error}</Notice>
        <div className="mt-4">
          <Link href="/admin" className="button" data-variant="secondary">
            Kembali ke Dashboard Admin
          </Link>
        </div>
      </main>
    );
  }

  if (!isLoaded) {
    return (
      <main className="mx-auto max-w-2xl p-6 sm:p-10">
        <Notice>Memuat dokumen undangan...</Notice>
      </main>
    );
  }

  const voter = state.voters.find((v) => v.id === id);

  if (!voter) {
    return (
      <main className="mx-auto max-w-2xl p-6 sm:p-10">
        <Notice tone="error">Surat undangan pemilih tidak ditemukan.</Notice>
        <div className="mt-4">
          <Link href="/admin" className="button" data-variant="secondary">
            Kembali ke Dashboard Admin
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-dvh bg-[#f6f7f2] py-6 print:min-h-0 print:bg-white print:p-0">
      <div className="no-print mx-auto mb-6 flex max-w-[800px] flex-wrap items-center justify-between gap-3 px-4">
        <Link href="/admin" className="button" data-variant="secondary">
          Kembali ke Dashboard Admin
        </Link>
        <Button onClick={() => window.print()}>Cetak undangan</Button>
      </div>

      <main className="print-stage px-4 print:p-0">
        <InvitationDocument voter={voter} />
      </main>
    </div>
  );
}
