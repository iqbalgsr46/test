import { expect, test, type Page } from '@playwright/test';
import { createInitialState } from '../../src/features/election/data';
import { encodeInvitation, transition } from '../../src/features/election/engine';
import type { ElectionState } from '../../src/features/election/types';
import { readyFixture, storageKey, votedFixture } from './fixtures';

function calledFixture(): ElectionState {
  let state = createInitialState();
  const voterId = state.voters[0].id;
  state = transition(state, {
    type: 'SCREEN',
    voterId,
    invitationChecked: true,
    identityChecked: true,
  });
  state = transition(state, { type: 'REGISTER', voterId, inkFree: true, identityChecked: true });
  return transition(state, { type: 'CALL', voterId });
}

async function assertPageFits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

async function loadState(page: Page, state: ElectionState, route: string) {
  await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), {
    key: storageKey,
    state,
  });
  await page.goto(route);
}

const viewports = [
  { label: '667x375 (HP Landscape Kompak)', width: 667, height: 375 },
  { label: '844x390 (HP Landscape Standar)', width: 844, height: 390 },
  { label: '1024x600 (Tablet Landscape TPS)', width: 1024, height: 600 },
];

for (const { label, width, height } of viewports) {
  test(`form aktif, dialog kandidat, dan penyelesaian tetap muat pada ${label}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await loadState(page, calledFixture(), '/registrasi');
    const signature = page.getByLabel('Area gambar tanda tangan');
    await expect(signature).toBeVisible();
    await assertPageFits(page);
    const signatureBox = await signature.boundingBox();
    expect(signatureBox).not.toBeNull();
    expect(signatureBox!.x).toBeGreaterThanOrEqual(0);
    expect(signatureBox!.x + signatureBox!.width).toBeLessThanOrEqual(width);

    await page.getByRole('button', { name: 'Ketik nama', exact: true }).click();
    await page.getByLabel('Nama lengkap sebagai tanda tangan').fill('Siti Aminah');
    await page.getByRole('checkbox', { name: 'Saya mengonfirmasi kehadiran saya' }).check();
    await expect(page.getByRole('button', { name: 'Simpan kehadiran' })).toBeEnabled();
    await assertPageFits(page);

    const ready = readyFixture();
    await loadState(page, ready, '/bilik');
    await page.getByRole('button', { name: /Input Kode/i }).click();
    await page.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(ready.voters[0]));
    await page.getByRole('button', { name: 'Verifikasi' }).click();
    await page.getByRole('button', { name: /Pilih Calon A Upin/i }).click();
    await page.getByRole('button', { name: 'PILIH KANDIDAT A' }).click();
    const modalText = page.getByText('Konfirmasi Pemilihan');
    await expect(modalText).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pilih', exact: true })).toBeVisible();
    await assertPageFits(page);
    await page.getByRole('button', { name: 'Ulangi' }).click();

    await loadState(
      page,
      votedFixture('4c3bf86e-121f-43f5-8329-af904a82ca8d'),
      '/penyelesaian?pemilih=voter-001',
    );
    await expect(page.getByRole('link', { name: 'Cetak ulang bukti QR' })).toBeVisible();
    for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
    await expect(page.getByRole('button', { name: 'Selesaikan proses' })).toBeEnabled();
    await assertPageFits(page);
  });
}
