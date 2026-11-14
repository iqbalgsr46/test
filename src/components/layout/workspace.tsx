'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useElection } from '@/features/election/election-provider';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Notice } from '@/components/ui/notice';
const navigation = [
  { href: '/', number: '01', label: 'Pemeriksaan awal', sub: 'Pengamanan TPS' },
  {
    href: '/registrasi',
    number: '02',
    label: 'Registrasi & antrean',
    sub: 'Meja 1 · Petugas KPPS',
  },
  { href: '/bilik', number: '03', label: 'Bilik suara digital', sub: 'Meja 2 · Pemilihan' },
  { href: '/penyelesaian', number: '04', label: 'Penyelesaian', sub: 'Kotak suara & tinta' },
];
export function Workspace({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { isLoaded, error, reset } = useElection();
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resetError, setResetError] = useState('');
  async function confirmReset() {
    setBusy(true);
    try {
      await reset();
      setResetOpen(false);
      window.location.reload();
    } catch (e) {
      setResetError(e instanceof Error ? e.message : 'Data tidak dapat direset.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[242px_1fr]">
      <aside className="bg-[#183e30] text-[#f1f6ef] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
        <Link href="/" className="flex items-center gap-3 px-6 py-7">
          <span className="flex size-10 items-center justify-center rounded-md border border-[#839b73] font-serif text-xl text-[#d4c18c]">
            ct
          </span>
          <span>
            <span className="block text-[11px] font-semibold tracking-[.15em]">CIKAUM TIMUR</span>
            <span className="mt-1 block text-[10px] text-[#d2ded4]">Pemilihan Kuwu Digital</span>
          </span>
        </Link>
        <div className="hidden px-7 pb-3 pt-7 text-[9px] font-semibold tracking-[.2em] text-[#bed0c2] lg:block">
          ALUR PELAYANAN TPS
        </div>
        <nav
          aria-label="Navigasi utama"
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:block lg:space-y-1"
        >
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={path === item.href ? 'page' : undefined}
              className={`flex min-w-fit items-center gap-3 rounded-lg px-4 py-3.5 ${path === item.href ? 'bg-[#315644] text-white' : 'text-[#e1ebe1] hover:bg-[#254b3a]'}`}
            >
              <span
                className={`text-[11px] font-semibold ${path === item.href ? 'text-[#e2ce98]' : 'text-[#bed0c2]'}`}
              >
                {item.number}
              </span>
              <span>
                <span className="block text-xs font-medium">{item.label}</span>
                <span className="mt-1 hidden text-[10px] text-[#bed0c2] lg:block">{item.sub}</span>
              </span>
            </Link>
          ))}
        </nav>
        <div className="hidden px-7 pb-3 pt-7 text-[9px] font-semibold tracking-[.2em] text-[#bed0c2] lg:block">
          DOKUMEN & INFORMASI
        </div>
        <nav aria-label="Dokumen" className="flex gap-1 px-3 pb-5 lg:block lg:space-y-1">
          {[
            { href: '/undangan', label: 'Surat undangan' },
            { href: '/panduan', label: 'Panduan simulasi' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={path === item.href ? 'page' : undefined}
              className={`block rounded-lg px-4 py-3 text-xs ${path === item.href ? 'bg-[#315644] text-white' : 'text-[#e1ebe1] hover:bg-[#254b3a]'}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto hidden px-7 pb-10 lg:block">
          <div className="border-t border-[#42604b] pt-5">
            <p className="text-[11px] font-semibold text-[#e2ce98]">Lingkungan simulasi</p>
            <p className="mt-2 text-[10px] leading-relaxed text-[#cde0d0]">
              Data contoh tersimpan di browser ini. Bukan untuk pemilihan resmi.
            </p>
            <button
              className="mt-4 min-h-9 text-[10px] font-medium text-[#f1f6ef] underline underline-offset-4"
              onClick={() => setResetOpen(true)}
            >
              Mulai ulang simulasi
            </button>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-[81px] flex-wrap items-center justify-between gap-3 border-b border-[#dce3db] bg-white px-5 py-4 sm:px-9">
          <div>
            <p className="text-xs font-semibold">Tempat Pemungutan Suara</p>
            <p className="muted mt-1 text-[10px]">Desa Cikaum Timur, Kecamatan Cikaum, Subang</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded border border-[#d6dfd3] px-3 py-1.5 text-[10px] font-semibold">
              TPS 001
            </span>
            <span className="status" data-active="true">
              Mode simulasi
            </span>
          </div>
        </header>
        <main className="mx-auto max-w-[1380px] px-5 py-7 sm:px-9 sm:py-9">
          {!isLoaded ? (
            <p role="status" className="panel p-8">
              Menyiapkan data simulasi...
            </p>
          ) : error ? (
            <div className="space-y-4">
              <Notice tone="error">{error}</Notice>
              <Button onClick={() => setResetOpen(true)} variant="secondary">
                Pulihkan dengan data contoh
              </Button>
            </div>
          ) : (
            children
          )}
          <button
            onClick={() => setResetOpen(true)}
            className="muted mt-8 min-h-11 text-xs underline lg:hidden"
          >
            Mulai ulang simulasi
          </button>
        </main>
        <footer className="flex flex-wrap justify-between gap-2 px-5 pb-6 text-[10px] text-[#7c897d] sm:px-9">
          <span>BPD Cikaum Timur · Simulasi pelayanan pemilih</span>
          <span>Data dummy. Tidak terhubung ke sistem pemilu resmi.</span>
        </footer>
      </div>
      <Dialog
        open={resetOpen}
        onClose={() => {
          if (!busy) setResetOpen(false);
        }}
        title="Mulai ulang simulasi?"
      >
        <p className="muted my-4 text-sm leading-relaxed">
          Seluruh antrean, tanda tangan, dan suara contoh pada browser ini akan dihapus dan diganti
          data awal. Tindakan ini tidak dapat dibatalkan.
        </p>
        {resetError && <Notice tone="error">{resetError}</Notice>}
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" disabled={busy} onClick={() => setResetOpen(false)}>
            Batal
          </Button>
          <Button variant="danger" disabled={busy} onClick={confirmReset}>
            {busy ? 'Memproses...' : 'Reset data simulasi'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow mb-2">{eyebrow}</p>
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-.035em] sm:text-[30px]">
          {title}
        </h1>
        <p className="muted mt-3 max-w-2xl text-xs leading-relaxed sm:text-[13px]">{description}</p>
      </div>
      {action}
    </div>
  );
}
