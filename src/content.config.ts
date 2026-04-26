import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';
import { blogSchema } from 'starlight-blog/schema'

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: (context) => blogSchema(context).extend({
				/** 隐藏博客文章中的广告区域 */
				hideAd: z.boolean().optional(),
				/** Optional explicit RSS language. Missing blog posts derive language from their locale path. */
				language: z.enum(['zh-CN', 'zh', 'en', 'en-US']).optional(),
			}),
		})
	}),
};
