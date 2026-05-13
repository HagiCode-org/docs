# Claude Code AI 配置预设

本目录包含 Claude Code AI 的配置预设文件，用于在各种应用中快速配置 Anthropic 兼容的 API 提供商。

## 目录结构

```
presets/
├── index.json              # 全局预设索引（所有类型的预设）
└── claude-code/
    └── providers/          # Claude Code AI 提供商预设
        ├── anthropic.json
        ├── zai.json
        ├── aliyun.json
        └── minimax.json
```

## 使用方法

### 获取预设索引

```bash
curl https://<your-docs-site>/presets/index.json
```

### 加载特定提供商预设

```bash
curl https://<your-docs-site>/presets/claude-code/providers/zai.json
```

## 预设格式

### 索引文件 (index.json)

索引文件包含所有预设类型的元数据和路径信息：

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-02-24T00:00:00Z",
  "types": {
    "claude-code": {
      "path": "claude-code",
      "description": "Claude Code AI 配置预设",
      "providers": {
        "anthropic": {
          "path": "claude-code/providers/anthropic.json",
          "name": "Anthropic Official",
          "description": "官方 Anthropic API",
          "recommended": false
        }
      }
    }
  }
}
```

### 提供商预设文件

每个提供商预设文件包含完整的 API 配置：

```json
{
  "providerId": "zai",
  "name": "智谱 AI",
  "description": "智谱 AI 提供的 Claude API 兼容服务",
  "category": "china-providers",
  "apiUrl": {
    "codingPlanForAnthropic": "https://open.bigmodel.cn/api/anthropic"
  },
  "recommended": true,
  "region": "cn",
  "defaultModels": {
    "sonnet": "glm-4.7",
    "opus": "glm-5",
    "haiku": "glm-4.5-air"
  },
  "supportedModels": ["glm-4.7", "glm-5", "glm-4.5-air"],
  "referralUrl": "https://open.bigmodel.cn/"
}
```

## 添加新提供商

### 1. 创建提供商预设文件

在 `public/presets/claude-code/providers/` 目录下创建新的 JSON 文件，文件名使用 kebab-case 格式（如 `new-provider.json`）。

### 2. 更新索引文件

在 `presets/index.json` 的 `types.claude-code.providers` 对象中添加新提供商的条目：

```json
{
  "new-provider": {
    "path": "claude-code/providers/new-provider.json",
    "name": "New Provider",
    "description": "新提供商描述",
    "recommended": false
  }
}
```

### 3. 验证 JSON 格式

```bash
cat public/presets/index.json | jq .
cat public/presets/claude-code/providers/new-provider.json | jq .
```

## 添加新的预设类型

预设系统设计为可扩展，支持添加其他 AI 服务的预设（如 OpenAI、Gemini 等）。

### 步骤

1. **创建新类型目录**：在 `presets/` 下创建新的子目录（如 `openai/`）
2. **创建 providers 子目录**：在新类型目录下创建 `providers/` 目录
3. **添加提供商预设文件**：在 `providers/` 目录下添加提供商 JSON 文件
4. **更新索引文件**：在 `index.json` 的 `types` 对象中添加新类型

### 示例：添加 OpenAI 预设类型

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-02-24T00:00:00Z",
  "types": {
    "claude-code": { ... },
    "openai": {
      "path": "openai",
      "description": "OpenAI API 配置预设",
      "providers": {
        "openai-official": {
          "path": "openai/providers/openai-official.json",
          "name": "OpenAI Official",
          "description": "官方 OpenAI API",
          "recommended": false
        }
      }
    }
  }
}
```

## 版本历史

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| 1.0.0 | 2025-02-24 | 初始版本，支持 Claude Code AI 预设 |
