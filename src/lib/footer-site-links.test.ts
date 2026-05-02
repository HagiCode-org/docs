import { describe, expect, it } from 'vitest';

import { resolveDocsFooterSiteLinks } from './footer-site-links';

describe('docs footer site links', () => {
  it('localizes related site metadata for English docs routes', () => {
    const links = resolveDocsFooterSiteLinks('en');

    expect(links.find((link) => link.siteId === 'hagicode-main')).toMatchObject({
      title: 'HagiCode Main Site',
      description: 'Primary product entry.',
      href: 'https://hagicode.com/',
    });
  });

  it('falls back through the docs route locale mapping for Traditional Chinese routes', () => {
    const links = resolveDocsFooterSiteLinks('zh-Hant');

    expect(links.find((link) => link.siteId === 'hagicode-main')).toMatchObject({
      title: 'HagiCode 主站',
      description: '產品入口',
      href: 'https://hagicode.com/zh-Hant/',
    });
  });
});
