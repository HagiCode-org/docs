# HagiCode Documentation

[English](./README.md)

本仓库包含基于 Astro 与 Starlight 构建的独立 HagiCode 文档站点。

## 产品概览

文档站是用户了解 HagiCode 的主要入口：产品介绍、安装指南、教程、博客文章以及可下载的配置预设都在这里提供。

## 站点内容范围

- 面向新用户的产品介绍与上手指南
- 分步骤的安装与配置文档
- HagiCode 生态的博客内容与更新动态
- 被公开文档页面引用的预设文件与静态资源

## 仓库结构

- `src/content/docs/` - 中文基线文档与共享 docs 资源
- `src/content/translations/docs/<locale>/` - 使用 canonical source locale 命名的非基线本地化作者目录
- `src/content/.generated/docs/` - 由 `npm run prepare:docs-content` 生成、供 Starlight 消费的组装内容树
- `src/components/` 与 `src/layouts/` - 站点 UI 组件与布局
- `public/` - 静态资源、可下载预设和共享媒体文件
- `scripts/` 与 `tests/` - 文档质量与路由行为的校验工具

## 本地开发

```bash
npm install
npm run dev
npm run build
npm run preview
```

本地文档站默认运行在 `http://localhost:31265`。

## GitHub Actions

- `.github/workflows/docs-ci.yml` 负责对 `main` 的 push 与 pull request 做校验。
- `.github/workflows/docs-deploy-gh-pages.yml` 会在 `main` push 与 `workflow_dispatch` 时发布一份经过校验的 `gh-pages` payload。
- `gh-pages` 的 payload 契约是：分支根目录保留 `esa.jsonc`、`wrangler.jsonc`，并在 `npm run build:ci` 校验通过后把可发布的 Astro 产物组装到 `dist/`。
- build job 保持只读并上传校验后的 payload artifact；`gh-pages` 仍然是权威发布面，只有 deploy job 获得 `contents: write`。
- 手动 `workflow_dispatch` 会基于所选 ref 重新执行 `npm run build:ci`，并把生成的 payload 重新发布到 `gh-pages`。
- Cloudflare 直接发布现在在这个 workflow 之外处理；请把 `gh-pages/wrangler.jsonc` 视为直接发布操作使用的、受版本控制的 Wrangler 契约。
- 现有工作流保持不变：`.github/workflows/docs-ci.yml`、`.github/workflows/azure-static-web-apps-agreeable-stone-04924c800.yml`、`.github/workflows/compress-images.yml` 与 `.github/workflows/indexnow.yml` 都继续保留，新工作流只是附加能力。
- 不要把新增工作流等同于生产切换：仅添加工作流，并不能证明 `docs.hagicode.com` 已经开始读取 `gh-pages/esa.jsonc`、`gh-pages/wrangler.jsonc` 这份 Wrangler 契约，以及 `gh-pages/dist/`。
- 在把 `docs.hagicode.com` 视为 `gh-pages` 消费方之前，先完成后续检查：确认工作流实际发布了 `esa.jsonc`、`wrangler.jsonc` 与 `dist/`，确认托管目标仍然指向 `gh-pages`，然后再访问 `https://docs.hagicode.com` 验证部署结果。
- 这次变更只迁移 `repos/docs`；`repos/awesome-design-md-site`、`repos/cost`、`repos/index`、`repos/soul`、`repos/trait` 与 `repos/docker-compose-builder-web` 继续保持不变，作为后续迁移候选项。
- `.github/workflows/compress-images.yml` 和 `.github/workflows/indexnow.yml` 负责仓库维护类自动化。

## hagi18n 维护工作流

Docs 的 UI 文案由本仓库内的 `@hagicode/hagi18n` 维护。翻译源文件位于 `src/i18n/locales/<locale>/`，这是提交到仓库的 source of truth；运行时资源提交在 `src/i18n/generated/`，因为 `astro.config.mjs` 会在配置求值阶段同步导入它们。

在 `repos/docs` 目录运行：

```bash
npm run i18n:audit
npm run i18n:doctor
npm run i18n:generate
npm run i18n:check
```

`npm install` 会安装项目本地的 `hagi18n` CLI。需要直接确认 CLI 可用时，可以运行 `npx hagi18n info`，也可以直接执行上面的 npm scripts。

### 更新 UI 翻译

修改 `src/i18n/locales/en-US/` 与 `src/i18n/locales/zh-CN/` 下的 YAML 文件。两个语言目录必须保持 namespace 文件、标量 key 路径和 `{{placeholder}}` 占位符一致。修改后先运行 `npm run i18n:audit` 或 `npm run i18n:doctor`，再运行 `npm run i18n:generate` 刷新 `src/i18n/generated/docs-locale-resources.mjs`。

`npm run i18n:check` 会同时执行 hagi18n 校验和 generated resource stale check。`npm run dev`、`npm run build` 与 `npm run typecheck` 会先执行 `prepare:docs-runtime`，确保 locale 资源和组装后的 docs 内容树都已生成，再交给 Astro 或 TypeScript 读取。

### 安全的 sync 与 prune 命令

sync 和 prune 默认只做 dry-run 预览：

```bash
npm run i18n:sync
npm run i18n:prune
```

只有显式的 write 变体会修改 locale 源文件：

```bash
npm run i18n:sync:write
npm run i18n:prune:write
```

### 内容边界

hagi18n 只管理 docs UI 文案、博客插件 UI 标签、Starlight locale metadata 和通用语言选择器标签。MDX 文档页与博客正文现在采用“基线内容 + 翻译作者目录 + 构建期组装”的结构：

- 中文基线内容位于 `src/content/docs/`
- 非基线翻译作者文件位于 `src/content/translations/docs/<source-locale>/`
- Astro/Starlight 实际读取的是 `src/content/.generated/docs/` 这棵由 `npm run prepare:docs-content` 组装出的内容树

新增或修改翻译文档时，请保持与基线文件一致的 canonical doc key，并使用 `en-US`、`ja-JP`、`zh-Hant` 这类 canonical locale 目录名。

### 翻译覆盖率报表

用下面这些命令可以查看哪些文档页、博客文章或语言还没有完成翻译：

```bash
npm run report:translation
npm run report:docs-translation
npm run report:blog-translation
```

`npm run report:translation` 会生成组合报表 `.tmp/translation-report.json`，并同时刷新 `.tmp/docs-translation-report.json` 与 `.tmp/blog-translation-report.json`。组合报表会按语言汇总中文基线文档页和博客 slug 的覆盖率，以及缺失、重复和高相似度问题。

### Claude CLI 自动补翻译

如果你想直接基于 zh-CN 原文，用本地 Claude CLI 自动补齐缺失翻译，可以运行：

```bash
npm run translate:missing:claude
```

默认只处理报表里仍然是 **missing** 的条目。如果还想把那些和 zh-CN 原文完全重复的翻译文件也重写一遍，可以运行：

```bash
npm run translate:missing:claude -- --include-duplicates
```

常用筛选方式：

```bash
npm run translate:missing:claude -- --surface blog --locales en-US,ja-JP --limit 5 --dry-run
```

这个流程调用本地 `claude` CLI，直接根据仓库里的 Markdown/MDX 原文进行翻译，不依赖额外的机器翻译 API。脚本会把文档翻译写到 `src/content/translations/docs/<locale>/...`；博客翻译目前按现有博客报表布局写到 `src/content/docs/<locale>/blog/...`。

## 截图分析工作流

受管截图同步流程会在启动 ImgBin 之前读取 `repos/docs/.env`。
仓库默认使用下面这组图片分析配置：

- `IMGBIN_ANALYSIS_PROVIDER=codex`
- `IMGBIN_CODEX_MODEL=lemon/gpt-5.4`
- `IMGBIN_CODEX_BASE_URL=http://localhost:36129/v1`

如果你需要给 `npm run screenshots:sync` 准备一份本地配置文件，可以把 [`./.env.example`](./.env.example) 复制成 `.env`。

## Desktop 版本数据

Desktop 下载数据在运行时直接读取 `repos/index` 发布的 canonical index 端点。
当运行时加载最终失败时，docs 会回退到 Index Desktop 版本历史页：`https://index.hagicode.com/desktop/history/`。
`repos/index` 在此仅作为被引用依赖；稳定 fallback surface 为 `https://index.hagicode.com/desktop/history/` 与 `https://index.hagicode.com/desktop/index.json`。
本仓库仍提供 `public/version-index.json` 作为离线 fallback 快照，但维护者应先排查运行时拉取链路与 index 部署结果，而非在 docs 内新增第二套版本历史页。
按仓库拆分的更新详情页已不再由 docs 托管；后续版本信息入口会在未来的单独变更中重新引入。

## Release Notes 同步工作流

新的版本更新说明入口现在由本仓库托管，受管输出固定为单路由模式：

- `src/data/release-notes/index.json`
- `src/data/release-notes/<tag>.json`
- `src/content/docs/release-notes/index.mdx`
- `src/content/translations/docs/en-US/release-notes/index.mdx`

这些文件统一从权威的 `repos/release-notes` 工作区数据生成。
同步结果不再生成 `src/content/docs/release-notes/<tag>.md` 或 `src/content/translations/docs/en-US/release-notes/<tag>.md` 这类按 tag 拆分的详情页。
版本级深链现在统一改为 landing 页面锚点，例如 `/release-notes/#v0.1.0-beta.46` 与 `/en-US/release-notes/#v0.1.0-beta.46`。
对于 monorepo 内的自动化，首选路径是仓库到仓库的直接转移；GitHub Release asset 只保留为无本地 checkout 时的可选 fallback source。

### 常用命令

```bash
npm run release-notes:fetch
npm run release-notes:materialize
npm run release-notes:sync
npm run verify:release-notes:input
npm run verify:release-notes:output
npm run test:release-notes

# monorepo / cron 路径：直接读取相邻的 release-notes 仓库
DOCS_RELEASE_NOTES_SOURCE=local \
DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT=../release-notes \
npm run release-notes:sync
```

### Source 模式

- `DOCS_RELEASE_NOTES_SOURCE=local`
  - 直接从 `DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT` 读取 `artifacts/tags/<tag>/<tag>.json` 与 `published/<tag>.<locale>.md`。
  - 这是 `hagirepocron` 与同机编排任务的目标模式。
- `DOCS_RELEASE_NOTES_SOURCE=github`
  - 从 `DOCS_RELEASE_NOTES_REPOSITORY` 的 GitHub Releases 与 `release-notes-<tag>-history.zip` asset 读取。
  - 只适合 docs 无法访问本地 sibling checkout 的场景。
- `DOCS_RELEASE_NOTES_SOURCE=auto`
  - 默认模式。
  - 设置了 `DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT` 时优先走本地，否则回退到 GitHub。

### 本地仓库契约

- 每个同步的 tag 必须提供 `artifacts/tags/<tag>/<tag>.json`。
- 每个同步的 tag 还必须同时提供 `published/<tag>.zh-CN.md` 与 `published/<tag>.en.md`。
- 如果 JSON 缺失、JSON 非法、tag 不一致，或某个语言正文缺失，则该 tag 会按确定性原因跳过，不会发布部分页面。
- 本次 docs 侧回滚不会修改这些上游输入路径，也不会改写 `published/` 下的正文结构；问题应优先在 docs 物化层排查。

### GitHub fallback 资产契约

- GitHub fallback 流程只接受命名为 `release-notes-<tag>-history.zip` 的 asset。
- 每个可接受的压缩包都必须包含 `artifacts/tags/<tag>/<tag>.json`。
- 每个可接受的压缩包还必须同时包含 `published/<tag>.zh-CN.md` 与 `published/<tag>.en.md`。

### 自动化与排障

- `.github/workflows/release-notes-sync.yml` 会按日程运行，也支持 `workflow_dispatch` 手动触发。
- 在 monorepo cron 路径中，`hagirepocron` 会显式设置 `DOCS_RELEASE_NOTES_SOURCE=local` 并传入 sibling `release-notes` 路径，因此 docs 页面物化不再依赖已发布的 release asset。
- docs 受管数据现已拆分为轻量 `index.json` 与按 tag 输出的详情 JSON；landing 页面仍保持单路由聚合展示。
- `npm run build` 会在 Astro 构建前校验 release-notes 输入，并在 Astro 构建后校验静态产物。只有 `src/data/release-notes/index.json` 的 `entries` 为空时才允许 release-notes 空态；只要 entries 存在，detail JSON、本地化正文、版本锚点或静态 HTML 内容缺失都必须让构建失败。
- 工作流优先使用 `DOCS_RELEASE_NOTES_TOKEN` 访问上游 GitHub API；只有当当前仓库默认 `GITHUB_TOKEN` 本身就具备跨仓库可见性时，才会回退到它。
- 在 CI 中，`DOCS_RELEASE_NOTES_ALLOW_STALE_ON_SOURCE_ERROR=true` 会在上游仓库暂时不可访问、但当前受管输出已存在时保留现状并继续通过工作流。
- 同步脚本除 Node.js 之外，还依赖系统自带的 `zip` 与 `unzip` 工具。
- 如果历史同步曾留下 `src/content/docs/release-notes/*.md` 或 `src/content/translations/docs/en-US/release-notes/*.md`，重新运行 `npm run release-notes:sync` 会自动清理这些旧的受管详情页。
- 如果需要排查“为什么页面仍然像旧的多路由模式”，先确认 `src/data/release-notes/index.json` 中是否已经移除了 `routes` 字段、为每个条目生成 `anchorId`，并且 `src/data/release-notes/<tag>.json` 已正确写出详情 HTML。
- 如果 local 模式下同步日志里出现 skipped tags，优先检查 `release-notes` 源文件；如果是 GitHub 模式，再检查上游 Release asset。
- 如果 release discovery 返回 `404`，优先按认证或仓库访问问题排查，并确认 `DOCS_RELEASE_NOTES_TOKEN` 是否能读取 `HagiCode-org/release-notes`。
- 如果是在 monorepo 本地开发，优先使用 `DOCS_RELEASE_NOTES_SOURCE=local` 加 `DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT`。

## 在生态中的角色

当目标是面向用户的说明文档与教学内容时，应优先查看本仓库；产品品牌叙事主要位于 `repos/site`，应用实现则位于 `repos/web`、`repos/hagicode-desktop` 与 `repos/hagicode-core`。
