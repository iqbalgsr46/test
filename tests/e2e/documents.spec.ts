import { test, expect } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { mkdir } from 'node:fs/promises';
import { votedFixture, storageKey } from './fixtures';

const receiptId = '92d6d012-fb83-4530-8d74-f2c32f189407';

test('panduan menjelaskan empat tahap dan batas simulasi secara jujur', async ({ page }) => {
  await page.goto('/panduan');
  await expect(page.getByRole('heading', { name: 'Panduan simulasi', exact: true })).toBeVisible();

  await expect(
    page.getByRole('list', { name: 'Empat tahap pelayanan' }).getByRole('listitem'),
  ).toHaveCount(4);
  for (const href of ['/', '/registrasi', '/bilik', '/penyelesaian', '/undangan']) {
    await expect(page.getByRole('main').locator(`a[href="${href}"]`)).toBeVisible();
  }
  const body = page.locator('body');
  for (const text of [
    'pemeriksaan fisik',
    'kode manual',
    'unggah gambar QR',
    'HTTPS atau localhost',
    'origin yang sama',
    'bukan bukti bahwa kertas sudah tercetak',
    'Reset data simulasi',
    'tanpa autentikasi',
    'bukan sistem pemilihan resmi',
  ]) {
    await expect(body).toContainText(text);
  }
});

test('daftar enam undangan menyediakan tautan cetak dan pratinjau pemilih terpilih', async ({
  page,
}) => {
  await page.goto('/undangan');
  await expect(page.getByRole('heading', { name: 'Surat undangan', exact: true })).toBeVisible();
  const rows = page.getByRole('table', { name: 'Daftar undangan pemilih' }).locator('tbody tr');
  await expect(rows).toHaveCount(6);
  for (let index = 0; index < 6; index += 1) {
    const id = `voter-${String(index + 1).padStart(3, '0')}`;
    await expect(rows.nth(index).getByRole('link', { name: /Cetak undangan/ })).toHaveAttribute(
      'href',
      `/cetak/undangan/${id}`,
    );
  }
  const preview = page.getByRole('region', { name: 'Pratinjau undangan' });
  await expect(preview.locator('article.document')).toContainText('DEMO-0001');
  await rows
    .nth(1)
    .getByRole('button', { name: /Pratinjau/ })
    .click();
  await expect(preview.locator('article.document')).toContainText('DEMO-0002');
  await expect(preview.locator('article.document')).toContainText('CT26-B8L3Q6');
  await expect(preview.getByRole('link', { name: 'Buka halaman cetak' })).toHaveAttribute(
    'href',
    '/cetak/undangan/voter-002',
  );
});

test('halaman cetak undangan membuka dialog cetak dan hanya mencetak dokumen', async ({ page }) => {
  await page.goto('/cetak/undangan/voter-001');
  await expect(page.locator('article.document')).toContainText('DEMO-0001');
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.evaluate(() => {
    window.print = () => document.body.setAttribute('data-print-requested', 'true');
  });
  await page.getByRole('button', { name: 'Cetak undangan', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-requested', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Cetak undangan', exact: true })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Kembali ke undangan' })).toBeHidden();
  await expect(page.locator('article.document')).toBeVisible();
  const qr = page.getByRole('img', { name: 'QR undangan pemilih' });
  expect(await decodeQr(await qr.screenshot())).toBe('PILKADES:CT-2026:UND:CT26-A7K2P9');
});

test('halaman cetak bukti membuka dialog cetak dan hanya mencetak bukti', async ({ page }) => {
  await page.addInitScript(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: storageKey,
    state: votedFixture(receiptId),
  });
  await page.goto(`/cetak/bukti/${receiptId}`);
  await expect(page.locator('article.receipt')).toContainText(receiptId);
  await expect(page.getByRole('navigation')).toHaveCount(0);
  await page.evaluate(() => {
    window.print = () => document.body.setAttribute('data-print-requested', 'true');
  });
  await page.getByRole('button', { name: 'Cetak bukti', exact: true }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-requested', 'true');
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Cetak bukti', exact: true })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Kembali ke penyelesaian' })).toBeHidden();
  await expect(page.locator('article.receipt')).toBeVisible();
  const qr = page.getByRole('img', { name: 'QR bukti simulasi' });
  expect(await decodeQr(await qr.screenshot())).toBe(`PILKADES:CT-2026:BUKTI:${receiptId}`);
  await mkdir('artifacts/verification', { recursive: true });
  await page.pdf({
    path: 'artifacts/verification/Bukti_QR_Simulasi_Cikaum_Timur.pdf',
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
  });
});

test('nomor bukti acak yang tidak tersimpan tidak dapat dicetak', async ({ page }) => {
  await page.goto(`/cetak/bukti/${receiptId}`);
  await expect(page.locator('article.receipt')).toHaveCount(0);
  await expect(page.locator('.notice[role="alert"]')).toContainText('tidak ditemukan');
});

async function decodeQr(png: Buffer) {
  const image = PNG.sync.read(png);
  return jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data;
}

test('bukti cetak memiliki QR yang terbaca tanpa identitas atau pilihan pemilih', async ({
  page,
}) => {
  const { Receipt } = await import('../../src/features/documents/receipt');
  await page.setContent(renderToStaticMarkup(createElement(Receipt, { receiptId })));

  const document = page.locator('article.receipt');
  await expect(document.getByText('BUKTI SIMULASI', { exact: true })).toBeVisible();
  await expect(
    document.getByText('Bukti telah memilih secara digital', { exact: true }),
  ).toBeVisible();
  await expect(document.getByText(receiptId, { exact: true })).toBeVisible();
  await expect(document).toContainText('Minggu, 22 November 2026');
  await expect(document).toContainText('TPS 001');
  await expect(document).not.toContainText(
    /Siti Aminah|DEMO-0001|candidate-01|Ahmad Hidayat|Dedi Kurniawan/,
  );
  const qr = document.getByRole('img', { name: 'QR bukti simulasi' });
  expect(await decodeQr(await qr.screenshot())).toBe(`PILKADES:CT-2026:BUKTI:${receiptId}`);
});

test('undangan memuat identitas demo, jadwal, ruang tanda tangan kosong, dan QR sebenarnya', async ({
  page,
}) => {
  const { InvitationDocument } = await import('../../src/features/documents/invitation-document');
  const { INITIAL_VOTERS } = await import('../../src/features/election/data');
  const voter = INITIAL_VOTERS[0];
  await page.setContent(renderToStaticMarkup(createElement(InvitationDocument, { voter })));

  const document = page.locator('article.document');
  await expect(document.getByText('PANITIA PEMILIHAN KUWU', { exact: true })).toBeVisible();
  await expect(document.getByRole('heading', { name: 'SURAT UNDANGAN PEMILIH' })).toBeVisible();
  await expect(document.getByText('CONTOH SIMULASI', { exact: true })).toBeVisible();
  for (const text of [
    voter.name,
    voter.identity,
    voter.address,
    voter.invitationCode,
    'Minggu, 22 November 2026',
    '07.00 - 13.00 WIB',
    'Balai Desa Cikaum Timur',
  ]) {
    await expect(document).toContainText(text);
  }
  await expect(document.getByText('001/UND/CT/XI/2026', { exact: true })).toBeVisible();
  await expect(document.getByRole('group', { name: 'Catatan kehadiran' })).toContainText(
    'Tanda tangan pemilih',
  );
  await expect(document.getByTestId('attendance-blank')).toBeEmpty();
  await expect(document.getByTestId('signature-blank')).toBeEmpty();
  await expect(document).toContainText('Bawa undangan dan identitas');
  await expect(document).toContainText('satu kali');
  const qr = document.getByRole('img', { name: 'QR undangan pemilih' });
  expect(await decodeQr(await qr.screenshot())).toBe(
    `PILKADES:CT-2026:UND:${voter.invitationCode}`,
  );
});
