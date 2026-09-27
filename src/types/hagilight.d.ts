declare module '@hagicode/hagilight-starlight/article-promotion-schema' {
  import { z } from 'astro/zod';

  export const articlePromotionSchema: ReturnType<typeof z.object>;
}
