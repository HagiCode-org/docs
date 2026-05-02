/**
 * 导航链接配置
 * 站点导航链接的统一数据源,确保所有组件使用相同的链接配置
 * 使用共享链接库管理站点间跳转和公共链接
 * 支持中英文双语显示
 */
import { getLink, getLinkRel, getLinkTarget, getLinkWithLocale, type PublicLinkKey } from '@shared/links';
import { buildDocsRoutePath, resolveDocsLocale, type DocsLocale } from '@/lib/i18n';

/**
 * 导航链接接口
 * 定义导航链接的基本结构
 */
export interface NavLink {
  /** 链接显示文本 */
  label: string;

  /** 非默认语言显示文本 */
  translations?: Partial<Record<Exclude<DocsLocale, 'root'>, string>>;

  /** 链接地址 (支持相对路径和绝对 URL) */
  href: string;

  /** 是否为外部链接 (可选) */
  external?: boolean;

  /** Starlight 图标名称 (可选) */
  icon?: string;

  /** 链接键名 (用于从共享库获取环境相关链接) */
  linkKey?: PublicLinkKey;
}

export interface LocalizedNavLink extends NavLink {
  /** 当前 locale 最终渲染文案 */
  displayLabel: string;
}

/**
 * 站点导航链接配置
 * 使用共享链接库,自动根据环境切换开发/生产链接
 * 根据语言显示不同的文本
 */
export const navLinks: NavLink[] = [
  {
    label: "首页",
    translations: {
      en: 'Home',
      'zh-Hant': '首頁',
      'ja-JP': 'ホーム',
      'ko-KR': '홈',
      'de-DE': 'Startseite',
      'fr-FR': 'Accueil',
      'es-ES': 'Inicio',
      'pt-BR': 'Início',
      'ru-RU': 'Главная',
    },
    href: getLink('website'),
    linkKey: 'website',
  },
  {
    label: "部署生成器",
    translations: {
      en: 'Builder',
      'zh-Hant': '部署產生器',
      'ja-JP': 'デプロイビルダー',
      'ko-KR': '배포 빌더',
      'de-DE': 'Deployment-Builder',
      'fr-FR': 'Générateur de déploiement',
      'es-ES': 'Generador de despliegue',
      'pt-BR': 'Gerador de implantação',
      'ru-RU': 'Генератор развертывания',
    },
    href: 'https://builder.hagicode.com/',
  },
  {
    label: "博客",
    translations: {
      en: 'Blog',
      'zh-Hant': '部落格',
      'ja-JP': 'ブログ',
      'ko-KR': '블로그',
      'de-DE': 'Blog',
      'fr-FR': 'Blog',
      'es-ES': 'Blog',
      'pt-BR': 'Blog',
      'ru-RU': 'Блог',
    },
    href: getLink('blog'),
    linkKey: 'blog',
  },
  {
    label: "获取技术支持",
    translations: {
      en: 'Get Support',
      'zh-Hant': '獲取技術支援',
      'ja-JP': 'サポート',
      'ko-KR': '기술 지원',
      'de-DE': 'Support',
      'fr-FR': 'Assistance',
      'es-ES': 'Soporte',
      'pt-BR': 'Suporte',
      'ru-RU': 'Поддержка',
    },
    href: getLink('about'),
    icon: "comment",
    linkKey: 'about',
  },
];

/**
 * 按 locale 解析导航显示文案，缺失时回退到中文标签。
 */
export function getNavLinkLabel(link: NavLink, locale: DocsLocale): string {
  if (locale !== 'root' && link.translations?.[locale]) {
    return link.translations[locale];
  }

  if (link.label) {
    return link.label;
  }

  if (link.translations?.en) {
    return link.translations.en;
  }

  // Keep navigation labels non-empty even when upstream config is incomplete.
  return locale === 'en' ? 'Link' : '链接';
}

/**
 * 获取已本地化的导航配置（用于渲染层）。
 */
export function getLocalizedNavLinks(localeInput?: string | null): LocalizedNavLink[] {
  const locale = resolveDocsLocale(localeInput);
  return navLinks.map((link) => ({
    ...link,
    href:
      link.linkKey === 'blog'
        ? buildDocsRoutePath(locale, '/blog/')
        : link.linkKey
          ? getLinkWithLocale(link.linkKey, locale)
        : link.href,
    displayLabel: getNavLinkLabel(link, locale),
  }));
}

/**
 * 获取链接的完整属性
 * @param link - 导航链接对象
 * @returns 包含 target 和 rel 属性的对象
 */
export function getLinkAttributes(link: NavLink) {
  const attributes: { target?: string; rel?: string } = {};

  if (link.external) {
    attributes.target = '_blank';
    attributes.rel = 'noopener noreferrer';
  }

  return attributes;
}
