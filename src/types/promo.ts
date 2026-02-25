/**
 * 推广相关类型定义
 *
 * 提供推广配置的 TypeScript 类型接口，确保配置的编译时类型安全
 */

/**
 * 推广元数据接口
 *
 * 定义 provider JSON 文件中的 promotion 对象结构
 */
export interface PromotionMetadata {
  /** 是否启用此推广 */
  enabled: boolean;
  /** 推广标题 */
  title: string;
  /** 推广描述 */
  description: string;
  /** 行动号召按钮标签 */
  ctaLabel: string;
  /** 行动号召链接 URL */
  ctaUrl: string;
  /** 徽章文本（可选） */
  badge?: string;
  /** 展示优先级（数字越小越靠前） */
  priority: number;
}

/**
 * Provider 配置接口（扩展现有 provider 结构）
 *
 * 对应 public/presets/claude-code/providers/*.json 的数据结构
 */
export interface ProviderConfig {
  /** 提供商 ID */
  providerId: string;
  /** 提供商名称 */
  name: string;
  /** 提供商描述 */
  description: string;
  /** 是否推荐 */
  recommended?: boolean;
  /** 推荐链接 */
  referralUrl?: string;
  /** 分类 */
  category?: string;
  /** API 地址配置 */
  apiUrl?: Record<string, string>;
  /** 区域 */
  region?: string;
  /** 默认模型 */
  defaultModels?: Record<string, string>;
  /** 支持的模型列表 */
  supportedModels?: string[];
  /** 功能特性 */
  features?: string[];
  /** 认证令牌环境变量名 */
  authTokenEnv?: string;
  /** 文档链接 */
  documentationUrl?: string;
  /** 备注 */
  notes?: string;
  /** 推广元数据（新增字段） */
  promotion?: PromotionMetadata;
}

/**
 * 推广内容接口（用于组件渲染的简化接口）
 *
 * 从 ProviderConfig 提取的推广相关信息，用于组件渲染
 */
export interface PromoContent {
  /** 提供商 ID */
  providerId: string;
  /** 提供商名称 */
  name: string;
  /** 推广标题 */
  title: string;
  /** 推广描述 */
  description: string;
  /** 行动号召按钮标签 */
  ctaLabel: string;
  /** 行动号召链接 URL */
  ctaUrl: string;
  /** 徽章文本（可选） */
  badge?: string;
}

/**
 * Provider 文件模块接口
 *
 * 用于 import.meta.glob 返回的模块类型
 */
export interface ProviderModule {
  /** Provider 配置数据 */
  default: ProviderConfig;
}
