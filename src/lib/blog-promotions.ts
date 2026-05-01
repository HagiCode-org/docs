import {
  createFallbackPromotion,
  loadActivePromotions,
  type ActivePromotion,
  type LoadActivePromotionsOptions,
} from '@/lib/docs-promote-banner';

export type { ActivePromotion } from '@/lib/docs-promote-banner';

export interface LoadBlogPromotionsOptions extends LoadActivePromotionsOptions {}

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

// Blog pages resolve promotions during server render and share one result across regions.
export async function loadBlogPromotions(
  options: LoadBlogPromotionsOptions = {},
): Promise<ActivePromotion[]> {
  return loadActivePromotions(options);
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
