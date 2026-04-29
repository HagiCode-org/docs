import type { APIContext } from 'astro';

import { getBlogRssResponse } from '@/lib/blog-rss';

export async function GET(context: APIContext) {
  return getBlogRssResponse(context, 'ja-JP');
}
