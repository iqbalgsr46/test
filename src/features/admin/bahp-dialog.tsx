'use client';

import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CANDIDATES, ELECTION } from '@/features/election/data';
import type { ElectionState } from '@/features/election/types';

interface BahpDialogProps {
  open: boolean;
  onClose: () => void;
  state: ElectionState;
}

export function BahpDialog({ open, onClose, state }: BahpDialogProps) {
  const totalDpt = state.voters.length;
  const totalVoted = state.voters.filter(
    (v) => v.stage === 'voted' || v.stage === 'completed',
  ).length;
  const totalUnvoted = totalDpt - totalVoted;
  const participationRate = totalDpt > 0 ? ((totalVoted / totalDpt) * 100).toFixed(1) : '0';

  return (
    <Dialog open={open} onClose={onClose} title="Berita Acara Rekapitulasi Hasil Suara">
      <div className="max-h-[70vh] overflow-y-auto px-1 py-2 text-xs text-[#223628]">
        {/* Printable Official Document Content */}
        <div id="bahp-document" className="rounded-xl border border-[#cfdacd] bg-[#fdfdfc] p-6">
          {/* Header Berita Acara */}
          <div className="border-b-2 border-black pb-4 text-center">
            <h3 className="font-serif text-sm font-bold tracking-wider uppercase text-black">
              PANITIA PEMILIHAN KEPALA DESA (KUWU)
            </h3>
            <h4 className="font-serif text-base font-black uppercase text-black">
              DESA {ELECTION.village.toUpperCase()} · KECAMATAN {ELECTION.district.toUpperCase()}
            </h4>
            <p className="mt-1 text-[11px] text-black">
              KABUPATEN {ELECTION.regency.toUpperCase()} · PROVINSI JAWA BARAT
            </p>
            <p className="mt-2 text-xs font-bold uppercase tracking-widest text-black">
              BERITA ACARA REKAPITULASI HASIL PENGHITUNGAN SUARA (BAHP)
            </p>
            <p className="text-[10px] text-black">Nomor: 270/BAHP-PLK/{ELECTION.id}/2026</p>
          </div>

          {/* Statement */}
          <p className="mt-4 leading-relaxed text-black">
            Pada hari ini, <strong className="font-bold">{ELECTION.dateLabel}</strong>, bertempat di{' '}
            <strong className="font-bold">{ELECTION.location}</strong>, Kelompok Penyelenggara
            Pemungutan Suara (KPPS) pada <strong className="font-bold">{ELECTION.tps}</strong> telah
            melaksanakan pemungutan dan rekapitulasi penghitungan suara secara digital dengan
            rincian sebagai berikut:
          </p>

          {/* Table 1: Turnout */}
          <div className="mt-4">
            <h5 className="font-bold text-black uppercase text-[11px]">
              I. DATA PEMILIH & PARTISIPASI
            </h5>
            <table className="mt-1.5 w-full border-collapse border border-black text-left text-[11px]">
              <tbody>
                <tr className="border-b border-black">
                  <td className="w-8 border-r border-black p-1.5 text-center">1</td>
                  <td className="border-r border-black p-1.5">
                    Jumlah Pemilih Terdaftar dalam DPT
                  </td>
                  <td className="w-20 p-1.5 text-right font-bold">{totalDpt} Orang</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1.5 text-center">2</td>
                  <td className="border-r border-black p-1.5">
                    Jumlah Suara Sah yang Masuk (Memilih)
                  </td>
                  <td className="p-1.5 text-right font-bold">{totalVoted} Suara</td>
                </tr>
                <tr className="border-b border-black">
                  <td className="border-r border-black p-1.5 text-center">3</td>
                  <td className="border-r border-black p-1.5">
                    Jumlah Pemilih Belum / Tidak Menggunakan Hak Suara
                  </td>
                  <td className="p-1.5 text-right font-bold">{totalUnvoted} Orang</td>
                </tr>
                <tr>
                  <td className="border-r border-black p-1.5 text-center">4</td>
                  <td className="border-r border-black p-1.5 font-bold">
                    Tingkat Partisipasi Pemilih
                  </td>
                  <td className="p-1.5 text-right font-bold text-[#183e30]">
                    {participationRate}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Table 2: Candidate Results */}
          <div className="mt-4">
            <h5 className="font-bold text-black uppercase text-[11px]">
              II. RINCIAN PEROLEHAN SUARA CALON KUWU
            </h5>
            <table className="mt-1.5 w-full border-collapse border border-black text-left text-[11px]">
              <thead>
                <tr className="border-b border-black bg-[#f0f4ee]">
                  <th className="w-16 border-r border-black p-1.5 text-center font-bold">
                    No. Urut
                  </th>
                  <th className="border-r border-black p-1.5 font-bold">Nama Calon Kuwu</th>
                  <th className="w-24 border-r border-black p-1.5 text-right font-bold">
                    Perolehan Suara
                  </th>
                  <th className="w-20 p-1.5 text-right font-bold">Persentase</th>
                </tr>
              </thead>
              <tbody>
                {CANDIDATES.map((c) => {
                  const votes = state.totals[c.id] ?? 0;
                  const pct = totalVoted > 0 ? ((votes / totalVoted) * 100).toFixed(1) : '0';
                  return (
                    <tr key={c.id} className="border-b border-black">
                      <td className="border-r border-black p-1.5 text-center font-bold">
                        {c.number}
                      </td>
                      <td className="border-r border-black p-1.5 font-semibold">{c.name}</td>
                      <td className="border-r border-black p-1.5 text-right font-mono font-bold">
                        {votes} Suara
                      </td>
                      <td className="p-1.5 text-right font-mono font-semibold">{pct}%</td>
                    </tr>
                  );
                })}
                <tr className="bg-[#f0f4ee] font-bold">
                  <td colSpan={2} className="border-r border-black p-1.5 text-center">
                    TOTAL SUARA SAH MASUK
                  </td>
                  <td className="border-r border-black p-1.5 text-right font-mono">
                    {totalVoted} Suara
                  </td>
                  <td className="p-1.5 text-right font-mono">{totalVoted > 0 ? '100.0%' : '0%'}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Signatures */}
          <div className="mt-8 grid grid-cols-2 gap-4 text-center text-[10px] text-black">
            <div>
              <p>Saksi Calon 01 & 02,</p>
              <div className="my-8 border-b border-dashed border-gray-400" />
              <p className="font-semibold">( ............................................ )</p>
            </div>
            <div>
              <p>Ketua KPPS {ELECTION.tps},</p>
              <div className="my-8 border-b border-dashed border-gray-400" />
              <p className="font-bold underline">H. SUHENDAR, S.IP</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3 border-t border-[#d8e2d4] pt-4">
        <Button variant="secondary" onClick={onClose}>
          Tutup
        </Button>
        <Button
          onClick={() => {
            window.print();
          }}
          className="bg-[#183e30] text-white hover:bg-[#122e24]"
        >
          Cetak Dokumen (A4)
        </Button>
      </div>
    </Dialog>
  );
}
