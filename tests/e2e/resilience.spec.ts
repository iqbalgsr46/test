import { test, expect } from '@playwright/test';
import { readyFixture, storageKey } from './fixtures';
import { encodeInvitation, transition } from '../../src/features/election/engine';
import { createInitialState } from '../../src/features/election/data';
import type { ElectionState } from '../../src/features/election/types';
import { mkdir } from 'node:fs/promises';

const evidence = 'artifacts/verification';
test('unggah QR nyata, izin kamera ditolak, dan pemulihan aman', async ({ page }) => {
  const ready = readyFixture();
  await page.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: storageKey, state: ready },
  );
  await page.goto('/cetak/undangan/voter-001');
  const png = await page.getByRole('img', { name: 'QR undangan pemilih' }).screenshot();
  await page.goto('/bilik');
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
      value: async () => {
        throw new DOMException('Permission denied', 'NotAllowedError');
      },
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Buka kamera' }).click();
  await expect(page.locator('.notice[role="alert"]')).toContainText('Izin kamera ditolak');
  await page
    .getByLabel('Unggah gambar QR', { exact: true })
    .setInputFiles({ name: 'undangan.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('heading', { name: 'Tentukan pilihan Anda' })).toBeVisible();
  await page.getByRole('button', { name: 'Batalkan sesi' }).click();
  await page.getByLabel('Unggah gambar QR', { exact: true }).setInputFiles({
    name: 'palsu.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a real image'),
  });
  await expect(page.locator('.notice[role="alert"]')).toContainText('QR tidak terbaca');
  await page.goto('/');
  await page.getByRole('button', { name: 'Mulai ulang simulasi', exact: true }).first().click();
  await page.getByRole('button', { name: 'Batal', exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).voters[0].stage,
      storageKey,
    ),
  ).toBe('ready');
  await page.getByRole('button', { name: 'Mulai ulang simulasi', exact: true }).first().click();
  await page.getByRole('button', { name: 'Reset data simulasi', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Konfirmasi pemeriksaan' })).toBeVisible();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).voters[0].stage,
      storageKey,
    ),
  ).toBe('invited');
});

test('data rusak tidak direset otomatis', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, 'not-json'), storageKey);
  await page.goto('/');
  await expect(page.locator('.notice[role="alert"]')).toContainText('rusak');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('not-json');
  await expect(page.getByRole('button', { name: 'Konfirmasi pemeriksaan' })).toHaveCount(0);
});

test('dua tab dengan kandidat berbeda: hanya pemenang yang sukses, tab kalah menampilkan penolakan', async ({
  page,
  context,
}) => {
  const ready = readyFixture();
  await context.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: storageKey, state: ready },
  );
  const second = await context.newPage();

  // Tab A (second) memilih candidate-02 (Dedi Kurniawan)
  await second.goto('/bilik');
  await second.getByLabel('Kode undangan atau isi QR').fill(encodeInvitation(ready.voters[0]));
  await second.getByRole('button', { name: 'Verifikasi undangan' }).click();
  await second.getByRole('button', { name: 'Pilih Dedi Kurniawan' }).click();
  await second.getByRole('button', { name: 'Pilih kandidat ini', exact: true }).click();
  await expect(second.getByRole('dialog')).toBeVisible();

  // Tab B (page) memilih candidate-01 (Ahmad Hidayat)
  await page.goto('/bilik');
  await page.getByLabel('Kode undangan atau isi QR').fill(encodeInvitation(ready.voters[0]));
  await page.getByRole('button', { name: 'Verifikasi undangan' }).click();
  await page.getByRole('button', { name: 'Pilih Ahmad Hidayat' }).click();
  await page.getByRole('button', { name: 'Pilih kandidat ini', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Tab B menyimpan terlebih dahulu dan menang
  await page.getByRole('button', { name: 'Pilih', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pilihan berhasil disimpan' })).toBeVisible();

  // Tab A dialog pending tertutup/terinvalidasi otomatis karena status pemilih berubah dari ready,
  // ATAU jika Tab A mencoba klik Pilih setelahnya, ia harus ditolak dan TIDAK menampilkan sukses.
  // Jika dialog tertutup otomatis karena stage berubah, tab A harus menunjukkan penolakan / bahwa pemilih sudah memilih.
  // Jika Tab A masih sempat mengklik, ia harus mendapatkan pesan error penolakan dan bukan heading sukses palsu.
  const dialogVisible = await second.getByRole('dialog').isVisible();
  if (dialogVisible) {
    await second.getByRole('button', { name: 'Pilih', exact: true }).click();
  }

  await expect(second.getByRole('heading', { name: 'Pilihan berhasil disimpan' })).toHaveCount(0);
  await expect(
    second.getByText(/sudah menggunakan hak pilih|Pilihan belum tersimpan|tidak sesuai/i),
  ).toBeVisible();

  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(state.totals['candidate-01']).toBe(1);
  expect(state.totals['candidate-02']).toBe(0);
  expect(Object.values(state.totals).reduce((sum, value) => Number(sum) + Number(value), 0)).toBe(
    1,
  );
  await second.close();
});

test('dialog konfirmasi di tab A otomatis terinvalidasi dan tertutup jika tab lain memilih duluan', async ({
  page,
  context,
}) => {
  const ready = readyFixture();
  await context.addInitScript(
    ({ key, state }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: storageKey, state: ready },
  );
  const second = await context.newPage();

  // Tab A (page) membuka bilik dan membuka dialog konfirmasi Dedi Kurniawan
  await page.goto('/bilik');
  await page.getByLabel('Kode undangan atau isi QR').fill(encodeInvitation(ready.voters[0]));
  await page.getByRole('button', { name: 'Verifikasi undangan' }).click();
  await page.getByRole('button', { name: 'Pilih Dedi Kurniawan' }).click();
  await page.getByRole('button', { name: 'Pilih kandidat ini', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();

  // Tab B (second) menyelesaikan vote untuk pemilih yang sama dengan Ahmad Hidayat
  await second.goto('/bilik');
  await second.getByLabel('Kode undangan atau isi QR').fill(encodeInvitation(ready.voters[0]));
  await second.getByRole('button', { name: 'Verifikasi undangan' }).click();
  await second.getByRole('button', { name: 'Pilih Ahmad Hidayat' }).click();
  await second.getByRole('button', { name: 'Pilih kandidat ini', exact: true }).click();
  await second.getByRole('button', { name: 'Pilih', exact: true }).click();
  await expect(second.getByRole('heading', { name: 'Pilihan berhasil disimpan' })).toBeVisible();

  // Di Tab A: dialog konfirmasi harus otomatis ditutup/invalidasi karena status sudah bukan ready,
  // dan Tab A TIDAK boleh menampilkan heading 'Pilihan berhasil disimpan' (bukan vote dari Tab A).
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Pilihan berhasil disimpan' })).toHaveCount(0);
  await expect(
    page.getByText(/sudah menggunakan hak pilih|telah digunakan|tidak dapat digunakan/i),
  ).toBeVisible();

  await second.close();
});

test('form registrasi membersihkan persetujuan dan tanda tangan saat pemilih di-reset atau diproses ulang di tab lain', async ({
  page,
  context,
}) => {
  // Setup voter-001 sampai stage 'called'
  let state: ElectionState = createInitialState();
  const vId = state.voters[0].id;
  state = transition(state, {
    type: 'SCREEN',
    voterId: vId,
    invitationChecked: true,
    identityChecked: true,
  });
  state = transition(state, {
    type: 'REGISTER',
    voterId: vId,
    identityChecked: true,
    inkFree: true,
  });
  state = transition(state, { type: 'CALL', voterId: vId });

  await context.addInitScript(
    ({ key, s }) => {
      if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(s));
    },
    { key: storageKey, s: state },
  );

  // Tab A (page): membuka meja registrasi untuk pemilih yang sedang dipanggil
  await page.goto('/registrasi');
  await page.getByRole('button', { name: 'Ketik nama', exact: true }).click();
  await page.getByLabel('Nama lengkap sebagai tanda tangan').fill('Siti Aminah');
  await page.getByRole('checkbox', { name: 'Saya mengonfirmasi kehadiran saya' }).check();
  await expect(page.getByRole('button', { name: 'Simpan kehadiran' })).toBeEnabled();

  // Tab B (second): reset simulasi atau reset pemilih kembali ke screened/called
  const second = await context.newPage();
  await second.goto('/');
  await second.getByRole('button', { name: 'Mulai ulang simulasi', exact: true }).first().click();
  await second.getByRole('button', { name: 'Reset data simulasi', exact: true }).click();

  // Di Tab A: pemilih kini berstatus 'invited' karena reset di Tab B.
  // Tanda tangan & persetujuan kehadiran tidak boleh tersisa atau membiarkan form aktif secara tidak sah.
  await expect(
    page.getByText('Pemilih harus melewati pemeriksaan awal terlebih dahulu.'),
  ).toBeVisible();

  // Jalankan lagi voter-001 dari tab B sampai called kembali
  await second.getByLabel('Pilih pemilih').selectOption('voter-001');
  await second.getByRole('checkbox', { name: 'Surat undangan telah diperiksa' }).check();
  await second.getByRole('checkbox', { name: 'Kartu identitas sesuai dengan undangan' }).check();
  await second.getByRole('button', { name: 'Konfirmasi pemeriksaan' }).click();
  await second.getByRole('link', { name: 'Lanjut ke meja 1' }).click();
  await second.getByRole('checkbox', { name: 'Jari pemilih belum bertinta' }).check();
  await second.getByRole('checkbox', { name: 'Data diri dan dokumen sudah sesuai' }).check();
  await second.getByRole('button', { name: 'Daftarkan dan buat antrean' }).click();
  await second.getByRole('button', { name: 'Panggil antrean berikutnya' }).click();

  // Kembali periksa Tab A: form sekarang di-called, tetapi input tanda tangan dan checkbox konfirmasi harus KOSONG/UNCHECKED dan tombol simpan DISABLED
  await expect(page.getByRole('button', { name: 'Simpan kehadiran' })).toBeDisabled();
  await expect(
    page.getByRole('checkbox', { name: 'Saya mengonfirmasi kehadiran saya' }),
  ).not.toBeChecked();

  await second.close();
});

test('tampilan responsif, foto termuat, dan bukti PDF', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/', '/registrasi', '/undangan', '/panduan', '/bilik', '/penyelesaian']) {
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route} at ${width}`,
      ).toBe(true);
    }
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pemeriksaan awal' })).toBeVisible();
  await page.screenshot({ path: `${evidence}/pemeriksaan-desktop.png`, fullPage: true });
  await page.goto('/cetak/undangan/voter-001');
  await expect(page.locator('article.document')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: `${evidence}/Undangan_Simulasi_Cikaum_Timur.pdf`,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
  await page.screenshot({ path: `${evidence}/undangan-desktop.png`, fullPage: true });
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: storageKey,
    state: readyFixture(),
  });
  await page.goto('/bilik');
  await page
    .getByLabel('Kode undangan atau isi QR')
    .fill(encodeInvitation(readyFixture().voters[0]));
  await page.getByRole('button', { name: 'Verifikasi undangan' }).click();
  await expect(page.getByTestId('candidate-option')).toHaveCount(2);
  await expect(page.getByRole('img', { name: 'Foto contoh Ahmad Hidayat' })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('main img')
        .evaluateAll((images) =>
          images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
        ),
    )
    .toBe(true);
  await page.screenshot({ path: `${evidence}/bilik-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${evidence}/bilik-mobile.png`, fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
