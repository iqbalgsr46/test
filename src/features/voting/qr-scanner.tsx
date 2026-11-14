'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { validateImage } from './qr-validation';

interface QrScannerProps {
  onDecoded: (value: string) => void;
  demoVoters?: Array<{
    id: string;
    name: string;
    invitationCode: string;
    stage: string;
  }>;
}

export function QrScanner({ onDecoded, demoVoters = [] }: QrScannerProps) {
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualError, setManualError] = useState('');

  const video = useRef<HTMLVideoElement>(null);
  const callback = useRef(onDecoded);

  useEffect(() => {
    callback.current = onDecoded;
  }, [onDecoded]);

  // Check if multiple camera devices are available
  useEffect(() => {
    async function checkDevices() {
      try {
        if (!navigator.mediaDevices?.enumerateDevices) return;
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === 'videoinput');
        if (videoInputs.length > 1) {
          setHasMultipleCameras(true);
        }
      } catch {
        // ignore
      }
    }
    void checkDevices();
  }, []);

  // Continuous Camera Scanning
  useEffect(() => {
    if (!cameraActive) return;
    const videoElement = video.current;
    let disposed = false;
    let controls: IScannerControls | undefined;

    async function startCamera() {
      setCameraError('');
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Perangkat atau browser tidak mendukung akses kamera.');
        }

        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (disposed || !videoElement) return;

        const reader = new BrowserQRCodeReader();

        // Attempt constraints with preferred facingMode, with graceful fallback to any video
        try {
          controls = await reader.decodeFromConstraints(
            { video: { facingMode }, audio: false },
            videoElement,
            (result, _error, activeControls) => {
              if (result && !disposed) {
                activeControls.stop();
                setCameraActive(false);
                callback.current(result.getText());
              }
            },
          );
        } catch {
          // If preferred facingMode fails, try generic video constraint
          if (disposed) return;
          controls = await reader.decodeFromConstraints(
            { video: true, audio: false },
            videoElement,
            (result, _error, activeControls) => {
              if (result && !disposed) {
                activeControls.stop();
                setCameraActive(false);
                callback.current(result.getText());
              }
            },
          );
        }

        if (disposed) controls?.stop();
      } catch (e) {
        if (!disposed) {
          setCameraError(
            e instanceof DOMException && e.name === 'NotAllowedError'
              ? 'Izin kamera ditolak. Silakan izinkan akses kamera di browser Anda.'
              : e instanceof Error
                ? e.message
                : 'Kamera tidak dapat diakses.',
          );
        }
      }
    }

    void startCamera();

    return () => {
      disposed = true;
      controls?.stop();
      const stream = videoElement?.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraActive, facingMode]);

  async function handleFileUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setManualError('');
    const problem = validateImage(file);
    if (problem) {
      setManualError(problem);
      return;
    }

    setBusy(true);
    const url = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const image = new window.Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 16_000_000) {
        throw new Error('Ukuran gambar terlalu besar.');
      }
      const result = await reader.decodeFromImageElement(image);
      onDecoded(result.getText());
    } catch {
      setManualError(
        'Kode QR tidak terbaca pada gambar. Pastikan gambar jelas atau gunakan input manual.',
      );
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setManualError('');
    onDecoded(code.trim());
  }

  function toggleCameraFlip() {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }

  return (
    <div className="relative flex min-h-[82vh] w-full flex-col items-center justify-between overflow-hidden rounded-2xl bg-black shadow-2xl sm:min-h-[88vh]">
      {/* Background Live Video Feed */}
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 size-full object-cover"
        aria-label="Kamera Pemindai QR Bilik Suara"
      />

      {/* Subtle Dark Vignette Overlay for Contrast */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70" />

      {/* TOP HEADER: Instruction Banner (Matching Image 2) */}
      <div className="relative z-10 mt-6 w-full max-w-xl px-4 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/50 px-5 py-2 text-xs font-medium text-white shadow-lg backdrop-blur-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-4 text-emerald-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Arahkan kamera ke kode QR pada surat undangan</span>
        </div>
      </div>

      {/* CENTER VIEWFINDER: Green Reticles + Laser Line (Cloning Image 2) */}
      <div className="relative z-10 flex flex-col items-center justify-center py-6">
        <div className="relative size-[250px] sm:size-[310px]">
          {/* Top-Left Corner */}
          <div className="absolute top-0 left-0 size-10 border-t-[5px] border-l-[5px] border-[#22c55e] rounded-tl-sm shadow-[0_0_8px_#22c55e]" />
          {/* Top-Right Corner */}
          <div className="absolute top-0 right-0 size-10 border-t-[5px] border-r-[5px] border-[#22c55e] rounded-tr-sm shadow-[0_0_8px_#22c55e]" />
          {/* Bottom-Left Corner */}
          <div className="absolute bottom-0 left-0 size-10 border-b-[5px] border-l-[5px] border-[#22c55e] rounded-bl-sm shadow-[0_0_8px_#22c55e]" />
          {/* Bottom-Right Corner */}
          <div className="absolute bottom-0 right-0 size-10 border-b-[5px] border-r-[5px] border-[#22c55e] rounded-br-sm shadow-[0_0_8px_#22c55e]" />

          {/* Animated Laser Scanning Line */}
          {cameraActive && !cameraError && <div className="scanner-laser" />}

          {/* Floating Dark Center Badge (Matching Image 2) */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="whitespace-nowrap rounded-md border border-white/20 bg-black/70 px-4 py-1.5 text-center text-xs font-semibold text-white shadow-lg backdrop-blur-md">
              Letakkan QR code di dalam frame
            </div>
          </div>
        </div>

        {/* Camera Error / Permission Fallback */}
        {cameraError && (
          <div className="mt-4 max-w-sm rounded-xl border border-red-500/40 bg-red-950/80 p-4 text-center text-xs text-red-200 shadow-lg backdrop-blur-md">
            <p className="font-semibold text-white">Kamera tidak aktif</p>
            <p className="mt-1 text-[11px] leading-relaxed text-red-300">{cameraError}</p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setCameraActive(true)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-500"
              >
                Coba Lagi
              </button>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
              >
                Gunakan Input Manual
              </button>
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM BAR: Status Pill & Controls (Matching Image 2) */}
      <div className="relative z-10 mb-6 flex w-full max-w-2xl flex-col items-center px-4">
        {/* Status Pill: "Siap untuk scan" */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-emerald-500/40 bg-black/60 px-5 py-2 text-xs font-semibold text-emerald-300 shadow-lg backdrop-blur-md">
          <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
          <span>Siap untuk scan</span>
        </div>

        {/* Bottom Utility Controls */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {hasMultipleCameras && (
            <button
              type="button"
              onClick={toggleCameraFlip}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs backdrop-blur-md transition hover:bg-white/20"
              title="Ganti kamera depan/belakang"
            >
              🔄 Ganti Kamera
            </button>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs backdrop-blur-md transition hover:bg-white/20">
            <span>📁 Unggah Gambar QR</span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>

          <button
            type="button"
            onClick={() => setShowManual((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs backdrop-blur-md transition hover:bg-white/20"
          >
            <span>⌨️ Input Kode / Simulasi</span>
          </button>
        </div>

        {/* Collapsible Manual Input & Testing Drawer */}
        {showManual && (
          <div className="mt-4 w-full max-w-md rounded-2xl border border-white/20 bg-black/85 p-5 text-white shadow-2xl backdrop-blur-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                Pilihan Input Alternatif & Simulasi
              </span>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="mt-3">
              <label htmlFor="manual-code" className="block text-xs font-medium text-gray-300">
                Ketik Kode Undangan (contoh: CT26-A7K2P9)
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="manual-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CT26-XXXXXX"
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-mono uppercase tracking-wider text-white placeholder-gray-400 focus:border-emerald-400 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!code.trim() || busy}
                  className="shrink-0 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                >
                  Verifikasi
                </button>
              </div>
            </form>

            {manualError && (
              <p className="mt-2 text-xs text-red-400">{manualError}</p>
            )}

            {/* Quick Demo Voters Chips for Immediate Click */}
            {demoVoters.length > 0 && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="text-[11px] font-semibold text-gray-300">
                  Uji Coba Cepat (Klik salah satu warga):
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {demoVoters.map((item) => {
                    const already = item.stage === 'voted' || item.stage === 'completed';
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onDecoded(item.invitationCode)}
                        className={`rounded-lg border p-2 text-left text-xs transition ${
                          already
                            ? 'border-gray-700 bg-gray-800/60 opacity-60'
                            : 'border-white/20 bg-white/10 hover:border-emerald-400 hover:bg-white/20'
                        }`}
                      >
                        <span className="block font-semibold text-white truncate">{item.name}</span>
                        <span className="block font-mono text-[10px] text-gray-300">
                          {item.invitationCode}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
