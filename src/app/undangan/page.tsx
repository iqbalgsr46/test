import type { Metadata } from 'next';
import Link from 'next/link';
import { PageHeading, Workspace } from '@/components/layout/workspace';
import { InvitationList } from '@/features/documents/invitation-list';

export const metadata: Metadata = { title: 'Surat undangan' };

export default function InvitationsPage() {
  return (
    <Workspace>
      <PageHeading
        eyebrow="Dokumen dan informasi"
        title="Surat undangan"
        description="Siapkan undangan pemilih untuk simulasi. Pilih pratinjau, periksa identitas, lalu buka dokumen siap cetak."
        action={
          <Link href="/panduan" className="button" data-variant="secondary">
            Panduan simulasi
          </Link>
        }
      />
      <InvitationList />
    </Workspace>
  );
}
