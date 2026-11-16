'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useElection } from '@/features/election/election-provider';
import { CANDIDATES, ELECTION } from '@/features/election/data';
import { findVoterByQr } from '@/features/election/engine';
import { Notice } from '@/components/ui/notice';
import { QrScanner } from './qr-scanner';

export function Ballot() {
  const { state, dispatch, isLoaded, error: storageError } = useElection();
  const [voterId, setVoterId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittedReceiptId, setSubmittedReceiptId] = useState<string | null>(null);

  const voter = state.voters.find((v) => v.id === voterId);
  const candidate = CANDIDATES.find((c) => c.id === candidateId);
  const isVoted = Boolean(
    voter &&
      submittedReceiptId &&
      voter.receiptId === submittedReceiptId &&
      (voter.stage === 'voted' || voter.stage === 'completed'),
  );

  // Auto-return to scanner after 10 seconds behind the scenes
  useEffect(() => {
    if (!isVoted) return;
    const timer = setTimeout(() => {
      exit();
    }, 10_000);
    return () => clearTimeout(timer);
  }, [isVoted]);

  // Eagerly preload and decode coblos paku image so the browser has it ready in memory before any user tap
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const img = new window.Image();
    img.src = '/images/coblos-paku.png';
    if (typeof img.decode === 'function') {
      img.decode().catch(() => {});
    }
  }, []);

  function handleScan(value: string) {
    setError('');
    setSubmittedReceiptId(null);
    try {
      const found = findVoterByQr(state, value);
      if (!found) {
        throw new Error(
          'Kode QR undangan tidak ditemukan atau tidak valid. Periksa kembali surat undangan Anda.',
        );
      }
      if (found.stage === 'voted' || found.stage === 'completed') {
        const timeStr = found.votedAt
          ? new Date(found.votedAt).toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
            }) + ' WIB'
          : 'sebelumnya';
        throw new Error(
          `Pemilih atas nama ${found.name} sudah menggunakan hak pilih pada ${timeStr}. Undangan ini tidak dapat digunakan kembali.`,
        );
      }
      setVoterId(found.id);
      setCandidateId(null);
      setError('');
    } catch (e) {
      setVoterId(null);
      setError(e instanceof Error ? e.message : 'Undangan tidak dapat diverifikasi.');
    }
  }

  async function handleVote() {
    if (!voter || !candidate || busy) return;
    if (voter.stage === 'voted' || voter.stage === 'completed') {
      setError('Pemilih sudah menggunakan hak pilih. Undangan ini tidak dapat digunakan kembali.');
      setConfirmOpen(false);
      return;
    }
    setBusy(true);
    setError('');
    const receiptId = crypto.randomUUID();
    try {
      await dispatch({
        type: 'KIOSK_VOTE',
        voterId: voter.id,
        candidateId: candidate.id,
        receiptId,
        timestamp: new Date().toISOString(),
      });
      setSubmittedReceiptId(receiptId);
      setCandidateId(null);
      setConfirmOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pilihan belum tersimpan. Silakan coba lagi.');
      setConfirmOpen(false);
    } finally {
      setBusy(false);
    }
  }

  function exit() {
    setVoterId(null);
    setCandidateId(null);
    setSubmittedReceiptId(null);
    setConfirmOpen(false);
    setError('');
  }

  return (
    <div className="relative h-dvh max-h-dvh w-full overflow-hidden font-sans select-none">
      {/* Preload coblos paku asset so browser warms exact unoptimized asset */}
      <div
        className="pointer-events-none fixed -top-96 left-0 size-1 overflow-hidden opacity-0"
        aria-hidden="true"
      >
        <Image
          src="/images/coblos-paku.png"
          alt=""
          width={160}
          height={192}
          unoptimized
          priority
          decoding="sync"
        />
      </div>

      {/* Discreet Top Navigation Bar for Admin (only on camera scanner screen) */}
      {!voter && (
        <header className="absolute top-0 right-0 left-0 z-40 flex items-center justify-end px-5 py-3 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-3.5 py-1.5 text-xs font-semibold text-[#183e30] shadow-xs backdrop-blur-md transition hover:bg-white"
              title="Masuk ke Dashboard Admin"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span>Admin</span>
            </Link>
          </div>
        </header>
      )}

      {/* Main Container */}
      <main className="h-dvh max-h-dvh w-full overflow-hidden">
        {!isLoaded ? (
          <div className="flex min-h-dvh items-center justify-center bg-slate-950">
            <div className="text-center">
              <div className="mx-auto mb-4 size-10 animate-spin rounded-full border-4 border-sky-400 border-t-transparent" />
              <p className="text-sm font-medium text-sky-200">Menyiapkan bilik suara tablet...</p>
            </div>
          </div>
        ) : storageError ? (
          <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-6">
            <div className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <Notice tone="error">{storageError}</Notice>
              <div className="mt-4 text-center">
                <Link href="/admin" className="button">
                  Buka Panel Admin
                </Link>
              </div>
            </div>
          </div>
        ) : voter && isVoted ? (
          /* ================= SCREEN 4: HALAMAN TERIMA KASIH (RINGKAS & CLEAN, AUTO 10 DETIK) ================= */
          <div className="h-dvh max-h-dvh w-full overflow-hidden flex flex-col items-center justify-center bg-[#f4f8f3] px-4 text-[#143024] select-none animate-success-in">
            <div className="flex flex-col items-center text-center max-w-lg mx-auto">
              {/* Clean Checkmark Logo */}
              <div className="flex size-20 sm:size-24 items-center justify-center rounded-full bg-[#1e7e4e] text-white shadow-xl ring-8 ring-[#e0f0dd] animate-check-pop">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-10 sm:size-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>

              {/* Suara Berhasil Disimpan */}
              <p className="mt-5 sm:mt-6 text-xs sm:text-sm font-bold tracking-widest uppercase text-[#1e7e4e]">
                Suara Berhasil Disimpan
              </p>

              {/* Terima Kasih Telah Memilih */}
              <h1 className="mt-2 text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0f2e20]">
                Terima Kasih Telah Memilih
              </h1>
            </div>
          </div>
        ) : !voter ? (
          /* ================= SCREEN 1: FULL KAMERA BELAKANG SCAN QR (CLONING IMAGE 2) ================= */
          <div className="relative min-h-dvh w-full">
            <QrScanner onDecoded={handleScan} demoVoters={state.voters} />
            {error && (
              <div className="fixed bottom-24 left-1/2 z-50 w-full max-w-md -translate-x-1/2 px-4 animate-bounce">
                <Notice tone="error">{error}</Notice>
              </div>
            )}
          </div>
        ) : (
          /* ================= SCREEN 2: PILIH CALON KUWU (CLONING IMAGE 3: FULL LAYAR ADAPTIF, TANPA SCROLL) ================= */
          <div className="h-dvh max-h-dvh w-full overflow-hidden flex flex-col justify-between bg-[#dff0fa] px-3 py-2 sm:px-6 sm:py-3 text-[#142d3e] select-none animate-fade-in">
            {/* Header Surat Suara (Clean modern typography & Logo Benteng Pancasila) */}
            <div className="shrink-0 mx-auto w-full max-w-4xl text-center pt-0.5 sm:pt-1">
              {/* Official Logo Benteng Pancasila Subang */}
              <div className="relative mx-auto mb-1 size-8 sm:size-10 shrink-0">
                <Image
                  src="/images/logo-benteng-pancasila.png"
                  alt="Logo Benteng Pancasila Subang"
                  fill
                  sizes="40px"
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="font-sans text-xs sm:text-base font-extrabold tracking-widest uppercase text-[#0d344d] leading-tight">
                SURAT SUARA
              </h1>
              <h2 className="font-sans text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#184e72] leading-tight mt-0.5">
                PEMILIHAN KUWU DESA {ELECTION.village.toUpperCase()}
              </h2>
              <p className="font-sans text-[9px] sm:text-[11px] font-medium uppercase tracking-wider text-[#356586] leading-tight mt-0.5">
                KEC. {ELECTION.district.toUpperCase()} · KAB. {ELECTION.regency.toUpperCase()} · TAHUN 2024
              </p>
            </div>

            {/* Candidate Row (Foto full kotak, tanpa shadow & border, teks nama dibawah, coblos paku besar menonjol keluar) */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center gap-4 sm:gap-8 px-2 my-1 sm:my-2 overflow-visible">
              {CANDIDATES.map((c) => {
                const isSelected = candidateId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={`Pilih Calon ${c.number} ${c.name}`}
                    aria-pressed={isSelected}
                    onClick={() => setCandidateId(c.id)}
                    className="group relative flex h-full max-h-[58dvh] w-auto aspect-[3/4] sm:aspect-[4/5] flex-col overflow-visible rounded-none border-0 shadow-none bg-transparent transition-transform active:scale-[0.98]"
                  >
                    {/* Candidate Photo Box (Full foto tanpa padding/border/shadow, overflow-visible untuk paku) */}
                    <div className="relative flex-1 min-h-0 w-full overflow-visible bg-slate-200">
                      <Image
                        src={c.photo}
                        alt={`Foto Calon ${c.name}`}
                        fill
                        sizes="(max-width: 768px) 45vw, 320px"
                        className="object-cover"
                        priority
                      />

                      {/* Candidate Number Badge (Pojok kiri atas, tajam dan clean) */}
                      <div
                        className={`absolute top-0 left-0 z-10 flex size-7 sm:size-9 items-center justify-center font-sans text-sm sm:text-base font-black text-white transition-colors ${
                          isSelected ? 'bg-[#dc2626]' : 'bg-[#1976d2]'
                        }`}
                      >
                        {c.number}
                      </div>

                      {/* Animasi Gambar Coblos Paku (Pre-mounted in DOM, zero network request, zero decode delay on first click) */}
                      <div
                        className={`pointer-events-none absolute inset-0 z-30 overflow-visible transition-opacity duration-75 ${
                          isSelected ? 'opacity-100' : 'opacity-0'
                        }`}
                        aria-hidden={!isSelected}
                      >
                        <div
                          className={`absolute top-1/2 left-1/2 w-32 sm:w-40 aspect-[348/417] ${
                            isSelected ? 'animate-coblos' : '-translate-x-[30.4%] -translate-y-[77.8%]'
                          }`}
                        >
                          <Image
                            src="/images/coblos-paku.png"
                            alt={isSelected ? 'Tercoblos Paku' : ''}
                            fill
                            unoptimized
                            decoding="sync"
                            className="object-contain"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Candidate Name Footer (Tepat dibawah kotak foto, merah saat dipilih) */}
                    <div
                      className={`shrink-0 py-2 sm:py-2.5 text-center transition-colors rounded-none ${
                        isSelected ? 'bg-[#dc2626] text-white' : 'bg-white text-[#0f3148]'
                      }`}
                    >
                      <h3 className="text-xs sm:text-sm font-bold tracking-tight truncate px-2">{c.name}</h3>
                      <p className={`text-[9px] sm:text-[10px] font-semibold ${isSelected ? 'text-red-100' : 'text-[#567a94]'}`}>
                        Calon Kuwu No. Urut {c.number}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Bottom Wide Red Button (Matching Image 3, fits nicely at bottom without scroll) */}
            <div className="shrink-0 mx-auto w-full max-w-3xl pb-1">
              <button
                type="button"
                disabled={!candidate || busy}
                onClick={() => setConfirmOpen(true)}
                className={`w-full rounded-xl py-2.5 sm:py-3.5 text-center text-sm sm:text-lg font-black tracking-wider uppercase text-white shadow-lg transition-all active:scale-[0.99] ${
                  candidate && !busy
                    ? 'bg-[#e05338] hover:bg-[#c93f25] cursor-pointer'
                    : 'cursor-not-allowed bg-[#a8c2d4] opacity-70 shadow-none'
                }`}
              >
                {candidate
                  ? `PILIH KANDIDAT ${candidate.number}`
                  : 'SILAKAN SENTUH FOTO KANDIDAT DI ATAS'}
              </button>

              <div className="mt-1 flex items-center justify-between px-2 text-[10px] sm:text-xs text-[#416985]">
                <span>
                  Pemilih: <strong>{voter.name}</strong> ({voter.invitationCode})
                </span>
                <button
                  type="button"
                  onClick={exit}
                  className="font-medium underline hover:text-[#0f3148]"
                >
                  Batal / Ganti Undangan
                </button>
              </div>
            </div>

            {error && (
              <div className="fixed bottom-14 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
                <Notice tone="error">{error}</Notice>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ================= SCREEN 3: CONFIRMATION MODAL (CLONING IMAGE 4, FITS LANDSCAPE SCREENS) ================= */}
      {confirmOpen && candidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-lg max-h-[95dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-7 shadow-2xl animate-modal-pop">
            {/* Modal Content - Left Text + Right Photo Card Layout (Matching Image 4) */}
            <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:items-start sm:justify-between">
              {/* Left Side: Title & Question */}
              <div className="flex-1 text-center sm:text-left">
                <h3 className="text-lg font-bold tracking-tight text-[#153424] sm:text-xl">
                  Konfirmasi Pemilihan
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm font-semibold leading-relaxed text-[#b63532]">
                  Apa Anda yakin akan memilih kandidat ini?
                </p>
                <p className="mt-1.5 text-[11px] sm:text-xs leading-relaxed text-[#597061]">
                  Pilihan Anda bersifat rahasia dan tidak dapat diubah setelah disimpan ke dalam sistem.
                </p>
              </div>

              {/* Right Side: Candidate Photo Card (Matching Image 4 with coblos paku mark) */}
              <div className="shrink-0 overflow-visible rounded-none border-0 bg-transparent p-1 text-center shadow-none">
                <div className="relative size-24 sm:size-32 overflow-visible rounded-none bg-slate-100">
                  <Image
                    src={candidate.photo}
                    alt={candidate.name}
                    fill
                    sizes="128px"
                    className="object-cover"
                  />
                  {/* Coblos Paku on preview */}
                  <div className="pointer-events-none absolute inset-0 z-20 overflow-visible">
                    <div className="absolute top-1/2 left-1/2 w-16 sm:w-20 aspect-[348/417] -translate-x-[30.4%] -translate-y-[77.8%]">
                      <Image
                        src="/images/coblos-paku.png"
                        alt="Tercoblos Paku"
                        fill
                        unoptimized
                        className="object-contain"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-1.5 text-center">
                  <span className="block font-sans text-[11px] sm:text-xs font-bold text-[#dc2626]">
                    Kandidat {candidate.number}
                  </span>
                  <span className="block text-xs font-black text-[#143024] truncate max-w-[120px]">
                    {candidate.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions: "Ulangi" (Red button) and "Pilih" (Blue button) */}
            <div className="mt-5 flex items-center justify-between border-t border-[#e2ece0] pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl bg-[#dc2626] hover:bg-[#b91c1c] active:scale-95 px-6 py-2.5 sm:px-7 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-md transition disabled:opacity-50"
              >
                Ulangi
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={handleVote}
                className="rounded-xl bg-[#1976d2] px-7 py-2.5 sm:px-8 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#125ea8] active:scale-95 disabled:opacity-50"
              >
                {busy ? 'Menyimpan...' : 'Pilih'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
