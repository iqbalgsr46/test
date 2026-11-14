'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useElection } from '@/features/election/election-provider';
import { CANDIDATES, ELECTION } from '@/features/election/data';
import { findVoterByQr } from '@/features/election/engine';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Receipt } from '@/features/documents/receipt';
import { QrScanner } from './qr-scanner';

export function Ballot() {
  const { state, dispatch, isLoaded, error: storageError } = useElection();
  const [voterId, setVoterId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittedReceiptId, setSubmittedReceiptId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(45);

  const voter = state.voters.find((v) => v.id === voterId);
  const candidate = CANDIDATES.find((c) => c.id === candidateId);
  const isVoted = Boolean(
    voter &&
      submittedReceiptId &&
      voter.receiptId === submittedReceiptId &&
      (voter.stage === 'voted' || voter.stage === 'completed'),
  );

  // Auto-reset countdown timer on the receipt screen
  useEffect(() => {
    if (!isVoted) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          exit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isVoted]);

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
      setCountdown(45);
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
      {/* Discreet Top Navigation Bar for Admin & Identity (Only on scan & completion) */}
      {(!voter || isVoted) && (
        <header className="absolute top-0 right-0 left-0 z-40 flex items-center justify-between px-5 py-3 pointer-events-none">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3.5 py-1.5 shadow-xs backdrop-blur-md">
            <span className="flex size-6 items-center justify-center rounded-full bg-[#183e30] font-serif text-[11px] font-bold text-[#e5d4a4]">
              ct
            </span>
            <span className="text-[11px] font-bold tracking-wider text-[#183e30]">
              PILKADES {ELECTION.village.toUpperCase()}
            </span>
          </div>

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
          /* ================= SCREEN 4: PRINT OUT QR BUKTI TELAH MEMILIH ================= */
          <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f4f7f2] px-4 py-10 text-[#1a2e21] animate-fade-in">
            <div className="w-full max-w-xl">
              {/* Header Box */}
              <div className="mb-6 rounded-2xl border border-[#cde0cb] bg-[#eef7ec] p-6 text-center shadow-xs">
                <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-[#245443] shadow-md">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-xs font-bold tracking-widest text-[#245443] uppercase">
                  SUARA BERHASIL DISIMPAN
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#163a2a] sm:text-3xl">
                  Terima Kasih Telah Memilih
                </h1>
                <p className="mt-2 text-xs leading-relaxed text-[#3a5845] sm:text-sm">
                  Hak suara pemilih atas nama <strong className="font-semibold">{voter.name}</strong> telah
                  tercatat ke dalam sistem secara anonim dan aman.
                </p>
              </div>

              {/* Receipt Component */}
              <div className="my-6">
                {voter.receiptId && <Receipt receiptId={voter.receiptId} />}
              </div>

              {/* Actions */}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => window.print()}
                  className="flex items-center gap-2 bg-[#183e30] px-6 text-white hover:bg-[#102d23]"
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
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  <span>Cetak Print Out QR</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={exit}
                  className="border-[#b9c8b8] bg-white text-[#203628] hover:bg-[#f3f7f1]"
                >
                  Selesai / Pemilih Berikutnya ({countdown}s)
                </Button>
              </div>

              {/* Physical Guidance (Di Luar Sistem Website) */}
              <div className="mt-8 rounded-xl border border-[#d6dfd2] bg-white p-5 sm:p-6 shadow-xs">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#2d4838]">
                  Tahap Akhir Pemilihan (Alur Di Luar Sistem):
                </h3>
                <ol className="mt-3.5 space-y-3 text-xs text-[#3a4e3e]">
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#245443] text-[10px] font-bold text-white">
                      1
                    </span>
                    <span>
                      Masukkan kertas print out bukti QR ini ke dalam kotak suara fisik.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#245443] text-[10px] font-bold text-white">
                      2
                    </span>
                    <span>
                      Serahkan kembali surat undangan pemilih Anda kepada petugas KPPS.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#245443] text-[10px] font-bold text-white">
                      3
                    </span>
                    <span>
                      Celupkan salah satu jari tangan Anda ke dalam botol tinta sebagai tanda telah memilih.
                    </span>
                  </li>
                </ol>
              </div>
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
            {/* Header Surat Suara (Compact height for landscape screens) */}
            <div className="shrink-0 mx-auto w-full max-w-4xl text-center pt-0.5 sm:pt-1">
              {/* Official Seal SVG Icon */}
              <div className="mx-auto mb-1 flex size-7 sm:size-9 items-center justify-center rounded-full border border-[#1c557c] bg-[#eef7fd] shadow-xs">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="size-4 sm:size-5 text-[#1c557c]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z"
                  />
                </svg>
              </div>
              <h1 className="font-serif text-xs sm:text-base font-black tracking-widest uppercase text-[#0d344d] leading-tight">
                SURAT SUARA
              </h1>
              <h2 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#184e72] leading-tight">
                PEMILIHAN KUWU DESA {ELECTION.village.toUpperCase()}
              </h2>
              <p className="text-[9px] sm:text-[11px] font-semibold uppercase tracking-wider text-[#356586] leading-tight">
                KEC. {ELECTION.district.toUpperCase()} · KAB. {ELECTION.regency.toUpperCase()} · TAHUN 2026
              </p>
            </div>

            {/* Candidate Row (Matching Image 3, flexible height, fits viewport perfectly without scroll) */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center gap-3 sm:gap-6 px-2 my-1 sm:my-2">
              {CANDIDATES.map((c) => {
                const isSelected = candidateId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-label={`Pilih Calon Nomor ${c.number} ${c.name}`}
                    aria-pressed={isSelected}
                    onClick={() => setCandidateId(c.id)}
                    className={`group relative flex h-full max-h-[58dvh] w-auto aspect-[3/4] sm:aspect-[4/5] flex-col overflow-hidden rounded-xl border-3 sm:border-4 bg-white shadow-md transition-all duration-150 active:scale-[0.98] ${
                      isSelected
                        ? 'border-[#245443] ring-3 ring-[#88c983] shadow-xl'
                        : 'border-[#c4dced] hover:border-[#7ca7c7]'
                    }`}
                  >
                    {/* Candidate Number Badge (Blue Box in Top-Left Corner like Image 3) */}
                    <div className="absolute top-1.5 left-1.5 z-10 flex size-7 sm:size-9 items-center justify-center rounded-md bg-[#1976d2] font-serif text-sm sm:text-base font-black text-white shadow-md">
                      {parseInt(c.number, 10)}
                    </div>

                    {/* SVG Checkmark badge when chosen */}
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 z-10 flex size-6 sm:size-8 items-center justify-center rounded-full bg-[#245443] text-white shadow-md">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="size-3.5 sm:size-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    {/* Candidate Photo */}
                    <div className="relative flex-1 min-h-0 w-full bg-[#f4f8fb]">
                      <Image
                        src={c.photo}
                        alt={`Foto Calon ${c.name}`}
                        fill
                        sizes="(max-width: 768px) 45vw, 320px"
                        className="object-contain p-1 sm:p-2"
                        priority
                      />
                    </div>

                    {/* Candidate Name Footer (Matching Image 3) */}
                    <div
                      className={`shrink-0 py-1.5 sm:py-2 text-center transition-colors ${
                        isSelected ? 'bg-[#245443] text-white' : 'bg-white text-[#0f3148]'
                      }`}
                    >
                      <h3 className="text-xs sm:text-sm font-bold tracking-tight truncate px-2">{c.name}</h3>
                      <p className={`text-[9px] sm:text-[10px] ${isSelected ? 'text-emerald-100' : 'text-[#567a94]'}`}>
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
          <div className="relative w-full max-w-lg max-h-[95dvh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-7 shadow-2xl">
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

              {/* Right Side: Candidate Photo Card (Matching Image 4) */}
              <div className="shrink-0 overflow-hidden rounded-xl border-2 border-[#c5d8c3] bg-[#f5f8f3] p-1.5 text-center shadow-md">
                <div className="relative size-24 sm:size-32 overflow-hidden rounded-lg bg-white">
                  <Image
                    src={candidate.photo}
                    alt={candidate.name}
                    fill
                    sizes="128px"
                    className="object-contain p-1"
                  />
                </div>
                <div className="mt-1.5 text-center">
                  <span className="block font-serif text-[11px] sm:text-xs font-bold text-[#183e30]">
                    Nomor {candidate.number}
                  </span>
                  <span className="block text-xs font-black text-[#143024] truncate max-w-[120px]">
                    {candidate.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Actions: "Ulangi" and "Pilih" (Matching Image 4) */}
            <div className="mt-5 flex items-center justify-between border-t border-[#e2ece0] pt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmOpen(false)}
                className="px-4 py-2 text-xs sm:text-sm font-semibold text-[#546b5a] transition hover:text-[#183e30] hover:underline"
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
