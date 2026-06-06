export const DEFAULT_WINDOWS_STORE_PRODUCT_ID = '9N3PM0N3SVDW';

export function resolveDocsMicrosoftStoreBadgeLanguage(locale?: 'zh' | 'en'): string {
  return locale === 'zh' ? 'zh-cn' : 'en-us';
}

export function resolveMicrosoftStoreProductId(href?: string): string {
  if (!href) {
    return DEFAULT_WINDOWS_STORE_PRODUCT_ID;
  }

  const match = href.match(/(?:detail|store\/detail)\/([a-z0-9]+)/i);
  return match?.[1]?.toUpperCase() ?? DEFAULT_WINDOWS_STORE_PRODUCT_ID;
}
