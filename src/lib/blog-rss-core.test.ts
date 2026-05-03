import { describe, expect, it } from 'vitest';

import { BLOG_LANGUAGE_CODES } from './blog-i18n';
import {
  BLOG_RSS_POST_LIMIT,
  filterAndSortBlogRssPosts,
  getFeedMetadata,
  normalizeBlogPostLanguage,
  type RssBlogPostInput,
} from './blog-rss-core';

function createPost(
  id: string,
  date: string,
  language?: string,
): RssBlogPostInput {
  return {
    id,
    data: {
      title: id,
      date: new Date(date),
      language,
    },
  };
}

describe('blog RSS helpers', () => {
  it.each([
    ['blog/2026-04-29-example', undefined, 'zh-CN'],
    ['zh-Hant/blog/2026-04-29-example', undefined, 'zh-Hant'],
    ['en-US/blog/2026-04-29-example', undefined, 'en-US'],
    ['ja-JP/blog/2026-04-29-example', undefined, 'ja-JP'],
    ['ko-KR/blog/2026-04-29-example', undefined, 'ko-KR'],
    ['de-DE/blog/2026-04-29-example', undefined, 'de-DE'],
    ['fr-FR/blog/2026-04-29-example', undefined, 'fr-FR'],
    ['es-ES/blog/2026-04-29-example', undefined, 'es-ES'],
    ['pt-BR/blog/2026-04-29-example', undefined, 'pt-BR'],
    ['ru-RU/blog/2026-04-29-example', undefined, 'ru-RU'],
    ['en-US/blog/2026-04-29-alias', 'en-GB', 'en-US'],
    ['zh-Hant/blog/2026-04-29-alias', 'zh-TW', 'zh-Hant'],
  ] as const)('normalizes %s with %s to %s', (id, language, expected) => {
    expect(
      normalizeBlogPostLanguage({
        id,
        data: {
          title: id,
          language,
        },
      }),
    ).toBe(expected);
  });

  it('rejects unsupported explicit language metadata', () => {
    expect(() =>
      normalizeBlogPostLanguage({
        id: 'en-US/blog/2026-04-29-invalid',
        data: {
          title: 'invalid',
          language: 'it-IT',
        },
      }),
    ).toThrow(/Unsupported blog language "it-IT"/);
  });

  it('filters posts by desktop language scope and preserves normalized item language', () => {
    const posts = [
      createPost('blog/2026-04-01-root', '2026-04-01T00:00:00.000Z'),
      createPost('zh-Hant/blog/2026-04-02-zht', '2026-04-02T00:00:00.000Z'),
      createPost('en-US/blog/2026-04-03-en', '2026-04-03T00:00:00.000Z'),
      createPost('ja-JP/blog/2026-04-04-ja', '2026-04-04T00:00:00.000Z'),
      createPost('ko-KR/blog/2026-04-05-ko', '2026-04-05T00:00:00.000Z'),
      createPost('de-DE/blog/2026-04-06-de', '2026-04-06T00:00:00.000Z'),
      createPost('fr-FR/blog/2026-04-07-fr', '2026-04-07T00:00:00.000Z'),
      createPost('es-ES/blog/2026-04-08-es', '2026-04-08T00:00:00.000Z'),
      createPost('pt-BR/blog/2026-04-09-pt', '2026-04-09T00:00:00.000Z'),
      createPost('ru-RU/blog/2026-04-10-ru', '2026-04-10T00:00:00.000Z'),
    ];

    const allPosts = filterAndSortBlogRssPosts(posts, 'all');
    expect(allPosts.map((post) => post.language)).toEqual([
      'ru-RU',
      'pt-BR',
      'es-ES',
      'fr-FR',
      'de-DE',
      'ko-KR',
      'ja-JP',
      'en-US',
      'zh-Hant',
      'zh-CN',
    ]);

    for (const language of BLOG_LANGUAGE_CODES) {
      const scopedPosts = filterAndSortBlogRssPosts(posts, language);
      expect(scopedPosts).toHaveLength(1);
      expect(scopedPosts[0]?.language).toBe(language);
    }
  });

  it('applies the item limit after filtering by language scope', () => {
    const englishPosts = Array.from({ length: BLOG_RSS_POST_LIMIT + 5 }, (_, index) =>
      createPost(
        `en-US/blog/2026-04-${String(index + 1).padStart(2, '0')}-english-${index}`,
        `2026-04-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      ),
    );
    const chinesePost = createPost('blog/2026-03-01-chinese', '2026-03-01T00:00:00.000Z');
    const posts = [...englishPosts, chinesePost];

    expect(filterAndSortBlogRssPosts(posts, 'en-US')).toHaveLength(BLOG_RSS_POST_LIMIT);
    expect(filterAndSortBlogRssPosts(posts, 'zh-CN')).toHaveLength(1);
  });

  it('returns desktop-aligned feed metadata for all and per-language feeds', () => {
    expect(getFeedMetadata('all')).toEqual({
      title: 'Hagicode Docs | Blog',
      description: 'Hagicode project documentation blog posts in every supported language',
      language: 'all',
    });

    expect(getFeedMetadata('zh-CN')).toEqual({
      title: 'Hagicode Docs | 简体中文 Blog',
      description: '简体中文 posts from the HagiCode documentation blog',
      language: 'zh-CN',
    });

    expect(getFeedMetadata('en-US')).toEqual({
      title: 'Hagicode Docs | English Blog',
      description: 'English posts from the HagiCode documentation blog',
      language: 'en-US',
    });
  });
});
