# Hasil verifikasi

## Pemeriksaan otomatis

Verifikasi dilakukan dengan Node.js 24.11.1, Next.js 16.4.6, dan Microsoft Edge melalui Playwright.

| Pemeriksaan            | Hasil                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------- |
| `npm test`             | 24 pengujian unit/domain lulus pada 4 berkas                                           |
| `npm run test:e2e`     | 21 pengujian browser lulus terhadap build produksi                                     |
| `npm run lint`         | Lulus tanpa peringatan                                                                 |
| `npm run typecheck`    | Lulus tanpa error                                                                      |
| `npm run format:check` | Lulus                                                                                  |
| `npm run build`        | Build produksi berhasil, seluruh 8 rute Next.js App Router tersedia                    |
| `npm audit --omit=dev` | Tidak ada kerentanan yang dilaporkan registry pada dependency runtime saat pemeriksaan |

## Cakupan

- Pemeriksaan undangan dan identitas sebelum registrasi.
- Konfirmasi jari tanpa tinta, antrean, panggilan, tanda tangan ketik, serta tanda tangan gambar yang dapat dibersihkan.
- Penolakan QR sebelum seluruh registrasi selesai.
- Dua kandidat, pemilihan satu kandidat, tombol merah, dialog konfirmasi, Ulangi, penyimpanan satu suara.
- QR undangan dan bukti dipindai ulang dari raster screenshot menggunakan decoder terpisah.
- Unggah gambar QR yang benar, gambar rusak, dan pemulihan setelah izin kamera ditolak.
- Proteksi multi-tab: dua tab dengan kandidat berbeda memastikan hanya pemenang yang menyimpan suara dan tab kalah menampilkan penolakan operasional; dialog otomatis terinvalidasi jika tab lain memilih duluan; form registrasi membersihkan data saat di-reset atau diproses ulang di tab lain.
- Pemulihan error penyimpanan (double-failure recovery): kegagalan resync saat penolakan aturan bisnis mengaktifkan barrier error global.
- Undangan yang sudah digunakan tidak dapat digunakan kembali melalui alur normal.
- Reset memerlukan konfirmasi; pembatalan tidak mengubah data.
- Penyimpanan rusak tidak direset otomatis.
- Bukti tidak dapat dibuat dari UUID acak yang belum tersimpan.
- Tahap kotak suara, penyerahan undangan, dan tinta harus seluruhnya dikonfirmasi.
- Enam halaman utama diperiksa pada lebar 320, 390, 768, dan 1440 piksel tanpa overflow horizontal halaman.
- Foto kandidat termuat, tidak ada page error pada pemeriksaan responsif.
- Undangan dan bukti QR berhasil diekspor lewat renderer browser menjadi PDF, masing-masing satu halaman A4.

## Bukti keluaran

Tersimpan di `artifacts/verification/`:

- `pemeriksaan-desktop.png`
- `bilik-desktop.png`
- `bilik-mobile.png`
- `undangan-desktop.png`
- `Undangan_Simulasi_Cikaum_Timur.pdf`
- `Bukti_QR_Simulasi_Cikaum_Timur.pdf`

## Yang tidak diverifikasi

Kamera fisik tablet, pemindaian dari kertas melalui kamera, printer fisik, pemakaian antarperangkat, dan otorisasi pemilu nyata tidak diverifikasi. Pengujian izin kamera menggunakan penolakan terkontrol; pembacaan QR nyata diverifikasi melalui unggah gambar dan decoder raster. Dialog cetak dipanggil dalam pengujian, bukan bukti kertas keluar dari printer.

Ini simulasi lokal, bukan sertifikasi keamanan atau kesiapan pemilu resmi. Seluruh data dan foto adalah contoh. Referensi gambar dari pengguna belum diterima.
