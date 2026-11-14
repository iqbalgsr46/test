'use client';

import { useEffect, useState } from 'react';

export function LandscapeGuard() {
  const [isPortrait, setIsPortrait] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    function checkOrientation() {
      // Check if viewport is mobile/tablet size (< 1024px) and in portrait mode
      const portrait = window.innerHeight > window.innerWidth;
      const mobile = Math.max(window.innerWidth, window.innerHeight) <= 1180;
      setIsPortrait(portrait);
      setIsMobile(mobile);
    }

    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  async function handleLockLandscape() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (screen.orientation && 'lock' in screen.orientation) {
        await (screen.orientation as { lock: (orientation: string) => Promise<void> }).lock(
          'landscape',
        );
      }
    } catch {
      // Some browsers require explicit user settings for orientation lock
    }
  }

  // Only show the overlay on mobile/tablet devices that are currently held in portrait
  if (!isPortrait || !isMobile) {
    return null;
  }

  return (
    <aside
      aria-label="Peringatan Orientasi Layar"
      role="alert"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-6 text-center text-white"
    >
      {/* Animated Phone Rotation Illustration */}
      <div className="relative mb-6 flex size-28 items-center justify-center">
        {/* Curved Arrow */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="absolute -top-1 -right-1 size-14 text-sky-400 opacity-80"
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

        {/* Rotating Smartphone Device Icon */}
        <div className="animate-phone-rotate origin-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="size-20 text-sky-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <rect x="5" y="2" width="14" height="20" rx="3" ry="3" />
            <line x1="12" y1="18" x2="12.01" y2="18" strokeWidth={2.5} strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <span className="inline-block rounded-full bg-sky-950/80 px-3.5 py-1 text-[11px] font-bold uppercase tracking-wider text-sky-400 border border-sky-800/60">
        Orientasi Layar Diperlukan
      </span>

      <h1 className="mt-3 text-xl font-bold tracking-tight text-white sm:text-2xl">
        Silakan Miringkan Layar HP Anda
      </h1>

      <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-slate-300 sm:text-sm">
        Sistem bilik suara digital ini dioptimalkan khusus untuk posisi <strong className="text-white">layar miring (lanskap)</strong> seperti tablet pemilihan di TPS.
      </p>

      <div className="mt-6 flex flex-col gap-2.5 w-full max-w-xs">
        <button
          type="button"
          onClick={handleLockLandscape}
          className="rounded-xl bg-sky-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-sky-500 active:scale-95"
        >
          Kunci Layar Lanskap
        </button>
        <p className="text-[10px] text-slate-400">
          Pastikan fitur Rotasi Otomatis (Auto-Rotate) pada HP Anda telah diaktifkan.
        </p>
      </div>
    </aside>
  );
}
