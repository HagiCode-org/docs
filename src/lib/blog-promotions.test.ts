import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearPromotionDocumentCache } from './docs-promote-banner';
import {
  getRenderableBlogPromotions,
  loadBlogPromotions,
  resolveBlogAdProps,
  type ActivePromotion,
} from './blog-promotions';

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
  options: {
    useCatalogEntries?: boolean;
    fail?: boolean;
  } = {},
) {
  return vi.fn(async (input: RequestInfo | URL) => {
    if (options.fail) {
      throw new Error('network failed');
    }

    const url = input.toString();

    if (url.endsWith('/index-catalog.json')) {
      return jsonResponse({
        entries: options.useCatalogEntries === false
          ? []
          : [
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
          cta: {
            zh: promotion.ctaZh ?? '立即前往',
            en: promotion.ctaEn ?? 'Go now',
          },
          link: promotion.link ?? 'https://example.invalid/default',
          targetPlatform: promotion.platform,
          image: promotion.image,
        })),
      });
    }

    throw new Error(`Unexpected fetch: ${url}`);
  });
}

describe('blog promotions', () => {
  afterEach(() => {
    clearPromotionDocumentCache();
  });

  it('loads canonical index promotions for blog ads and keeps fallback endpoints valid', async () => {
    const promotions = await loadBlogPromotions({
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
      ], { useCatalogEntries: false }) as typeof fetch,
    });

    expect(promotions).toEqual([
      expect.objectContaining({
        id: 'builder',
        title: 'Try the Builder',
        ctaLabel: 'Open Builder',
        link: 'https://builder.hagicode.com/',
        source: 'remote',
      }),
    ]);
  });

  it('keeps remote image metadata for blog promo rendering', async () => {
    const promotions = await loadBlogPromotions({
      locale: 'en',
      fetchImpl: createPromotionFetch([
        {
          id: 'main-game',
          titleEn: 'Wishlist Now',
          descriptionEn: 'Coming soon.',
          ctaEn: 'Wishlist',
          link: 'https://store.steampowered.com/app/4625540/Hagicode/',
          platform: 'steam',
          image: {
            src: '/images/promotions/main-game.webp',
            alt: 'HagiCode Steam artwork',
            width: 640,
            height: 360,
          },
        },
      ]) as typeof fetch,
    });

    expect(promotions[0]).toEqual(expect.objectContaining({
      image: {
        src: 'https://index.hagicode.com/images/promotions/main-game.webp',
        alt: 'HagiCode Steam artwork',
        width: 640,
        height: 360,
      },
    }));
  });

  it('returns locale-aware fallback blog promotions when remote data is unavailable', async () => {
    const blogAdProps = await resolveBlogAdProps({
      isBlogPost: true,
      locale: 'zh-CN',
      loadPromotions: async () => [],
    });

    expect(blogAdProps.promotions).toEqual([
      expect.objectContaining({
        id: 'docs-product-overview-fallback-zh',
        title: '查看 HagiCode 产品概览',
        ctaLabel: '查看文档',
        source: 'fallback',
      }),
    ]);
  });

  it('keeps hideAd behavior by skipping promotion loading for hidden blog ads', async () => {
    const loadPromotions = vi.fn(async (): Promise<ActivePromotion[]> => [{
      id: 'unexpected',
      title: 'Unexpected',
      description: 'Unexpected',
      ctaLabel: 'Open',
      link: 'https://example.invalid/unexpected',
      platform: null,
      badgeText: 'Promo',
      image: null,
      source: 'remote',
      payloadSignature: 'remote:unexpected',
    }]);

    const blogAdProps = await resolveBlogAdProps({
      isBlogPost: true,
      hideAd: true,
      locale: 'en',
      loadPromotions,
    });

    expect(loadPromotions).not.toHaveBeenCalled();
    expect(blogAdProps).toEqual({
      hideAd: true,
      locale: 'en',
      promotions: [],
    });
  });

  it('reuses the same resolved promotion set for both blog ad regions', async () => {
    const resolvedPromotions: ActivePromotion[] = [{
      id: 'shared-campaign',
      title: 'Shared campaign',
      description: 'One page render should share one normalized promotion set.',
      ctaLabel: 'Open',
      link: 'https://example.invalid/shared-campaign',
      platform: 'web',
      badgeText: 'web',
      image: null,
      source: 'remote',
      payloadSignature: 'remote:shared-campaign',
    }];
    const loadPromotions = vi.fn(async () => resolvedPromotions);

    const blogAdProps = await resolveBlogAdProps({
      isBlogPost: true,
      locale: 'en',
      loadPromotions,
    });

    expect(loadPromotions).toHaveBeenCalledOnce();
    expect(blogAdProps.promotions).toBe(resolvedPromotions);
    expect(getRenderableBlogPromotions(blogAdProps.promotions, 'en')).toBe(resolvedPromotions);

    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const markdownContentSource = readFileSync(
      path.resolve(currentDir, '../components/MarkdownContent.astro'),
      'utf8',
    );
    const blogHeaderSource = readFileSync(
      path.resolve(currentDir, '../components/BlogHeaderAd.astro'),
      'utf8',
    );
    const blogFooterSource = readFileSync(
      path.resolve(currentDir, '../components/BlogFooterAd.astro'),
      'utf8',
    );

    expect(markdownContentSource).toContain('const blogAdProps = await resolveBlogAdProps({');
    expect(markdownContentSource).toContain('<BlogHeaderAd {...blogAdProps} />');
    expect(markdownContentSource).toContain('<BlogFooterAd {...blogAdProps} />');
    expect(blogHeaderSource).toContain('promo.image ? (');
    expect(blogFooterSource).toContain('promo.image ? (');
    expect(blogFooterSource).not.toContain('dockerComposeUrl');
  });
});
