import { test, expect, type Page } from '@playwright/test';

async function registerVoter(page: Page) {
  await page.goto('/');
  await page.getByLabel('Pilih pemilih').selectOption('voter-001');
  await page.getByRole('checkbox', { name: 'Surat undangan telah diperiksa' }).check();
  await page.getByRole('checkbox', { name: 'Kartu identitas sesuai dengan undangan' }).check();
  await page.getByRole('button', { name: 'Konfirmasi pemeriksaan' }).click();
  await page.getByRole('link', { name: 'Lanjut ke meja 1' }).click();
  await page.getByRole('checkbox', { name: 'Jari pemilih belum bertinta' }).check();
  await page.getByRole('checkbox', { name: 'Data diri dan dokumen sudah sesuai' }).check();
  await page.getByRole('button', { name: 'Daftarkan dan buat antrean' }).click();
  await expect(page.getByText('Nomor antrean Anda')).toBeVisible();
}

test('tanda tangan gambar disimpan dan dapat dibersihkan', async ({ page }) => {
  await registerVoter(page);
  await page.getByRole('button', { name: 'Panggil antrean berikutnya' }).click();
  const canvas = page.getByLabel('Area gambar tanda tangan');
  await canvas.scrollIntoViewIfNeeded();
  let box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas belum tersedia');
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 75, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('checkbox', { name: 'Saya mengonfirmasi kehadiran saya' }).check();
  await expect(page.getByRole('button', { name: 'Simpan kehadiran' })).toBeEnabled();
  await page.getByRole('button', { name: 'Bersihkan', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Simpan kehadiran' })).toBeDisabled();
  await canvas.scrollIntoViewIfNeeded();
  box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas belum tersedia');
  await page.mouse.move(box.x + 20, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 130, box.y + 75, { steps: 12 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Simpan kehadiran' }).click();
  await expect(page.getByText('Kehadiran telah dikonfirmasi.')).toBeVisible();
  const signature = await page.evaluate(
    () => JSON.parse(localStorage.getItem('cikaum-timur-election-v1')!).voters[0].signature,
  );
  expect(signature).toMatch(/^data:image\/png;base64,/);
});

test('registrasi mewajibkan pemeriksaan, antrean, dan tanda tangan sebelum bilik', async ({
  page,
}) => {
  await page.goto('/registrasi');
  await expect(
    page.getByText('Pemilih harus melewati pemeriksaan awal terlebih dahulu.'),
  ).toBeVisible();
  await registerVoter(page);
  await expect(page.getByRole('button', { name: 'Simpan kehadiran' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Panggil antrean berikutnya' }).click();
  await expect(page.getByRole('button', { name: 'Simpan kehadiran' })).toBeDisabled();
  await page.getByRole('button', { name: 'Ketik nama', exact: true }).click();
  await page.getByLabel('Nama lengkap sebagai tanda tangan').fill('Siti Aminah');
  await page.getByRole('checkbox', { name: 'Saya mengonfirmasi kehadiran saya' }).check();
  await page.getByRole('button', { name: 'Simpan kehadiran' }).click();
  await expect(page.getByRole('link', { name: 'Lanjut ke bilik suara' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Kehadiran telah dikonfirmasi.')).toBeVisible();
});
