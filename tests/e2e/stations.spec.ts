import { test, expect } from '@playwright/test';

test('halaman utama menampilkan bilik suara kiosk scanner dan daftar undangan di /undangan', async ({
  page,
}) => {
  // 1. Root / is Kiosk Bilik Suara with camera scanner
  await page.goto('/');
  await expect(page.locator('video')).toBeVisible();
  await expect(page.getByRole('button', { name: /Input Kode/i })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admin' })).toBeVisible();

  // 2. /undangan provides 6 simulation invitations
  await page.goto('/undangan');
  await expect(page.getByRole('heading', { name: 'Surat undangan', exact: true })).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Daftar undangan pemilih' }).getByText('Siti Aminah'),
  ).toBeVisible();
  await expect(
    page.getByRole('table', { name: 'Daftar undangan pemilih' }).getByText('Warga Demo Enam'),
  ).toBeVisible();
});

