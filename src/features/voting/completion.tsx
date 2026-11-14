'use client';
import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useElection } from '@/features/election/election-provider';
import type { Voter } from '@/features/election/types';
import { PageHeading } from '@/components/layout/workspace';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { STAGE_LABELS } from '@/features/election/presentation';
export function Completion() {
  const { state } = useElection();
  const params = useSearchParams();
  const [id, setId] = useState(params.get('pemilih') ?? '');
  const voters = state.voters.filter((v) => v.stage === 'voted' || v.stage === 'completed');
  const voter = voters.find((v) => v.id === id) ?? voters[0];
  return (
    <>
      <PageHeading
        eyebrow="TAHAP 04 · PETUGAS KELUAR"
        title="Penyelesaian pemilihan"
        description="Pastikan bukti masuk ke kotak suara dan seluruh prosedur akhir telah dilakukan."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5 sm:p-7">
          {voter ? (
            <>
              <label htmlFor="completion-voter" className="label">
                Pemilih yang sudah memilih
              </label>
              <select
                id="completion-voter"
                className="field"
                value={voter.id}
                onChange={(e) => setId(e.target.value)}
              >
                {voters.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.name} · {STAGE_LABELS[v.stage]}
                  </option>
                ))}
              </select>
              <CompletionForm key={voter.id} voter={voter} />
            </>
          ) : (
            <div className="space-y-5">
              <h2 className="text-base font-semibold">Belum ada pemilih yang selesai memilih</h2>
              <p className="muted text-sm leading-relaxed">
                Pemilih akan muncul di sini setelah menyimpan pilihan di bilik suara.
              </p>
              <Link href="/bilik" className="button">
                Buka bilik suara
              </Link>
            </div>
          )}
        </section>
        <aside className="rounded-xl bg-[#e9efdf] p-6">
          <p className="eyebrow">PENGINGAT PETUGAS</p>
          <h2 className="my-4 font-serif text-[24px]">Pastikan proses tuntas.</h2>
          <p className="text-xs leading-relaxed text-[#65765a]">
            Bukti QR tidak mencantumkan pilihan kandidat. Setelah dicetak, bukti dimasukkan ke kotak
            suara. Surat undangan diserahkan kepada petugas dan jari pemilih dicelupkan ke tinta.
          </p>
          <p className="mt-5 border-t border-[#ccd8be] pt-5 text-[11px] leading-relaxed text-[#65765a]">
            Tombol cetak membuka dialog browser. Verifikasi pencetakan dan langkah fisik dilakukan
            langsung oleh petugas, bukan dideteksi otomatis oleh aplikasi.
          </p>
        </aside>
      </div>
    </>
  );
}
function CompletionForm({ voter }: { voter: Voter }) {
  const { dispatch } = useElection();
  const [deposited, setDeposited] = useState(false);
  const [returned, setReturned] = useState(false);
  const [inked, setInked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function complete() {
    setBusy(true);
    setError('');
    try {
      await dispatch({
        type: 'COMPLETE',
        voterId: voter.id,
        receiptDeposited: deposited,
        invitationReturned: returned,
        fingerInked: inked,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Penyelesaian gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-6 space-y-5">
      {voter.stage === 'completed' ? (
        <>
          <Notice tone="success">Seluruh prosedur pemilihan telah dikonfirmasi petugas.</Notice>
          <h2 className="text-xl font-semibold">Seluruh tahapan selesai</h2>
          <p className="muted text-sm">
            Terima kasih, {voter.name}. Proses simulasi telah selesai.
          </p>
          <Link className="button" href="/">
            Layani pemilih berikutnya
          </Link>
        </>
      ) : (
        <>
          <div className="rounded-lg bg-[#f5f7f0] p-4">
            <p className="text-sm font-semibold">{voter.name}</p>
            <p className="muted mt-2 break-all text-[11px]">Bukti: {voter.receiptId}</p>
            <Link
              href={`/cetak/bukti/${voter.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-xs font-semibold underline underline-offset-4"
            >
              Cetak ulang bukti QR
            </Link>
          </div>
          <div className="divide-y divide-[#e8ede1]">
            <label className="check-row">
              <input
                type="checkbox"
                checked={deposited}
                onChange={(e) => setDeposited(e.target.checked)}
              />
              <span>
                Bukti QR telah dimasukkan ke kotak suara
                <small>Periksa bukti cetak secara langsung.</small>
              </span>
            </label>
            <label className="check-row">
              <input
                type="checkbox"
                checked={returned}
                onChange={(e) => setReturned(e.target.checked)}
              />
              <span>Surat undangan telah diserahkan kepada petugas</span>
            </label>
            <label className="check-row">
              <input type="checkbox" checked={inked} onChange={(e) => setInked(e.target.checked)} />
              <span>
                Jari pemilih telah dicelupkan ke tinta
                <small>Sebagai tanda bahwa hak pilih sudah digunakan.</small>
              </span>
            </label>
          </div>
          <Button disabled={!deposited || !returned || !inked || busy} onClick={complete}>
            {busy ? 'Menyimpan...' : 'Selesaikan proses'}
          </Button>
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
