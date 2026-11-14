import { Suspense } from 'react';
import { Workspace } from '@/components/layout/workspace';
import { Completion } from '@/features/voting/completion';
export default function Page() {
  return (
    <Workspace>
      <Suspense fallback={<p>Memuat data pemilih...</p>}>
        <Completion />
      </Suspense>
    </Workspace>
  );
}
