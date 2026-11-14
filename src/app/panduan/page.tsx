import type { Metadata } from 'next';
import { PageHeading, Workspace } from '@/components/layout/workspace';
import { SimulationGuide } from '@/features/documents/simulation-guide';

export const metadata: Metadata = { title: 'Panduan simulasi' };

export default function GuidePage() {
  return (
    <Workspace>
      <PageHeading
        eyebrow="Dokumen dan informasi"
        title="Panduan simulasi"
        description="Kenali urutan pelayanan, peran petugas, dan batas penggunaan simulasi pemilihan kuwu."
      />
      <SimulationGuide />
    </Workspace>
  );
}
