'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { useElection } from '@/features/election/election-provider';
import { STAGE_LABELS } from '@/features/election/presentation';
import { InvitationDocument } from './invitation-document';

export function InvitationList() {
  const { state } = useElection();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = state.voters.find((voter) => voter.id === selectedId) ?? state.voters[0];

  if (!selected) {
    return <Notice>Belum ada undangan pada data simulasi ini.</Notice>;
  }

  return (
    <div className="space-y-7">
      <Notice>
        Enam identitas fiktif untuk latihan. Cetak satu undangan per pemilih atau gunakan kode
        manual pada bilik suara. Undangan ini tidak berlaku untuk pemilihan resmi.
      </Notice>
      <section className="panel overflow-hidden" aria-labelledby="invitation-list-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e9e0] px-5 py-5">
          <div>
            <p className="eyebrow">Daftar pemilih contoh</p>
            <h2 id="invitation-list-title" className="mt-1 text-base font-semibold">
              Undangan yang tersedia
            </h2>
          </div>
          <span className="status">{state.voters.length} pemilih simulasi</span>
        </div>
        <div className="table-wrap">
          <table className="data-table" aria-label="Daftar undangan pemilih">
            <thead>
              <tr>
                <th scope="col">Pemilih</th>
                <th scope="col">Kode manual</th>
                <th scope="col">Tahap</th>
                <th scope="col">Dokumen</th>
              </tr>
            </thead>
            <tbody>
              {state.voters.map((voter) => (
                <tr key={voter.id} className={selected.id === voter.id ? 'bg-[#f6f9f2]' : ''}>
                  <th
                    scope="row"
                    className="border-t border-[#e8ece5] px-5 py-[18px] text-left align-middle font-normal"
                  >
                    <span className="block whitespace-nowrap font-semibold">{voter.name}</span>
                    <span className="muted mt-1 block font-mono text-[11px]">{voter.identity}</span>
                  </th>
                  <td className="whitespace-nowrap font-mono tracking-wide">
                    {voter.invitationCode}
                  </td>
                  <td>
                    <span className="status" data-active={voter.stage !== 'invited'}>
                      {STAGE_LABELS[voter.stage]}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        className="!px-3 !text-xs"
                        aria-label={`Pratinjau undangan ${voter.name}`}
                        aria-pressed={selected.id === voter.id}
                        aria-controls="invitation-preview"
                        onClick={() => setSelectedId(voter.id)}
                      >
                        Pratinjau
                      </Button>
                      <Link
                        href={`/cetak/undangan/${voter.id}`}
                        className="button !px-3 !text-xs"
                        data-variant="secondary"
                        aria-label={`Cetak undangan ${voter.name}`}
                      >
                        Cetak
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="invitation-preview" aria-label="Pratinjau undangan" className="scroll-mt-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">Pratinjau dokumen</p>
            <h2 className="mt-2 text-lg font-semibold">Undangan {selected.name}</h2>
            <p className="muted mt-2 text-xs">
              Dokumen cetak tidak menyertakan navigasi dan daftar pemilih.
            </p>
          </div>
          <Link href={`/cetak/undangan/${selected.id}`} className="button">
            Buka halaman cetak
          </Link>
        </div>
        <InvitationDocument voter={selected} />
      </section>
    </div>
  );
}
