/**
 * 导航链接配置
 * 站点导航链接的统一数据源,确保所有组件使用相同的链接配置
 * 使用共享链接库管理站点间跳转和公共链接
 * 支持中英文双语显示
 */
import { getLink, getLinkTarget, getLinkRel, type PublicLinkKey } from '@shared/links';
import { resolveDocsLocale, type DocsLocale } from '@/lib/i18n';

/**
 * 导航链接接口
 * 定义导航链接的基本结构
 */
export interface NavLink {
  /** 链接显示文本 */
  label: string;

  /** 英文版显示文本 */
  labelEn?: string;

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
    labelEn: "Home",
    href: getLink('website'),
    linkKey: 'website',
  },
  {
    label: "博客",
    labelEn: "Blog",
    href: getLink('blog'),
    linkKey: 'blog',
  },
  {
    label: "技术支持群",
    labelEn: "Support Group",
    href: getLink('qqGroup'),
    external: true,
    icon: "comment",
    linkKey: 'qqGroup',
  },
  {
    label: "Discord",
    labelEn: "Discord",
    href: getLink('discord'),
    external: true,
    icon: "comment",
    linkKey: 'discord',
  },
];

/**
 * 按 locale 解析导航显示文案，缺失时回退到中文标签。
 */
export function getNavLinkLabel(link: NavLink, locale: DocsLocale): string {
  if (locale === 'en' && link.labelEn) {
    return link.labelEn;
  }

  if (link.label) {
    return link.label;
  }

  if (link.labelEn) {
    return link.labelEn;
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
        ? (locale === 'en' ? '/en/blog/' : '/blog/')
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
