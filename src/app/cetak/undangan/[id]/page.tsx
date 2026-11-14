import type { Metadata } from 'next';
import { PrintInvitationClient } from '@/features/documents/print-invitation';

export const metadata: Metadata = {
  title: 'Cetak Surat Undangan',
};

export default async function PrintInvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PrintInvitationClient id={id} />;
}
