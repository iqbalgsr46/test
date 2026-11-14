'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useElection } from '@/features/election/election-provider';
import type { ElectionAction, Voter } from '@/features/election/types';
import { STAGE_LABELS, queueLabel } from '@/features/election/presentation';
import { PageHeading } from '@/components/layout/workspace';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { SignaturePad } from './signature-pad';
export function Registration() {
  const { state, dispatch } = useElection();
  const params = useSearchParams();
  const [id, setId] = useState(params.get('pemilih') ?? state.voters[0]?.id ?? '');
  const selected = state.voters.find((v) => v.id === id) ?? state.voters[0];
  const queue = state.voters
    .filter((v) => v.stage === 'registered')
    .sort((a, b) => (a.queueNumber ?? 0) - (b.queueNumber ?? 0));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function callNext() {
    if (!queue[0]) return;
    setBusy(true);
    setError('');
    try {
      await dispatch({ type: 'CALL', voterId: queue[0].id });
      setId(queue[0].id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Antrean gagal dipanggil.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="TAHAP 02 · MEJA 1"
        title="Registrasi & antrean"
        description="Verifikasi hak pilih, panggil antrean, dan konfirmasi kehadiran pemilih."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,1fr)]">
        <section className="panel p-5 sm:p-7">
          <h2 className="mb-5 text-base font-semibold">Pelayanan registrasi</h2>
          <label htmlFor="registration-voter" className="label">
            Pilih pemilih
          </label>
          <select
            id="registration-voter"
            value={selected?.id ?? ''}
            onChange={(e) => setId(e.target.value)}
            className="field"
          >
            {state.voters.map((v) => (
              <option value={v.id} key={v.id}>
                {v.name} · {STAGE_LABELS[v.stage]}
              </option>
            ))}
          </select>
          {selected && (
            <RegistrationForm
              key={`${selected.id}:${selected.stage}:${selected.queueNumber ?? ''}:${selected.registeredAt ?? ''}`}
              voter={selected}
            />
          )}
        </section>
        <aside className="space-y-5">
          <section className="panel overflow-hidden">
            <div className="border-b border-[#e5eadf] p-5">
              <p className="eyebrow">PANGGILAN ANTREAN</p>
              <h2 className="mt-3 text-xl font-semibold">{queue.length} pemilih menunggu</h2>
              <p className="muted mt-2 text-xs">Panggilan mengikuti urutan registrasi.</p>
            </div>
            <div className="p-5">
              {queue[0] ? (
                <div className="mb-5 flex items-center gap-4">
                  <span className="rounded-md bg-[#edf2e7] px-4 py-3 text-lg font-semibold tabular-nums">
                    {queueLabel(queue[0].queueNumber)}
                  </span>
                  <div>
                    <p className="text-xs font-semibold">{queue[0].name}</p>
                    <p className="muted mt-1 text-[10px]">Antrean berikutnya</p>
                  </div>
                </div>
              ) : (
                <p className="muted mb-5 text-xs">Belum ada antrean yang perlu dipanggil.</p>
              )}
              {error && <Notice tone="error">{error}</Notice>}
              <Button disabled={!queue.length || busy} onClick={callNext} className="w-full">
                {busy ? 'Memanggil...' : 'Panggil antrean berikutnya'}
              </Button>
            </div>
          </section>
          <Notice>
            KPPS menerima surat undangan dan kartu identitas untuk diperiksa. Kembalikan undangan
            kepada pemilih untuk dipindai di bilik suara.
          </Notice>
        </aside>
      </div>
      <section className="panel mt-6 overflow-hidden">
        <div className="p-5">
          <h2 className="text-sm font-semibold">Daftar hadir</h2>
          <p className="muted mt-1 text-[11px]">
            Tanda tangan dikonfirmasi setelah nomor antrean dipanggil.
          </p>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Antrean</th>
                <th>Nama pemilih</th>
                <th>Kehadiran</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {state.voters
                .filter((v) => v.queueNumber !== null)
                .map((v) => (
                  <tr key={v.id}>
                    <td className="font-semibold">{queueLabel(v.queueNumber)}</td>
                    <td className="whitespace-nowrap">{v.name}</td>
                    <td>{v.signature ? 'Sudah ditandatangani' : 'Belum ditandatangani'}</td>
                    <td>
                      <span className="status" data-active={!!v.signature}>
                        {STAGE_LABELS[v.stage]}
                      </span>
                    </td>
                  </tr>
                ))}
              {!state.voters.some((v) => v.queueNumber !== null) && (
                <tr>
                  <td colSpan={4} className="muted">
                    Daftar hadir masih kosong.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
function RegistrationForm({ voter }: { voter: Voter }) {
  const { dispatch } = useElection();
  const [inkFree, setInkFree] = useState(false);
  const [identity, setIdentity] = useState(false);
  const [signature, setSignature] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function act(action: ElectionAction) {
    setBusy(true);
    setError('');
    try {
      await dispatch(action);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Data tidak dapat disimpan.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 space-y-5">
      <div className="flex flex-wrap justify-between gap-3 rounded-lg bg-[#f6f8f2] p-4">
        <div>
          <p className="text-sm font-semibold">{voter.name}</p>
          <p className="muted mt-1 text-xs">{voter.identity}</p>
        </div>
        <span className="status h-fit" data-active={voter.stage !== 'invited'}>
          {STAGE_LABELS[voter.stage]}
        </span>
        <p className="muted w-full text-[11px]">{voter.address}</p>
      </div>
      {voter.stage === 'invited' && (
        <>
          <Notice>Pemilih harus melewati pemeriksaan awal terlebih dahulu.</Notice>
          <Link className="button" data-variant="secondary" href="/">
            Buka pemeriksaan awal
          </Link>
        </>
      )}
      {voter.stage === 'screened' && (
        <>
          <label className="check-row">
            <input
              type="checkbox"
              checked={inkFree}
              onChange={(e) => setInkFree(e.target.checked)}
            />
            <span>
              Jari pemilih belum bertinta
              <small>Pastikan pemilih belum menggunakan hak pilihnya.</small>
            </span>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={identity}
              onChange={(e) => setIdentity(e.target.checked)}
            />
            <span>
              Data diri dan dokumen sudah sesuai
              <small>KPPS memeriksa undangan QR dan kartu identitas.</small>
            </span>
          </label>
          <Button
            disabled={!inkFree || !identity || busy}
            onClick={() =>
              act({ type: 'REGISTER', voterId: voter.id, inkFree, identityChecked: identity })
            }
          >
            {busy ? 'Menyimpan...' : 'Daftarkan dan buat antrean'}
          </Button>
        </>
      )}
      {voter.stage === 'registered' && (
        <div className="rounded-lg bg-[#edf3e6] p-6 text-center">
          <p className="eyebrow">Nomor antrean Anda</p>
          <p className="my-3 text-3xl font-semibold tracking-wider">
            {queueLabel(voter.queueNumber)}
          </p>
          <p className="muted text-xs">Silakan menunggu panggilan petugas KPPS.</p>
        </div>
      )}
      {voter.stage === 'called' && (
        <>
          <Notice>
            Antrean {queueLabel(voter.queueNumber)} dipanggil. Silakan isi tanda tangan konfirmasi
            kehadiran.
          </Notice>
          <SignaturePad name={voter.name} onChange={setSignature} />
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              Saya mengonfirmasi kehadiran saya
              <small>Tanda tangan ini digunakan untuk daftar hadir simulasi.</small>
            </span>
          </label>
          <Button
            disabled={!signature || !consent || busy}
            onClick={() => act({ type: 'SIGN', voterId: voter.id, signature })}
          >
            {busy ? 'Menyimpan...' : 'Simpan kehadiran'}
          </Button>
        </>
      )}
      {['ready', 'voted', 'completed'].includes(voter.stage) && (
        <>
          <Notice tone="success">Kehadiran telah dikonfirmasi.</Notice>
          {voter.stage === 'ready' ? (
            <Link className="button" href="/bilik">
              Lanjut ke bilik suara
            </Link>
          ) : (
            <p className="muted text-xs">Pemilih telah menggunakan hak pilih pada simulasi ini.</p>
          )}
        </>
      )}
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
