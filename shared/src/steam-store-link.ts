export const ABOUT_SNAPSHOT_URL = 'https://index.hagicode.com/about.json';
export const DEFAULT_STEAM_STORE_URL = 'https://store.steampowered.com/app/4625540/Hagicode/';

export interface SteamStoreLinkResult {
  readonly href: string;
  readonly source: 'canonical' | 'fallback';
  readonly updatedAt: string | null;
}

let cachedSteamStoreLinkPromise: Promise<SteamStoreLinkResult> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readSteamHref(payload: unknown): string | null {
  if (!isRecord(payload) || !Array.isArray(payload.entries)) {
    return null;
  }

  const steamEntry = payload.entries.find(
    (entry) =>
      isRecord(entry) &&
      entry.id === 'steam' &&
      entry.type === 'link' &&
      typeof entry.url === 'string' &&
      entry.url.trim().length > 0,
  );

  return isRecord(steamEntry) && typeof steamEntry.url === 'string' ? steamEntry.url : null;
}

function readUpdatedAt(payload: unknown): string | null {
  return isRecord(payload) && typeof payload.updatedAt === 'string' && payload.updatedAt.trim().length > 0
    ? payload.updatedAt
    : null;
}

export function getFallbackSteamStoreLink(): SteamStoreLinkResult {
  return {
    href: DEFAULT_STEAM_STORE_URL,
    source: 'fallback',
    updatedAt: null,
  };
}

async function fetchSteamStoreLinkInternal(fetcher: typeof fetch = fetch): Promise<SteamStoreLinkResult> {
  try {
    const response = await fetcher(ABOUT_SNAPSHOT_URL, {
      cache: 'no-store',
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return getFallbackSteamStoreLink();
    }

    const payload = await response.json();
    return {
      href: readSteamHref(payload) ?? DEFAULT_STEAM_STORE_URL,
      source: readSteamHref(payload) ? 'canonical' : 'fallback',
      updatedAt: readUpdatedAt(payload),
    };
  } catch {
    return getFallbackSteamStoreLink();
  }
}

export function loadSteamStoreLink(fetcher: typeof fetch = fetch): Promise<SteamStoreLinkResult> {
  if (fetcher !== fetch) {
    return fetchSteamStoreLinkInternal(fetcher);
  }

  if (!cachedSteamStoreLinkPromise) {
    cachedSteamStoreLinkPromise = fetchSteamStoreLinkInternal(fetcher);
  }

  return cachedSteamStoreLinkPromise;
}
