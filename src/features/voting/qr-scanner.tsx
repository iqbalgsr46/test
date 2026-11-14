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

// Find standard 1x main camera and strictly exclude ultrawide (0.5x) or macro sensors
async function findStandardMainCamera(): Promise<string | undefined> {
  if (!navigator.mediaDevices?.enumerateDevices) return undefined;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');
    if (videoInputs.length <= 1) return videoInputs[0]?.deviceId;

    const backCameras = videoInputs.filter((d) => {
      const l = d.label.toLowerCase();
      return (
        l.includes('back') ||
        l.includes('rear') ||
        l.includes('environment') ||
        l.includes('belakang') ||
        l.includes('facing back') ||
        l.includes('camera2 0') ||
        l.includes('camera 0')
      );
    });

    const isUltrawide = (label: string) =>
      /ultra|0\.5|0\.6|wide-angle|wideangle|super|macro|depth|aux|tele/i.test(label);

    // Priority 1: Explicitly labeled as main, primary, standard, or 1x
    const mainCam = backCameras.find(
      (d) => !isUltrawide(d.label) && /main|primary|1x|standard|normal/i.test(d.label),
    );
    if (mainCam) return mainCam.deviceId;

    // Priority 2: Any back camera without ultrawide keywords
    const standardCam = backCameras.find((d) => !isUltrawide(d.label));
    if (standardCam) return standardCam.deviceId;

    // Priority 3: First back camera (index 0 is standard 1x in Android HAL)
    if (backCameras.length > 0) return backCameras[0].deviceId;
  } catch {
    // ignore
  }
  return undefined;
}

// Acquire media stream with crisp 1080p/720p clarity, strictly avoiding ultrawide
async function acquireCameraStream(preferredFacing: 'environment' | 'user'): Promise<MediaStream> {
  let targetDeviceId: string | undefined;
  if (preferredFacing === 'environment') {
    targetDeviceId = await findStandardMainCamera();
  }

  const attempts: MediaStreamConstraints[] = [
    // 1. Crisp 1080p full HD on targeted standard main camera
    targetDeviceId
      ? {
          video: {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        }
      : {
          video: {
            facingMode: { ideal: preferredFacing },
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        },
    // 2. High-definition 720p fallback
    {
      video: {
        facingMode: { ideal: preferredFacing },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    },
    // 3. Simple facingMode
    {
      video: { facingMode: preferredFacing },
      audio: false,
    },
    // 4. Universal fallback
    {
      video: true,
      audio: false,
    },
  ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Apply 1x standard zoom and continuous autofocus if hardware exposes capabilities
      const track = stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        try {
          const caps = track.getCapabilities() as {
            zoom?: { min: number; max: number };
            focusMode?: string[];
          };
          const adv: Record<string, unknown> = {};
          if (caps?.zoom) {
            adv.zoom = 1.0;
          }
          if (caps?.focusMode && caps.focusMode.includes('continuous')) {
            adv.focusMode = 'continuous';
          }
          if (Object.keys(adv).length > 0) {
            await track.applyConstraints({ advanced: [adv] });
          }
        } catch {
          // ignore capability error
        }
      }

      return stream;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
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

  // Camera Lifecycle & QR Scanning Loop
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

            // Step A: Native BarcodeDetector (Chrome Android hardware accelerated)
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
      className="relative flex min-h-dvh w-full flex-col items-center justify-between overflow-hidden bg-black"
    >
      {/* Background Live Video Feed (Clean Full-Screen) */}
      <video
        ref={video}
        muted
        playsInline
        autoPlay
        className="absolute inset-0 size-full object-cover"
        aria-label="Kamera Pemindai QR"
      />

      {/* Top spacing */}
      <div className="relative z-30 pt-6" />

      {/* Center Framing Guides: Pure White Reticle Corners, No Green, No Moving Laser, No Text */}
      <div className="relative z-20 flex flex-col items-center justify-center py-6">
        <div className="relative size-[250px] sm:size-[320px]">
          {/* Top-Left Corner Bracket (Pure White) */}
          <div className="absolute top-0 left-0 size-11 border-t-[3.5px] border-l-[3.5px] border-white rounded-tl-sm shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          {/* Top-Right Corner Bracket (Pure White) */}
          <div className="absolute top-0 right-0 size-11 border-t-[3.5px] border-r-[3.5px] border-white rounded-tr-sm shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          {/* Bottom-Left Corner Bracket (Pure White) */}
          <div className="absolute bottom-0 left-0 size-11 border-b-[3.5px] border-l-[3.5px] border-white rounded-bl-sm shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
          {/* Bottom-Right Corner Bracket (Pure White) */}
          <div className="absolute bottom-0 right-0 size-11 border-b-[3.5px] border-r-[3.5px] border-white rounded-br-sm shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
        </div>

        {/* Autoplay Blocked Banner */}
        {isAutoplayBlocked && !cameraError && (
          <div className="mt-4 rounded-xl border border-white/40 bg-black/80 p-4 text-center text-xs text-white shadow-xl backdrop-blur-md animate-fade-in">
            <p className="font-bold">Ketuk Layar untuk Membuka Kamera</p>
            <button
              type="button"
              onClick={handleResumePlay}
              className="mt-3 rounded-lg bg-white px-5 py-2 text-xs font-bold text-black shadow-md transition hover:bg-slate-200"
            >
              Aktifkan Kamera
            </button>
          </div>
        )}

        {/* Camera Error / Permission Fallback */}
        {cameraError && (
          <div className="mt-4 max-w-sm rounded-xl border border-white/30 bg-black/85 p-5 text-center text-xs text-white shadow-xl backdrop-blur-md">
            <p className="font-bold">Kamera Belakang Tidak Aktif</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-300">{cameraError}</p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCameraActive(false);
                  setTimeout(() => setCameraActive(true), 100);
                }}
                className="rounded-lg bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-slate-200"
              >
                Coba Lagi
              </button>
              <button
                type="button"
                onClick={() => setShowManual(true)}
                className="rounded-lg border border-white/40 bg-white/10 px-4 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                Input Manual
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Minimalist White Controls without bulky text banners */}
      <div className="relative z-30 mb-6 flex w-full max-w-md flex-col items-center px-4">
        {/* White Minimalist Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          {hasMultipleCameras && (
            <button
              type="button"
              onClick={toggleCameraFlip}
              aria-label="Ganti Kamera"
              title="Ganti kamera depan/belakang"
              className="flex size-11 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 hover:border-white active:scale-95"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="size-5"
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
            </button>
          )}

          <label
            aria-label="Unggah Gambar QR"
            title="Unggah gambar QR dari galeri"
            className="flex size-11 cursor-pointer items-center justify-center rounded-full border border-white/40 bg-black/40 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 hover:border-white active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-5"
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
            aria-label="Input Kode atau Simulasi"
            title="Ketik kode undangan atau simulasi uji coba"
            className="flex size-11 items-center justify-center rounded-full border border-white/40 bg-black/40 text-white shadow-lg backdrop-blur-md transition hover:bg-black/60 hover:border-white active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-5"
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
          </button>
        </div>

        {/* Collapsible Manual Input & Testing Drawer */}
        {showManual && (
          <div className="mt-4 w-full rounded-2xl border border-white/30 bg-black/90 p-5 text-white shadow-2xl backdrop-blur-xl animate-fade-in">
            <div className="flex items-center justify-between border-b border-white/20 pb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-white">
                Input Kode Undangan
              </span>
              <button
                type="button"
                onClick={() => setShowManual(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                Tutup
              </button>
            </div>

            <form onSubmit={handleManualSubmit} className="mt-3">
              <div className="flex gap-2">
                <input
                  id="manual-code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="CT26-XXXXXX"
                  className="w-full rounded-lg border border-white/30 bg-white/10 px-3 py-2 text-xs font-mono uppercase tracking-wider text-white placeholder-slate-400 focus:border-white focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!code.trim() || busy}
                  className="shrink-0 rounded-lg bg-white px-4 py-2 text-xs font-bold text-black transition hover:bg-slate-200 disabled:opacity-50"
                >
                  Verifikasi
                </button>
              </div>
            </form>

            {manualError && (
              <p className="mt-2 text-xs text-rose-400">{manualError}</p>
            )}

            {/* Quick Demo Voters Chips for Immediate Click */}
            {demoVoters.length > 0 && (
              <div className="mt-4 border-t border-white/20 pt-3">
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
                            ? 'border-white/10 bg-white/5 opacity-50'
                            : 'border-white/20 bg-white/10 hover:border-white hover:bg-white/20'
                        }`}
                      >
                        <span className="block font-semibold text-white truncate">{item.name}</span>
                        <span className="block font-mono text-[10px] text-slate-300">
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
