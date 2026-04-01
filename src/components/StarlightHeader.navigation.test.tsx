import { describe, expect, it } from 'vitest';
import { getLink } from '@shared/links';
import { getLocalizedNavLinks } from '@/config/navigation';

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
});
