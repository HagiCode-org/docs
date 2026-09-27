import { getDocsPromoteFallback } from '@/lib/docs-promote-fallback';
import {
  filterActivePromotions,
  loadPromotions,
  mapDocsLocaleToPromoteLocale,
  type LoadPromotionsOptions,
  type NormalizedPromotion,
  type PromotionImage,
} from '@/lib/promotions';

export interface ActivePromotion {
  id: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
  platform: string | null;
  badgeText: string;
  image: PromotionImage | null;
  source: 'remote' | 'fallback';
  payloadSignature: string;
}

export interface LoadBlogPromotionsOptions extends LoadPromotionsOptions {}

export interface BlogAdProps {
  hideAd?: boolean;
  locale?: string;
  promotions: ActivePromotion[];
}

export interface ResolveBlogAdPropsOptions {
  isBlogPost: boolean;
  hideAd?: boolean;
  locale?: string;
  loadPromotions?: (options: LoadBlogPromotionsOptions) => Promise<ActivePromotion[]>;
}

export function resolveBlogPostVisibility(data?: {
  hideAd?: boolean;
  hideCta?: boolean;
}): { hideAd: boolean; hideCta: boolean } {
  return {
    hideAd: data?.hideAd ?? false,
    hideCta: data?.hideCta ?? false,
  };
}

function buildPayloadSignature(source: ActivePromotion['source'], values: string[]): string {
  return `${source}:${values.map(encodeURIComponent).join('|')}`;
}

function createFallbackPromotion(locale: string | null | undefined): ActivePromotion {
  const fallback = getDocsPromoteFallback(locale);
  return {
    id: fallback.id,
    title: fallback.title,
    description: fallback.description,
    ctaLabel: fallback.ctaLabel,
    link: fallback.link,
    platform: null,
    badgeText: fallback.badgeText,
    image: null,
    source: 'fallback',
    payloadSignature: buildPayloadSignature('fallback', [
      fallback.id,
      fallback.badgeText,
      fallback.title,
      fallback.description,
      fallback.ctaLabel,
      fallback.link,
    ]),
  };
}

function createRemotePromotion(
  promotion: NormalizedPromotion,
  locale: string | null | undefined,
): ActivePromotion {
  const badgeText = promotion.platform ?? (mapDocsLocaleToPromoteLocale(locale) === 'en' ? 'Promoted' : '推荐');
  return {
    id: promotion.id,
    title: promotion.title,
    description: promotion.description,
    ctaLabel: promotion.ctaLabel,
    link: promotion.link,
    platform: promotion.platform,
    badgeText,
    image: promotion.image,
    source: 'remote',
    payloadSignature: buildPayloadSignature('remote', [
      promotion.id,
      badgeText,
      promotion.title,
      promotion.description,
      promotion.ctaLabel,
      promotion.link,
      promotion.image?.src ?? '',
      promotion.image?.alt ?? '',
    ]),
  };
}

// Blog pages resolve promotions during server render and share one result across regions.
export async function loadBlogPromotions(
  options: LoadBlogPromotionsOptions = {},
): Promise<ActivePromotion[]> {
  const promotions = filterActivePromotions(await loadPromotions(options));
  if (promotions.length > 0) {
    return promotions.map((promotion) => createRemotePromotion(promotion, options.locale));
  }
  return [createFallbackPromotion(options.locale)];
}

export function getRenderableBlogPromotions(
  promotions: readonly ActivePromotion[] | null | undefined,
  locale: string | null | undefined,
): ActivePromotion[] {
  if (promotions && promotions.length > 0) {
    return promotions as ActivePromotion[];
  }

  return [createFallbackPromotion(locale)];
}

export async function resolveBlogAdProps(
  options: ResolveBlogAdPropsOptions,
): Promise<BlogAdProps> {
  const { isBlogPost, hideAd = false, locale, loadPromotions = loadBlogPromotions } = options;

  if (!isBlogPost || hideAd) {
    return {
      hideAd,
      locale,
      promotions: [],
    };
  }

  const promotions = getRenderableBlogPromotions(
    await loadPromotions({ locale }),
    locale,
  );

  return {
    hideAd,
    locale,
    promotions,
  };
}
