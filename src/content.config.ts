import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { slug as githubSlug } from 'github-slugger';
import { blogSchema } from 'starlight-blog/schema'
import { DOCS_LOCALES } from './i18n/generated/docs-locale-resources.mjs';
import { BLOG_LANGUAGE_INPUTS } from './lib/blog-i18n';

const localeSlugMap = new Map(
	Object.keys(DOCS_LOCALES)
		.filter((locale) => locale !== 'root')
		.map((locale) => [githubSlug(locale), locale]),
);

function generateDocsEntryId({ entry, data }: { entry: string; data: Record<string, unknown> }) {
	if (typeof data.slug === 'string' && data.slug.length > 0) {
		return data.slug;
	}

	const withoutExtension = entry.replace(/\.[^./]+$/u, '');
	const segments = withoutExtension.split('/');
	const slugSegments = segments.map((segment, index) => {
		const sluggedSegment = githubSlug(segment);
		if (index === 0) {
			return localeSlugMap.get(sluggedSegment) ?? sluggedSegment;
		}

		return sluggedSegment;
	});

	return slugSegments.join('/').replace(/\/index$/u, '');
}

export const collections = {
	docs: defineCollection({
		loader: docsLoader({ generateId: generateDocsEntryId }),
		schema: docsSchema({
			extend: (context) => blogSchema(context).extend({
				/** 隐藏博客文章中的广告区域 */
				hideAd: z.boolean().optional(),
				/** Optional explicit RSS language. Missing blog posts derive language from their locale path. */
				language: z.enum(BLOG_LANGUAGE_INPUTS).optional(),
			}),
		})
	}),
};
