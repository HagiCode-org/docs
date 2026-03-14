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

### 管理文档截图 metadata

产品截图统一通过 `screenshot-staging/` 入库到 `src/content/docs/img/screenshots/`，避免手工拼接路径和散落的描述信息。
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

执行同步命令：

```bash
npm run screenshots:sync -- --input ./screenshot-staging
```

常用参数：

- `--input <dir>`：指定截图 staging 根目录
- `--library-root <dir>`：指定受管截图根目录，默认 `src/content/docs/img/screenshots`
- `--manifest <path>`：指定 manifest 输出文件，默认 `src/content/docs/img/screenshots/manifest.json`
- `--imgbin <path>`：显式指定 imgbin CLI；未提供时默认尝试 `../imgbin/dist/cli.js`
- `--category <name>`：强制所有截图使用同一个分类
- `--dry-run`：只预览扫描和目标路径，不写入任何文件
- `--reindex`：导入后执行一次 imgbin 搜索索引重建

环境变量：

```bash
IMGBIN_EXECUTABLE=/absolute/or/relative/path/to/imgbin/dist/cli.js
SCREENSHOT_STAGING_DIR=./screenshot-staging
SCREENSHOT_LIBRARY_ROOT=./src/content/docs/img/screenshots
SCREENSHOT_MANIFEST_PATH=./src/content/docs/img/screenshots/manifest.json
SCREENSHOT_ANALYSIS_PROMPT=./prompts/custom-analysis-prompt.txt
```

行为约定：

1. 支持 `png`、`jpg`、`jpeg`、`webp` 四种截图格式。
2. 默认根据 staging 子目录推导分类；若截图直接放在 staging 根目录，则会进入 `shared/` 分类。
3. 文件名会被归一化为稳定 slug；如果同一分类下出现重名截图，会自动追加基于相对路径的哈希后缀，确保重复执行不产生歧义目录。
4. 已存在的受管截图目录会被复用并刷新 `original.*` 与 `metadata.json`，不会生成无控制的 `-2`、`-3` 重复目录。
5. 成功处理的截图会自动从 staging 目录移除；失败的截图会保留在原位置，方便排查和重试。
6. 批处理时单个截图失败不会回滚已经成功的导入；命令会继续处理剩余文件，并以非零退出码报告失败数量，方便 CI/CD 检测。
7. 每次成功运行都会重建 `src/content/docs/img/screenshots/manifest.json`；manifest 只包含识别成功的截图条目，因此修复环境后直接重试即可恢复引用。

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
4. 语言切换后 Blog 路由保持连续（`/blog/` <-> `/en/blog/`）。

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

1. `https://docs.hagicode.com/blog/`：导航文案显示中文且包含语言切换入口。
2. `https://docs.hagicode.com/en/blog/`：导航文案显示英文且可返回中文路径。
3. 任一中文博客详情页：顶部/底部广告标题、描述、按钮文案可见。
4. 任一中文博客详情页点击语言切换：路由与文案切换行为符合预期。
5. 若发现回退文案：确认是否为翻译缺失导致，并记录后续补充计划。

## CI/CD

文档通过 GitHub Actions 自动部署到 Azure Static Web Apps。

- 推送到 `main` 分支会触发部署
- Pull Requests 会触发构建验证

## 相关资源

- [Astro 文档](https://docs.astro.build)
- [Starlight 文档](https://starlight.astro.build)
- [配图管理指南](./illustration-management.md)
