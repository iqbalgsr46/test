# Simulasi TPS Digital Cikaum Timur

Aplikasi simulasi pemilihan kepala desa / kuwu dengan Next.js, TypeScript, React, dan Tailwind CSS. Seluruh nama, identitas, tanggal, dan kandidat adalah contoh pembelajaran, bukan data pemilihan resmi.

## Menjalankan

Prasyarat: Node.js 24 LTS dan npm. Browser yang disarankan: Microsoft Edge atau Chrome terbaru dengan Web Locks API.

```bash
npm ci
npm run dev
```

Buka `http://localhost:3000`.

Build produksi lokal:

```bash
npm run build
npm start
```

Hentikan dev server sebelum menjalankan build. Jangan menjalankan dua dev server untuk folder proyek yang sama.

## Alur simulasi

1. **Pemeriksaan awal**: pilih pemilih contoh, periksa surat undangan serta kartu identitas, lalu konfirmasi pemeriksaan.
2. **Registrasi & antrean**: petugas KPPS memeriksa jari tanpa tinta dan data diri. Daftarkan untuk mendapatkan nomor antrean. Panggil antrean berikutnya. Pemilih menandatangani daftar hadir dengan mouse, stylus, jari, atau alternatif ketik nama lengkap.
3. **Bilik suara**: pindai QR undangan melalui kamera, unggah gambar QR, atau masukkan kode undangan. Klik salah satu dari dua foto kandidat. Klik tombol merah **Pilih kandidat ini**. Dialog konfirmasi menyediakan **Pilih** dan **Ulangi**.
4. **Bukti & penyelesaian**: buka **Cetak bukti QR**. Setelah dicetak, masukkan ke kotak suara, serahkan surat undangan, lalu celupkan jari ke tinta. Petugas mencentang ketiga pemeriksaan fisik dan menyelesaikan proses.

Halaman **Surat undangan** menyediakan enam undangan fiktif dengan kode QR yang benar-benar dapat dibaca. Di dialog cetak browser, pilih printer atau **Simpan sebagai PDF**. Tidak ada koneksi otomatis ke printer.

## Struktur

```text
src/
  app/                   Rute Next.js App Router
  components/
    layout/              Workspace petugas dan navigasi
    ui/                  Tombol, pesan, dan dialog
  features/
    election/            Tipe, fixture, state machine, penyimpanan
    check-in/            Pemeriksaan, registrasi, tanda tangan
    voting/              QR scanner, bilik, penyelesaian
    documents/           Undangan dan bukti cetak
public/images/           Dua foto contoh kandidat
 tests/
  unit/                  Uji domain dan validasi
  e2e/                   Uji alur browser Playwright
 docs/                   Arsitektur dan sumber aset
```

## Perintah kualitas

```bash
npm test
npm run lint
npm run typecheck
npm run test:e2e
npm run build
npm run format:check
```

Playwright menggunakan Microsoft Edge yang terpasang (`channel: msedge`). Untuk lingkungan tanpa Edge, instal Chromium Playwright dan ubah channel pada `playwright.config.ts`. E2E memakai konteks browser terisolasi sehingga tidak mengubah data demo pengguna.

## Data dan batas keamanan

- Data berada di `localStorage`, bukan database server. Tab pada origin yang sama dalam profil browser yang sama berbagi data. Perangkat dan profil berbeda tidak tersinkronisasi.
- Aplikasi mewajibkan urutan tahapan dan menolak penggunaan ulang undangan melalui alur normal.
- Web Locks menyerialkan perubahan untuk mencegah dua tab menyimpan suara bersamaan. Browser tanpa dukungan ini tidak diizinkan melakukan mutasi.
- Data browser tetap dapat diubah atau dihapus pemilik perangkat. Ini bukan kontrol keamanan untuk pemilu resmi.
- QR bukti tidak memuat nama pemilih maupun pilihan kandidat. Agregat disimpan terpisah dari identitas, tetapi aplikasi tidak menjamin anonimitas kriptografis atau ketahanan terhadap korelasi waktu.
- Kamera memerlukan izin dan secure context: localhost atau HTTPS. HTTP alamat LAN biasanya tidak mendukung kamera; gunakan kode manual atau unggah gambar jika perlu.
- Reset simulasi memerlukan konfirmasi pengguna dan menghapus hanya data simulasi aplikasi ini.
- Pemeriksaan identitas, tinta, pencetakan, dan kotak suara tetap dilakukan manusia.

Jangan memasukkan NIK atau data pribadi asli. Jangan gunakan untuk pemilihan resmi tanpa perancangan ulang dan audit independen. Rincian: [docs/architecture.md](docs/architecture.md). Sumber foto: [docs/assets.md](docs/assets.md).

## Mengganti data contoh

Konfigurasi pemilihan, dua kandidat, dan enam pemilih ada pada `src/features/election/data.ts`. Foto kandidat disimpan lokal pada `public/images/`. Setelah mengubah fixture, lakukan reset simulasi melalui menu aplikasi agar data browser tidak tertinggal dari konfigurasi.

Gambar referensi dari pengguna belum tersedia saat desain awal dibuat. Layout undangan dan UI merupakan rancangan awal, bukan reproduksi referensi yang belum diterima.
