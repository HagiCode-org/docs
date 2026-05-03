import { mapDocsLocaleToPromoteLocale } from '@/lib/promotions';

type PromoteLocale = 'zh' | 'en';

export interface DocsPromoteFallbackConfig {
  id: string;
  badgeText: string;
  title: string;
  description: string;
  ctaLabel: string;
  link: string;
}

const DOCS_PROMOTE_FALLBACKS: Record<PromoteLocale, DocsPromoteFallbackConfig> = {
  zh: {
    id: 'docs-product-overview-fallback-zh',
    badgeText: '文档',
    title: '查看 HagiCode 产品概览',
    description: '从文档入口快速了解产品能力、版本关系与常见上手路径。',
    ctaLabel: '查看文档',
    link: '/product-overview/',
  },
  en: {
    id: 'docs-product-overview-fallback-en',
    badgeText: 'Docs',
    title: 'Explore the HagiCode Product Overview',
    description: 'Open the docs entry for product capabilities, editions, and setup paths.',
    ctaLabel: 'Open Docs',
    link: '/en-US/product-overview/',
  },
};

export function getDocsPromoteFallback(
  locale: string | null | undefined,
): DocsPromoteFallbackConfig {
  const promoteLocale = mapDocsLocaleToPromoteLocale(locale);
  return DOCS_PROMOTE_FALLBACKS[promoteLocale];
}
