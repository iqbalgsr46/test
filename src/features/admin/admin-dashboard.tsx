'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useElection } from '@/features/election/election-provider';
import { CANDIDATES, ELECTION } from '@/features/election/data';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
import { BahpDialog } from './bahp-dialog';
import { QrCatalogDialog } from './qr-catalog-dialog';

interface AdminDashboardProps {
  onLogout: () => void;
}

export function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const { state, reset, isLoaded, error } = useElection();
  const [filter, setFilter] = useState<'all' | 'voted' | 'unvoted'>('all');
  const [search, setSearch] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [bahpOpen, setBahpOpen] = useState(false);
  const [qrCatalogOpen, setQrCatalogOpen] = useState(false);
  const [selectedVoterIdForQr, setSelectedVoterIdForQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [currentTime, setCurrentTime] = useState('');

  // Clock in WIB
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          timeZone: 'Asia/Jakarta',
        }) + ' WIB',
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalDpt = state.voters.length;
  const votedVoters = state.voters.filter((v) => v.stage === 'voted' || v.stage === 'completed');
  const totalVoted = votedVoters.length;
  const totalUnvoted = totalDpt - totalVoted;
  const participationRate = totalDpt > 0 ? ((totalVoted / totalDpt) * 100).toFixed(1) : '0';

  // Find max votes for leading candidate badge
  const candidateScores = CANDIDATES.map((c) => ({
    ...c,
    votes: state.totals[c.id] ?? 0,
    pct: totalVoted > 0 ? (((state.totals[c.id] ?? 0) / totalVoted) * 100).toFixed(1) : '0',
  }));
  const maxVotes = Math.max(...candidateScores.map((c) => c.votes));
  const hasLeader =
    maxVotes > 0 && candidateScores.filter((c) => c.votes === maxVotes).length === 1;

  // Filter & Search
  const filteredVoters = useMemo(() => {
    return state.voters.filter((voter) => {
      const isVoted = voter.stage === 'voted' || voter.stage === 'completed';
      if (filter === 'voted' && !isVoted) return false;
      if (filter === 'unvoted' && isVoted) return false;

      if (!search.trim()) return true;
      const query = search.toLowerCase();
      return (
        voter.name.toLowerCase().includes(query) ||
        voter.identity.toLowerCase().includes(query) ||
        voter.invitationCode.toLowerCase().includes(query) ||
        voter.address.toLowerCase().includes(query)
      );
    });
  }, [state.voters, filter, search]);

  async function handleResetSimulation() {
    setBusy(true);
    try {
      await reset();
      setResetOpen(false);
    } catch {
      // handled
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[#f1f4ee] text-[#1c2c22]">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 border-b border-[#d4ded1] bg-white px-5 py-3.5 shadow-xs sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-[#183e30] font-serif text-xl font-bold text-[#e8d7a7]">
              ct
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider text-[#183e30]">
                  PANEL REKAPITULASI · DESA {ELECTION.village.toUpperCase()}
                </span>
                <span className="hidden rounded bg-[#dbe8da] px-2 py-0.5 text-[10px] font-bold text-[#1f5636] sm:inline">
                  {ELECTION.tps}
                </span>
              </div>
              <p className="text-[11px] text-[#556959]">Petugas KPPS Balai Desa Cikaum Timur</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentTime && (
              <span className="hidden items-center gap-1.5 rounded-md border border-[#cfdacd] bg-[#f8faf6] px-3 py-1.5 font-mono text-xs font-semibold text-[#294232] md:inline-flex">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-3.5 text-[#3b5e47]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
                </svg>
                <span>{currentTime}</span>
              </span>
            )}
            <Link
              href="/"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#c4d4c2] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#183e30] transition hover:bg-[#edf5eb]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
              <span>Buka Bilik Suara (Tablet)</span>
            </Link>
            <Button
              variant="secondary"
              onClick={onLogout}
              className="border-[#cfdacd] text-xs font-semibold text-[#661e1b] hover:bg-[#ffeded]"
            >
              Keluar
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        {!isLoaded ? (
          <div className="py-20 text-center">
            <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-[#183e30] border-t-transparent" />
            <p className="text-sm font-medium text-[#495a50]">Memuat data hasil pemilihan...</p>
          </div>
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : (
          <div className="space-y-8">
            {/* Page Title & Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#245443]">
                  DATA HASIL PEMILIHAN KUWU
                </span>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#143024] sm:text-3xl">
                  Dashboard Rekapitulasi Suara
                </h1>
                <p className="mt-1 text-xs text-[#526a57]">
                  Pemantauan hasil pemungutan suara secara real-time dari bilik suara digital.
                </p>
              </div>

              <div className="flex flex-wrap gap-2.5">
                <Button
                  onClick={() => {
                    setSelectedVoterIdForQr(null);
                    setQrCatalogOpen(true);
                  }}
                  className="flex items-center gap-2 bg-[#183e30] text-xs font-bold text-white hover:bg-[#102d23]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Unduh Kode QR Pemilih</span>
                </Button>
                <Button
                  onClick={() => setBahpOpen(true)}
                  variant="secondary"
                  className="flex items-center gap-2 border-[#cfdacd] bg-white text-xs font-bold text-[#183e30] hover:bg-[#edf5eb]"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span>Cetak Berita Acara (BAHP)</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setResetOpen(true)}
                  className="border-[#cfdacd] bg-white text-xs font-semibold text-[#8c2a26] hover:bg-[#fff2f1]"
                >
                  Mulai Ulang Simulasi
                </Button>
              </div>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#546b5a]">
                  TOTAL DPT
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-serif text-3xl font-black text-[#143024]">{totalDpt}</span>
                  <span className="text-xs font-semibold text-[#546b5a]">Pemilih</span>
                </div>
                <div className="mt-2 text-[10px] text-[#6d8272]">Daftar Pemilih Tetap TPS 001</div>
              </div>

              <div className="rounded-2xl border border-[#b8dcbb] bg-[#edf8ec] p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1e5833]">
                  SUARA MASUK
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-serif text-3xl font-black text-[#1b4d2e]">
                    {totalVoted}
                  </span>
                  <span className="text-xs font-semibold text-[#276b40]">Suara</span>
                </div>
                <div className="mt-2 text-[10px] text-[#3b6b4e]">Telah memilih di bilik suara</div>
              </div>

              <div className="rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#546b5a]">
                  PARTISIPASI
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-serif text-3xl font-black text-[#143024]">
                    {participationRate}%
                  </span>
                  <span className="text-xs font-semibold text-[#546b5a]">Kehadiran</span>
                </div>
                <div className="mt-2 text-[10px] text-[#6d8272]">Persentase suara masuk</div>
              </div>

              <div className="rounded-2xl border border-[#d2ddd0] bg-white p-5 shadow-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#546b5a]">
                  BELUM MEMILIH
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-serif text-3xl font-black text-[#143024]">
                    {totalUnvoted}
                  </span>
                  <span className="text-xs font-semibold text-[#546b5a]">Warga</span>
                </div>
                <div className="mt-2 text-[10px] text-[#6d8272]">Belum menggunakan hak pilih</div>
              </div>
            </div>

            {/* Candidate Result Cards (Quick Count / Real Count) */}
            <div className="rounded-2xl border border-[#d2ded0] bg-white p-6 shadow-xs">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#e5eee3] pb-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-[#163827]">
                    Hasil Perolehan Suara Calon Kuwu
                  </h2>
                  <p className="mt-0.5 text-xs text-[#526958]">
                    Rekapitulasi perolehan suara sah berdasarkan pilihan pemilih di bilik suara
                    digital.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-2 rounded-full bg-[#207a41] animate-ping" />
                  <span className="text-xs font-bold text-[#1f5636]">Hasil Realtime</span>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {candidateScores.map((c) => {
                  const isLeading = hasLeader && c.votes === maxVotes;
                  return (
                    <div
                      key={c.id}
                      className={`relative overflow-hidden rounded-2xl border-2 p-5 transition ${
                        isLeading
                          ? 'border-[#245443] bg-[#f3f9f1] shadow-xs'
                          : 'border-[#d7e1d5] bg-white'
                      }`}
                    >
                      {isLeading && (
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-[#183e30] px-3 py-1 text-[10px] font-bold text-[#e5d4a4] shadow-xs">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="size-3 text-[#e5d4a4]"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                          <span>Unggul Sementara</span>
                        </span>
                      )}

                      <div className="flex items-center gap-4">
                        <div className="relative size-20 shrink-0 overflow-hidden rounded-xl border border-[#cad7c7] bg-[#edf2ea]">
                          <Image
                            src={c.photo}
                            alt={c.name}
                            fill
                            sizes="80px"
                            className="object-contain p-1"
                          />
                        </div>
                        <div>
                          <span className="inline-block rounded bg-[#245443] px-2 py-0.5 font-serif text-[11px] font-bold text-white">
                            CALON {c.number}
                          </span>
                          <h3 className="mt-1 text-lg font-bold text-[#143024]">{c.name}</h3>
                          <p className="text-xs text-[#526b59]">{c.description}</p>
                        </div>
                      </div>

                      {/* Vote Score & Percentage */}
                      <div className="mt-5 rounded-xl border border-[#d2ded0] bg-white p-4">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs font-semibold text-[#546b5a]">
                            Perolehan Suara:
                          </span>
                          <div className="text-right">
                            <span className="font-serif text-2xl font-black text-[#153424]">
                              {c.votes}
                            </span>
                            <span className="text-xs font-medium text-[#546b5a]"> Suara</span>
                            <span className="ml-2 font-mono text-sm font-bold text-[#235835]">
                              ({c.pct}%)
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#e8efe6]">
                          <div
                            className="h-full rounded-full bg-[#245443] transition-all duration-500"
                            style={{ width: `${c.pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Voter Participation Table */}
            <div className="rounded-2xl border border-[#d2ded0] bg-white p-6 shadow-xs">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-[#163827]">
                    Data Pemilih & Status Hak Suara
                  </h2>
                  <p className="mt-0.5 text-xs text-[#526958]">
                    Daftar pemilih tetap (DPT) beserta status penggunaan hak pilihnya.
                  </p>
                </div>

                {/* Filter Tabs & Search */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex rounded-lg border border-[#cfdacd] bg-[#f0f5ee] p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setFilter('all')}
                      className={`rounded-md px-3 py-1.5 font-semibold transition ${
                        filter === 'all'
                          ? 'bg-[#183e30] text-white shadow-xs'
                          : 'text-[#3d5444] hover:bg-[#e4ede1]'
                      }`}
                    >
                      Semua ({totalDpt})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('voted')}
                      className={`rounded-md px-3 py-1.5 font-semibold transition ${
                        filter === 'voted'
                          ? 'bg-[#183e30] text-white shadow-xs'
                          : 'text-[#3d5444] hover:bg-[#e4ede1]'
                      }`}
                    >
                      Sudah Memilih ({totalVoted})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilter('unvoted')}
                      className={`rounded-md px-3 py-1.5 font-semibold transition ${
                        filter === 'unvoted'
                          ? 'bg-[#183e30] text-white shadow-xs'
                          : 'text-[#3d5444] hover:bg-[#e4ede1]'
                      }`}
                    >
                      Belum Memilih ({totalUnvoted})
                    </button>
                  </div>

                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari nama, NIK, kode..."
                    className="field min-h-9 max-w-xs text-xs"
                  />
                </div>
              </div>

              {/* Responsive Table */}
              <div className="overflow-x-auto rounded-xl border border-[#dce5da]">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#dce5da] bg-[#f4f7f2] text-[11px] font-bold uppercase tracking-wider text-[#405646]">
                    <tr>
                      <th className="px-4 py-3 text-center">No</th>
                      <th className="px-4 py-3">Nama Pemilih</th>
                      <th className="px-4 py-3">NIK / Identitas</th>
                      <th className="px-4 py-3">Alamat</th>
                      <th className="px-4 py-3">Kode Undangan</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3">Waktu Memilih</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e3ebe0]">
                    {filteredVoters.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-xs text-[#627768]">
                          Tidak ada data pemilih yang sesuai dengan pencarian atau filter.
                        </td>
                      </tr>
                    ) : (
                      filteredVoters.map((voter, index) => {
                        const isVoted = voter.stage === 'voted' || voter.stage === 'completed';
                        const timeStr = voter.votedAt
                          ? new Date(voter.votedAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            }) + ' WIB'
                          : '-';

                        return (
                          <tr key={voter.id} className="transition hover:bg-[#f6f9f4]">
                            <td className="px-4 py-3 text-center font-medium text-[#5c7062]">
                              {index + 1}
                            </td>
                            <td className="px-4 py-3 font-bold text-[#143024]">{voter.name}</td>
                            <td className="px-4 py-3 font-mono text-[11px] text-[#4d6353]">
                              {voter.identity}
                            </td>
                            <td className="px-4 py-3 text-[#4d6353]">{voter.address}</td>
                            <td className="px-4 py-3 font-mono text-[11px] font-semibold text-[#183e30]">
                              {voter.invitationCode}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                                  isVoted
                                    ? 'bg-[#e0f2dd] text-[#1c552f]'
                                    : 'bg-[#f5eecb] text-[#785913]'
                                }`}
                              >
                                {isVoted ? (
                                  <>
                                    <svg
                                      xmlns="http://www.w3.org/2000/svg"
                                      className="size-3 text-[#1c552f]"
                                      fill="none"
                                      viewBox="0 0 24 24"
                                      stroke="currentColor"
                                      strokeWidth={3}
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                      />
                                    </svg>
                                    <span>Sudah Memilih</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="size-1.5 rounded-full bg-[#785913]" />
                                    <span>Belum Memilih</span>
                                  </>
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-[11px] text-[#4a6150]">
                              {timeStr}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedVoterIdForQr(voter.id);
                                    setQrCatalogOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#c5d5c3] bg-[#f8faf7] px-2 py-1 text-[11px] font-bold text-[#183e30] transition hover:bg-[#edf5eb]"
                                  title="Lihat & unduh gambar QR PNG"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="size-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                                    />
                                  </svg>
                                  <span>Unduh QR</span>
                                </button>
                                <Link
                                  href={`/cetak/undangan/${voter.id}`}
                                  target="_blank"
                                  className="inline-flex items-center gap-1 rounded-md border border-[#c5d5c3] bg-white px-2 py-1 text-[11px] font-semibold text-[#245443] transition hover:bg-[#edf5eb]"
                                  title="Cetak Surat Undangan ber-QR untuk warga ini"
                                >
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    className="size-3"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={2}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                                    />
                                  </svg>
                                  <span>Surat A4</span>
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Anonymous Audit Log (Luber Jurdil) */}
            <div className="rounded-2xl border border-[#d2ded0] bg-white p-6 shadow-xs">
              <h2 className="text-base font-bold text-[#163827]">
                Log Transaksi Suara Masuk (Audit Trail Anonim)
              </h2>
              <p className="mt-0.5 text-xs text-[#526958]">
                Sesuai asas Langsung, Umum, Bebas, dan Rahasia (LUBER), identitas pilihan calon
                pemilih tidak dicatat pada struk transaksi.
              </p>

              <div className="mt-4 space-y-2">
                {votedVoters.length === 0 ? (
                  <p className="text-xs text-[#708475] italic">Belum ada suara masuk.</p>
                ) : (
                  votedVoters.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#dde6da] bg-[#f8faf7] p-3 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-[#207a41]" />
                        <span className="font-semibold text-[#183e30]">Suara Sah Tercatat</span>
                        <span className="font-mono text-[10px] text-[#556959]">
                          UUID: {item.receiptId ?? 'N/A'}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-[#465b4c]">
                        {item.votedAt
                          ? new Date(item.votedAt).toLocaleString('id-ID', {
                              dateStyle: 'short',
                              timeStyle: 'medium',
                            })
                          : '-'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* BAHP Dialog */}
      <BahpDialog open={bahpOpen} onClose={() => setBahpOpen(false)} state={state} />

      {/* QR Catalog & Download Dialog */}
      <QrCatalogDialog
        open={qrCatalogOpen}
        onClose={() => setQrCatalogOpen(false)}
        voters={state.voters}
        initialVoterId={selectedVoterIdForQr}
      />

      {/* Reset Confirmation Dialog */}
      <Dialog
        open={resetOpen}
        onClose={() => {
          if (!busy) setResetOpen(false);
        }}
        title="Mulai Ulang Simulasi Pemilihan?"
      >
        <p className="my-4 text-xs leading-relaxed text-[#4b5e50]">
          Seluruh suara yang masuk, nomor antrean, dan status pemilih akan direset kembali ke
          kondisi awal (0 suara). Data simulasi ini hanya tersimpan di browser Anda.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => setResetOpen(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            onClick={handleResetSimulation}
            className="bg-[#b63532] text-white hover:bg-[#962825]"
          >
            {busy ? 'Mereset...' : 'Ya, Reset Data Suara'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
