import type { Metadata } from 'next';
import { AdminPortal } from '@/features/admin/admin-portal';

export const metadata: Metadata = {
  title: 'Dashboard Admin KPPS · Data Hasil Pemilihan Kuwu',
  description: 'Portal Administrasi dan Rekapitulasi Suara Pemilihan Kuwu Desa Cikaum Timur.',
};

export default function AdminPage() {
  return <AdminPortal />;
}
