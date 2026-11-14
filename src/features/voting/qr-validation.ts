export function validateImage(file: { size: number; type: string }): string | null {
  if (file.size > 8 * 1024 * 1024) return 'Ukuran gambar maksimal 8 MB.';
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    return 'Gunakan gambar PNG, JPEG, atau WebP.';
  return null;
}
