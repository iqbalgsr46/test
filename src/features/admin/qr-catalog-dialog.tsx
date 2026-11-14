'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { encodeInvitation } from '@/features/election/engine';
import { ELECTION } from '@/features/election/data';
import type { Voter } from '@/features/election/types';

interface QrCatalogDialogProps {
  open: boolean;
  onClose: () => void;
  voters: Voter[];
  initialVoterId?: string | null;
}

export function QrCatalogDialog({
  open,
  onClose,
  voters,
  initialVoterId = null,
}: QrCatalogDialogProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unvoted' | 'voted'>('all');

  const filteredVoters = voters.filter((v) => {
    const isVoted = v.stage === 'voted' || v.stage === 'completed';
    if (activeFilter === 'voted') return isVoted;
    if (activeFilter === 'unvoted') return !isVoted;
    return true;
  });

  // Download individual voter QR card as high-res PNG
  function handleDownloadPng(voter: Voter) {
    const canvas = document.getElementById(`qr-canvas-${voter.id}`) as HTMLCanvasElement | null;
    if (!canvas) return;

    // Create a high-resolution export canvas (600x700px)
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 600;
    exportCanvas.height = 720;
    const ctx = exportCanvas.getContext('2d');
    if (!ctx) return;

    // Crisp white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

    // Decorative top header bar
    ctx.fillStyle = '#183e30';
    ctx.fillRect(0, 0, exportCanvas.width, 10);

    // Header Title
    ctx.fillStyle = '#183e30';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`KODE QR PEMILIH · DESA ${ELECTION.village.toUpperCase()}`, 300, 50);

    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#556959';
    ctx.fillText(`${ELECTION.tps} · Balai Desa Cikaum Timur`, 300, 75);

    // Separator line
    ctx.strokeStyle = '#d4ded1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 95);
    ctx.lineTo(560, 95);
    ctx.stroke();

    // Draw QR code centered
    ctx.drawImage(canvas, 130, 115, 340, 340);

    // Voter Details
    ctx.fillStyle = '#143024';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(voter.name, 300, 505);

    ctx.font = '15px monospace';
    ctx.fillStyle = '#4d6353';
    ctx.fillText(`NIK / Identitas: ${voter.identity}`, 300, 535);

    // Invitation Code Box
    ctx.fillStyle = '#f0f5ee';
    ctx.strokeStyle = '#c2d4c0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(150, 560, 300, 54, 8);
    ctx.fill();
    ctx.stroke();

    ctx.font = 'bold 26px monospace';
    ctx.fillStyle = '#183e30';
    ctx.fillText(voter.invitationCode, 300, 597);

    // Instructions
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#6e8273';
    ctx.fillText(
      'Arahkan kode QR ini ke kamera tablet bilik suara untuk membuka surat suara digital.',
      300,
      645,
    );

    ctx.font = 'italic 11px sans-serif';
    ctx.fillStyle = '#94a598';
    ctx.fillText('Simulasi Pemilihan Kepala Desa (Pilkades Digital)', 300, 680);

    // Trigger download
    const link = document.createElement('a');
    link.download = `QR_${voter.name.replace(/\s+/g, '_')}_${voter.invitationCode}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  }

  // Download all voter QR PNG cards sequentially
  async function handleDownloadAll() {
    setDownloadingAll(true);
    for (const v of voters) {
      handleDownloadPng(v);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    setDownloadingAll(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Katalog & Unduh Kode QR Pemilih">
      <div className="space-y-5">
        <p className="text-xs text-[#526a57] leading-relaxed">
          Berikut adalah kode QR resmi surat undangan seluruh Daftar Pemilih Tetap (DPT). Anda
          dapat mengunduh file gambar PNG untuk ditampilkan di layar HP lain atau mencetak surat
          undangan.
        </p>

        {/* Top Actions: Download All & Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#dce5da] py-3">
          <div className="inline-flex rounded-lg border border-[#cfdacd] bg-[#f0f5ee] p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                activeFilter === 'all'
                  ? 'bg-[#183e30] text-white shadow-xs'
                  : 'text-[#3d5444] hover:bg-[#e4ede1]'
              }`}
            >
              Semua ({voters.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unvoted')}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                activeFilter === 'unvoted'
                  ? 'bg-[#183e30] text-white shadow-xs'
                  : 'text-[#3d5444] hover:bg-[#e4ede1]'
              }`}
            >
              Belum Memilih ({voters.filter((v) => v.stage !== 'voted').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('voted')}
              className={`rounded-md px-3 py-1 font-semibold transition ${
                activeFilter === 'voted'
                  ? 'bg-[#183e30] text-white shadow-xs'
                  : 'text-[#3d5444] hover:bg-[#e4ede1]'
              }`}
            >
              Sudah Memilih ({voters.filter((v) => v.stage === 'voted').length})
            </button>
          </div>

          <Button
            onClick={handleDownloadAll}
            disabled={downloadingAll}
            className="flex items-center gap-1.5 bg-[#183e30] text-xs font-bold text-white hover:bg-[#123327]"
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
            <span>{downloadingAll ? 'Mengunduh...' : 'Unduh Semua QR (PNG)'}</span>
          </Button>
        </div>

        {/* Voter QR Grid */}
        <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
          {filteredVoters.map((voter) => {
            const isVoted = voter.stage === 'voted' || voter.stage === 'completed';
            const isTarget = initialVoterId === voter.id;

            return (
              <div
                key={voter.id}
                className={`flex flex-col items-center justify-between rounded-xl border p-4 text-center transition ${
                  isTarget
                    ? 'border-[#183e30] bg-[#f2f8f0] ring-2 ring-[#245443]'
                    : 'border-[#d4ded1] bg-white'
                }`}
              >
                {/* Status Badge */}
                <div className="w-full flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-[#556959]">{voter.invitationCode}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                      isVoted
                        ? 'bg-[#e0f2dd] text-[#1c552f]'
                        : 'bg-[#f5eecb] text-[#785913]'
                    }`}
                  >
                    {isVoted ? 'Sudah Memilih' : 'Siap Scan'}
                  </span>
                </div>

                {/* QR Code Canvas */}
                <div className="relative rounded-lg border border-[#cad7c7] bg-white p-2.5 shadow-xs">
                  <QRCodeCanvas
                    id={`qr-canvas-${voter.id}`}
                    value={encodeInvitation(voter)}
                    size={160}
                    level="M"
                    marginSize={2}
                  />
                </div>

                {/* Voter Info */}
                <div className="mt-3">
                  <h4 className="text-sm font-bold text-[#143024]">{voter.name}</h4>
                  <p className="font-mono text-[11px] text-[#556959]">{voter.identity}</p>
                </div>

                {/* Action Buttons */}
                <div className="mt-4 flex w-full gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownloadPng(voter)}
                    className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[#c4d4c2] bg-[#f8faf7] py-2 text-[11px] font-bold text-[#183e30] transition hover:bg-[#edf5eb]"
                    title="Unduh file gambar QR PNG untuk warga ini"
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
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    <span>Unduh PNG</span>
                  </button>

                  <Link
                    href={`/cetak/undangan/${voter.id}`}
                    target="_blank"
                    className="flex items-center justify-center gap-1 rounded-lg border border-[#c4d4c2] bg-white px-3 py-2 text-[11px] font-semibold text-[#3b5343] transition hover:bg-[#f2f6f1]"
                    title="Buka surat undangan A4 lengkap"
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
                        d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                      />
                    </svg>
                    <span>Surat A4</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <Button variant="secondary" onClick={onClose} className="border-[#cfdacd] text-xs">
            Tutup
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
