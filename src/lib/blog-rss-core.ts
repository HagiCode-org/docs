import {
  BLOG_LANGUAGE_OPTIONS,
  deriveBlogLanguageFromContentId,
  getBlogLanguageOption,
  normalizeBlogLanguageCode,
  type BlogLanguageCode,
  type BlogRssScope,
} from './blog-i18n';

export const BLOG_RSS_POST_LIMIT = 20;

export type RssBlogPostInput = {
  id: string;
  data: {
    title: string;
    date?: Date;
    excerpt?: string;
    description?: string;
    tags?: string[];
    language?: string;
  };
};

export type RssBlogPostWithLanguage<TPost extends RssBlogPostInput = RssBlogPostInput> = TPost & {
  language: BlogLanguageCode;
};

export function normalizeBlogPostLanguage(post: Pick<RssBlogPostInput, 'id' | 'data'>): BlogLanguageCode {
  if (typeof post.data.language === 'string') {
    const normalized = normalizeBlogLanguageCode(post.data.language);
    if (!normalized) {
      throw new Error(
        `Unsupported blog language "${post.data.language}" in ${post.id}. Run verify:blog-i18n-completeness for diagnostics.`,
      );
    }

    return normalized;
  }

  return deriveBlogLanguageFromContentId(post.id);
}

export function hasPublicationDate<TPost extends RssBlogPostInput>(
  post: TPost,
): post is TPost & { data: TPost['data'] & { date: Date } } {
  return post.data.date instanceof Date;
}

export function filterAndSortBlogRssPosts<TPost extends RssBlogPostInput>(
  posts: TPost[],
  scope: BlogRssScope = 'all',
  limit = BLOG_RSS_POST_LIMIT,
): Array<RssBlogPostWithLanguage<TPost & { data: TPost['data'] & { date: Date } }>> {
  return posts
    .filter(hasPublicationDate)
    .map((post) => ({
      ...post,
      language: normalizeBlogPostLanguage(post),
    }))
    .filter((post) => scope === 'all' || post.language === scope)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, limit);
}

export function getFeedMetadata(scope: BlogRssScope) {
  if (scope === 'all') {
    return {
      title: 'Hagicode Docs | Blog',
      description: 'Hagicode project documentation blog posts in every supported language',
      language: 'all',
    };
  }

  const option = getBlogLanguageOption(scope) ?? BLOG_LANGUAGE_OPTIONS[0];
  return {
    title: `Hagicode Docs | ${option.nativeName} Blog`,
    description: `${option.nativeName} posts from the HagiCode documentation blog`,
    language: option.code,
  };
}
