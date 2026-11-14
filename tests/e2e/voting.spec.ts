import { test, expect } from '@playwright/test';
import { createInitialState } from '../../src/features/election/data';
import { encodeInvitation } from '../../src/features/election/engine';

const key = 'cikaum-timur-election-v1';

test('alir pemilihan bilik: full kamera scan QR -> surat suara calon -> tombol merah -> konfirmasi ulangi/pilih -> bukti print QR', async ({
  page,
}) => {
  const initialState = createInitialState();
  const voter = initialState.voters[0];

  await page.goto('/');

  // 1. Full Camera Scan QR screen (Cloning Image 2: pure white, clean, no text)
  await expect(page.locator('video')).toBeVisible();

  // Open manual/simulation drawer
  await page.getByRole('button', { name: /Input Kode/i }).click();
  await page.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(voter));
  await page.getByRole('button', { name: 'Verifikasi' }).click();

  // 2. Candidate Selection / Surat Suara screen (Cloning Image 3)
  await expect(page.getByRole('heading', { name: 'SURAT SUARA' })).toBeVisible();
  await expect(page.getByText(voter.name)).toBeVisible();

  const redButtonDisabled = page.getByRole('button', {
    name: 'SILAKAN SENTUH FOTO KANDIDAT DI ATAS',
  });
  await expect(redButtonDisabled).toBeDisabled();

  // Select Candidate 01
  await page.getByRole('button', { name: /Pilih Calon Nomor 01 Ahmad Hidayat/i }).click();
  const redButton01 = page.getByRole('button', { name: 'PILIH KANDIDAT 01' });
  await expect(redButton01).toBeEnabled();

  // Click red button -> Opens confirmation modal (Cloning Image 4)
  await redButton01.click();
  await expect(page.getByText('Konfirmasi Pemilihan')).toBeVisible();
  await expect(page.getByText('Apa Anda yakin akan memilih kandidat ini?')).toBeVisible();

  // Test "Ulangi" button -> Closes modal
  await page.getByRole('button', { name: 'Ulangi' }).click();
  await expect(page.getByText('Konfirmasi Pemilihan')).not.toBeVisible();

  // Switch to Candidate 02
  await page.getByRole('button', { name: /Pilih Calon Nomor 02 Dedi Kurniawan/i }).click();
  const redButton02 = page.getByRole('button', { name: 'PILIH KANDIDAT 02' });
  await redButton02.click();
  await expect(page.getByText('Konfirmasi Pemilihan')).toBeVisible();

  // Confirm vote with "Pilih"
  await page.getByRole('button', { name: 'Pilih', exact: true }).click();

  // 3. Success / Print QR Receipt screen
  await expect(page.getByRole('heading', { name: 'Terima Kasih Telah Memilih' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Cetak Print Out QR/i })).toBeVisible();

  // Verify storage
  const stored = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
  expect(stored.voters[0].stage).toBe('voted');
  expect(stored.totals['candidate-02']).toBe(1);

  // 4. Try scanning the same QR again -> rejected
  await page.getByRole('button', { name: /Selesai/i }).click();
  await expect(page.locator('video')).toBeVisible();

  await page.getByRole('button', { name: /Input Kode/i }).click();
  await page.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(voter));
  await page.getByRole('button', { name: 'Verifikasi' }).click();
  await expect(page.locator('.notice[data-tone="error"]')).toContainText(
    'sudah menggunakan hak pilih',
  );
});

test('admin flow: login -> dashboard data hasil pemilihan', async ({ page }) => {
  await page.goto('/admin');

  // Login page
  await expect(page.getByRole('heading', { name: 'Portal Admin KPPS' })).toBeVisible();
  await page.getByLabel('Username Petugas').fill('admin');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Masuk ke Dashboard' }).click();

  // Dashboard page
  await expect(page.getByRole('heading', { name: 'Dashboard Rekapitulasi Suara' })).toBeVisible();
  await expect(page.getByText('TOTAL DPT', { exact: true })).toBeVisible();
  await expect(page.getByText('SUARA MASUK', { exact: true })).toBeVisible();
  await expect(page.getByText('Hasil Perolehan Suara Calon Kuwu')).toBeVisible();
  await expect(page.getByText('Data Pemilih & Status Hak Suara')).toBeVisible();

  // Open QR Catalog Dialog
  await page.getByRole('button', { name: /Unduh Kode QR/i }).click();
  await expect(page.getByRole('dialog')).toContainText('Katalog & Unduh Kode QR Pemilih');
  await page.getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();

  // Open BAHP Dialog
  await page.getByRole('button', { name: /Cetak Berita Acara/i }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'BERITA ACARA REKAPITULASI HASIL PENGHITUNGAN SUARA',
  );
  await page.getByRole('button', { name: 'Tutup' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
