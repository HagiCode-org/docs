import type { GetStaticPathsResult } from 'astro';
import { getCollection } from 'astro:content';
import configs from 'virtual:starlight-blog/configs';
import {
  getBlogEntryExcerpt as getConfiguredBlogEntryExcerpt,
  type StarlightBlogEntry,
  type StarlightBlogEntryPaginated,
} from '../../../../node_modules/starlight-blog/libs/content.ts';
import {
  DefaultLocale,
  getLocales,
  type Locale,
} from '../../../../node_modules/starlight-blog/libs/i18n.ts';
import type { StarlightBlogConfig } from '../../../../node_modules/starlight-blog/libs/config.ts';
import {
  getPathWithLocale,
  getRelativeBlogUrl,
  getRelativeUrl,
} from '../../../../node_modules/starlight-blog/libs/page.ts';
import {
  stripLeadingSlash,
  stripTrailingSlash,
} from '../../../../node_modules/starlight-blog/libs/path.ts';

const config = configs.get('blog');
if (!config) {
  throw new Error('The Docs blog configuration was not registered with starlight-blog.');
}

const blogEntriesPerLocale = new Map<Locale, StarlightBlogEntry[]>();

export type { StarlightBlogEntry, StarlightBlogEntryPaginated };

export function getBlogStaticPaths() {
  return createBlogStaticPaths();
}

export function getBlogEntries(locale: Locale) {
  return getConfiguredBlogEntries(locale);
}

export async function getBlogEntry(
  slug: string,
  locale: Locale,
): Promise<StarlightBlogEntryPaginated> {
  const entries = await getBlogEntries(locale);
  const entryIndex = entries.findIndex((entry) => {
    if (entry.id === stripLeadingSlash(stripTrailingSlash(slug))) return true;
    if (locale) {
      return entry.id === stripLeadingSlash(stripTrailingSlash(getPathWithLocale(slug, undefined)));
    }
    return false;
  });
  const entry = entries[entryIndex];
  if (!entry) {
    throw new Error(`Blog post with slug '${slug}' not found.`);
  }

  const prevEntry = entries[entryIndex - 1];
  const nextEntry = entries[entryIndex + 1];
  const prevLink = prevEntry
    ? { href: getRelativeUrl(`/${getPathWithLocale(prevEntry.id, locale)}`), label: prevEntry.data.title }
    : undefined;
  const nextLink = nextEntry
    ? { href: getRelativeUrl(`/${getPathWithLocale(nextEntry.id, locale)}`), label: nextEntry.data.title }
    : undefined;

  return {
    entry,
    nextLink: config.prevNextLinksOrder === 'reverse-chronological' ? nextLink : prevLink,
    prevLink: config.prevNextLinksOrder === 'reverse-chronological' ? prevLink : nextLink,
  };
}

export function getSidebarBlogEntries(locale: Locale) {
  return getBlogEntries(locale).then((entries) => {
    const featured: StarlightBlogEntry[] = [];
    const recent: StarlightBlogEntry[] = [];
    for (const entry of entries) {
      (entry.data.featured ? featured : recent).push(entry);
    }
    return { featured, recent: recent.slice(0, config.recentPostCount) };
  });
}

export function getBlogEntryExcerpt(entry: StarlightBlogEntry) {
  return getConfiguredBlogEntryExcerpt(entry);
}

export function getBlogConfig(): StarlightBlogConfig {
  return config;
}

async function getConfiguredBlogEntries(locale: Locale): Promise<StarlightBlogEntry[]> {
  const cached = blogEntriesPerLocale.get(locale);
  if (cached) return cached;

  const docs = await getCollection('docs');
  const entriesById = new Map(docs.map((entry) => [entry.id, entry]));
  const defaultPrefix = `${getPathWithLocale(config.prefix, DefaultLocale)}/`;
  const isProduction = import.meta.env.MODE === 'production';
  const entries: StarlightBlogEntry[] = [];

  for (const entry of docs) {
    if (isProduction && entry.data.draft) continue;

    const relativePath = getGeneratedDocsRelativePath(entry.filePath);
    if (!relativePath?.startsWith(defaultPrefix)) continue;
    if (relativePath === `${defaultPrefix}index.md` || relativePath === `${defaultPrefix}index.mdx`) continue;

    if (locale === DefaultLocale) {
      entries.push(entry);
      continue;
    }

    const localizedEntry = entriesById.get(getPathWithLocale(entry.id, locale));
    entries.push(localizedEntry && !(isProduction && localizedEntry.data.draft) ? localizedEntry : entry);
  }

  entries.sort((a, b) => {
    return b.data.date.getTime() - a.data.date.getTime() || a.data.title.localeCompare(b.data.title);
  });
  blogEntriesPerLocale.set(locale, entries);
  return entries;
}

async function createBlogStaticPaths(): Promise<GetStaticPathsResult> {
  const paths = [];

  for (const locale of getLocales()) {
    const entries = await getBlogEntries(locale);
    const pages: StarlightBlogEntry[][] = [];
    for (const entry of entries) {
      const currentPage = pages.at(-1);
      if (!currentPage || currentPage.length === config.postCount) pages.push([entry]);
      else currentPage.push(entry);
    }
    if (pages.length === 0) pages.push([]);

    for (const [index, pageEntries] of pages.entries()) {
      const previousPage = index === 0 ? undefined : pages.at(index - 1);
      const nextPage = pages.at(index + 1);
      const previousLink = previousPage
        ? { href: getRelativeBlogUrl(config, index === 1 ? '/' : `/${index}`, locale) }
        : undefined;
      const nextLink = nextPage
        ? { href: getRelativeBlogUrl(config, `/${index + 2}`, locale) }
        : undefined;

      paths.push({
        params: {
          page: index === 0 ? undefined : String(index + 1),
          prefix: getPathWithLocale(config.prefix, locale),
        },
        props: {
          prefix: config.prefix,
          entries: pageEntries,
          locale,
          nextLink: config.prevNextLinksOrder === 'reverse-chronological' ? nextLink : previousLink,
          prevLink: config.prevNextLinksOrder === 'reverse-chronological' ? previousLink : nextLink,
        },
      });
    }
  }

  return paths;
}

function getGeneratedDocsRelativePath(filePath: string | undefined): string | undefined {
  const normalizedPath = filePath?.replaceAll('\\', '/');
  const rootMarker = 'src/content/.generated/docs/';
  const rootIndex = normalizedPath?.indexOf(rootMarker) ?? -1;
  return rootIndex === -1 ? undefined : normalizedPath?.slice(rootIndex + rootMarker.length);
}
