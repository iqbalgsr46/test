import type { Metadata } from 'next';
import { PrintReceiptClient } from '@/features/documents/print-receipt';

export const metadata: Metadata = {
  title: 'Cetak Bukti Pemilihan',
};

export default async function PrintReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrintReceiptClient id={id} />;
}
