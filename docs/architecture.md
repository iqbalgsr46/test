# Arsitektur simulasi TPS

## Tujuan dan batas sistem

Aplikasi ini merupakan simulasi pendidikan alur pemilihan kuwu. Semua nama, nomor identitas, jadwal, dan kode undangan adalah data contoh. Aplikasi tidak boleh dipakai untuk pemilihan resmi.

Data disimpan pada localStorage per origin dan profil browser. Tab pada origin yang sama berbagi data. Perangkat, browser, port, atau profil berbeda tidak berbagi data. Tidak ada server pemilu, otorisasi petugas, autentikasi pemilih, enkripsi kotak suara, ataupun jaminan anonimitas kriptografis. Penyimpanan browser dapat diubah pemilik perangkat.

## Lapisan

- `src/app`: routing App Router, layout global, dan halaman cetak.
- `src/components/ui`: komponen presentasi yang dapat digunakan ulang.
- `src/components/layout`: navigasi, header, dan status kesiapan penyimpanan.
- `src/features/election`: tipe domain, fixture, state machine, persistence, provider.
- `src/features/check-in`: pemeriksaan awal dan registrasi KPPS.
- `src/features/voting`: pemindaian, pemilihan kandidat, dan penyelesaian.
- `src/features/documents`: undangan serta bukti QR yang dapat dicetak.
- `tests/unit`: validasi transisi dan penyimpanan.
- `tests/e2e`: interaksi browser nyata.

## Transisi pemilih

1. `invited`: undangan contoh tersedia.
2. `screened`: petugas pengamanan TPS telah memeriksa undangan dan identitas.
3. `registered`: KPPS memverifikasi identitas dan jari tanpa tinta; nomor antrean diterbitkan.
4. `called`: antrean dipanggil.
5. `ready`: pemilih menandatangani daftar hadir.
6. `voted`: QR telah divalidasi dan satu kandidat dikonfirmasi.
7. `completed`: bukti dimasukkan ke kotak suara, undangan diserahkan, jari dicelupkan ke tinta.

Setiap transisi divalidasi oleh engine, bukan hanya tombol UI. Mutasi dibaca ulang dan disimpan dalam Web Lock untuk mencegah dua tab menyimpan suara ganda. Pilihan hanya ditambahkan ke agregat kandidat, tidak dituliskan di record pemilih atau bukti QR. Ini bukan anonimitas pemilu yang terverifikasi: waktu transaksi, perangkat, dan agregat dapat tetap membocorkan korelasi.

## QR dan pencetakan

QR undangan berisi versi/proyek dan kode contoh pemilih, bukan NIK. QR bukti berbeda jenis dan tidak memuat kandidat. Pemindaian menerima QR melalui kamera, unggah gambar, atau kode manual. Kamera memerlukan izin serta secure context (localhost atau HTTPS). Akses melalui HTTP alamat LAN biasanya tidak dapat membuka kamera.

Cetak memanggil dialog browser. Pengguna memilih printer atau Simpan sebagai PDF; aplikasi tidak mengklaim bukti sudah tercetak hanya karena dialog dibuka. Pemeriksaan fisik dan konfirmasi tinta dilakukan manusia.

## Prasyarat produksi nyata

Untuk pemilihan resmi perlu rancangan terpisah: dasar hukum, audit keamanan independen, kontrol akses petugas, backend transaksional, verifikasi identitas, pemisahan identitas dan surat suara, jaminan kerahasiaan, audit trail tahan manipulasi, pengujian perangkat, pencadangan, aksesibilitas, serta prosedur sengketa dan pemulihan. Proyek ini tidak menyediakan jaminan tersebut.
