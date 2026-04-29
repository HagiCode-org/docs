import { describe, expect, it } from 'vitest';

import {
  BLOG_LANGUAGE_CODES,
  BLOG_LANGUAGE_OPTIONS,
  buildBlogPostRoutePath,
  buildBlogRoutePath,
  getBlogLanguageOption,
  getBlogRouteLocale,
  normalizeBlogLanguageCode,
} from './blog-i18n';

describe('blog desktop-language helpers', () => {
  it('exposes the full desktop language set with route prefixes and fallback codes', () => {
    expect(BLOG_LANGUAGE_CODES).toEqual([
      'zh-CN',
      'zh-Hant',
      'en-US',
      'ja-JP',
      'ko-KR',
      'de-DE',
      'fr-FR',
      'es-ES',
      'pt-BR',
      'ru-RU',
    ]);

    expect(BLOG_LANGUAGE_OPTIONS.map((option) => [option.code, option.routeLocale, option.shortLabel])).toEqual([
      ['zh-CN', 'root', '中'],
      ['zh-Hant', 'zh-Hant', '繁'],
      ['en-US', 'en', 'EN'],
      ['ja-JP', 'ja-JP', '日'],
      ['ko-KR', 'ko-KR', '한'],
      ['de-DE', 'de-DE', 'DE'],
      ['fr-FR', 'fr-FR', 'FR'],
      ['es-ES', 'es-ES', 'ES'],
      ['pt-BR', 'pt-BR', 'PT'],
      ['ru-RU', 'ru-RU', 'RU'],
    ]);
  });

  it.each([
    ['zh', 'zh-CN'],
    ['zh-CN', 'zh-CN'],
    ['zh_Hant', 'zh-Hant'],
    ['zh-TW', 'zh-Hant'],
    ['en', 'en-US'],
    ['en-GB', 'en-US'],
    ['ja', 'ja-JP'],
    ['ko', 'ko-KR'],
    ['de', 'de-DE'],
    ['fr', 'fr-FR'],
    ['es', 'es-ES'],
    ['pt', 'pt-BR'],
    ['ru', 'ru-RU'],
    ['it', null],
  ] as const)('normalizes %s to %s', (input, expected) => {
    expect(normalizeBlogLanguageCode(input)).toBe(expected);
  });

  it('maps canonical codes to docs route locales and fallback data', () => {
    expect(getBlogRouteLocale('zh-CN')).toBe('root');
    expect(getBlogRouteLocale('en-US')).toBe('en');
    expect(getBlogRouteLocale('fr-FR')).toBe('fr-FR');
    expect(getBlogLanguageOption('zh-Hant')?.fallbackCodes).toEqual(['zh-CN', 'en-US']);
    expect(getBlogLanguageOption('unknown')).toBeNull();
  });

  it.each([
    ['zh-CN', '/blog/', '/blog/'],
    ['en-US', '/blog/', '/en/blog/'],
    ['zh-Hant', '/blog/example/', '/zh-Hant/blog/example/'],
    ['ja-JP', '/en/blog/example/', '/ja-JP/blog/example/'],
    ['ru-RU', '/zh-Hant/blog/example/', '/ru-RU/blog/example/'],
  ] as const)('builds %s blog route for %s', (language, path, expected) => {
    expect(buildBlogRoutePath(language, path)).toBe(expected);
  });

  it('preserves slug identity when building localized post routes', () => {
    expect(buildBlogPostRoutePath('pt-BR', '2026-04-17-example')).toBe('/pt-BR/blog/2026-04-17-example/');
  });
});
