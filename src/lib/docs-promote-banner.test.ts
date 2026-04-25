import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearPromotionDocumentCache,
  loadActivePromotions,
  loadPromotionDocuments,
  mapDocsLocaleToPromoteLocale,
  normalizeActivePromotions,
  resolvePromotionDocumentUrls,
} from './docs-promote-banner';

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'content-type': 'application/json',
    },
  });
}

describe('docs promote banner source', () => {
  afterEach(() => {
    clearPromotionDocumentCache();
  });

  it('falls back to canonical promote endpoints when the catalog cannot resolve promotion entries', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.endsWith('/index-catalog.json')) {
        return jsonResponse({
          version: '1.0.0',
          entries: [],
        });
      }

      if (url.endsWith('/promote.json')) {
        return jsonResponse({
          promotes: [{ id: 'main-game', on: true }],
        });
      }

      if (url.endsWith('/promote_content.json')) {
        return jsonResponse({
          contents: [{
            id: 'main-game',
            title: { zh: '立即添加到愿望单', en: 'Wishlist Now' },
            description: {
              zh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
              en: 'Coming April 29, 2026. Add to your Steam wishlist now!',
            },
            link: 'https://store.steampowered.com/app/4625540/Hagicode/',
            targetPlatform: 'steam',
          }],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const urls = await resolvePromotionDocumentUrls(fetchMock);
    const documents = await loadPromotionDocuments({ fetchImpl: fetchMock });

    expect(urls).toMatchObject({
      flagsUrl: 'https://index.hagicode.com/promote.json',
      contentUrl: 'https://index.hagicode.com/promote_content.json',
      source: 'fallback',
    });
    expect(documents.urls.source).toBe('fallback');
    expect(documents.flags.promotes).toEqual([{ id: 'main-game', on: true }]);
    expect(documents.content.contents).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://index.hagicode.com/index-catalog.json',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          accept: 'application/json',
        }),
      }),
    );
  });

  it('uses catalog-provided endpoints when they are published', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.endsWith('/index-catalog.json')) {
        return jsonResponse({
          entries: [
            { id: 'promotion-flags', path: '/promote.json' },
            { id: 'promotion-content', path: '/promote_content.json' },
          ],
        });
      }

      if (url.endsWith('/promote.json')) {
        return jsonResponse({ promotes: [] });
      }

      if (url.endsWith('/promote_content.json')) {
        return jsonResponse({ contents: [] });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const urls = await resolvePromotionDocumentUrls(fetchMock);

    expect(urls).toEqual({
      flagsUrl: 'https://index.hagicode.com/promote.json',
      contentUrl: 'https://index.hagicode.com/promote_content.json',
      source: 'catalog',
    });
  });

  it('keeps only enabled promotions with matching content and localizes fields for docs locales', () => {
    const promotions = normalizeActivePromotions(
      {
        promotes: [
          { id: 'main-game', on: true },
          { id: 'missing-copy', on: true },
          { id: 'hidden-entry', on: false },
        ],
      },
      {
        contents: [
          {
            id: 'main-game',
            title: { zh: '立即添加到愿望单', en: 'Wishlist Now' },
            description: {
              zh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
              en: 'Coming April 29, 2026. Add to your Steam wishlist now!',
            },
            link: 'https://store.steampowered.com/app/4625540/Hagicode/',
            targetPlatform: 'steam',
          },
          {
            id: 'hidden-entry',
            title: { zh: '不应显示', en: 'Hidden' },
            description: { zh: '关闭条目', en: 'Disabled entry' },
            link: 'https://example.com/hidden',
          },
        ],
      },
      'en-US',
    );

    expect(promotions).toEqual([
      {
        id: 'main-game',
        title: 'Wishlist Now',
        description: 'Coming April 29, 2026. Add to your Steam wishlist now!',
        link: 'https://store.steampowered.com/app/4625540/Hagicode/',
        platform: 'Steam',
      },
    ]);
    expect(mapDocsLocaleToPromoteLocale('zh-CN')).toBe('zh');
    expect(mapDocsLocaleToPromoteLocale('en')).toBe('en');
  });

  it('keeps pre-start promotions hidden until their window begins', async () => {
    const fetchMock = createScheduleFetch([
      {
        id: 'future',
        on: true,
        startTime: '2026-04-29T00:00:00+08:00',
        titleEn: 'Future promotion',
      },
    ]);

    await expect(loadActivePromotions({
      locale: 'en',
      fetchImpl: fetchMock,
      now: Date.parse('2026-04-28T23:59:59+08:00'),
    })).resolves.toEqual([]);
  });

  it('removes post-end promotions and swaps cleanly at the exact boundary', async () => {
    const fetchMock = createScheduleFetch([
      {
        id: 'main-game-2026-04-29',
        on: true,
        endTime: '2026-04-29T00:00:00+08:00',
        titleEn: 'Wishlist Now',
      },
      {
        id: 'main-game-steam-ea-2026-04-29',
        on: true,
        startTime: '2026-04-29T00:00:00+08:00',
        titleEn: 'Early Access Is Live',
      },
    ]);

    const before = await loadActivePromotions({
      locale: 'en',
      fetchImpl: fetchMock,
      now: Date.parse('2026-04-28T23:59:59+08:00'),
    });
    const atBoundary = await loadActivePromotions({
      locale: 'en',
      fetchImpl: fetchMock,
      now: Date.parse('2026-04-29T00:00:00+08:00'),
    });

    expect(before.map((promotion) => promotion.id)).toEqual(['main-game-2026-04-29']);
    expect(atBoundary.map((promotion) => promotion.id)).toEqual(['main-game-steam-ea-2026-04-29']);
  });

  it('fails closed for invalid schedule values while preserving valid entries', async () => {
    const fetchMock = createScheduleFetch([
      {
        id: 'broken-start',
        on: true,
        startTime: 'not-a-date',
        titleEn: 'Broken start',
      },
      {
        id: 'broken-range',
        on: true,
        startTime: '2026-04-29T00:00:01+08:00',
        endTime: '2026-04-28T23:59:59+08:00',
        titleEn: 'Broken range',
      },
      {
        id: 'valid',
        on: true,
        titleEn: 'Valid',
      },
    ]);

    const promotions = await loadActivePromotions({
      locale: 'en',
      fetchImpl: fetchMock,
      now: Date.parse('2026-04-29T00:00:00+08:00'),
    });

    expect(promotions.map((promotion) => promotion.id)).toEqual(['valid']);
  });

  it('returns a hidden-state empty list when promote payloads are invalid', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.endsWith('/index-catalog.json')) {
        return new Response('<html>not-json</html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
          },
        });
      }

      if (url.endsWith('/promote.json') || url.endsWith('/promote_content.json')) {
        return new Response('<html>not-json</html>', {
          status: 200,
          headers: {
            'content-type': 'text/html',
          },
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    await expect(loadActivePromotions({ locale: 'zh-CN', fetchImpl: fetchMock })).resolves.toEqual([]);
  });

  it('does not reuse stale promotions when a later request returns html instead of json', async () => {
    let responseMode: 'json' | 'html' = 'json';

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = input.toString();

      if (url.endsWith('/index-catalog.json')) {
        if (responseMode === 'html') {
          return new Response('<html>catalog down</html>', {
            status: 200,
            headers: {
              'content-type': 'text/html',
            },
          });
        }

        return jsonResponse({
          entries: [
            { id: 'promotion-flags', path: '/promote.json' },
            { id: 'promotion-content', path: '/promote_content.json' },
          ],
        });
      }

      if (url.endsWith('/promote.json')) {
        if (responseMode === 'html') {
          return new Response('<html>promote down</html>', {
            status: 200,
            headers: {
              'content-type': 'text/html',
            },
          });
        }

        return jsonResponse({
          promotes: [{ id: 'main-game', on: true }],
        });
      }

      if (url.endsWith('/promote_content.json')) {
        if (responseMode === 'html') {
          return new Response('<html>content down</html>', {
            status: 200,
            headers: {
              'content-type': 'text/html',
            },
          });
        }

        return jsonResponse({
          contents: [{
            id: 'main-game',
            title: { zh: '立即添加到愿望单', en: 'Wishlist Now' },
            description: {
              zh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
              en: 'Coming April 29, 2026. Add to your Steam wishlist now!',
            },
            link: 'https://store.steampowered.com/app/4625540/Hagicode/',
            targetPlatform: 'steam',
          }],
        });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock as typeof fetch);

    await expect(loadActivePromotions({ locale: 'en' })).resolves.toEqual([
      {
        id: 'main-game',
        title: 'Wishlist Now',
        description: 'Coming April 29, 2026. Add to your Steam wishlist now!',
        link: 'https://store.steampowered.com/app/4625540/Hagicode/',
        platform: 'Steam',
      },
    ]);

    responseMode = 'html';

    await expect(loadActivePromotions({ locale: 'en' })).resolves.toEqual([]);
  });
});

function createScheduleFetch(promotions: Array<{
  id: string;
  on?: boolean;
  startTime?: string;
  endTime?: string;
  titleEn: string;
}>) {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.endsWith('/index-catalog.json')) {
      return jsonResponse({
        entries: [
          { id: 'promotion-flags', path: '/promote.json' },
          { id: 'promotion-content', path: '/promote_content.json' },
        ],
      });
    }

    if (url.endsWith('/promote.json')) {
      return jsonResponse({
        promotes: promotions.map((promotion) => ({
          id: promotion.id,
          on: promotion.on ?? true,
          startTime: promotion.startTime,
          endTime: promotion.endTime,
        })),
      });
    }

    if (url.endsWith('/promote_content.json')) {
      return jsonResponse({
        contents: promotions.map((promotion) => ({
          id: promotion.id,
          title: { zh: promotion.titleEn, en: promotion.titleEn },
          description: { zh: promotion.titleEn, en: promotion.titleEn },
          link: `https://example.invalid/${promotion.id}`,
          targetPlatform: 'steam',
        })),
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}
