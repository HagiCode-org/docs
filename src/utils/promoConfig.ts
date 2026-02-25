/**
 * 推广配置工具模块
 *
 * 从 Presets JSON 文件动态读取推广配置，提供类型安全的配置访问接口
 *
 * @example
 * ```ts
 * import { getEnabledPromos } from '@/utils/promoConfig';
 *
 * const promos = getEnabledPromos();
 * // 返回: PromoContent[]
 * ```
 */

import type { ProviderConfig, PromoContent } from '@/types/promo';

/**
 * 获取所有 provider 配置
 *
 * 使用 import.meta.glob 在构建时读取所有 provider JSON 文件
 * @returns 所有 provider 配置数组
 *
 * @example
 * ```ts
 * const providers = getAllProviderConfigs();
 * // 返回: ProviderConfig[]
 * ```
 */
export function getAllProviderConfigs(): ProviderConfig[] {
  try {
    // 使用 import.meta.glob 读取所有 provider JSON 文件
    // eager: true 确保在构建时立即加载所有模块
    const providerModules = import.meta.glob<{ default: unknown }>(
      '../../public/presets/claude-code/providers/*.json',
      {
        eager: true,
        as: 'object',
      }
    );

    const providers: ProviderConfig[] = [];

    for (const [path, moduleData] of Object.entries(providerModules)) {
      try {
        const config = moduleData.default as ProviderConfig;

        // 验证必填字段
        if (!config.providerId || !config.name) {
          console.warn(
            `[promoConfig] Invalid provider config in ${path}: missing providerId or name`
          );
          continue;
        }

        providers.push(config);
      } catch (error) {
        console.warn(`[promoConfig] Failed to parse provider config in ${path}:`, error);
        // 继续处理其他文件
        continue;
      }
    }

    return providers;
  } catch (error) {
    console.error('[promoConfig] Failed to load provider configs:', error);
    // 返回空数组而不是抛出错误，确保构建不会失败
    return [];
  }
}

/**
 * 获取包含推广元数据的 providers
 *
 * 过滤出定义了 promotion 字段的 provider 配置
 * @returns 包含推广元数据的 provider 配置数组
 *
 * @example
 * ```ts
 * const promoProviders = getPromoProviders();
 * // 返回: ProviderConfig[] (每个元素都有 promotion 字段)
 * ```
 */
export function getPromoProviders(): ProviderConfig[] {
  const allProviders = getAllProviderConfigs();
  return allProviders.filter((provider) => provider.promotion !== undefined);
}

/**
 * 获取启用的推广配置
 *
 * 过滤出 promotion.enabled === true 的 providers，并按 priority 排序
 * @returns 启用的推广内容数组（按 priority 升序，priority 相同按 providerId 字母序）
 *
 * @example
 * ```ts
 * const enabledPromos = getEnabledPromos();
 * // 返回: ProviderConfig[] (已排序)
 * ```
 */
export function getEnabledPromos(): ProviderConfig[] {
  const promoProviders = getPromoProviders();

  return promoProviders
    .filter((provider) => provider.promotion?.enabled === true)
    .sort((a, b) => {
      const priorityA = a.promotion?.priority ?? Number.MAX_SAFE_INTEGER;
      const priorityB = b.promotion?.priority ?? Number.MAX_SAFE_INTEGER;

      // 首先按 priority 升序排序（数字越小越靠前）
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // priority 相同时，按 providerId 字母序排序
      return a.providerId.localeCompare(b.providerId);
    });
}

/**
 * 获取推广内容（用于组件渲染）
 *
 * 返回简化的推广内容接口，便于组件使用
 * @returns 推广内容数组
 *
 * @example
 * ```ts
 * const promoContents = getPromoContent();
 * // 返回: PromoContent[]
 * // [{
 * //   providerId: "zai",
 * //   name: "智谱 AI",
 * //   title: "智谱 GLM Coding: 20+ 大编程工具无缝支持",
 * //   description: "...",
 * //   ctaLabel: "立即开拼",
 * //   ctaUrl: "https://...",
 * //   badge: "推荐"
 * // }]
 * ```
 */
export function getPromoContent(): PromoContent[] {
  const enabledPromos = getEnabledPromos();

  const result: PromoContent[] = [];

  for (const provider of enabledPromos) {
    const promotion = provider.promotion;
    if (!promotion) {
      continue;
    }

    // 验证必填字段
    if (
      !promotion.title ||
      !promotion.description ||
      !promotion.ctaLabel ||
      !promotion.ctaUrl
    ) {
      console.warn(
        `[promoConfig] Incomplete promotion data for provider ${provider.providerId}: missing required fields`
      );
      continue;
    }

    result.push({
      providerId: provider.providerId,
      name: provider.name,
      title: promotion.title,
      description: promotion.description,
      ctaLabel: promotion.ctaLabel,
      ctaUrl: promotion.ctaUrl,
      badge: promotion.badge,
    });
  }

  return result;
}

/**
 * 根据 providerId 获取特定推广内容
 * @param providerId - 提供商 ID
 * @returns 推广内容，如果未找到或未启用则返回 undefined
 *
 * @example
 * ```ts
 * const zaiPromo = getPromoByProviderId('zai');
 * // 返回: PromoContent | undefined
 * ```
 */
export function getPromoByProviderId(providerId: string): PromoContent | undefined {
  const promoContents = getPromoContent();
  return promoContents.find((promo) => promo.providerId === providerId);
}

/**
 * 判断是否有任何启用的推广
 * @returns 如果至少有一个启用的推广则返回 true
 *
 * @example
 * ```ts
 * if (hasAnyEnabledPromos()) {
 *   // 显示推广区域
 * }
 * ```
 */
export function hasAnyEnabledPromos(): boolean {
  return getEnabledPromos().length > 0;
}
