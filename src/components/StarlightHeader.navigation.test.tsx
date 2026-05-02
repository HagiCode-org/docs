import { describe, expect, it } from 'vitest';
import { getLink } from '@shared/links';
import { getLocalizedNavLinks } from '@/config/navigation';
import { DOCS_LOCALE_METADATA, buildDocsRoutePath } from '@/lib/i18n';

describe('docs navigation support entry', () => {
  it('localizes the unified support label while keeping the canonical about link', () => {
    const chineseLinks = getLocalizedNavLinks('zh-CN');
    const englishLinks = getLocalizedNavLinks('en');

    const chineseSupportLink = chineseLinks.find((link) => link.linkKey === 'about');
    const englishSupportLink = englishLinks.find((link) => link.linkKey === 'about');

    expect(chineseSupportLink).toMatchObject({
      href: getLink('about'),
      displayLabel: '获取技术支持',
      icon: 'comment',
      linkKey: 'about',
    });
    expect(englishSupportLink).toMatchObject({
      href: getLink('about'),
      displayLabel: 'Get Support',
      icon: 'comment',
      linkKey: 'about',
    });
  });

  it('removes the old header-level qq and discord links', () => {
    const linkKeys = getLocalizedNavLinks('en').map((link) => link.linkKey);

    expect(linkKeys).toContain('about');
    expect(linkKeys).not.toContain('qqGroup');
    expect(linkKeys).not.toContain('discord');
  });

  it('exposes the builder site as a crawlable header path in both locales', () => {
    const chineseBuilderLink = getLocalizedNavLinks('zh-CN').find((link) => link.href === 'https://builder.hagicode.com/');
    const englishBuilderLink = getLocalizedNavLinks('en').find((link) => link.href === 'https://builder.hagicode.com/');

    expect(chineseBuilderLink).toMatchObject({
      href: 'https://builder.hagicode.com/',
      displayLabel: '部署生成器',
    });
    expect(englishBuilderLink).toMatchObject({
      href: 'https://builder.hagicode.com/',
      displayLabel: 'Builder',
    });
  });

  it('provides localized header labels for every supported docs locale', () => {
    const locales = DOCS_LOCALE_METADATA.map((locale) => locale.code);

    for (const locale of locales) {
      const localizedLinks = getLocalizedNavLinks(locale);

      expect(localizedLinks).toHaveLength(4);
      expect(localizedLinks.every((link) => link.displayLabel.trim().length > 0)).toBe(true);
      expect(localizedLinks.find((link) => link.linkKey === 'blog')?.href).toBe(
        buildDocsRoutePath(locale, '/blog/'),
      );
    }
  });
});
