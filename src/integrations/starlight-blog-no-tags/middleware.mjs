import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import config from 'virtual:starlight-blog/config';

import {
  getAllAuthors,
  getEntryAuthors,
} from '../../../node_modules/starlight-blog/libs/authors.ts';
import { renderBlogEntryToString } from '../../../node_modules/starlight-blog/libs/container.ts';
import {
  getBlogEntries,
  getSidebarBlogEntries,
} from '../../../node_modules/starlight-blog/libs/content.ts';
import { getMetrics } from '../../../node_modules/starlight-blog/libs/metrics.ts';
import { isNavigationWithSidebarLink } from '../../../node_modules/starlight-blog/libs/navigation.ts';
import {
  getPathWithLocale,
  getRelativeBlogUrl,
  getRelativeUrl,
  getSidebarProps,
  isAnyBlogPage,
  isBlogAuthorPage,
  isBlogRoot,
} from '../../../node_modules/starlight-blog/libs/page.ts';
import { getEntryTags } from '../../../node_modules/starlight-blog/libs/tags.ts';
import { getBlogTitle } from '../../../node_modules/starlight-blog/libs/title.ts';

const blogDataPerLocale = new Map();

export const onRequest = defineRouteMiddleware(async (context) => {
  const { starlightRoute } = context.locals;
  const { id, locale } = starlightRoute;

  context.locals.starlightBlog = await getBlogData(starlightRoute, context.locals.t);

  const isBlog = isAnyBlogPage(id);

  if (!isBlog) {
    if (isNavigationWithSidebarLink(config)) {
      starlightRoute.sidebar.unshift(
        makeSidebarLink(getBlogTitle(locale), getRelativeBlogUrl('/', locale), false, { class: 'sl-blog-mobile-link' }),
      );
    }
    return;
  }

  starlightRoute.sidebar = await getBlogSidebar(context);
});

async function getBlogData({ locale }, t) {
  if (blogDataPerLocale.has(locale)) {
    return blogDataPerLocale.get(locale);
  }

  const posts = await getBlogPostsData(locale, t);
  const authors = new Map();

  for (const post of posts) {
    for (const author of post.authors) {
      if (authors.has(author.name)) continue;
      authors.set(author.name, author);
    }
  }

  const blogData = { posts, authors: [...authors.values()] };

  blogDataPerLocale.set(locale, blogData);

  return blogData;
}

async function getBlogPostsData(locale, t) {
  const entries = await getBlogEntries(locale);

  return Promise.all(
    entries.map(async (entry) => {
      const authors = getEntryAuthors(entry);
      const tags = getEntryTags(entry);
      const html = await renderBlogEntryToString(entry, t);
      const metrics = getMetrics(html, locale, entry.data.metrics);

      const post = {
        authors: authors.map(({ name, title, url }) => ({
          name,
          title,
          url,
        })),
        cover: entry.data.cover,
        createdAt: entry.data.date,
        draft: entry.data.draft,
        entry,
        featured: entry.data.featured === true,
        href: getRelativeUrl(`/${getPathWithLocale(entry.id, locale)}`),
        metrics,
        tags: tags.map(({ label, slug }) => ({
          label,
          href: getRelativeBlogUrl(`/tags/${slug}`, locale),
        })),
        title: entry.data.title,
      };

      if (entry.data.lastUpdated && typeof entry.data.lastUpdated !== 'boolean') {
        post.updatedAt = entry.data.lastUpdated;
      }

      return post;
    }),
  );
}

async function getBlogSidebar(context) {
  const { starlightRoute, t } = context.locals;
  const { id, locale } = starlightRoute;

  const { featured, recent } = await getSidebarBlogEntries(locale);
  const sidebar = [
    makeSidebarLink(t('starlightBlog.sidebar.all'), getRelativeBlogUrl('/', locale), isBlogRoot(id)),
  ];

  if (featured.length > 0) {
    sidebar.push(makeSidebarGroup(t('starlightBlog.sidebar.featured'), getSidebarProps(id, featured, locale)));
  }

  sidebar.push(makeSidebarGroup(t('starlightBlog.sidebar.recent'), getSidebarProps(id, recent, locale)));

  const authors = await getAllAuthors(locale);
  const authorEntries = [...authors].sort(([, a], [, b]) => {
    if (a.entries.length === b.entries.length) {
      return a.author.name.localeCompare(b.author.name);
    }

    return b.entries.length - a.entries.length;
  });

  if (authorEntries.length > 1) {
    sidebar.push(
      makeSidebarGroup(
        t('starlightBlog.sidebar.authors'),
        authorEntries.map(([, { author, entries }]) =>
          makeSidebarLink(
            `${author.name} (${entries.length})`,
            getRelativeBlogUrl(`/authors/${author.slug}`, locale),
            isBlogAuthorPage(id, author.slug),
          ),
        ),
      ),
    );
  }

  return sidebar;
}

function makeSidebarLink(label, href, isCurrent, attrs = {}) {
  return {
    attrs,
    badge: undefined,
    href,
    isCurrent,
    label,
    type: 'link',
  };
}

function makeSidebarGroup(label, entries) {
  return {
    badge: undefined,
    collapsed: false,
    entries,
    label,
    type: 'group',
  };
}
