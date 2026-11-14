'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import type { BrowserQRCodeReader } from '@zxing/browser';
import { validateImage } from './qr-validation';

interface DetectedBarcode {
  rawValue: string;
}

interface NativeBarcodeDetector {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options?: { formats: string[] }): NativeBarcodeDetector;
}

interface WindowWithBarcodeDetector extends Window {
  BarcodeDetector?: BarcodeDetectorConstructor;
}

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
  const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualError, setManualError] = useState('');

  const video = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const callback = useRef(onDecoded);

  useEffect(() => {
    callback.current = onDecoded;
  }, [onDecoded]);

  // Acquire media stream with progressive fallbacks (prioritizing mobile rear camera)
  async function acquireCameraStream(preferredFacing: 'environment' | 'user'): Promise<MediaStream> {
    const attempts: MediaStreamConstraints[] = [
      // Attempt 1: Standard W3C rear/back camera with 720p ideal (optimal for mobile QR)
      {
        video: {
          facingMode: { ideal: preferredFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      // Attempt 2: Simple facingMode constraint
      {
        video: {
          facingMode: preferredFacing,
        },
        audio: false,
      },
      // Attempt 3: Strict exact facingMode
      {
        video: {
          facingMode: { exact: preferredFacing },
        },
        audio: false,
      },
      // Attempt 4: Any available video stream
      {
        video: true,
        audio: false,
      },
    ];

    let lastError: unknown;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  // Camera Lifecycle & Scanning Loop
  useEffect(() => {
    if (!cameraActive) return;
    const videoElement = video.current;
    let disposed = false;
    let animationFrameId: number | null = null;
    let zxingReader: BrowserQRCodeReader | null = null;
    let barcodeDetector: NativeBarcodeDetector | null = null;

    function stopTracks() {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      if (videoElement) {
        videoElement.srcObject = null;
      }
    }

    async function startCamera() {
      setCameraError('');
      setIsAutoplayBlocked(false);

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Perangkat atau browser ini tidak mendukung akses kamera.');
        }

        // 1. Acquire MediaStream
        const stream = await acquireCameraStream(facingMode);
        if (disposed) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;

        // 2. Attach Stream to Video Element with mobile-safe attributes
        if (videoElement) {
          videoElement.srcObject = stream;
          videoElement.playsInline = true;
          videoElement.muted = true;
          videoElement.setAttribute('playsinline', 'true');
          videoElement.setAttribute('webkit-playsinline', 'true');

          try {
            await videoElement.play();
          } catch {
            // Mobile browser prevented autoplay without prior gesture
            setIsAutoplayBlocked(true);
          }
        }

        // 3. Check for multiple camera devices safely after stream is granted
        try {
          if (navigator.mediaDevices?.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter((d) => d.kind === 'videoinput');
            if (videoInputs.length > 1) {
              setHasMultipleCameras(true);
            }
          }
        } catch {
          // ignore device listing error
        }

        // 4. Initialize Scanner Engine
        // Fast path: Native BarcodeDetector (Chrome Android hardware accelerated)
        if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
          try {
            const win = window as unknown as WindowWithBarcodeDetector;
            if (win.BarcodeDetector) {
              barcodeDetector = new win.BarcodeDetector({ formats: ['qr_code'] });
            }
          } catch {
            barcodeDetector = null;
          }
        }

        // Offscreen canvas for ZXing fallback
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let scanning = true;
        let lastScanTime = 0;

        async function scanLoop() {
          if (!scanning || disposed || !cameraActive) return;

          const now = performance.now();
          // Scan every ~160ms for silky smooth UI and battery efficiency
          if (
            now - lastScanTime >= 160 &&
            videoElement &&
            videoElement.readyState >= 2 &&
            !videoElement.paused
          ) {
            lastScanTime = now;

            // Step A: Native BarcodeDetector
            if (barcodeDetector) {
              try {
                const barcodes = await barcodeDetector.detect(videoElement);
                if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                  const raw = barcodes[0].rawValue.trim();
                  if (raw) {
                    scanning = false;
                    stopTracks();
                    setCameraActive(false);
                    callback.current(raw);
                    return;
                  }
                }
              } catch {
                // fall through to ZXing
              }
            }

            // Step B: ZXing BrowserQRCodeReader
            if (scanning && !disposed) {
              try {
                if (!zxingReader) {
                  const { BrowserQRCodeReader } = await import('@zxing/browser');
                  zxingReader = new BrowserQRCodeReader();
                }

                const width = videoElement.videoWidth || 640;
                const height = videoElement.videoHeight || 480;
                canvas.width = Math.min(width, 720);
                canvas.height = Math.min(height, 720);

                if (ctx) {
                  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                  const result = zxingReader.decodeFromCanvas(canvas);
                  if (result && result.getText()) {
                    const text = result.getText().trim();
                    if (text) {
                      scanning = false;
                      stopTracks();
                      setCameraActive(false);
                      callback.current(text);
                      return;
                    }
                  }
                }
              } catch {
                // NotFoundException: keep scanning
              }
            }
          }

          if (scanning && !disposed) {
            animationFrameId = requestAnimationFrame(scanLoop);
          }
        }

        animationFrameId = requestAnimationFrame(scanLoop);
      } catch (e) {
        if (!disposed) {
          const isDenied =
            e instanceof DOMException &&
            (e.name === 'NotAllowedError' || e.name === 'PermissionDeniedError');
          setCameraError(
            isDenied
              ? 'Izin kamera ditolak. Silakan izinkan akses kamera di ikon gembok/pengaturan browser Anda.'
              : e instanceof Error
                ? e.message
                : 'Kamera belakang tidak dapat diakses atau sedang digunakan oleh aplikasi lain.',
          );
        }
      }
    }

    void startCamera();

    return () => {
      disposed = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      stopTracks();
    };
  }, [cameraActive, facingMode]);

  async function handleResumePlay() {
    if (video.current) {
      try {
        await video.current.play();
        setIsAutoplayBlocked(false);
      } catch {
        // retry camera initialization
        setCameraActive(false);
        setTimeout(() => setCameraActive(true), 100);
      }
    }
  }

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
        'Kode QR tidak terbaca pada gambar. Pastikan foto jelas atau ketik kode manual.',
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
    <div
      onClick={handleResumePlay}
      className="relative flex min-h-dvh w-full flex-col items-center justify-between overflow-hidden bg-slate-950"
    >
      {/* Background Live Video Feed (Clean Full-Screen) */}
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 size-full object-cover"
        aria-label="Kamera Belakang Pemindai QR"
      />

      {/* Clean Full-Screen Scanning Laser Animation (Cyan / Blue, Not Green!) */}
      {cameraActive && !cameraError && (
        <div className="full-scanner-laser pointer-events-none z-20" />
      )}

      {/* Subtle Dark Vignette Overlay for Crisp Contrast */}
      <div className="pointer-events-none absolute inset-0 bg-radial-[circle_at_center,transparent_40%,rgba(2,6,23,0.7)_100%]" />

      {/* Top Banner (Clean typography, no emojis) */}
      <div className="relative z-30 mt-5 w-full max-w-xl px-4 text-center">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-slate-900/80 px-5 py-2 text-xs font-semibold text-sky-100 shadow-xl backdrop-blur-md">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-4 text-sky-400 shrink-0"
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
          <span>Arahkan kamera belakang ke kode QR pada surat undangan</span>
        </div>
      </div>

      {/* Center Framing Guides (Clean Cyan/White Brackets, Not Green!) */}
      <div className="relative z-20 flex flex-col items-center justify-center py-6">
        <div className="relative size-[250px] sm:size-[320px]">
          {/* Top-Left Corner Bracket */}
          <div className="absolute top-0 left-0 size-9 border-t-[3.5px] border-l-[3.5px] border-sky-400 rounded-tl-sm shadow-[0_0_10px_#38bdf8]" />
          {/* Top-Right Corner Bracket */}
          <div className="absolute top-0 right-0 size-9 border-t-[3.5px] border-r-[3.5px] border-sky-400 rounded-tr-sm shadow-[0_0_10px_#38bdf8]" />
          {/* Bottom-Left Corner Bracket */}
          <div className="absolute bottom-0 left-0 size-9 border-b-[3.5px] border-l-[3.5px] border-sky-400 rounded-bl-sm shadow-[0_0_10px_#38bdf8]" />
          {/* Bottom-Right Corner Bracket */}
          <div className="absolute bottom-0 right-0 size-9 border-b-[3.5px] border-r-[3.5px] border-sky-400 rounded-br-sm shadow-[0_0_10px_#38bdf8]" />

          {/* Floating Dark Center Badge */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="whitespace-nowrap rounded-md border border-sky-400/40 bg-slate-900/80 px-4 py-1.5 text-center text-xs font-semibold text-sky-100 shadow-xl backdrop-blur-md">
              Letakkan QR code di dalam frame
            </div>
          </div>
        </div>

        {/* Autoplay Blocked Banner */}
        {isAutoplayBlocked && !cameraError && (
          <div className="mt-4 rounded-xl border border-sky-400/50 bg-slate-900/90 p-4 text-center text-xs text-sky-200 shadow-xl backdrop-blur-md animate-fade-in">
            <p className="font-bold text-white">Ketuk Layar untuk Membuka Kamera</p>
            <p className="mt-1 text-[11px] text-slate-300">
              Browser HP memerlukan sentuhan layar untuk memulai siaran video kamera.
            </p>
            <button
              type="button"
              onClick={handleResumePlay}
              className="mt-3 rounded-lg bg-sky-600 px-5 py-2 text-xs font-bold text-white shadow-md transition hover:bg-sky-500"
            >
              Aktifkan Kamera Sekarang
            </button>
          </div>
        )}

        {/* Camera Error / Permission Fallback */}
        {cameraError && (
          <div className="mt-4 max-w-sm rounded-xl border border-rose-500/40 bg-slate-900/90 p-4 text-center text-xs text-rose-200 shadow-xl backdrop-blur-md">
            <p className="font-bold text-white">Kamera Belakang Tidak Aktif</p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-300">{cameraError}</p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCameraActive(false);
                  setTimeout(() => setCameraActive(true), 100);
                }}
                className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-sky-500"
              >
                Coba Lagi
              </button>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Input Manual
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Status Indicator & Minimal Controls */}
      <div className="relative z-30 mb-6 flex w-full max-w-2xl flex-col items-center px-4">
        {/* Status Pill: "Siap untuk scan" (Cyan/Blue, Not Green!) */}
        <div className="inline-flex items-center gap-2.5 rounded-full border border-sky-500/40 bg-slate-900/80 px-5 py-2 text-xs font-semibold text-sky-200 shadow-xl backdrop-blur-md">
          <span className="size-2 rounded-full bg-sky-400 animate-ping" />
          <span>Siap untuk scan (Kamera Belakang)</span>
        </div>

        {/* Bottom Utility Controls (Clean SVGs, No Emojis) */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
          {hasMultipleCameras && (
            <button
              type="button"
              onClick={toggleCameraFlip}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/70 px-4 py-2 text-xs font-medium text-white shadow-md backdrop-blur-md transition hover:bg-slate-800"
              title="Ganti kamera"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-3.5 text-sky-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Ganti Kamera</span>
            </button>
          )}

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/70 px-4 py-2 text-xs font-medium text-white shadow-md backdrop-blur-md transition hover:bg-slate-800">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-3.5 text-sky-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Unggah Gambar QR</span>
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
            className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-slate-900/70 px-4 py-2 text-xs font-medium text-white shadow-md backdrop-blur-md transition hover:bg-slate-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-3.5 text-sky-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            <span>Input Kode / Simulasi</span>
          </button>
        </div>

        {/* Collapsible Manual Input & Testing Drawer (Clean, no emojis) */}
        {showManual && (
          <div className="mt-4 w-full max-w-md rounded-2xl border border-sky-500/30 bg-slate-900/95 p-5 text-white shadow-2xl backdrop-blur-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Input Alternatif & Simulasi Warga
              </span>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="text-slate-400 hover:text-white"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="mt-3">
              <label htmlFor="manual-code" className="block text-xs font-medium text-slate-300">
                Ketik Kode Undangan (contoh: CT26-A7K2P9)
              </label>
              <div className="mt-1.5 flex gap-2">
                <input
                  id="manual-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CT26-XXXXXX"
                  className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-mono uppercase tracking-wider text-white placeholder-slate-400 focus:border-sky-400 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!code.trim() || busy}
                  className="shrink-0 rounded-lg bg-sky-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                >
                  Verifikasi
                </button>
              </div>
            </form>

            {manualError && (
              <p className="mt-2 text-xs text-rose-400">{manualError}</p>
            )}

            {/* Quick Demo Voters Chips for Immediate Click (No Emojis) */}
            {demoVoters.length > 0 && (
              <div className="mt-4 border-t border-slate-800 pt-3">
                <p className="text-[11px] font-semibold text-slate-300">
                  Uji Coba Cepat (Pilih salah satu warga):
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
                            ? 'border-slate-800 bg-slate-800/40 opacity-50'
                            : 'border-slate-700 bg-slate-800/80 hover:border-sky-400 hover:bg-slate-700'
                        }`}
                      >
                        <span className="block font-semibold text-white truncate">{item.name}</span>
                        <span className="block font-mono text-[10px] text-slate-400">
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
