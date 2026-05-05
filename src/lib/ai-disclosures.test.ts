import { describe, expect, it } from 'vitest';

import { buildAIDisclosureNotices } from './ai-disclosures';

describe('AI disclosure notice resolution', () => {
  it('renders translation before author notices for non-root localized pages', () => {
    expect(
      buildAIDisclosureNotices({
        isAITranslation: true,
        isAIAuthor: true,
        locale: 'ja-JP',
        pathname: '/ja-JP/install/',
      }),
    ).toEqual([
      {
        kind: 'translation',
        sourceHref: '/install/',
      },
      {
        kind: 'author',
      },
    ]);
  });

  it('suppresses the translation notice on root Simplified Chinese pages', () => {
    expect(
      buildAIDisclosureNotices({
        isAITranslation: true,
        isAIAuthor: true,
        locale: 'root',
        pathname: '/install/',
      }),
    ).toEqual([
      {
        kind: 'author',
      },
    ]);
  });

  it('preserves the zh-CN counterpart link for localized blog posts', () => {
    expect(
      buildAIDisclosureNotices({
        isAITranslation: true,
        isAIAuthor: false,
        locale: 'en-US',
        pathname: '/en-US/blog/2026-01-02-example/',
      }),
    ).toEqual([
      {
        kind: 'translation',
        sourceHref: '/blog/2026-01-02-example/',
      },
    ]);
  });

  it('omits notices whose frontmatter flags are disabled', () => {
    expect(
      buildAIDisclosureNotices({
        isAITranslation: false,
        isAIAuthor: false,
        locale: 'fr-FR',
        pathname: '/fr-FR/product-overview/',
      }),
    ).toEqual([]);
  });
});
