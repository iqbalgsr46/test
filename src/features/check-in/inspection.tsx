'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useElection } from '@/features/election/election-provider';
import { STAGE_LABELS } from '@/features/election/presentation';
import { PageHeading } from '@/components/layout/workspace';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
export function Inspection() {
  const { state, dispatch } = useElection();
  const [id, setId] = useState(state.voters[0]?.id ?? '');
  const [invitation, setInvitation] = useState(false);
  const [identity, setIdentity] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const voter = state.voters.find((v) => v.id === id);
  const finished = state.voters.filter((v) => v.stage === 'completed').length;
  const active = state.voters.filter((v) => !['invited', 'completed'].includes(v.stage)).length;
  async function screen() {
    if (!voter) return;
    setBusy(true);
    setError('');
    try {
      await dispatch({
        type: 'SCREEN',
        voterId: voter.id,
        invitationChecked: invitation,
        identityChecked: identity,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pemeriksaan gagal disimpan.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="TAHAP 01 · PENGAMANAN TPS"
        title="Pemeriksaan awal"
        description="Sambut pemilih, periksa dokumen, lalu arahkan ke meja registrasi."
        action={
          <Link href="/undangan" className="button" data-variant="secondary">
            Lihat undangan contoh
          </Link>
        }
      />
      <div className="mb-7 grid grid-cols-3 divide-x divide-[#dce3db] rounded-lg border border-[#dce3db] bg-white py-5">
        {[
          { label: 'Pemilih simulasi', value: state.voters.length, sub: 'Data undangan tersedia' },
          { label: 'Dalam proses', value: active, sub: 'Sedang mengikuti alur TPS' },
          { label: 'Proses selesai', value: finished, sub: 'Seluruh tahapan tuntas' },
        ].map((item) => (
          <div key={item.label} className="px-4 sm:px-6">
            <p className="text-[10px] font-medium text-[#68776b] sm:text-xs">{item.label}</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {String(item.value).padStart(2, '0')}
            </p>
            <p className="mt-1 hidden text-[10px] text-[#889184] sm:block">{item.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(270px,1fr)]">
        <section className="panel p-5 sm:p-7">
          <div className="mb-6 flex justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold">Verifikasi kedatangan</h2>
              <p className="muted mt-1 text-xs">Dilakukan oleh petugas pengamanan TPS.</p>
            </div>
            <span className="status h-fit">Pintu masuk</span>
          </div>
          <label className="label" htmlFor="voter-select">
            Pilih pemilih
          </label>
          <select
            id="voter-select"
            className="field"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setInvitation(false);
              setIdentity(false);
              setError('');
            }}
          >
            {state.voters.map((v) => (
              <option value={v.id} key={v.id}>
                {v.name} · {v.identity}
              </option>
            ))}
          </select>
          {voter && (
            <>
              <div className="my-5 grid grid-cols-2 gap-5 rounded-lg bg-[#f6f8f2] p-4">
                <div>
                  <p className="eyebrow">IDENTITAS CONTOH</p>
                  <p className="mt-2 text-sm font-semibold">{voter.identity}</p>
                </div>
                <div>
                  <p className="eyebrow">KODE UNDANGAN</p>
                  <p className="mt-2 text-sm font-semibold tracking-wide">{voter.invitationCode}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-[#75816e]">{voter.address}</p>
                </div>
              </div>
              {voter.stage === 'invited' ? (
                <>
                  <div className="divide-y divide-[#edf0e8]">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={invitation}
                        onChange={(e) => setInvitation(e.target.checked)}
                      />
                      <span>
                        Surat undangan telah diperiksa
                        <small>Nama, TPS tujuan, dan kode undangan sesuai.</small>
                      </span>
                    </label>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={identity}
                        onChange={(e) => setIdentity(e.target.checked)}
                      />
                      <span>
                        Kartu identitas sesuai dengan undangan
                        <small>Cocokkan identitas dan wajah pemilih secara langsung.</small>
                      </span>
                    </label>
                  </div>
                  {error && <Notice tone="error">{error}</Notice>}
                  <div className="mt-6 border-t border-[#e9ede4] pt-5">
                    <Button
                      className="w-full sm:w-auto"
                      disabled={!invitation || !identity || busy}
                      onClick={screen}
                    >
                      {busy ? 'Menyimpan...' : 'Konfirmasi pemeriksaan'}
                    </Button>
                    <p className="muted mt-3 text-[10px]">
                      Pemeriksaan fisik tetap dilakukan oleh petugas.
                    </p>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <Notice tone="success">
                    {voter.name} sudah lolos pemeriksaan awal. Status saat ini:{' '}
                    {STAGE_LABELS[voter.stage]}.
                  </Notice>
                  <Link className="button" href={`/registrasi?pemilih=${voter.id}`}>
                    Lanjut ke meja 1
                  </Link>
                </div>
              )}
            </>
          )}
        </section>
        <aside className="space-y-5">
          <div className="rounded-xl bg-[#e9efdf] p-6">
            <p className="eyebrow text-[#5e7049]">PROSEDUR KEDATANGAN</p>
            <h2 className="mt-3 font-serif text-[23px] leading-snug text-[#354b2c]">
              Pelayanan yang tertib,
              <br />
              hak pilih yang terjaga.
            </h2>
            <ol className="mt-6 space-y-5">
              {[
                ['01', 'Periksa undangan', 'Pastikan pemilih datang ke TPS yang sesuai.'],
                ['02', 'Cocokkan identitas', 'Periksa kartu identitas bersama surat undangan.'],
                ['03', 'Arahkan ke meja 1', 'Verifikasi jari, data diri, dan nomor antrean.'],
              ].map(([n, t, d]) => (
                <li key={n} className="flex gap-3">
                  <span className="pt-1 text-[10px] font-semibold text-[#8a956b]">{n}</span>
                  <div>
                    <p className="text-xs font-semibold">{t}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#6c795c]">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="px-1">
            <p className="text-[11px] font-semibold">Tentang data contoh</p>
            <p className="muted mt-2 text-[11px] leading-relaxed">
              Enam pemilih fiktif disediakan untuk mencoba seluruh alur. Surat undangan dapat
              dicetak dari menu dokumen.
            </p>
          </div>
        </aside>
      </div>
      <section className="panel mt-7 overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-5 sm:px-7">
          <div>
            <h2 className="text-sm font-semibold">Daftar pemilih simulasi</h2>
            <p className="muted mt-1 text-[11px]">
              Status layanan diperbarui setelah setiap tahapan.
            </p>
          </div>
          <span className="status">{state.voters.length} pemilih</span>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama pemilih</th>
                <th>Identitas contoh</th>
                <th>Kode undangan</th>
                <th>Status layanan</th>
              </tr>
            </thead>
            <tbody>
              {state.voters.map((v) => (
                <tr key={v.id}>
                  <td className="min-w-40 font-medium">{v.name}</td>
                  <td>{v.identity}</td>
                  <td className="whitespace-nowrap tracking-wide">{v.invitationCode}</td>
                  <td>
                    <span className="status" data-active={v.stage !== 'invited'}>
                      {STAGE_LABELS[v.stage]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
