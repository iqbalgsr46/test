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

for (const width of [320, 390, 768]) {
  test(`form aktif, dialog kandidat, dan penyelesaian tetap muat pada ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
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
    await page.getByLabel('Kode undangan atau isi QR').fill(encodeInvitation(ready.voters[0]));
    await page.getByRole('button', { name: 'Verifikasi undangan' }).click();
    await page.getByRole('button', { name: 'Pilih Upin', exact: true }).click();
    await page.getByRole('button', { name: 'Pilih kandidat ini', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(width);
    await expect(dialog.getByRole('button', { name: 'Pilih', exact: true })).toBeVisible();
    await assertPageFits(page);
    await dialog.getByRole('button', { name: 'Ulangi' }).click();

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
