'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ADMIN_CREDENTIALS } from './admin-auth';
import { Notice } from '@/components/ui/notice';
import { ELECTION } from '@/features/election/data';

interface AdminLoginProps {
  onLoginSuccess: () => void;
}

export function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);

    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = password.trim();

    // Verify credentials
    if (trimmedUser === ADMIN_CREDENTIALS.username && trimmedPass === ADMIN_CREDENTIALS.password) {
      onLoginSuccess();
    } else {
      setError('Username atau password salah. Silakan coba kembali.');
      setBusy(false);
    }
  }

  function fillDemo() {
    setUsername(ADMIN_CREDENTIALS.username);
    setPassword(ADMIN_CREDENTIALS.password);
    setError('');
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f2f5ee] px-4 py-8 text-[#1a2d21]">
      <div className="w-full max-w-md animate-fade-in">
        {/* Header Branding */}
        <div className="mb-6 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#183e30] font-serif text-2xl font-bold text-[#e8d7a7] shadow-md">
            ct
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#143324]">
            Portal Admin KPPS
          </h1>
          <p className="mt-1 text-xs text-[#526a57]">
            Pemilihan Kepala Desa (Kuwu) · {ELECTION.village}
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-[#d2ddd0] bg-white p-7 shadow-sm sm:p-8">
          <div className="mb-5 border-b border-[#e5ece2] pb-4">
            <h2 className="text-base font-bold text-[#1a3828]">Masuk ke Dashboard</h2>
            <p className="mt-1 text-xs text-[#5b7260]">
              Akses rekapitulasi data hasil suara & manajemen pemilih
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="admin-user" className="block text-xs font-semibold text-[#294231]">
                Username Petugas
              </label>
              <input
                id="admin-user"
                type="text"
                className="field mt-1.5 w-full text-sm"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                autoCapitalize="none"
                required
              />
            </div>

            <div>
              <label htmlFor="admin-pass" className="block text-xs font-semibold text-[#294231]">
                Password
              </label>
              <input
                id="admin-pass"
                type="password"
                className="field mt-1.5 w-full text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="pt-1">
                <Notice tone="error">{error}</Notice>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="mt-2 w-full rounded-lg bg-[#183e30] py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#102d23] disabled:opacity-50"
            >
              {busy ? 'Memverifikasi...' : 'Masuk ke Dashboard'}
            </button>
          </form>

          {/* Preset Helper for Easy Testing */}
          <div className="mt-6 rounded-xl border border-[#d8e3d5] bg-[#f0f6ee] p-3.5 text-center text-xs">
            <p className="font-semibold text-[#234533]">Kredensial Akun Simulasi:</p>
            <p className="mt-1 font-mono text-[11px] text-[#425e4c]">
              Username: <strong className="font-bold">admin</strong> | Password:{' '}
              <strong className="font-bold">admin123</strong>
            </p>
            <button
              type="button"
              onClick={fillDemo}
              className="mt-2.5 text-[11px] font-medium text-[#1c5535] underline underline-offset-2 hover:text-[#0f3620]"
            >
              Klik di sini untuk mengisi otomatis
            </button>
          </div>
        </div>

        {/* Back Link */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#4b6351] hover:text-[#183e30]"
          >
            <span>← Kembali ke Bilik Suara (Mode Tablet)</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
