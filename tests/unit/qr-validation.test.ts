import { it, expect } from 'vitest';
it('rejects non-image uploads', () => {
  expect(validateImage({ size: 100, type: 'text/plain' })).toBe(
    'Gunakan gambar PNG, JPEG, atau WebP.',
  );
});
it('accepts PNG within size limit', () => {
  expect(validateImage({ size: 2048, type: 'image/png' })).toBeNull();
});
import { validateImage } from '../../src/features/voting/qr-validation';
it('rejects files exceeding 8 MB before decoding', () => {
  expect(validateImage({ size: 9 * 1024 * 1024, type: 'image/png' })).toContain('8 MB');
});
