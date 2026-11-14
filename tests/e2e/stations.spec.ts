import { test, expect } from '@playwright/test';
test('halaman awal menampilkan meja pemeriksaan dan enam undangan simulasi', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pemeriksaan awal' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Surat undangan', exact: true })).toBeVisible();
  await expect(page.getByLabel('Pilih pemilih')).toContainText('Siti Aminah');
});
