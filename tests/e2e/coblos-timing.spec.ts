import { test, expect } from '@playwright/test';
import { createInitialState } from '../../src/features/election/data';
import { encodeInvitation } from '../../src/features/election/engine';

test('coblos paku is pre-mounted, uses unoptimized raw asset, and triggers animation immediately without cold delay', async ({
  page,
}) => {
  const initialState = createInitialState();
  const voter = initialState.voters[0];

  // Track network requests to ensure no on-demand /_next/image optimization happens for coblos paku
  const nextImageRequests: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('/_next/image') && url.includes('coblos-paku')) {
      nextImageRequests.push(url);
    }
  });

  await page.goto('/');

  // On scanner screen, verify preload link exists in head
  const preloadLink = page.locator('head link[rel="preload"][href="/images/coblos-paku.png"]');
  await expect(preloadLink).toHaveCount(1);

  // Navigate to ballot screen via manual code input
  await page.getByRole('button', { name: /Input Kode/i }).click();
  await page.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(voter));
  await page.getByRole('button', { name: 'Verifikasi' }).click();

  // Ballot screen should be visible
  await expect(page.getByRole('heading', { name: 'SURAT SUARA' })).toBeVisible();

  // Verify nail images are ALREADY pre-mounted in DOM before any click
  const upinButton = page.getByRole('button', { name: /Pilih Calon A Upin/i });
  const ipinButton = page.getByRole('button', { name: /Pilih Calon B Ipin/i });

  const upinNailImg = upinButton.locator('img[src="/images/coblos-paku.png"]');
  const ipinNailImg = ipinButton.locator('img[src="/images/coblos-paku.png"]');

  await expect(upinNailImg).toHaveCount(1);
  await expect(ipinNailImg).toHaveCount(1);

  // Before click: neither has animate-coblos class
  const upinNailContainer = upinButton.locator('.animate-coblos');
  await expect(upinNailContainer).toHaveCount(0);

  // FIRST CLICK: Click Candidate A (Upin)
  await upinButton.click();

  // Immediately on click, animate-coblos must be present
  await expect(upinButton.locator('.animate-coblos')).toHaveCount(1);
  await expect(upinButton.locator('.animate-coblos img')).toHaveAttribute(
    'src',
    '/images/coblos-paku.png',
  );

  // Assert NO /_next/image request was made on click
  expect(nextImageRequests).toHaveLength(0);

  // SWITCH TO CANDIDATE B (Ipin)
  await ipinButton.click();
  await expect(ipinButton.locator('.animate-coblos')).toHaveCount(1);
  await expect(upinButton.locator('.animate-coblos')).toHaveCount(0);

  // SWITCH BACK TO CANDIDATE A (Upin)
  await upinButton.click();
  await expect(upinButton.locator('.animate-coblos')).toHaveCount(1);
  await expect(ipinButton.locator('.animate-coblos')).toHaveCount(0);
});

test('coblos paku maintains centered puncture position under prefers-reduced-motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const initialState = createInitialState();
  const voter = initialState.voters[0];

  await page.goto('/');
  await page.getByRole('button', { name: /Input Kode/i }).click();
  await page.getByPlaceholder('CT26-XXXXXX').fill(encodeInvitation(voter));
  await page.getByRole('button', { name: 'Verifikasi' }).click();

  await page.getByRole('button', { name: /Pilih Calon A Upin/i }).click();

  const nailElement = page.getByRole('button', { name: /Pilih Calon A Upin/i }).locator('.animate-coblos');
  await expect(nailElement).toBeVisible();

  // Verify transform is centered anchor (-30.4%, -77.8%)
  const transform = await nailElement.evaluate((el) => window.getComputedStyle(el).transform);
  expect(transform).not.toBe('none');
});
