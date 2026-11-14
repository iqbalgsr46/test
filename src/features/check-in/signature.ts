export function matchesSignatureName(input: string, expected: string): boolean {
  return (
    expected.trim().length > 0 &&
    input.trim().toLocaleLowerCase('id') === expected.trim().toLocaleLowerCase('id')
  );
}
