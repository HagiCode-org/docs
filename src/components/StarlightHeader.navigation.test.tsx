import { describe, expect, it } from 'vitest';
import { getLinkWithLocale } from '@shared/links';
import { getLocalizedNavLinks } from '@/config/navigation';
import { DOCS_LOCALE_METADATA, buildDocsRoutePath } from '@/lib/i18n';

describe('docs navigation support entry', () => {
  it('localizes the unified support label while keeping the canonical about link', () => {
    const chineseLinks = getLocalizedNavLinks('zh-CN');
    const englishLinks = getLocalizedNavLinks('en');

    const chineseSupportLink = chineseLinks.find((link) => link.linkKey === 'about');
    const englishSupportLink = englishLinks.find((link) => link.linkKey === 'about');

    expect(chineseSupportLink).toMatchObject({
      href: getLinkWithLocale('about', 'zh-CN'),
      displayLabel: '获取技术支持',
      icon: 'comment',
      linkKey: 'about',
    });
    expect(englishSupportLink).toMatchObject({
      href: getLinkWithLocale('about', 'en'),
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

  it('removes the builder/deployment-generator entry from the header navigation', () => {
    const chineseBuilderLink = getLocalizedNavLinks('zh-CN').find((link) => link.href === 'https://builder.hagicode.com/');
    const englishBuilderLink = getLocalizedNavLinks('en').find((link) => link.href === 'https://builder.hagicode.com/');

    expect(chineseBuilderLink).toBeUndefined();
    expect(englishBuilderLink).toBeUndefined();
  });

  it('provides localized header labels for every supported docs locale', () => {
    const locales = DOCS_LOCALE_METADATA.map((locale) => locale.code);

    for (const locale of locales) {
      const localizedLinks = getLocalizedNavLinks(locale);

      expect(localizedLinks).toHaveLength(3);
      expect(localizedLinks.every((link) => link.displayLabel.trim().length > 0)).toBe(true);
      expect(localizedLinks.find((link) => link.linkKey === 'blog')?.href).toBe(
        buildDocsRoutePath(locale, '/blog/'),
      );
    }
  });
});
