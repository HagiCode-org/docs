import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PRIMARY_INDEX_JSON_URL } from './desktop-utils';
import {
  clearDesktopVersionCache,
  getDesktopVersionData,
} from './version-manager';

const desktopIndexFixture = {
  updatedAt: '2026-03-24T00:00:00Z',
  versions: [
    {
      version: 'v1.2.3',
      assets: [
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
      files: [
        'v1.2.3/Hagicode.Desktop.Setup.1.2.3.exe',
        'v1.2.3/Hagicode.Desktop-1.2.3-arm64.dmg',
        'v1.2.3/Hagicode.Desktop-1.2.3.AppImage',
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

  it('returns a fatal state when the primary payload is invalid', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === PRIMARY_INDEX_JSON_URL) {
        return createJsonResponse({ updatedAt: '2026-03-24T00:00:00Z' });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await getDesktopVersionData();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data.source).toBeNull();
    expect(data.status).toBe('fatal');
    expect(data.latest).toBeNull();
    expect(data.platforms).toEqual([]);
    expect(data.attempts).toEqual([
      expect.objectContaining({ source: 'primary' }),
    ]);
    expect(data.error).toContain('Failed to load desktop versions');
  });

  it('returns a fatal state when every source fails', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      throw new Error(`failed:${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const data = await getDesktopVersionData();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(data.status).toBe('fatal');
    expect(data.source).toBeNull();
    expect(data.latest).toBeNull();
    expect(data.platforms).toEqual([]);
    expect(data.error).toContain('Failed to load desktop versions');
    expect(data.attempts).toHaveLength(1);

    const second = await getDesktopVersionData();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second.status).toBe('fatal');
    expect(second).toBe(data);
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
