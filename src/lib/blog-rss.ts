import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

const POST_LIMIT = 20;
const DEFAULT_SITE = 'https://docs.hagicode.com';

export type BlogRssLanguage = 'zh-CN' | 'en';
export type BlogRssScope = BlogRssLanguage | 'all';

type BlogEntry = Awaited<ReturnType<typeof getCollection<'docs'>>>[number];
type BlogEntryWithDate = BlogEntry & { data: BlogEntry['data'] & { date: Date } };

function hasPublicationDate(post: BlogEntry): post is BlogEntryWithDate {
  return post.data.date instanceof Date;
}

export function normalizeBlogPostLanguage(post: Pick<BlogEntry, 'id' | 'data'>): BlogRssLanguage {
  const frontmatterLanguage = typeof post.data.language === 'string' ? post.data.language.toLowerCase() : undefined;

  if (frontmatterLanguage === 'en' || frontmatterLanguage === 'en-us') {
    return 'en';
  }

  if (frontmatterLanguage === 'zh' || frontmatterLanguage === 'zh-cn') {
    return 'zh-CN';
  }

  return post.id.startsWith('en/blog/') ? 'en' : 'zh-CN';
}

function getFeedMetadata(scope: BlogRssScope) {
  switch (scope) {
    case 'zh-CN':
      return {
        title: 'Hagicode Docs | 中文博客',
        description: 'Hagicode 项目中文博客',
        language: 'zh-CN',
      };
    case 'en':
      return {
        title: 'Hagicode Docs | English Blog',
        description: 'English posts from the HagiCode documentation blog',
        language: 'en',
      };
    default:
      return {
        title: 'Hagicode Docs | Blog',
        description: 'Hagicode 项目文档博客',
        language: 'zh-CN,en',
      };
  }
}

export async function getBlogRssResponse(context: APIContext, scope: BlogRssScope = 'all') {
  const blog = await getCollection('docs');
  const metadata = getFeedMetadata(scope);
  const site = context.site?.toString() || DEFAULT_SITE;

  const posts = blog
    .filter(hasPublicationDate)
    .map((post) => ({
      ...post,
      language: normalizeBlogPostLanguage(post),
    }))
    .filter((post) => scope === 'all' || post.language === scope)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .slice(0, POST_LIMIT);

  return rss({
    title: metadata.title,
    description: metadata.description,
    site,
    items: posts.map((post) => ({
      title: post.data.title,
      link: `/${post.id}/`,
      pubDate: post.data.date,
      description: post.data.excerpt || post.data.description || '',
      categories: post.data.tags,
      customData: `<language>${post.language}</language>`,
    })),
    customData: `<language>${metadata.language}</language>`,
  });
}
