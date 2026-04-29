import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

import {
  filterAndSortBlogRssPosts,
  getFeedMetadata,
  normalizeBlogPostLanguage,
  type RssBlogPostInput,
} from './blog-rss-core';
import type { BlogLanguageCode, BlogRssScope } from './blog-i18n';

const DEFAULT_SITE = 'https://docs.hagicode.com';

export type BlogRssLanguage = BlogLanguageCode;
export type { BlogRssScope };

type BlogEntry = Awaited<ReturnType<typeof getCollection<'docs'>>>[number];

export async function getBlogRssResponse(context: APIContext, scope: BlogRssScope = 'all') {
  const blog = await getCollection('docs');
  const metadata = getFeedMetadata(scope);
  const site = context.site?.toString() || DEFAULT_SITE;
  const posts = filterAndSortBlogRssPosts(blog as RssBlogPostInput[], scope);

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

export { normalizeBlogPostLanguage };
