import Link from 'next/link';
import { Notice } from '@/components/ui/notice';

const stages = [
  {
    number: '01',
    title: 'Pemeriksaan awal',
    place: 'Pintu masuk TPS',
    physical: 'Petugas memeriksa undangan dan identitas yang dibawa pemilih.',
    digital:
      'Pilih pemilih demo, lalu konfirmasi kedua pemeriksaan untuk melanjutkan ke registrasi.',
    href: '/',
    action: 'Buka pemeriksaan awal',
  },
  {
    number: '02',
    title: 'Registrasi dan antrean',
    place: 'Meja 1',
    physical:
      'Cocokkan identitas, pastikan jari belum bertinta, dan panggil pemilih sesuai urutan.',
    digital:
      'Pilih pemilih sesuai undangan, periksa data, lalu daftarkan pemilih. Setelah dipanggil, pemilih menandatangani daftar hadir digital.',
    href: '/registrasi',
    action: 'Buka registrasi',
  },
  {
    number: '03',
    title: 'Pemilihan digital',
    place: 'Meja 2 dan bilik suara',
    physical: 'Pemilih masuk ke bilik secara bergantian dan memilih tanpa arahan orang lain.',
    digital:
      'Pindai undangan pemilih yang sudah bertanda tangan, pilih calon, lalu konfirmasi. Satu pemilih hanya dapat menyimpan satu suara per sesi simulasi.',
    href: '/bilik',
    action: 'Buka bilik suara',
  },
  {
    number: '04',
    title: 'Penyelesaian',
    place: 'Kotak suara dan meja tinta',
    physical:
      'Masukkan bukti cetak ke kotak, kembalikan undangan, lalu beri tinta pada jari pemilih.',
    digital:
      'Konfirmasi ketiga tindakan setelah benar-benar dilakukan dalam latihan. Sistem hanya mencatat konfirmasi petugas.',
    href: '/penyelesaian',
    action: 'Buka penyelesaian',
  },
];

export function SimulationGuide() {
  return (
    <div className="space-y-6">
      <Notice>
        Ini alat pembelajaran, bukan sistem pemilihan resmi. Kotak centang tidak menggantikan
        pemeriksaan fisik dan aplikasi tidak memverifikasi tindakan di TPS.
      </Notice>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
        <section className="panel overflow-hidden" aria-labelledby="service-stages">
          <div className="border-b border-[#e3e9df] px-6 py-5">
            <p className="eyebrow">Urutan pelayanan</p>
            <h2 id="service-stages" className="mt-2 text-lg font-semibold">
              Dari undangan sampai selesai
            </h2>
          </div>
          <ol aria-label="Empat tahap pelayanan" className="divide-y divide-[#e3e9df]">
            {stages.map((stage) => (
              <li key={stage.number} className="grid gap-4 p-6 sm:grid-cols-[38px_1fr]">
                <span className="pt-1 font-mono text-base text-[#75866d]">{stage.number}</span>
                <div>
                  <p className="eyebrow">{stage.place}</p>
                  <h3 className="mb-4 mt-1 text-base font-semibold">{stage.title}</h3>
                  <dl className="space-y-3 text-xs leading-relaxed sm:text-[13px]">
                    <div>
                      <dt className="font-semibold">Di TPS</dt>
                      <dd className="muted mt-1">{stage.physical}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Di aplikasi</dt>
                      <dd className="muted mt-1">{stage.digital}</dd>
                    </div>
                  </dl>
                  <Link
                    href={stage.href}
                    className="mt-4 inline-flex min-h-11 items-center text-xs font-semibold text-primary underline underline-offset-4"
                  >
                    {stage.action}
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="space-y-6" aria-label="Persiapan simulasi">
          <section className="panel p-6">
            <p className="eyebrow">Sebelum mulai</p>
            <h2 className="mb-3 mt-2 text-base font-semibold">Siapkan undangan demo</h2>
            <p className="muted text-xs leading-relaxed">
              Tersedia enam pemilih fiktif. Setiap surat memiliki QR dan kode manual. Jangan
              memasukkan NIK atau identitas warga sebenarnya.
            </p>
            <Link href="/undangan" className="button mt-5 w-full" data-variant="secondary">
              Lihat surat undangan
            </Link>
          </section>
          <section className="px-1 text-xs leading-relaxed" aria-labelledby="scan-options">
            <h2 id="scan-options" className="mb-3 text-sm font-semibold">
              Tiga cara membaca undangan
            </h2>
            <p className="muted">
              Gunakan kamera, unggah gambar QR, atau masukkan kode manual yang tercetak pada
              undangan.
            </p>
            <p className="muted mt-3">
              Kamera memerlukan izin browser dan konteks aman: HTTPS atau localhost. Jika kamera
              ditolak atau tidak tersedia, gunakan unggahan atau kode manual.
            </p>
          </section>
        </aside>
      </div>

      <section className="panel p-6 sm:p-7" aria-labelledby="simulation-limits">
        <p className="eyebrow">Batas penggunaan</p>
        <h2 id="simulation-limits" className="mb-5 mt-2 text-lg font-semibold">
          Yang perlu diketahui petugas
        </h2>
        <dl className="divide-y divide-[#e3e9df] text-xs leading-relaxed sm:text-[13px]">
          <div className="grid gap-2 pb-4 sm:grid-cols-[180px_1fr]">
            <dt className="font-semibold">Penyimpanan lokal</dt>
            <dd className="muted">
              Data disimpan di localStorage browser ini. Tab dalam profil browser dan origin yang
              sama dapat berbagi data. Perangkat, profil browser, atau alamat origin berbeda tidak
              tersinkron otomatis. Tidak ada server basis data atau cadangan daring.
            </dd>
          </div>
          <div className="grid gap-2 py-4 sm:grid-cols-[180px_1fr]">
            <dt className="font-semibold">Privasi dan keamanan</dt>
            <dd className="muted">
              Simulasi berjalan tanpa autentikasi. Data browser dapat diubah atau dihapus pengguna.
              Bukti cetak tidak menampilkan nama, identitas, atau pilihan calon, tetapi penyimpanan
              lokal tetap mengaitkan pemilih dengan nomor buktinya. Ini bukan jaminan kerahasiaan
              atau keamanan pemilu.
            </dd>
          </div>
          <div className="grid gap-2 py-4 sm:grid-cols-[180px_1fr]">
            <dt className="font-semibold">Cetak atau simpan PDF</dt>
            <dd className="muted">
              Tombol cetak membuka dialog cetak browser, bukan bukti bahwa kertas sudah tercetak.
              Pilih printer atau Simpan sebagai PDF. Periksa pratinjau, gunakan A4 untuk undangan,
              dan matikan header serta footer browser. Pastikan bukti fisik tersedia sebelum
              mengonfirmasi penyelesaian.
            </dd>
          </div>
          <div className="grid gap-2 pt-4 sm:grid-cols-[180px_1fr]">
            <dt className="font-semibold">Mulai ulang</dt>
            <dd className="muted">
              Pilih Mulai ulang simulasi pada navigasi, kemudian konfirmasi Reset data simulasi.
              Antrean, tanda tangan, dan suara contoh akan dihapus lalu dikembalikan ke data awal.
              Pembatalan dialog tidak mengubah data; reset yang sudah dikonfirmasi tidak dapat
              dibatalkan.
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
