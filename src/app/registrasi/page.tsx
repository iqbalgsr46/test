import { Suspense } from 'react';
import { Workspace } from '@/components/layout/workspace';
import { Registration } from '@/features/check-in/registration';
export default function Page() {
  return (
    <Workspace>
      <Suspense fallback={<p>Memuat registrasi...</p>}>
        <Registration />
      </Suspense>
    </Workspace>
  );
}
