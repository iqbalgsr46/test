import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { build } from 'rolldown';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ElectionProvider, useElection } from '../../src/features/election/election-provider';
import { CANDIDATES, createInitialState } from '../../src/features/election/data';
import { transition } from '../../src/features/election/engine';
import type { ElectionState } from '../../src/features/election/types';

type MutableState = {
  version: unknown;
  voters: Record<string, unknown>[];
  totals: Record<string, unknown>;
  [key: string]: unknown;
};

function progressedState(): ElectionState {
  let state = createInitialState();
  for (let index = 0; index < 2; index++) {
    const voter = state.voters[index];
    state = transition(state, {
      type: 'SCREEN',
      voterId: voter.id,
      invitationChecked: true,
      identityChecked: true,
    });
    state = transition(state, {
      type: 'REGISTER',
      voterId: voter.id,
      identityChecked: true,
      inkFree: true,
    });
    state = transition(state, { type: 'CALL', voterId: voter.id });
    state = transition(state, {
      type: 'SIGN',
      voterId: voter.id,
      signature: `typed:${voter.name}`,
    });
    state = transition(state, {
      type: 'VOTE',
      voterId: voter.id,
      candidateId: CANDIDATES[index].id,
      receiptId: `7b8efca1-95eb-4821-8ed4-40ed126654f${index}`,
      timestamp: '2026-11-22T01:00:00.000Z',
    });
  }
  return transition(state, {
    type: 'COMPLETE',
    voterId: state.voters[0].id,
    receiptDeposited: true,
    invitationReturned: true,
    fingerInked: true,
  });
}
import {
  readElectionState,
  writeElectionState,
  validateElectionState,
  commitElectionAction,
  resetElectionState,
  STORAGE_KEY,
} from '../../src/features/election/storage';

describe('provider in a real browser', () => {
  let browser: Browser;
  let bundle: string;
  const origin = 'http://localhost:43117';
  beforeAll(async () => {
    const entry = resolve(process.cwd(), '__election_provider_unit_entry__.tsx').replaceAll(
      '\\',
      '/',
    );
    const result = await build({
      input: 'election-provider-test-entry',
      write: false,
      platform: 'browser',
      transform: { define: { 'process.env.NODE_ENV': JSON.stringify('production') } },
      onwarn(warning, defaultHandler) {
        if (warning.code !== 'MODULE_LEVEL_DIRECTIVE') defaultHandler(warning);
      },
      plugins: [
        {
          name: 'in-memory-provider-test',
          resolveId(id) {
            if (id === 'election-provider-test-entry') return entry;
          },
          load(id) {
            if (id !== entry) return;
            return `
            import { createElement, useEffect } from "react";
            import { createRoot } from "react-dom/client";
            import { ElectionProvider, useElection } from "./src/features/election/election-provider";
            window.snapshots = [];
            function Probe() {
              const value = useElection();
              useEffect(() => { window.election = value; window.snapshots.push({state: value.state, isLoaded: value.isLoaded, error: value.error}); }, [value]);
              return createElement("output", null, JSON.stringify({loaded:value.isLoaded,error:value.error,stage:value.state.voters[0].stage}));
            }
            window.testRoot = createRoot(document.getElementById("root"));
            window.testRoot.render(createElement(ElectionProvider, null, createElement(Probe)));
          `;
          },
        },
      ],
      output: { format: 'iife' },
    });
    bundle = result.output
      .filter((item) => item.type === 'chunk')
      .map((item) => item.code)
      .join('\n');
    browser = await chromium.launch({ channel: 'msedge', headless: true });
  }, 30_000);
  afterAll(async () => {
    await browser?.close();
  });

  async function freshContext(): Promise<BrowserContext> {
    const context = await browser.newContext();
    await context.route(`${origin}/**`, (route) =>
      route.fulfill({ contentType: 'text/html', body: '<!doctype html><div id="root"></div>' }),
    );
    return context;
  }

  async function mount(context: BrowserContext, raw?: string): Promise<Page> {
    const page = await context.newPage();
    await page.goto(origin);
    if (raw !== undefined)
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [STORAGE_KEY, raw]);
    await page.addScriptTag({ content: bundle });
    await page.waitForFunction(() => window.election?.isLoaded);
    return page;
  }

  it('hydrates corrupt data without reset, then resets explicitly and publishes successful writes', async () => {
    const context = await freshContext();
    try {
      const page = await mount(context, 'corrupt');
      expect(await page.evaluate(() => window.snapshots[0].isLoaded)).toBe(false);
      expect(await page.evaluate(() => window.election.error)).toMatch(/rusak/i);
      expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBe('corrupt');
      await page.evaluate(() => window.election.reset());
      await page.waitForFunction(() => window.election.error === null);
      await page.evaluate(() =>
        window.election.dispatch({
          type: 'SCREEN',
          voterId: 'voter-001',
          invitationChecked: true,
          identityChecked: true,
        }),
      );
      await page.waitForFunction(() => window.election.state.voters[0].stage === 'screened');
      expect(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)!).voters[0].stage,
          STORAGE_KEY,
        ),
      ).toBe('screened');
    } finally {
      await context.close();
    }
  });

  it('rejects business-rule errors without blocking the UI or resetting valid data', async () => {
    const context = await freshContext();
    try {
      const page = await mount(context);
      const rejection = await page.evaluate(async () => {
        try {
          await window.election.dispatch({ type: 'CALL', voterId: 'voter-001' });
          return null;
        } catch (cause) {
          return (cause as Error).message;
        }
      });
      expect(rejection).toMatch(/tahap/i);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => window.election.error)).toBeNull();
      expect(await page.evaluate(() => window.election.state.voters[0].stage)).toBe('invited');
      expect(await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY)).toBeNull();
    } finally {
      await context.close();
    }
  });

  it('blocks globally when storage resynchronization after a business-rule rejection fails', async () => {
    const context = await freshContext();
    try {
      const state = transition(createInitialState(), {
        type: 'SCREEN',
        voterId: 'voter-002',
        invitationChecked: true,
        identityChecked: true,
      });
      const raw = JSON.stringify(state);
      const page = await mount(context, raw);
      const result = await page.evaluate(async (key) => {
        const getItem = Storage.prototype.getItem;
        const setItem = Storage.prototype.setItem;
        let reads = 0;
        let writes = 0;
        let rejection: { name: string; message: string } | null = null;
        Storage.prototype.getItem = function (storageKey: string) {
          if (this === localStorage && storageKey === key && ++reads === 2) {
            throw new Error('Recovery read failed');
          }
          return getItem.call(this, storageKey);
        };
        Storage.prototype.setItem = function (storageKey: string, value: string) {
          if (this === localStorage && storageKey === key) writes++;
          return setItem.call(this, storageKey, value);
        };
        try {
          try {
            await window.election.dispatch({ type: 'CALL', voterId: 'voter-001' });
          } catch (cause) {
            rejection = { name: (cause as Error).name, message: (cause as Error).message };
          }
          return { rejection, reads, writes, persisted: getItem.call(localStorage, key) };
        } finally {
          Storage.prototype.getItem = getItem;
          Storage.prototype.setItem = setItem;
        }
      }, STORAGE_KEY);
      expect(result.rejection).toEqual({
        name: 'BusinessRuleError',
        message: 'Tahap pemilih tidak sesuai. Diperlukan tahap registered; saat ini invited.',
      });
      expect(result.reads).toBe(2);
      expect(result.writes).toBe(0);
      expect(result.persisted).toBe(raw);
      await expect
        .poll(() => page.evaluate(() => window.election.error))
        .toBe('Penyimpanan lokal tidak dapat dibaca. Izinkan penyimpanan browser untuk demo ini.');
      expect(await page.evaluate(() => window.election.state)).toEqual(state);
    } finally {
      await context.close();
    }
  });

  it('does not reread local data for unrelated sessionStorage events', async () => {
    const context = await freshContext();
    try {
      const page = await mount(context);
      await page.evaluate((key) => {
        localStorage.setItem(key, 'corrupt');
        window.dispatchEvent(
          new StorageEvent('storage', { key, storageArea: sessionStorage, newValue: 'unrelated' }),
        );
      }, STORAGE_KEY);
      await page.waitForTimeout(100);
      expect(await page.evaluate(() => window.election.error)).toBeNull();
    } finally {
      await context.close();
    }
  });
});

declare global {
  interface Window {
    election: import('../../src/features/election/election-provider').ElectionContextValue;
    snapshots: Array<{ state: ElectionState; isLoaded: boolean; error: string | null }>;
  }
}

describe('React provider hydration boundary', () => {
  it('renders an unloaded deterministic snapshot on the server without browser storage', () => {
    function Snapshot() {
      const { state, isLoaded, error, dispatch, reset } = useElection();
      expect(typeof dispatch).toBe('function');
      expect(typeof reset).toBe('function');
      return createElement(
        'output',
        null,
        JSON.stringify({ count: state.voters.length, isLoaded, error }),
      );
    }
    const markup = renderToStaticMarkup(
      createElement(ElectionProvider, null, createElement(Snapshot)),
    );
    expect(markup).toContain('&quot;isLoaded&quot;:false');
    expect(markup).toContain('&quot;count&quot;:6');
    expect(markup).toContain('&quot;error&quot;:null');
  });

  it('explains when the hook is rendered without its provider', () => {
    function Orphan() {
      useElection();
      return null;
    }
    expect(() => renderToStaticMarkup(createElement(Orphan))).toThrow(/ElectionProvider/);
  });
});

function memoryStorage(initial: string | null = null) {
  const entries = new Map<string, string>();
  if (initial !== null) entries.set('cikaum-timur-election-v1', initial);
  return {
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value);
    }),
  };
}

function serialLocks() {
  let tail = Promise.resolve();
  return {
    request: <T>(name: string, callback: () => T | Promise<T>): Promise<T> => {
      expect(name).toBe(`${STORAGE_KEY}:write`);
      const next = tail.then(callback);
      tail = next.then(
        () => undefined,
        () => undefined,
      );
      return next;
    },
  };
}

describe('serialized browser transactions', () => {
  it('rereads persisted state under a shared lock to reject simultaneous duplicate actions', async () => {
    const storage = memoryStorage();
    const locks = serialLocks();
    const action = {
      type: 'SCREEN' as const,
      voterId: 'voter-001',
      invitationChecked: true,
      identityChecked: true,
    };
    const committed: ElectionState[] = [];
    const results = await Promise.allSettled([
      commitElectionAction(storage, locks, action, (state) => {
        committed.push(state);
      }),
      commitElectionAction(storage, locks, action, (state) => {
        committed.push(state);
      }),
    ]);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
    expect(committed).toHaveLength(1);
    expect(readElectionState(storage).voters[0].stage).toBe('screened');
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    const next = await commitElectionAction(storage, locks, {
      type: 'REGISTER',
      voterId: 'voter-001',
      identityChecked: true,
      inkFree: true,
    });
    expect(next.voters[0].stage).toBe('registered');
  });

  it('fails visibly without Web Locks or writable storage and never publishes an unsaved state', async () => {
    const storage = memoryStorage();
    const action = {
      type: 'SCREEN' as const,
      voterId: 'voter-001',
      invitationChecked: true,
      identityChecked: true,
    };
    await expect(commitElectionAction(storage, undefined, action)).rejects.toThrow(
      /browser.*Web Locks/i,
    );
    expect(storage.setItem).not.toHaveBeenCalled();
    const publish = vi.fn();
    storage.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    await expect(commitElectionAction(storage, serialLocks(), action, publish)).rejects.toThrow(
      /menyimpan|penyimpanan/i,
    );
    expect(publish).not.toHaveBeenCalled();
    expect(readElectionState(storage).voters[0].stage).toBe('invited');
    storage.getItem.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => readElectionState(storage)).toThrow(/penyimpanan/i);
  });

  it('does not repair corruption during mutation but explicitly resets under the same lock', async () => {
    const storage = memoryStorage('corrupt');
    const locks = serialLocks();
    await expect(
      commitElectionAction(storage, locks, { type: 'CALL', voterId: 'voter-001' }),
    ).rejects.toThrow(/rusak/i);
    expect(storage.setItem).not.toHaveBeenCalled();
    const publish = vi.fn();
    await expect(resetElectionState(storage, locks, publish)).resolves.toEqual(
      createInitialState(),
    );
    expect(readElectionState(storage)).toEqual(createInitialState());
    expect(publish).toHaveBeenCalledWith(createInitialState());
    await expect(resetElectionState(storage, undefined)).rejects.toThrow(/Web Locks/i);
    const bad = createInitialState();
    bad.voters[0].stage = 'ready';
    expect(() => writeElectionState(storage, bad)).toThrow(/rusak/i);
  });
});

describe('stage consistency', () => {
  it('rejects inconsistent queue, signature, receipt, dates and vote counts', () => {
    expect(validateElectionState(progressedState())).toEqual(progressedState());
    const corruptions: Array<(state: MutableState) => void> = [
      (state) => {
        state.voters[0].queueNumber = null;
      },
      (state) => {
        state.voters[0].queueNumber = 0;
      },
      (state) => {
        state.voters[0].queueNumber = 1.5;
      },
      (state) => {
        state.voters[1].queueNumber = state.voters[0].queueNumber;
      },
      (state) => {
        state.voters[2].queueNumber = 9;
      },
      (state) => {
        state.voters[0].registeredAt = 'today';
      },
      (state) => {
        state.voters[2].registeredAt = '2026-11-22T01:00:00.000Z';
      },
      (state) => {
        state.voters[0].signature = null;
      },
      (state) => {
        state.voters[0].signature = 'typed:Wrong name';
      },
      (state) => {
        state.voters[2].signature = 'typed:Warga Demo Tiga';
      },
      (state) => {
        state.voters[0].receiptId = null;
      },
      (state) => {
        state.voters[0].receiptId = 'identity-and-candidate';
      },
      (state) => {
        state.voters[1].receiptId = state.voters[0].receiptId;
      },
      (state) => {
        state.voters[1].receiptId = String(state.voters[0].receiptId).toUpperCase();
      },
      (state) => {
        state.voters[2].receiptId = state.voters[0].receiptId;
      },
      (state) => {
        state.voters[0].votedAt = null;
      },
      (state) => {
        state.voters[2].votedAt = '2026-11-22T01:00:00.000Z';
      },
      (state) => {
        state.voters[0].completedAt = null;
      },
      (state) => {
        state.voters[0].completedAt = '2026-11-21T01:00:00.000Z';
      },
      (state) => {
        state.voters[1].completedAt = '2026-11-22T01:00:00.000Z';
      },
      (state) => {
        state.totals['candidate-01'] = 0;
      },
      (state) => {
        state.totals['candidate-01'] = 6;
      },
    ];
    for (const corrupt of corruptions) {
      const state = progressedState();
      corrupt(state as unknown as MutableState);
      expect(() => validateElectionState(state)).toThrow(/rusak|tidak sah/i);
    }
    const twoCalled = createInitialState();
    for (let index = 0; index < 2; index++) {
      Object.assign(twoCalled.voters[index], {
        stage: 'called',
        queueNumber: index + 1,
        registeredAt: '2026-11-22T01:00:00.000Z',
      });
    }
    expect(() => validateElectionState(twoCalled)).toThrow(/rusak|tidak sah/i);
  });
});

describe('corruption protection', () => {
  it('validates the exact version, demo roster, fields and candidate totals', () => {
    expect(validateElectionState(createInitialState())).toEqual(createInitialState());
    const corruptions: Array<(state: MutableState) => void> = [
      (state) => {
        state.version = 2;
      },
      (state) => {
        state.extra = 'unexpected';
      },
      (state) => {
        state.voters.pop();
      },
      (state) => {
        state.voters.push({ ...state.voters[0] });
      },
      (state) => {
        state.voters[1].id = state.voters[0].id;
      },
      (state) => {
        state.voters[0].id = 'real-person';
      },
      (state) => {
        state.voters[0].identity = '1234567890123456';
      },
      (state) => {
        state.voters[0].name = 'Non-demo person';
      },
      (state) => {
        state.voters[0].address = 'A real address';
      },
      (state) => {
        state.voters[0].invitationCode = 'CT26-OTHER1';
      },
      (state) => {
        state.voters[0].stage = 'other';
      },
      (state) => {
        state.voters[0].candidateId = 'candidate-01';
      },
      (state) => {
        delete state.voters[0].signature;
      },
      (state) => {
        state.totals = {};
      },
      (state) => {
        state.totals['unknown'] = 0;
      },
      (state) => {
        state.totals['candidate-01'] = -1;
      },
      (state) => {
        state.totals['candidate-01'] = 0.5;
      },
      (state) => {
        state.totals['candidate-01'] = '0';
      },
    ];
    for (const corrupt of corruptions) {
      const state = createInitialState();
      corrupt(state as unknown as MutableState);
      const storage = memoryStorage(JSON.stringify(state));
      expect(() => validateElectionState(state)).toThrow(/rusak|tidak sah/i);
      expect(() => readElectionState(storage)).toThrow(/rusak|tidak sah/i);
      expect(storage.setItem).not.toHaveBeenCalled();
    }
    for (const raw of ['', '{', 'null', '[]', 'false', '{}']) {
      const storage = memoryStorage(raw);
      expect(() => readElectionState(storage)).toThrow(/rusak|tidak sah/i);
      expect(storage.setItem).not.toHaveBeenCalled();
    }
  });
});

describe('local demo persistence', () => {
  it('reads a fresh seed without silently writing and roundtrips persisted state', () => {
    const storage = memoryStorage();
    const seed = createInitialState();
    expect(STORAGE_KEY).toBe('cikaum-timur-election-v1');
    expect(readElectionState(storage)).toEqual(seed);
    expect(storage.setItem).not.toHaveBeenCalled();
    writeElectionState(storage, seed);
    expect(storage.setItem).toHaveBeenCalledWith(STORAGE_KEY, JSON.stringify(seed));
    expect(readElectionState(storage)).toEqual(seed);
    expect(readElectionState(storage)).not.toBe(seed);
  });
});
