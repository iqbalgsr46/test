'use client';

import { QRCodeSVG } from 'qrcode.react';
import { ELECTION } from '@/features/election/data';
import { encodeInvitation } from '@/features/election/engine';
import type { Voter } from '@/features/election/types';

interface InvitationDocumentProps {
  voter: Voter;
}

export function InvitationDocument({ voter }: InvitationDocumentProps) {
  const number = `${voter.id.replace('voter-', '')}/UND/CT/XI/2026`;

  return (
    <article className="document" aria-label={`Undangan ${voter.name}`}>
      <div className="mb-5 flex flex-wrap justify-between gap-2 text-xs print:text-base">
        <span className="font-semibold tracking-[.1em]">CONTOH SIMULASI</span>
        <span>Kegiatan {ELECTION.id}</span>
      </div>
      <header className="border-b-2 border-[#304d3a] pb-4 text-center">
        <p className="font-semibold tracking-[.08em]">PANITIA PEMILIHAN KUWU</p>
        <p className="font-serif text-[22px] font-semibold">
          DESA {ELECTION.village.toUpperCase()}
        </p>
        <p>
          Kecamatan {ELECTION.district}, Kabupaten {ELECTION.regency}
        </p>
      </header>

      <div className="my-5 text-center">
        <h2 className="document-title !text-[22px] print:!text-[18pt]">SURAT UNDANGAN PEMILIH</h2>
        <p>
          Nomor: <span>{number}</span>
        </p>
      </div>

      <p>Kepada Yth. pemilih simulasi,</p>
      <dl className="mt-3">
        <dt>Nama lengkap</dt>
        <dd className="font-semibold">{voter.name}</dd>
        <dt>Identitas demo</dt>
        <dd className="font-mono">{voter.identity}</dd>
        <dt>Alamat</dt>
        <dd>{voter.address}</dd>
      </dl>
      <p className="mb-3 mt-5">
        Kami mengundang Saudara/i untuk mengikuti simulasi pemilihan kuwu pada:
      </p>
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Jadwal dan lokasi pemilihan</caption>
        <tbody>
          {[
            ['Hari, tanggal', ELECTION.dateLabel],
            ['Waktu', ELECTION.timeLabel],
            ['Tempat', `${ELECTION.tps}, ${ELECTION.location}`],
          ].map(([label, value]) => (
            <tr key={label} className="border-y border-[#dbe2d7]">
              <th scope="row" className="w-[34%] py-2 pr-3 align-top font-normal text-[#53634e]">
                {label}
              </th>
              <td className="py-2">{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="my-5 grid grid-cols-[132px_1fr] items-center gap-4 max-[400px]:grid-cols-1 print:my-4">
        <QRCodeSVG
          value={encodeInvitation(voter)}
          size={132}
          level="M"
          marginSize={4}
          bgColor="#ffffff"
          fgColor="#111111"
          role="img"
          aria-label="QR undangan pemilih"
        />
        <div>
          <p>Kode undangan manual</p>
          <p className="my-1 break-all font-mono text-lg font-semibold tracking-wide">
            {voter.invitationCode}
          </p>
          <p className="text-xs leading-relaxed print:text-base">
            Bawa undangan dan identitas demo. QR berlaku untuk satu kali proses pemilihan dalam
            simulasi ini. Petugas dapat memasukkan kode secara manual.
          </p>
        </div>
      </div>

      <div
        role="group"
        aria-label="Catatan kehadiran"
        className="grid grid-cols-2 gap-8 border-t border-[#dbe2d7] pt-4"
      >
        <div>
          <p>Jam kehadiran</p>
          <div data-testid="attendance-blank" className="h-12 border-b border-[#a5b29e]" />
        </div>
        <div>
          <p>Tanda tangan pemilih</p>
          <div data-testid="signature-blank" className="h-12 border-b border-[#a5b29e]" />
        </div>
      </div>
      <p className="mt-5 text-center text-xs print:text-base">
        Data fiktif untuk pembelajaran. Bukan undangan pemilihan resmi.
      </p>
    </article>
  );
}
