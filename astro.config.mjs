import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightBlog from "./src/integrations/starlight-blog-no-tags/index.mjs";
import sitemap from "@astrojs/sitemap";
import mdx from "@astrojs/mdx";
import partytown from "@astrojs/partytown";
import robotsTxt from "astro-robots-txt";
import react from "@astrojs/react";
import hagilight from "@hagicode/hagilight-starlight";
import { locales as HAGILIGHT_LOCALES } from "@hagicode/hagilight-starlight/locales";

import cachedLinkValidator from "./src/integrations/link-check-result-cache.js";
import { rehypePagefindOptimize } from "./src/integrations/rehype-pagefind-optimize.mjs";
import { DOCS_SIDEBAR } from "./src/config/sidebar.ts";
import {
  BLOG_PLUGIN_TITLE,
  BLOG_UI_TRANSLATIONS,
  DOCS_LOCALE_RESOURCES,
  DOCS_LOCALES,
} from "./src/i18n/generated/docs-locale-resources.mjs";
// rehype-raw 暂时禁用，可能与 MDX 处理冲突
// import rehypeRaw from "rehype-raw";
import rehypeExternalLinks from "rehype-external-links";

const DEFAULT_DOCS_UI = DOCS_LOCALE_RESOURCES["zh-CN"].starlight;
const HAGILIGHT_LOCALES_BY_LANG = new Map(
  Object.values(HAGILIGHT_LOCALES).map((locale) => [locale.lang, locale]),
);
const DOCS_LOCALE_CONFIG = Object.fromEntries(
  Object.entries(DOCS_LOCALES).map(([routeLocale, locale]) => {
    const sharedLocale = HAGILIGHT_LOCALES_BY_LANG.get(locale.lang);
    if (!sharedLocale) {
      throw new Error(`Hagilight does not define Docs locale "${locale.lang}".`);
    }
    return [routeLocale, { ...sharedLocale, ...locale }];
  }),
);

const BLOG_PLUGIN_CONFIG = {
  rss: false,
  postCount: 20,
  prefix: "blog",
  title: BLOG_PLUGIN_TITLE,
};

const docsLinkCheckCacheTtlHours = Number.parseInt(
  process.env.DOCS_LINK_CHECK_CACHE_TTL_HOURS ?? "48",
  10,
);
const docsLinkCheckCacheTtlMs = Number.isFinite(docsLinkCheckCacheTtlHours)
  ? docsLinkCheckCacheTtlHours * 60 * 60 * 1000
  : 48 * 60 * 60 * 1000;
// 默认不在常规构建后执行链接校验；需要时显式设置 DOCS_ENABLE_LINK_CHECK=true。
const docsEnableLinkCheck = process.env.DOCS_ENABLE_LINK_CHECK === "true";
const resolvedNodeEnv = process.env.NODE_ENV ?? (process.argv.includes("build") ? "production" : "development");

// 获取 base 路径：文档站点独立部署在 docs.hagicode.com，开发和生产都使用根路径
const getBasePath = () => {
  // 文档站点现在独立部署在 docs.hagicode.com
  // 不再需要 /docs 前缀，开发和生产都使用根路径
  return "/";
};

// https://astro.build/config
export default defineConfig({
  // 站点完整 URL,用于生成 sitemap 和 canonical URL
  site: "https://docs.hagicode.com",
  build: {
    inlineStylesheets: "never",
  },
  // 文档站点部署路径：独立部署在 docs.hagicode.com，使用根路径
  base: getBasePath(),
  // 中间件配置 - 暂时禁用，由页面级别处理重定向
  // middleware: './src/middleware.ts',
  markdown: {
    syntaxHighlight: {
      type: "shiki",
      excludeLangs: ["math"],
    },
    rehypePlugins: [
      // rehypeRaw 暂时禁用，可能与 MDX 处理冲突
      // rehypeRaw,
      [
        rehypeExternalLinks,
        {
          target: "_blank",
          rel: ["noopener", "noreferrer"],
        },
      ],
      [rehypePagefindOptimize, {}],
    ],
  },
  // 配置 Vite 环境变量
  vite: {
    resolve: {
      alias: {
        "@": new URL("./src", import.meta.url).pathname,
        "@shared": new URL("./shared/src", import.meta.url).pathname,
      },
    },
    define: {
      'import.meta.env.PROD': JSON.stringify(
        resolvedNodeEnv === 'production'
      ),
      "import.meta.env.VITE_CLARITY_PROJECT_ID": JSON.stringify(
        process.env.VITE_CLARITY_PROJECT_ID || "",
      ),
      "import.meta.env.VITE_CLARITY_DEBUG": JSON.stringify(
        process.env.VITE_CLARITY_DEBUG || "",
      ),
    },
  },
  integrations: [
    // robots.txt 配置 - 使用 astro-robots-txt 插件
    robotsTxt({
      sitemap: "https://docs.hagicode.com/sitemap-index.xml",
    }),

    starlight({
      title: DEFAULT_DOCS_UI.site.title,
      description: DEFAULT_DOCS_UI.site.description,
      favicon: "/favicon.ico",
      // i18n configuration - Use the desktop-aligned locale catalog.
      // Keep Chinese on / and English on /en-US/.
      defaultLocale: "root",
      locales: DOCS_LOCALE_CONFIG,
      social: [
        {
          icon: "github",
          label: DEFAULT_DOCS_UI.social.githubRepository,
          href: "https://github.com/HagiCode-org/site",
        },
      ],
      components: {
        Head: "./src/components/StarlightHead.astro",
        EditLink: "./src/components/StarlightEditLink.astro",
        PageTitle: "./src/components/StarlightPageTitle.astro",
        TableOfContents: "./src/components/StarlightTableOfContents.astro",
        MarkdownContent: "./src/components/MarkdownContent.astro",
        PageFrame: "./src/components/DocsPageFrame.astro",
      },
      sidebar: DOCS_SIDEBAR,
      customCss: ["./src/styles/starlight-override.css"],
      editLink: {
        baseUrl: "https://github.com/HagiCode-org/docs/edit/main/",
      },
      plugins: [
        hagilight({
          links: {
            siteId: "hagicode-docs",
            siteUrl: "https://docs.hagicode.com/",
          },
          aiDisclosures: {
            isAITranslation: true,
            isAIAuthor: true,
            sourceLocale: "root",
          },
          contentComponents: {
            pageTitle: false,
            markdownContent: false,
          },
          promoto: { enabled: false },
        }),
        {
          name: "docs-blog-zhcn-i18n-compat",
          hooks: {
            "i18n:setup": ({ injectTranslations }) => {
              // Starlight can resolve root Chinese routes with different lang tags
              // across environments. Inject all known variants to avoid key leaks.
              injectTranslations(BLOG_UI_TRANSLATIONS);
            },
            "config:setup": () => {},
          },
        },
        starlightBlog(BLOG_PLUGIN_CONFIG),
      ],
    }),
    sitemap(),
    partytown(),
    react(),
    ...(docsEnableLinkCheck
      ? [
          cachedLinkValidator({
            // 仅在 CI 环境中启用外部链接检查，避免本地构建时间过长
            checkExternal: process.env.CI === "true",
            // 外部链接超时时间（毫秒）
            externalTimeout: 10000,
            // 仅复用近期成功的外链结果，避免长期信任旧缓存。
            cacheDir: ".tmp/link-check-cache",
            cacheTtlMs: docsLinkCheckCacheTtlMs,
            // 链接检查不再阻塞构建，仅发出警告
            // 独立的链接检查由 .github/workflows/link-check.yml 负责
            failOnBrokenLinks: false,
            // 详细输出（用于调试）
            verbose: process.env.CI === "true",
            // 排除某些路径（如 API 端点、管理后台）
            exclude: [],
          }),
        ]
      : []),
  ],
  scopedStyleStrategy: "where",
});
