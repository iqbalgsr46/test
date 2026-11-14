'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createInitialState } from './data';
import {
  commitElectionAction,
  readElectionState,
  resetElectionState,
  STORAGE_KEY,
  type ElectionLocks,
  type ElectionStorage,
} from './storage';
import { BusinessRuleError } from './engine';
import type { ElectionAction, ElectionState } from './types';

export interface ElectionContextValue {
  state: ElectionState;
  isLoaded: boolean;
  error: string | null;
  dispatch: (action: ElectionAction) => Promise<void>;
  reset: () => Promise<void>;
}

const ElectionContext = createContext<ElectionContextValue | null>(null);

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : 'Terjadi kesalahan pada penyimpanan simulasi.';
}

function browserStorage(): ElectionStorage {
  try {
    return window.localStorage;
  } catch {
    throw new Error(
      'Penyimpanan lokal tidak tersedia. Izinkan penyimpanan browser untuk menggunakan demo.',
    );
  }
}

function browserLocks(): ElectionLocks | undefined {
  return typeof navigator !== 'undefined' ? navigator.locks : undefined;
}

/** Local demo only: same-origin tabs are coordinated, not users, devices, or a real election. */
export function ElectionProvider({ children }: { children: ReactNode }) {
  // The server and first client render are identical; never read storage during render.
  const [state, setState] = useState<ElectionState>(createInitialState);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const loaded = useRef(false);

  const publish = useCallback((next: ElectionState) => {
    if (!mounted.current) return;
    setState(next);
    setError(null);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const refresh = () => {
      if (!mounted.current) return;
      try {
        publish(readElectionState(browserStorage()));
      } catch (cause) {
        setError(messageFor(cause));
      } finally {
        loaded.current = true;
        setIsLoaded(true);
      }
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try {
        if (event.storageArea !== browserStorage()) return;
      } catch (cause) {
        setError(messageFor(cause));
        return;
      }
      // Reread the latest value rather than an older queued event's newValue.
      refresh();
    };
    window.addEventListener('storage', onStorage);
    queueMicrotask(refresh);
    return () => {
      mounted.current = false;
      loaded.current = false;
      window.removeEventListener('storage', onStorage);
    };
  }, [publish]);

  const dispatch = useCallback(
    async (action: ElectionAction): Promise<void> => {
      try {
        if (!loaded.current) throw new Error('Data simulasi belum selesai dimuat.');
        await commitElectionAction(browserStorage(), browserLocks(), action, publish);
      } catch (cause) {
        if (cause instanceof BusinessRuleError) {
          // Business rule errors are normal operational rejections (e.g. stale calls).
          // Reread storage to resynchronize without forcing a full-screen corruption barrier.
          try {
            publish(readElectionState(browserStorage()));
          } catch (recoveryCause) {
            if (mounted.current) setError(messageFor(recoveryCause));
          }
        } else if (mounted.current) {
          setError(messageFor(cause));
        }
        throw cause instanceof Error ? cause : new Error(messageFor(cause));
      }
    },
    [publish],
  );

  const reset = useCallback(async (): Promise<void> => {
    try {
      if (!loaded.current) throw new Error('Data simulasi belum selesai dimuat.');
      // Caller must obtain explicit user confirmation. Corruption never triggers this automatically.
      await resetElectionState(browserStorage(), browserLocks(), publish);
    } catch (cause) {
      const message = messageFor(cause);
      if (mounted.current) setError(message);
      throw new Error(message);
    }
  }, [publish]);

  const value = useMemo(
    () => ({ state, isLoaded, error, dispatch, reset }),
    [state, isLoaded, error, dispatch, reset],
  );
  return <ElectionContext.Provider value={value}>{children}</ElectionContext.Provider>;
}

export function useElection(): ElectionContextValue {
  const context = useContext(ElectionContext);
  if (!context) throw new Error('useElection harus digunakan di dalam ElectionProvider.');
  return context;
}
