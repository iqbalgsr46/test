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
  await expect(page.getByText('Izin kamera ditolak')).toBeVisible();

  // Upload valid QR image
  const fileInput = page.locator('label[aria-label="Unggah Gambar QR"] input[type="file"]');
  await fileInput.setInputFiles({ name: 'undangan.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('heading', { name: 'SURAT SUARA' })).toBeVisible();

  // Cancel / exit back to scanner
  await page.getByRole('button', { name: 'Batal / Ganti Undangan' }).click();
  await expect(page.getByText('Izin kamera ditolak')).toBeVisible();

  // Upload invalid fake image
  await fileInput.setInputFiles({
    name: 'palsu.png',
    mimeType: 'image/png',
    buffer: Buffer.from('not a real image'),
  });
  await expect(page.getByText('Kode QR tidak terbaca pada gambar')).toBeVisible();
});

test('data rusak tidak direset otomatis', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, 'not-json'), storageKey);
  await page.goto('/');
  await expect(page.locator('.notice[role="alert"]')).toContainText('rusak');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe('not-json');
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

  // Tab A (second) memilih candidate-02 (Ipin)
  await second.goto('/bilik');
  await second.getByRole('button', { name: /Input Kode/i }).click();
  await second.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(ready.voters[0]));
  await second.getByRole('button', { name: 'Verifikasi' }).click();
  await second.getByRole('button', { name: /Pilih Calon B Ipin/i }).click();
  await second.getByRole('button', { name: 'PILIH KANDIDAT B' }).click();
  await expect(second.getByText('Konfirmasi Pemilihan')).toBeVisible();

  // Tab B (page) memilih candidate-01 (Upin)
  await page.goto('/bilik');
  await page.getByRole('button', { name: /Input Kode/i }).click();
  await page.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(ready.voters[0]));
  await page.getByRole('button', { name: 'Verifikasi' }).click();
  await page.getByRole('button', { name: /Pilih Calon A Upin/i }).click();
  await page.getByRole('button', { name: 'PILIH KANDIDAT A' }).click();
  await expect(page.getByText('Konfirmasi Pemilihan')).toBeVisible();

  // Tab B menyimpan terlebih dahulu dan menang
  await page.getByRole('button', { name: 'Pilih', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Terima Kasih Telah Memilih' })).toBeVisible();

  // Tab A mencoba klik Pilih setelahnya -> harus ditolak
  await second.getByRole('button', { name: 'Pilih', exact: true }).click();
  await expect(second.getByRole('heading', { name: 'Terima Kasih Telah Memilih' })).toHaveCount(0);
  await expect(
    second.getByText(/sudah menggunakan hak pilih|Pilihan belum tersimpan|tidak dapat digunakan/i),
  ).toBeVisible();

  const state = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(state.totals['candidate-01']).toBe(1);
  expect(state.totals['candidate-02']).toBe(0);
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

  // Tab A (page) membuka bilik dan membuka dialog konfirmasi Ipin
  await page.goto('/bilik');
  await page.getByRole('button', { name: /Input Kode/i }).click();
  await page.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(ready.voters[0]));
  await page.getByRole('button', { name: 'Verifikasi' }).click();
  await page.getByRole('button', { name: /Pilih Calon B Ipin/i }).click();
  await page.getByRole('button', { name: 'PILIH KANDIDAT B' }).click();
  await expect(page.getByText('Konfirmasi Pemilihan')).toBeVisible();

  // Tab B (second) menyelesaikan vote untuk pemilih yang sama dengan Upin
  await second.goto('/bilik');
  await second.getByRole('button', { name: /Input Kode/i }).click();
  await second.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(ready.voters[0]));
  await second.getByRole('button', { name: 'Verifikasi' }).click();
  await second.getByRole('button', { name: /Pilih Calon A Upin/i }).click();
  await second.getByRole('button', { name: 'PILIH KANDIDAT A' }).click();
  await second.getByRole('button', { name: 'Pilih', exact: true }).click();
  await expect(second.getByRole('heading', { name: 'Terima Kasih Telah Memilih' })).toBeVisible();

  // Di Tab A: jika mencoba klik Pilih, dialog tertutup dan pesan penolakan muncul
  await page.getByRole('button', { name: 'Pilih', exact: true }).click();
  await expect(page.getByText('Konfirmasi Pemilihan')).toHaveCount(0);
  await expect(
    page.getByText(/sudah menggunakan hak pilih|Pilihan belum tersimpan|tidak dapat digunakan/i),
  ).toBeVisible();

  await second.close();
});

test('form registrasi membersihkan persetujuan dan tanda tangan saat pemilih di-reset di tab lain', async ({
  page,
  context,
}) => {
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

  // Tab B (second): reset simulasi dari workspace
  const second = await context.newPage();
  await second.goto('/registrasi');
  await second.getByRole('button', { name: 'Mulai ulang simulasi', exact: true }).first().click();
  await second.getByRole('button', { name: 'Reset data simulasi', exact: true }).click();

  // Di Tab A: pemilih kini berstatus 'invited' karena reset di Tab B.
  await expect(
    page.getByText('Pemilih harus melewati pemeriksaan awal terlebih dahulu.'),
  ).toBeVisible();

  await second.close();
});

test('tampilan responsif bilik, foto termuat, dan bukti PDF', async ({ page }) => {
  await mkdir(evidence, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // Landscape viewport fits LandscapeGuard
  await page.setViewportSize({ width: 1024, height: 600 });

  for (const route of ['/registrasi', '/undangan', '/panduan', '/admin']) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${route}`,
    ).toBe(true);
  }

  // Print undangan PDF
  await page.goto('/cetak/undangan/voter-001');
  await expect(page.locator('article.document')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: `${evidence}/Undangan_Simulasi_Cikaum_Timur.pdf`,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });

  // Bilik screen
  await page.evaluate(
    ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
    { key: storageKey, state: readyFixture() },
  );
  await page.goto('/bilik');
  await page.getByRole('button', { name: /Input Kode/i }).click();
  await page.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(readyFixture().voters[0]));
  await page.getByRole('button', { name: 'Verifikasi' }).click();

  await expect(page.getByRole('heading', { name: 'SURAT SUARA' })).toBeVisible();
  await expect(page.locator('img[alt="Foto Calon Upin"]')).toBeVisible();
  await expect(page.locator('img[alt="Foto Calon Ipin"]')).toBeVisible();

  expect(errors).toEqual([]);
});
