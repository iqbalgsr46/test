'use client';

import { QRCodeSVG } from 'qrcode.react';
import { ELECTION } from '@/features/election/data';

interface ReceiptProps {
  receiptId: string;
}

export function Receipt({ receiptId }: ReceiptProps) {
  return (
    <article className="receipt" aria-label="Bukti telah memilih">
      <header className="border-b border-[#d6dfd2] pb-5">
        <p className="text-base font-semibold tracking-[.12em]">BUKTI SIMULASI</p>
        <h2 className="mt-3 font-serif text-xl leading-snug">Bukti telah memilih secara digital</h2>
        <p className="mt-3 text-base leading-relaxed">Pemilihan Kuwu Desa {ELECTION.village}</p>
      </header>

      <p className="mt-5 text-base leading-relaxed">
        {ELECTION.tps}
        <br />
        {ELECTION.dateLabel}
      </p>

      <QRCodeSVG
        value={`PILKADES:${ELECTION.id}:BUKTI:${receiptId}`}
        size={208}
        level="M"
        marginSize={4}
        bgColor="#ffffff"
        fgColor="#111111"
        role="img"
        aria-label="QR bukti simulasi"
        className="mx-auto my-4 max-w-full"
      />

      <p className="text-base">Nomor bukti</p>
      <p className="mt-2 break-all font-mono text-base leading-relaxed">{receiptId}</p>
      <footer className="mt-5 border-t border-dashed border-[#bac6b7] pt-5 text-base leading-relaxed">
        <p>Masukkan bukti ini ke kotak suara pada simulasi penyelesaian.</p>
        <p className="mt-3">Bukan dokumen pemilihan resmi.</p>
      </footer>
    </article>
  );
}
