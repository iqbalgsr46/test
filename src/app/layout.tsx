import type { Metadata } from 'next';
import { ElectionProvider } from '@/features/election/election-provider';
import { LandscapeGuard } from '@/components/ui/landscape-guard';
import './globals.css';
export const metadata: Metadata = {
  title: { default: 'Cikaum Timur | Simulasi Pemilihan Kuwu', template: '%s | Cikaum Timur' },
  description:
    'Simulasi alur TPS digital Desa Cikaum Timur. Data contoh untuk pembelajaran, bukan pemilihan resmi.',
  robots: { index: false, follow: false },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <ElectionProvider>
          <LandscapeGuard />
          {children}
        </ElectionProvider>
      </body>
    </html>
  );
}
