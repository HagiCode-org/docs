import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BACKUP_INDEX_JSON_URL,
  LOCAL_VERSION_INDEX,
  PRIMARY_INDEX_JSON_URL,
} from './desktop-utils';
import {
  clearDesktopVersionCache,
  getDesktopVersionData,
} from './version-manager';

const desktopIndexFixture = {
  updatedAt: '2026-03-24T00:00:00Z',
  versions: [
    {
      version: 'v1.2.3',
      files: [
        {
          name: 'Hagicode.Desktop.Setup.1.2.3.exe',
          path: 'v1.2.3/Hagicode.Desktop.Setup.1.2.3.exe',
          size: 1048576,
          lastModified: null,
        },
        {
          name: 'Hagicode.Desktop-1.2.3-arm64.dmg',
          path: 'v1.2.3/Hagicode.Desktop-1.2.3-arm64.dmg',
          size: 1048576,
          lastModified: null,
        },
        {
          name: 'Hagicode.Desktop-1.2.3.AppImage',
          path: 'v1.2.3/Hagicode.Desktop-1.2.3.AppImage',
          size: 1048576,
          lastModified: null,
        },
      ],
    },
  ],
  channels: {
    stable: { latest: 'v1.2.3', versions: ['v1.2.3'] },
    beta: { latest: 'v1.2.3', versions: ['v1.2.3'] },
  },
};

function createJsonResponse(body: unknown, options?: { ok?: boolean; status?: number; statusText?: string }) {
  return {
    ok: options?.ok ?? true,
    status: options?.status ?? 200,
    statusText: options?.statusText ?? 'OK',
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('docs runtime index fetching', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {});
  });

  afterEach(() => {
    clearDesktopVersionCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('uses the primary source and reuses the cached result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(createJsonResponse(structuredClone(desktopIndexFixture)));
    vi.stubGlobal('fetch', fetchMock);

    const first = await getDesktopVersionData();
    const second = await getDesktopVersionData();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      PRIMARY_INDEX_JSON_URL,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(first).toBe(second);
    expect(first.source).toBe('primary');
    expect(first.status).toBe('ready');
    expect(first.attempts).toEqual([]);
    expect(first.latest?.version).toBe('v1.2.3');
    expect(first.platforms).toHaveLength(3);
  });

  it('falls back to the backup source when the primary payload is invalid', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === PRIMARY_INDEX_JSON_URL) {
        return createJsonResponse({ updatedAt: '2026-03-24T00:00:00Z' });
      }

      if (url === BACKUP_INDEX_JSON_URL) {
        return createJsonResponse(structuredClone(desktopIndexFixture));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await getDesktopVersionData();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(data.source).toBe('backup');
    expect(data.status).toBe('degraded');
    expect(data.attempts).toEqual([
      expect.objectContaining({ source: 'primary' }),
    ]);
    expect(data.error).toBeNull();
  });

  it('falls back to the local snapshot after both remote sources fail', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === PRIMARY_INDEX_JSON_URL) {
        throw new Error('primary down');
      }

      if (url === BACKUP_INDEX_JSON_URL) {
        return createJsonResponse({}, { ok: false, status: 503, statusText: 'Service Unavailable' });
      }

      if (url === LOCAL_VERSION_INDEX) {
        return createJsonResponse(structuredClone(desktopIndexFixture));
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await getDesktopVersionData();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(data.source).toBe('local');
    expect(data.status).toBe('local_snapshot');
    expect(data.attempts).toEqual([
      expect.objectContaining({ source: 'primary', error: 'primary down' }),
      expect.objectContaining({ source: 'backup' }),
    ]);
    expect(data.latest?.version).toBe('v1.2.3');
  });

  it('returns a fatal state when every source fails', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      throw new Error(`failed:${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await getDesktopVersionData();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(data.status).toBe('fatal');
    expect(data.source).toBeNull();
    expect(data.latest).toBeNull();
    expect(data.platforms).toEqual([]);
    expect(data.error).toContain('Failed to load desktop versions');
    expect(data.attempts).toHaveLength(3);

    const second = await getDesktopVersionData();
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(second.status).toBe('fatal');
  });

  it('deduplicates concurrent in-flight requests', async () => {
    let resolveResponse: (value: ReturnType<typeof createJsonResponse>) => void = () => {};
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise<ReturnType<typeof createJsonResponse>>((resolve) => {
          resolveResponse = resolve;
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const pending = Promise.all([
      getDesktopVersionData(),
      getDesktopVersionData(),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveResponse(createJsonResponse(structuredClone(desktopIndexFixture)));

    const [first, second] = await pending;
    expect(first).toBe(second);
    expect(first.source).toBe('primary');
  });
});
