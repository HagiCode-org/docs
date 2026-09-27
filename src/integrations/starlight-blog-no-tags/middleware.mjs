import { getAllAuthors, getEntryAuthors } from './libs/authors.ts';
import { getBlogEntries, getSidebarBlogEntries } from './libs/content.ts';
import { getAllTags, getEntryTags } from './libs/tags.ts';
import { onRequest as starlightBlogMiddleware } from 'starlight-blog/middleware';
import { renderBlogEntryToString } from '../../../node_modules/starlight-blog/libs/container.ts';
import { getMetrics } from '../../../node_modules/starlight-blog/libs/metrics.ts';
import {
  getBlogConfigFromPath,
  getPathWithLocale,
  getRelativeBlogUrl,
  getRelativeUrl,
  isBlogAuthorPage,
  isBlogRoot,
  isBlogTagPage,
} from '../../../node_modules/starlight-blog/libs/page.ts';

const blogDataPerLocale = new Map();

function linkToTagIndex(href) {
  const match = href.match(/^(.*\/tags)\/([^/?#]+)\/?$/u);
  return match ? `${match[1]}/#${match[2]}` : href;
}

function rewriteSidebarTagLinks(items) {
  return items.map((item) => {
    if (item.type === 'group') {
      return { ...item, entries: rewriteSidebarTagLinks(item.entries) };
    }

    if (item.type === 'link' && typeof item.href === 'string') {
      return { ...item, href: linkToTagIndex(item.href) };
    }

    return item;
  });
}

export const onRequest = async (context) => {
  await starlightBlogMiddleware(context);

  const { id, locale } = context.locals.starlightRoute;
  const config = getBlogConfigFromPath(id);
  if (config) {
    const data = await getDocsBlogData(config, locale, context.locals.t);
    const blogs = new Map(context.locals.starlightBlogs);
    blogs.set(config.prefix, data);
    context.locals.starlightBlogs = blogs;
    context.locals.starlightRoute.sidebar = await getDocsBlogSidebar(config, id, locale, context);
  }

  const blog = context.locals.starlightBlog;
  for (const post of blog?.posts ?? []) {
    for (const tag of post.tags ?? []) {
      tag.href = linkToTagIndex(tag.href);
    }
  }

  context.locals.starlightRoute.sidebar = rewriteSidebarTagLinks(
    context.locals.starlightRoute.sidebar,
  );
};

async function getDocsBlogData(config, locale, t) {
  const cacheKey = `${config.prefix}:${locale ?? ''}`;
  const cached = blogDataPerLocale.get(cacheKey);
  if (cached) return cached;

  const entries = await getBlogEntries(locale);
  const authors = new Map();
  const posts = await Promise.all(entries.map(async (entry) => {
    const entryAuthors = getEntryAuthors(entry).map(({ name, title, url }) => ({ name, title, url }));
    for (const author of entryAuthors) authors.set(author.name, author);

    const html = await renderBlogEntryToString(entry, t);
    const tags = getEntryTags(entry).map(({ label, slug }) => ({
      label,
      href: getRelativeBlogUrl(config, `/tags/${slug}`, locale),
    }));
    const post = {
      authors: entryAuthors,
      cover: entry.data.cover,
      createdAt: entry.data.date,
      draft: entry.data.draft,
      entry,
      featured: entry.data.featured === true,
      href: getRelativeUrl(`/${getPathWithLocale(entry.id, locale)}`),
      metrics: getMetrics(html, locale, entry.data.metrics),
      tags,
      title: entry.data.title,
    };

    if (entry.data.lastUpdated && typeof entry.data.lastUpdated !== 'boolean') {
      post.updatedAt = entry.data.lastUpdated;
    }

    return post;
  }));

  const data = { authors: [...authors.values()], posts };
  blogDataPerLocale.set(cacheKey, data);
  return data;
}

async function getDocsBlogSidebar(config, id, locale, context) {
  const { featured, recent } = await getBlogEntriesForSidebar(locale, config.recentPostCount);
  const sidebar = [
    makeSidebarLink(
      context.locals.t('starlightBlog.sidebar.all'),
      getRelativeBlogUrl(config, '/', locale),
      isBlogRoot(config, id),
    ),
  ];

  if (featured.length > 0) {
    sidebar.push(makeSidebarGroup(
      context.locals.t('starlightBlog.sidebar.featured'),
      featured.map((entry) => makePostLink(entry, id, locale)),
    ));
  }

  sidebar.push(makeSidebarGroup(
    context.locals.t('starlightBlog.sidebar.recent'),
    recent.map((entry) => makePostLink(entry, id, locale)),
  ));

  const tags = await getAllTags(locale);
  if (tags.size > 0) {
    sidebar.push(makeSidebarGroup(
      context.locals.t('starlightBlog.sidebar.tags'),
      [...tags]
        .sort(([, a], [, b]) => b.entries.length - a.entries.length || a.label.localeCompare(b.label))
        .map(([slug, { entries, label }]) => makeSidebarLink(
          `${label} (${entries.length})`,
          getRelativeBlogUrl(config, `/tags/${slug}`, locale),
          isBlogTagPage(config, id, slug),
        )),
    ));
  }

  const authors = await getAllAuthors(locale);
  if (authors.size > 1) {
    sidebar.push(makeSidebarGroup(
      context.locals.t('starlightBlog.sidebar.authors'),
      [...authors]
        .sort(([, a], [, b]) => b.entries.length - a.entries.length || a.author.name.localeCompare(b.author.name))
        .map(([, { author, entries }]) => makeSidebarLink(
          `${author.name} (${entries.length})`,
          getRelativeBlogUrl(config, `/authors/${author.slug}`, locale),
          isBlogAuthorPage(config, id, author.slug),
        )),
    ));
  }

  if (context.site && config.rss) {
    sidebar.push(makeSidebarLink(
      context.locals.t('starlightBlog.sidebar.rss'),
      getRelativeBlogUrl(config, '/rss.xml', locale, true),
      false,
    ));
  }

  return sidebar;
}

async function getBlogEntriesForSidebar(locale, recentPostCount) {
  return getSidebarBlogEntries(locale).then(({ featured, recent }) => ({
    featured,
    recent: recent.slice(0, recentPostCount),
  }));
}

function makePostLink(entry, id, locale) {
  const href = getRelativeUrl(`/${getPathWithLocale(entry.id, locale)}`);
  return makeSidebarLink(entry.data.title, href, id === getPathWithLocale(entry.id, locale));
}

function makeSidebarLink(label, href, isCurrent) {
  return {
    attrs: {},
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
