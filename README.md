# HagiCode Documentation

独立的 HagiCode 文档站点，使用 Astro 和 Starlight 构建。

## 仓库结构

```
docs/
├── src/
│   ├── content/docs/    # 文档内容（Markdown 和 MDX 文件）
│   │   └── blog/        # 博客文章
│   ├── components/      # 自定义 UI 组件
│   ├── config/          # 导航和配置
│   ├── integrations/    # Astro 集成
│   ├── pages/           # 页面
│   ├── styles/          # 样式文件
│   └── utils/           # 工具函数
├── public/              # 静态资源（图片、图标等）
├── .github/workflows/   # CI/CD 工作流
├── astro.config.mjs     # Astro 配置
├── package.json         # 依赖和脚本
├── tsconfig.json        # TypeScript 配置
└── illustration-management.md  # 配图管理指南
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

文档站点将在 http://localhost:31265 启动。

### 构建

```bash
npm run build
```

构建输出将生成在 `dist/` 目录。

### 外链缓存校验

`npm run build` 仍然会校验内部链接和静态资源；只有在 `CI=true` 时，构建才会额外启用 `.tmp/link-check-cache/` 下的外部链接结果缓存。

- 成功且未过期的外链缓存会直接复用，避免对相同 URL 重复发起网络请求。
- 新链接、过期记录、schema 不兼容记录，以及上次失败的 URL 都会重新执行实时校验并刷新缓存。
- 当前默认 TTL 为 48 小时，可通过 `DOCS_LINK_CHECK_CACHE_TTL_HOURS` 覆盖；缓存 schema 升级时会自动忽略旧记录并重新生成。
- GitHub Actions 会在 docs build 前恢复 `.tmp/link-check-cache/`，构建后再以滚动 key 保存新的快照；该目录保持在本地临时目录中，不进入版本控制。

本地如果要模拟 CI 外链检查并验证日志摘要，推荐使用：

```bash
CI=true NODE_ENV=production npm run build
npm run test:link-check-cache
```

若需要强制丢弃旧缓存，可删除 `repos/docs/.tmp/link-check-cache/`，或在实现变更时提升缓存 schema 版本。

### 首页与 docs/blog 默认路径语言规则

- 默认访问 `https://docs.hagicode.com/` 时，会根据 `query > 已保存偏好 > 客户端语言 > 默认英文` 解析首页入口语言。
- 无显式语言且没有已保存偏好时，根路径 `/` 会先读取浏览器语言：中文客户端保留在 `/`，英文或无法识别的语言会尽早跳转到 `/en/`。
- docs 内容页与 blog 的默认无前缀路径（如 `/product-overview/`、`/blog/`）会根据 `query > 已保存偏好 > 默认英文` 解析：没有显式中文信号时会自动进入对应的 `/en/...` 路径。
- 显式 `?lang=zh-CN` 或已保存的中文偏好仍然会保留无前缀中文 docs/blog 路径；因此从中文首页进入后，后续中文文档流仍可保持在 root 路径。
- `/en/` 与 `/en/blog/` 仍然是稳定的英文 landing / blog 入口；本次变更继续没有反转 `src/content/docs/**` 与 `src/content/docs/en/**` 的目录语义。

推荐在构建后执行入口验证：

```bash
npm run build:verify-docs-entry-language
```

该验证会检查首页首次访问时的浏览器语言分流、`/product-overview/` 与 `/blog/` 的英文默认、显式 `?lang=zh-CN` 中文覆盖、无效语言回退，以及 `/en/` / `/en/blog/` 稳定性。

### 管理文档截图 metadata

产品截图维护现在分为两条命令：

- `npm run screenshots:scan-metadata`：只读扫描任意截图目录，输出基础 metadata 报告，适合 CI、本地盘点和同步前预检
- `npm run screenshots:sync`：把 staging 截图导入到 `src/content/docs/img/screenshots/`，调用 imgbin 生成受管 metadata 并重建 manifest

仓库会保留 `screenshot-staging/.gitkeep` 以确保初始 staging 目录可以提交；成功入库的截图源文件会自动从 staging 目录移除，失败项会保留以便重试。

推荐的 staging 布局：

```text
repos/docs/
├── screenshot-staging/
│   ├── installation/
│   │   └── desktop-start.png
│   └── shared/
│       └── settings-license-success.png
└── src/content/docs/img/screenshots/
    └── manifest.json
```

先做只读 metadata 盘点：

```bash
npm run screenshots:scan-metadata -- --input ./screenshot-staging --output ./artifacts/screenshot-report.json
```

扫描报告的 JSON 结构固定为：

```json
{
  "summary": {
    "generatedAt": "2026-03-14T09:30:00.000Z",
    "inputDirectory": "screenshot-staging",
    "outputPath": "artifacts/screenshot-report.json",
    "supportedExtensions": [".jpg", ".jpeg", ".png", ".webp"],
    "scannedFileCount": 3,
    "successCount": 3,
    "failureCount": 0
  },
  "entries": [
    {
      "relativePath": "ai-compose-commit/trigger-button.png",
      "fileName": "trigger-button.png",
      "extension": ".png",
      "mimeType": "image/png",
      "sizeBytes": 290816,
      "createdAt": "2026-03-14T09:00:00.000Z",
      "modifiedAt": "2026-03-14T09:00:00.000Z",
      "width": 1440,
      "height": 900
    }
  ],
  "failures": []
}
```

预期进度日志示例：

```text
[screenshots:scan-metadata] starting scan
[screenshots:scan-metadata] input: ./screenshot-staging
[screenshots:scan-metadata] discovered 3 supported screenshot files
[screenshots:scan-metadata] [1/3] scanning ai-compose-commit/trigger-button.png
[screenshots:scan-metadata] [1/3] ok 1440x900 284 KB
[screenshots:scan-metadata] [2/3] scanning ai-compose-commit/confirm-dialog.png
[screenshots:scan-metadata] [2/3] ok 1440x900 301 KB
[screenshots:scan-metadata] [3/3] scanning monospecs/select-repository.png
[screenshots:scan-metadata] [3/3] ok 1728x1117 512 KB
[screenshots:scan-metadata] wrote report to ./artifacts/screenshot-report.json
[screenshots:scan-metadata] completed: 3 succeeded, 0 failed
```

再执行入库同步命令：

```bash
npm run screenshots:sync
```

默认的 ImgBin analysis context file 位于 `repos/docs/prompts/screenshot-analysis-context.txt`。`screenshots:sync` 在本地和 CI 中都会按以下优先级解析它：

1. `--analysis-context-file <path>`
2. `SCREENSHOT_ANALYSIS_CONTEXT_FILE`
3. 仓库内默认文件 `./prompts/screenshot-analysis-context.txt`

脚本会在真正调用 ImgBin 前先校验该文件存在且去掉空白后仍非空；如果 context file 缺失或为空，会直接失败并输出对应路径，避免批量导入跑到一半才暴露配置问题。

常用参数：

- `screenshots:scan-metadata --input <dir>`：指定只读扫描目录，默认 `screenshot-staging`
- `screenshots:scan-metadata --output <path>`：把 JSON 报告写入文件，同时继续输出同结构 stdout
- `--input <dir>`：指定截图 staging 根目录
- `--library-root <dir>`：指定受管截图根目录，默认 `src/content/docs/img/screenshots`
- `--manifest <path>`：指定 manifest 输出文件，默认 `src/content/docs/img/screenshots/manifest.json`
- `--imgbin <path>`：显式指定 imgbin CLI；未提供时默认优先使用 `repos/docs` 已安装的 `@hagicode/imgbin`，否则回退到 `../imgbin/dist/cli.js`
- `--category <name>`：强制所有截图使用同一个分类
- `--analysis-context-file <path>`：覆盖默认的 ImgBin analysis context file
- `--analysis-prompt <path>`：额外追加自定义 analysis prompt；不会替代 context file
- `--dry-run`：只预览扫描和目标路径，不写入任何文件
- `--reindex`：导入后执行一次 imgbin 搜索索引重建

环境变量：

```bash
IMGBIN_EXECUTABLE=../imgbin/dist/cli.js
SCREENSHOT_STAGING_DIR=./screenshot-staging
SCREENSHOT_LIBRARY_ROOT=./src/content/docs/img/screenshots
SCREENSHOT_MANIFEST_PATH=./src/content/docs/img/screenshots/manifest.json
SCREENSHOT_ANALYSIS_CONTEXT_FILE=./prompts/screenshot-analysis-context.txt
SCREENSHOT_ANALYSIS_PROMPT=./prompts/custom-analysis-prompt.txt
```

如果这些变量已经写入 `repos/docs/.env`，那么 `npm run screenshots:sync` 会自动读取它们，并在没有显式设置 `TMPDIR`、`TMP`、`TEMP` 时自动创建 `.tmp` 作为导入中转目录。默认情况下，命令会优先调用 `repos/docs` 中已安装的 `@hagicode/imgbin`，并自动加载 `./prompts/screenshot-analysis-context.txt`。

### 自动图片压缩

`repos/docs` 已启用仓库级 GitHub Actions 图片压缩 workflow。只要提交或合并中包含以下位图格式，仓库就会在提交后自动尝试压缩：

- `png`
- `jpg`
- `jpeg`
- `webp`

该自动化覆盖 docs 仓库里的常见图片目录，包括：

- `src/content/docs/img/**`
- `src/content/docs/img/screenshots/**`
- `public/img/**`

行为说明：

- `pull_request`、推送到 `main`、手动触发和定时任务都会运行 `Compress images` workflow
- 压缩发生在 GitHub Actions 中，不是 `npm run build` 前必须执行的本地步骤
- `svg`、`gif`、JSON metadata、prompt 文件等非目标格式继续按现有流程手动维护
- 非 PR 事件如果检测到可压缩结果，会自动创建 `Auto Compress Images` PR 回流仓库

维护 `screenshot-analysis-context.txt` 时，建议只写“长期稳定、跨多张截图都成立”的语义，例如页面类型、常见按钮形态、双语界面线索、安装/配置/会话/确认成功等工作流语义。不要把一次性排障备注、某个工单的临时说明、只对单张截图成立的猜测、模型供应商特定 hack 或版本号清单塞进这个文件；这些内容更适合留在单次命令参数、变更说明或单独的实验 prompt 里。

行为约定：

1. 支持 `png`、`jpg`、`jpeg`、`webp` 四种截图格式。
2. `screenshots:scan-metadata` 只读扫描，不会移动文件、不会调用 imgbin、不会刷新 manifest；它适合在真正同步前先确认尺寸、时间戳和坏图。
3. 默认根据 staging 子目录推导分类；若截图直接放在 staging 根目录，则会进入 `shared/` 分类。
4. 文件名会被归一化为稳定 slug；如果同一分类下出现重名截图，会自动追加基于相对路径的哈希后缀，确保重复执行不产生歧义目录。
5. 已存在的受管截图目录会被复用并刷新 `original.*` 与 `metadata.json`，不会生成无控制的 `-2`、`-3` 重复目录。
6. 成功处理的截图会自动从 staging 目录移除；失败的截图会保留在原位置，方便排查和重试。
7. 批处理时单个截图失败不会回滚已经成功的导入；命令会继续处理剩余文件，并以非零退出码报告失败数量，方便 CI/CD 检测。
8. `screenshots:sync` 会自动读取 `repos/docs/.env`，并在未显式设置 `TMPDIR`、`TMP`、`TEMP` 时自动创建 `.tmp` 作为工作目录。
9. `screenshots:sync` 启动时会打印本次将使用的 analysis context file，方便在 CI 日志里确认是否命中了默认路径或显式覆盖。
10. `screenshots:sync` 在 imgbin 分析或批量导入阶段可能只先打印启动信息，看起来像“开始了但还没动静”；这时优先先跑一次 `screenshots:scan-metadata` 做预检，确认文件集和基础 metadata 没问题，再继续同步。
11. 每次成功运行都会重建 `src/content/docs/img/screenshots/manifest.json`，并刷新图库下的 imgbin 搜索索引，方便后续按标题、标签、描述和来源路径检索这些截图。

文档侧引用可以通过 `src/utils/screenshot-manifest.js` 读取 manifest，再根据当前文档路径生成 Markdown/MDX 可用的相对图片地址。

### 预览构建结果

```bash
npm run preview
```

## 贡献指南

### 编辑文档

文档内容位于 `src/content/docs/` 目录。编辑 Markdown 文件后，更改将自动在开发服务器中反映。

### 维护「大模型指南」分类

`src/content/docs/llm-guide/` 与 `src/content/docs/en/llm-guide/` 用于维护模型对比文档，更新时请遵循以下约束：

1. 每次更新评测结论时，同步更新“测试时间与场景说明”。
2. 中文与英文页面保持相同章节骨架，避免语言切换信息不一致。
3. 模型条目至少包含：模型名称、测试时间、代码质量评分、性价比评分。
4. 建议每月复核一次，若模型能力或价格发生明显变化应立即补充更新。

### 添加博客文章

1. 在 `src/content/docs/blog/` 创建新文件
2. 使用日期前缀命名（例如：`2026-02-21-my-post.mdx`）
3. 添加 frontmatter 元数据

### 添加静态资源

将图片和其他静态文件放入 `public/` 目录。它们在构建时会被复制到 `dist/` 目录的根路径。

### 博客多语言与广告显示维护

当调整 `src/components/StarlightHeader.astro`、`src/components/MarkdownContent.astro`、`src/components/BlogHeaderAd.astro`、`src/components/BlogFooterAd.astro` 时，请同步检查以下项：

1. locale 解析链路保持一致：`Astro.currentLocale` -> `starlightRoute.locale` -> `root`。
2. 博客导航在中英文构建产物中都有非空文案（`博客` / `Blog`）。
3. StarlightAd 头/尾广告区标题、描述、CTA 文案在构建产物中非空。
4. 语言切换后 Blog 路由保持连续（root 中文路径与 `/en/blog/` 英文路径之间可相互切换）。

推荐使用以下命令执行构建后验证：

```bash
npm run build:verify-blog-i18n
# 或仅验证已构建产物
npm run verify:blog-sidebar-i18n
```

### StarlightAd 线上可见性故障排查

若线上出现“广告方格可见但文字不可见”，优先检查：

1. **主题变量是否缺失**：确认 `--color-primary`、`--color-secondary`、`--sl-color-text-high` 在目标主题下可解析。
2. **样式层叠是否覆盖文字颜色**：检查是否存在 `color: transparent`、`-webkit-text-fill-color: transparent` 或高优先级覆盖。
3. **构建差异**：对比本地 `dist/` 与线上页面渲染结果，确认构建产物中广告文本节点存在且非空。
4. **内容源是否为空**：确认 `public/presets/claude-code/providers/*.json` 的 `promotion` 字段完整，或回退文案可正常渲染。

### 上线后抽样检查清单

建议每次发布后抽样检查以下页面与项目：

1. `https://docs.hagicode.com/blog/`：首次无偏好访问应自动进入英文 blog，若已保存中文偏好则保留中文路径。
2. `https://docs.hagicode.com/en/blog/`：导航文案显示英文且可返回中文路径。
3. 任一中文博客详情页：顶部/底部广告标题、描述、按钮文案可见。
4. 任一中文博客详情页点击语言切换：路由与文案切换行为符合预期。
5. 若发现回退文案：确认是否为翻译缺失导致，并记录后续补充计划。

## CI/CD

文档通过 GitHub Actions 自动部署到 Azure Static Web Apps。

- 推送到 `main` 分支会触发部署
- Pull Requests 会触发构建验证
- 图片相关的 `png`、`jpg`、`jpeg`、`webp` 变更还会触发独立的 `Compress images` workflow
- 该 workflow 在仓库内提交后执行压缩，不替代本地截图 metadata 或文档构建流程

## 相关资源

- [Astro 文档](https://docs.astro.build)
- [Starlight 文档](https://starlight.astro.build)
- [配图管理指南](./illustration-management.md)
