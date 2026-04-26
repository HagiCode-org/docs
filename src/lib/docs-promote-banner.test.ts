import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearPromotionDocumentCache,
  createFallbackPromotion,
  getPromotionSetSignature,
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

function createPromotionFetch(
  promotions: Array<{
    id: string;
    on?: boolean;
    startTime?: string;
    endTime?: string;
    titleZh?: string;
    titleEn?: string;
    descriptionZh?: string;
    descriptionEn?: string;
    ctaZh?: string;
    ctaEn?: string;
    link?: string;
    platform?: string;
    image?: string | {
      src?: string;
      alt?: string;
      width?: number;
      height?: number;
    };
  }>,
) {
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
          title: {
            zh: promotion.titleZh ?? '默认中文标题',
            en: promotion.titleEn ?? 'Default title',
          },
          description: {
            zh: promotion.descriptionZh ?? '默认中文描述',
            en: promotion.descriptionEn ?? 'Default description',
          },
          cta: promotion.ctaZh || promotion.ctaEn
            ? {
                zh: promotion.ctaZh,
                en: promotion.ctaEn,
              }
            : undefined,
          link: promotion.link ?? 'https://example.invalid/default',
          targetPlatform: promotion.platform,
          image: promotion.image,
        })),
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
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
        return jsonResponse({ version: '1.0.0', entries: [] });
      }

      if (url.endsWith('/promote.json')) {
        return jsonResponse({ promotes: [{ id: 'main-game', on: true }] });
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
            cta: { zh: '加入愿望单', en: 'Wishlist on Steam' },
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
  });

  it('uses the first eligible active remote promotion set when remote data is available', () => {
    const promotions = normalizeActivePromotions(
      {
        promotes: [
          { id: 'main-game', on: true },
          { id: 'disabled-entry', on: false },
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
            cta: { zh: '加入愿望单', en: 'Wishlist on Steam' },
            link: 'https://store.steampowered.com/app/4625540/Hagicode/',
            targetPlatform: 'steam',
            image: {
              src: '/images/promotions/main-game.webp',
              alt: 'HagiCode Steam artwork',
              width: 640,
              height: 640,
            },
          },
        ],
      },
      'en-US',
    );

    expect(promotions).toEqual([
      expect.objectContaining({
        id: 'main-game',
        title: 'Wishlist Now',
        ctaLabel: 'Wishlist on Steam',
        badgeText: 'Steam',
        image: {
          src: 'https://index.hagicode.com/images/promotions/main-game.webp',
          alt: 'HagiCode Steam artwork',
          width: 640,
          height: 640,
        },
        source: 'remote',
      }),
    ]);
    expect(mapDocsLocaleToPromoteLocale('zh-CN')).toBe('zh');
    expect(mapDocsLocaleToPromoteLocale('en')).toBe('en');
  });

  it('returns the localized fallback card when no active remote promotion exists', async () => {
    const promotions = await loadActivePromotions({
      locale: 'zh-CN',
      fetchImpl: createPromotionFetch([
        {
          id: 'future-entry',
          on: true,
          startTime: '2026-04-29T00:00:00+08:00',
          titleZh: '未来推广',
          titleEn: 'Future promotion',
        },
      ]) as typeof fetch,
      now: Date.parse('2026-04-28T23:59:59+08:00'),
    });

    expect(promotions).toEqual([
      expect.objectContaining({
        id: 'docs-product-overview-fallback-zh',
        badgeText: '文档',
        title: '查看 HagiCode 产品概览',
        link: '/product-overview/',
        source: 'fallback',
      }),
    ]);
  });

  it('returns the localized fallback card when remote promotion fetch fails', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network failed');
    });

    await expect(loadActivePromotions({
      locale: 'en',
      fetchImpl: fetchMock as typeof fetch,
    })).resolves.toEqual([
      expect.objectContaining({
        id: 'docs-product-overview-fallback-en',
        badgeText: 'Docs',
        title: 'Explore the HagiCode Product Overview',
        link: '/en/product-overview/',
        source: 'fallback',
      }),
    ]);
  });

  it('distinguishes fallback dismissal signatures from later remote campaign signatures', async () => {
    const fallback = createFallbackPromotion('en');
    const remote = await loadActivePromotions({
      locale: 'en',
      fetchImpl: createPromotionFetch([
        {
          id: 'builder',
          titleZh: '体验部署生成器',
          titleEn: 'Try the Builder',
          descriptionZh: '使用 Docker Compose Builder 快速生成部署配置。',
          descriptionEn: 'Generate Docker Compose deployment files with the Builder.',
          ctaZh: '立即体验',
          ctaEn: 'Open Builder',
          link: 'https://builder.hagicode.com/',
          platform: 'web',
        },
      ]) as typeof fetch,
    });

    expect(getPromotionSetSignature([fallback])).not.toBe(getPromotionSetSignature(remote));
    expect(getPromotionSetSignature([fallback])).toBe(getPromotionSetSignature([createFallbackPromotion('en')]));
  });

  it('keeps remote promotion image metadata so the banner can render it', async () => {
    const promotions = await loadActivePromotions({
      locale: 'en',
      fetchImpl: createPromotionFetch([
        {
          id: 'main-game',
          titleZh: '立即添加到愿望单',
          titleEn: 'Wishlist Now',
          descriptionZh: '游戏将于 2026-04-29 发售，立即前往 Steam 添加愿望单。',
          descriptionEn: 'Coming April 29, 2026. Add to your Steam wishlist now!',
          link: 'https://store.steampowered.com/app/4625540/Hagicode/',
          platform: 'steam',
          image: {
            src: '/images/promotions/main-game.webp',
            width: 640,
            height: 360,
          },
        },
      ]) as typeof fetch,
    });

    expect(promotions[0]).toEqual(expect.objectContaining({
      image: {
        src: 'https://index.hagicode.com/images/promotions/main-game.webp',
        alt: 'Wishlist Now',
        width: 640,
        height: 360,
      },
    }));
  });
});
