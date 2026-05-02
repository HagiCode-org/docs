/**
 * 公共链接管理库
 *
 * 统一管理站点间的跳转链接和公共链接
 * 根据环境自动切换开发/生产环境的链接
 *
 * 开发环境链接配置
 *
 * 端口可通过环境变量配置：
 * - PORT_DOCS: 文档站点端口（默认 31265）
 * - PORT_WEBSITE: 营销站点端口（默认 31264）
 *
 * 如需自定义端口，请在 .env.local 中设置对应的环境变量
 */

/**
 * 获取当前环境类型
 * 使用 NODE_ENV 环境变量来区分开发/生产环境
 * @returns 'development' | 'production'
 */
export function getEnvironment(): 'development' | 'production' {
    // 优先使用 NODE_ENV 环境变量
    // 如果没有设置，则根据 import.meta.env.MODE 判断（Astro 内置）
    const nodeEnv = import.meta.env.NODE_ENV || import.meta.env.MODE;
    if (nodeEnv === 'development') {
        return 'development';
    }
    return 'production';
}

/**
 * 获取文档站点的 base 路径
 * 开发环境为根路径，生产环境为根路径（独立部署在 docs.hagicode.com）
 * @returns base 路径
 */
export function getDocsBasePath(): string {
    return '/';
}

/**
 * 链接配置接口
 */
export interface LinkConfig {
    /** 开发环境链接 */
    dev: string;
    /** 生产环境链接 */
    prod: string;
    /** 是否为外部链接（新窗口打开） */
    external?: boolean;
    /** 是否为相对路径（需要添加 base 前缀） */
    relative?: boolean;
}

type SiteLocale = 'zh-CN' | 'zh-Hant' | 'en-US' | 'ja-JP' | 'ko-KR' | 'de-DE' | 'fr-FR' | 'es-ES' | 'pt-BR' | 'ru-RU';
type DocsRouteLocale = 'root' | 'en' | 'zh-Hant' | 'ja-JP' | 'ko-KR' | 'de-DE' | 'fr-FR' | 'es-ES' | 'pt-BR' | 'ru-RU';

const SITE_DEFAULT_LOCALE: SiteLocale = 'en-US';
const DOCS_DEFAULT_ROUTE_LOCALE: DocsRouteLocale = 'root';
const DOCS_ROUTE_TO_SITE_LOCALE: Record<DocsRouteLocale, SiteLocale> = {
    root: 'zh-CN',
    en: 'en-US',
    'zh-Hant': 'zh-Hant',
    'ja-JP': 'ja-JP',
    'ko-KR': 'ko-KR',
    'de-DE': 'de-DE',
    'fr-FR': 'fr-FR',
    'es-ES': 'es-ES',
    'pt-BR': 'pt-BR',
    'ru-RU': 'ru-RU',
};
const NORMALIZED_SITE_LOCALE_MAP: Record<string, SiteLocale> = {
    root: 'zh-CN',
    zh: 'zh-CN',
    'zh-cn': 'zh-CN',
    'zh-hans': 'zh-CN',
    'zh-tw': 'zh-Hant',
    'zh-hk': 'zh-Hant',
    'zh-hant': 'zh-Hant',
    en: 'en-US',
    'en-us': 'en-US',
    'ja-jp': 'ja-JP',
    'ko-kr': 'ko-KR',
    'de-de': 'de-DE',
    'fr-fr': 'fr-FR',
    'es-es': 'es-ES',
    'pt-br': 'pt-BR',
    'ru-ru': 'ru-RU',
};
const NORMALIZED_DOCS_ROUTE_LOCALE_MAP: Record<string, DocsRouteLocale> = {
    root: 'root',
    zh: 'root',
    'zh-cn': 'root',
    'zh-hans': 'root',
    en: 'en',
    'en-us': 'en',
    'zh-tw': 'zh-Hant',
    'zh-hk': 'zh-Hant',
    'zh-hant': 'zh-Hant',
    'ja-jp': 'ja-JP',
    'ko-kr': 'ko-KR',
    'de-de': 'de-DE',
    'fr-fr': 'fr-FR',
    'es-es': 'es-ES',
    'pt-br': 'pt-BR',
    'ru-ru': 'ru-RU',
};

function normalizeLocaleKey(locale: string): string {
    return locale.trim().replace(/_/g, '-').toLowerCase();
}

function normalizeAbsolutePath(pathname: string): string {
    const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
    const withoutTrailingSlash = normalized.replace(/\/+$/u, '');
    return withoutTrailingSlash || '/';
}

function ensureTrailingSlash(pathname: string): string {
    if (pathname === '/') {
        return pathname;
    }

    return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function resolveSiteLocale(locale?: string): SiteLocale | null {
    if (!locale) {
        return null;
    }

    return NORMALIZED_SITE_LOCALE_MAP[normalizeLocaleKey(locale)] ?? null;
}

function resolveDocsRouteLocale(locale?: string): DocsRouteLocale | null {
    if (!locale) {
        return null;
    }

    return NORMALIZED_DOCS_ROUTE_LOCALE_MAP[normalizeLocaleKey(locale)] ?? null;
}

function stripSiteLocalePrefix(pathname: string): string {
    const normalized = normalizeAbsolutePath(pathname);
    const hasLocalePrefix = /^\/(en|zh-CN|zh-Hant|ja-JP|ko-KR|de-DE|fr-FR|es-ES|pt-BR|ru-RU)(?=\/|$)/u.test(normalized);

    if (!hasLocalePrefix) {
        return ensureTrailingSlash(normalized);
    }

    const stripped = normalized.replace(/^\/[^/]+(?=\/|$)/u, '');
    return ensureTrailingSlash(stripped || '/');
}

function stripDocsLocalePrefix(pathname: string): string {
    const normalized = normalizeAbsolutePath(pathname);
    const hasLocalePrefix = /^\/(en|zh-Hant|ja-JP|ko-KR|de-DE|fr-FR|es-ES|pt-BR|ru-RU)(?=\/|$)/u.test(normalized);

    if (!hasLocalePrefix) {
        return ensureTrailingSlash(normalized);
    }

    const stripped = normalized.replace(/^\/[^/]+(?=\/|$)/u, '');
    return ensureTrailingSlash(stripped || '/');
}

function getLocalizedSitePath(pathname: string, locale?: string): string {
    const resolvedLocale = resolveSiteLocale(locale) ?? SITE_DEFAULT_LOCALE;
    const normalizedPath = stripSiteLocalePrefix(pathname);

    if (resolvedLocale === SITE_DEFAULT_LOCALE) {
        return normalizedPath;
    }

    if (normalizedPath === '/') {
        return `/${resolvedLocale}/`;
    }

    return `/${resolvedLocale}${normalizedPath}`;
}

function getLocalizedDocsPath(pathname: string, locale?: string): string {
    const resolvedSiteLocale = resolveSiteLocale(locale);
    const docsLocale = resolveDocsRouteLocale(locale)
        ?? (resolvedSiteLocale
            ? Object.entries(DOCS_ROUTE_TO_SITE_LOCALE).find(([, siteLocale]) => siteLocale === resolvedSiteLocale)?.[0] as DocsRouteLocale | undefined
            : undefined)
        ?? DOCS_DEFAULT_ROUTE_LOCALE;
    const normalizedPath = stripDocsLocalePrefix(pathname);

    if (docsLocale === 'root') {
        return normalizedPath;
    }

    if (normalizedPath === '/') {
        return `/${docsLocale}/`;
    }

    return `/${docsLocale}${normalizedPath}`;
}

function getLocalizedDocsRssPath(locale?: string): string {
    const resolvedLocale = resolveSiteLocale(locale) ?? DOCS_ROUTE_TO_SITE_LOCALE[resolveDocsRouteLocale(locale) ?? DOCS_DEFAULT_ROUTE_LOCALE];
    return resolvedLocale.startsWith('zh') ? '/blog/rss.zh-CN.xml' : '/blog/rss.en.xml';
}

function localizeAbsoluteUrl(input: string, locale?: string): string {
    if (!locale) {
        return input;
    }

    const url = new URL(input);

    if (url.hostname === 'hagicode.com') {
        url.pathname = getLocalizedSitePath(url.pathname, locale);
        return url.toString();
    }

    if (url.hostname === 'docs.hagicode.com' || url.port === '31265') {
        url.pathname = url.pathname.includes('/blog/rss.')
            ? getLocalizedDocsRssPath(locale)
            : getLocalizedDocsPath(url.pathname, locale);
        return url.toString();
    }

    return input;
}

/**
 * 站点间链接配置
 */
export const SITE_LINKS = {
    /** 文档站点 */
    docs: {
        dev: 'http://localhost:31265/', // docs 应用开发环境端口
        prod: 'https://docs.hagicode.com/',
        external: false,
    } as LinkConfig,

    /** 官方营销站点 */
    website: {
        dev: 'https://hagicode.com/', // 使用生产 URL（跨仓库链接）
        prod: 'https://hagicode.com/',
        external: false,
    } as LinkConfig,

    /** GitHub 仓库 */
    github: {
        dev: 'https://github.com/HagiCode-org/site',
        prod: 'https://github.com/HagiCode-org/site',
        external: true,
    } as LinkConfig,

    /** 技术支持群 QQ */
    qqGroup: {
        dev: 'https://qm.qq.com/q/Fwb0o094kw',
        prod: 'https://qm.qq.com/q/Fwb0o094kw',
        external: true,
    } as LinkConfig,

    /** Discord 社区 */
    discord: {
        dev: 'https://discord.gg/qY662sJK',
        prod: 'https://discord.gg/qY662sJK',
        external: true,
    } as LinkConfig,

    /** 博客页面（相对于文档站点） */
    blog: {
        dev: 'http://localhost:31265/blog/',
        prod: 'https://docs.hagicode.com/blog/',
        external: false,
    } as LinkConfig,

    /** 产品概述（相对于文档站点） */
    productOverview: {
        dev: 'http://localhost:31265/product-overview/',
        prod: 'https://docs.hagicode.com/product-overview/',
        external: false,
    } as LinkConfig,

    /** 桌面应用下载页 */
    desktop: {
        dev: 'https://hagicode.com/desktop/', // 使用生产 URL（跨仓库链接）
        prod: 'https://hagicode.com/desktop/',
        external: false,
    } as LinkConfig,

    /** Docker Compose 安装指南（相对于文档站点） */
    dockerCompose: {
        dev: 'http://localhost:31265/installation/docker-compose/',
        prod: 'https://docs.hagicode.com/installation/docker-compose/',
        external: false,
    } as LinkConfig,

    /** 容器部署落地页 */
    container: {
        dev: 'https://hagicode.com/container/', // 使用生产 URL（跨仓库链接）
        prod: 'https://hagicode.com/container/',
        external: false,
    } as LinkConfig,

    /** 官方 About 页面 */
    about: {
        dev: 'https://hagicode.com/about/',
        prod: 'https://hagicode.com/about/',
        external: false,
    } as LinkConfig,

    /** 博客 RSS 订阅（相对于文档站点） */
    rss: {
        dev: 'http://localhost:31265/blog/rss.zh-CN.xml',
        prod: 'https://docs.hagicode.com/blog/rss.zh-CN.xml',
        external: false,
    } as LinkConfig,

    /** 成本计算器 */
    costCalculator: {
        dev: 'https://cost.hagicode.com',
        prod: 'https://cost.hagicode.com',
        external: true,
    } as LinkConfig,
} as const;

/**
 * GLM（智谱 AI）推广链接配置
 * 用于博客广告区域和其他推广位置
 *
 * @deprecated 推广链接已迁移到 Presets JSON 配置系统
 * 请使用 `@/utils/promoConfig` 中的 `getPromoContent()` 函数获取动态配置的推广内容
 * 此导出仅为向后兼容保留，将在未来版本中移除
 *
 * @see {@link ../src/utils/promoConfig.ts}
 */
export const GLM_PROMO_LINKS = {
    /** 智谱 GLM Coding 订阅链接（带推广码） */
    glmCoding: {
        url: 'https://www.bigmodel.cn/glm-coding?ic=14BY54APZA',
        label: '立即开拼',
        title: '智谱 GLM Coding: 20+ 大编程工具无缝支持',
        description: 'Claude Code、Cline 等 20+ 大编程工具无缝支持，"码力"全开，越拼越爽！',
        discount: '10% 优惠',
    },

    /** Docker Compose 部署指南链接 */
    dockerComposeGuide: {
        url: '/installation/docker-compose/',
        label: '查看部署指南',
        title: 'Docker Compose 部署: 一键部署 Hagicode',
        description: '一键部署 Hagicode，快速体验 AI 编程助手',
        isInternal: true,
    },
} as const;

/**
 * 阿里云（Aliyun）推广链接配置
 * 用于博客广告区域和其他推广位置
 *
 * @deprecated 推广链接已迁移到 Presets JSON 配置系统
 * 请使用 `@/utils/promoConfig` 中的 `getPromoContent()` 函数获取动态配置的推广内容
 * 此导出仅为向后兼容保留，将在未来版本中移除
 *
 * @see {@link ../src/utils/promoConfig.ts}
 */
export const ALIYUN_PROMO_LINKS = {
    /** 阿里云千问 Coding Plan 订阅链接（带推广码） */
    aistar: {
        url: 'https://www.aliyun.com/benefit/ai/aistar?userCode=vmx5szbq&clubBiz=subTask..12384055..10263..',
        label: '立即订阅',
        title: '阿里云千问 Coding Plan 上线',
        description: '阿里云千问 Coding Plan 已上线，满足开发日常需求。推荐 + Hagicode，完美实现开发过程中的各项需求。',
        external: true,
    },
} as const;

/**
 * 获取 GLM Coding 推广链接
 *
 * @deprecated 推广链接已迁移到 Presets JSON 配置系统
 * 请使用 `@/utils/promoConfig` 中的 `getPromoContent()` 函数获取动态配置的推广内容
 * 此函数仅为向后兼容保留，将在未来版本中移除
 *
 * @see {@link ../src/utils/promoConfig.ts}
 * @returns GLM Coding 推广链接 URL
 */
export function getGlmCodingUrl(): string {
    return GLM_PROMO_LINKS.glmCoding.url;
}

/**
 * 获取阿里云千问 Coding Plan 推广链接
 *
 * @deprecated 推广链接已迁移到 Presets JSON 配置系统
 * 请使用 `@/utils/promoConfig` 中的 `getPromoContent()` 函数获取动态配置的推广内容
 * 此函数仅为向后兼容保留，将在未来版本中移除
 *
 * @see {@link ../src/utils/promoConfig.ts}
 * @returns 阿里云千问 Coding Plan 推广链接 URL
 */
export function getAliyunPromoUrl(): string {
    return ALIYUN_PROMO_LINKS.aistar.url;
}

/**
 * 获取 Docker Compose 指南链接（带 base 路径）
 * @returns Docker Compose 指南完整 URL
 */
export function getDockerComposeGuideUrl(): string {
    const basePath = getDocsBasePath();
    const path = GLM_PROMO_LINKS.dockerComposeGuide.url;
    // 确保 base 路径和链接路径正确拼接
    if (basePath === '/') {
        return path;
    }
    return `${basePath}${path}`.replace(/\/+/g, '/');
}

/**
 * 公共链接类型
 */
export type PublicLinkKey = keyof typeof SITE_LINKS;

export function getLinkWithLocale(key: PublicLinkKey, locale?: string): string {
    const config = SITE_LINKS[key];
    const env = getEnvironment();
    const url = env === 'development' ? config.dev : config.prod;

    if (config.external) {
        return url;
    }

    return localizeAbsoluteUrl(url, locale);
}

/**
 * 获取指定链接的当前环境 URL
 * @param key - 链接键名
 * @returns 当前环境下的完整 URL
 */
export function getLink(key: PublicLinkKey): string {
    const config = SITE_LINKS[key];
    const env = getEnvironment();

    if (env === 'development') {
        return config.dev;
    }
    return config.prod;
}

/**
 * 获取指定链接的配置信息
 * @param key - 链接键名
 * @returns 链接配置对象
 */
export function getLinkConfig(key: PublicLinkKey): LinkConfig {
    return SITE_LINKS[key];
}

/**
 * 判断链接是否为外部链接
 * @param key - 链接键名
 * @returns 是否为外部链接
 */
export function isExternalLink(key: PublicLinkKey): boolean {
    return SITE_LINKS[key].external === true;
}

/**
 * 获取链接的打开方式属性
 * @param key - 链接键名
 * @returns target 属性值
 */
export function getLinkTarget(key: PublicLinkKey): '_blank' | undefined {
    return isExternalLink(key) ? '_blank' : undefined;
}

/**
 * 获取链接的 rel 属性（用于外部链接的安全）
 * @param key - 链接键名
 * @returns rel 属性值
 */
export function getLinkRel(key: PublicLinkKey): 'noopener noreferrer' | undefined {
    return isExternalLink(key) ? 'noopener noreferrer' : undefined;
}
