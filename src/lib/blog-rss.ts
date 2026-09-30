import { generateRssFeed } from '@hagicode/hagilight/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

import {
  filterAndSortBlogRssPosts,
  getFeedMetadata,
  normalizeBlogPostLanguage,
  type RssBlogPostInput,
} from './blog-rss-core';
import type { BlogLanguageCode, BlogRssScope } from './blog-i18n';

export type BlogRssLanguage = BlogLanguageCode;
export type { BlogRssScope };

type BlogEntry = Awaited<ReturnType<typeof getCollection<'docs'>>>[number];

function toRssBlogPostInput(entry: BlogEntry): RssBlogPostInput | undefined {
  const { data } = entry;
  if (typeof data.title !== 'string') return undefined;

  return {
    id: entry.id,
    data: {
      title: data.title,
      ...(data.date instanceof Date ? { date: data.date } : {}),
      ...(typeof data.excerpt === 'string' ? { excerpt: data.excerpt } : {}),
      ...(typeof data.description === 'string' ? { description: data.description } : {}),
      ...(Array.isArray(data.tags) && data.tags.every((tag) => typeof tag === 'string')
        ? { tags: data.tags }
        : {}),
      ...(typeof data.language === 'string' ? { language: data.language } : {}),
    },
  };
}

export async function getBlogRssResponse(context: APIContext, scope: BlogRssScope = 'all') {
  if (!context.site) throw new Error('The Astro site URL is required to generate the blog RSS feed.');
  const blog = await getCollection('docs');
  const metadata = getFeedMetadata(scope);
  const rssBlogPosts = blog.flatMap((entry) => {
    const post = toRssBlogPostInput(entry);
    return post ? [post] : [];
  });
  const posts = filterAndSortBlogRssPosts(rssBlogPosts, scope);

  return generateRssFeed({
    title: metadata.title,
    description: metadata.description,
    site: context.site,
    items: posts.map((post) => ({
      title: post.data.title,
      link: `/${post.id}/`,
      pubDate: post.data.date,
      description: post.data.excerpt || post.data.description || '',
    })),
    language: metadata.language,
  });
}

export { normalizeBlogPostLanguage };
