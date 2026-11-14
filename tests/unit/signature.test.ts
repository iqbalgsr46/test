import { describe, expect, it } from 'vitest';
import { matchesSignatureName } from '../../src/features/check-in/signature';
describe('typed attendance signature', () => {
  it('accepts the full voter name ignoring outside whitespace and case', () => {
    expect(matchesSignatureName('  siti aminah ', 'Siti Aminah')).toBe(true);
  });
});
