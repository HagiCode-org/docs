declare module 'virtual:starlight/git-info' {
  export function getNewestCommitDate(path: string): Date;
}

declare module 'virtual:starlight/collection-config' {
  import type { ContentConfig } from 'astro:content';
  export const collections: ContentConfig['collections'];
}

declare module 'virtual:starlight/user-images' {
  export const logos: {
    dark?: unknown;
    light?: unknown;
  };
}

declare module 'virtual:starlight-blog-config' {
  const config: {
    prefix: string;
    postCount: number;
    recentPostCount: number;
    prevNextLinksOrder: 'reverse-chronological' | 'chronological';
  };

  export default config;
}

declare module 'virtual:starlight-blog-context' {
  const context: {
    srcDir: string;
    rootDir: string;
    trailingSlash: 'always' | 'ignore' | 'never';
  };

  export default context;
}
