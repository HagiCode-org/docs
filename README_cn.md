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

- `src/content/docs/` - 文档页面与博客内容
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

- `src/data/release-notes.index.json`
- `src/content/docs/release-notes/index.mdx`
- `src/content/docs/en/release-notes/index.mdx`

这些文件统一从权威的 `repos/release-notes` 工作区数据生成。
同步结果不再生成 `src/content/docs/release-notes/<tag>.md` 或 `src/content/docs/en/release-notes/<tag>.md` 这类按 tag 拆分的详情页。
版本级深链现在统一改为 landing 页面锚点，例如 `/release-notes/#v0.1.0-beta.46` 与 `/en/release-notes/#v0.1.0-beta.46`。
对于 monorepo 内的自动化，首选路径是仓库到仓库的直接转移；GitHub Release asset 只保留为无本地 checkout 时的可选 fallback source。

### 常用命令

```bash
npm run release-notes:fetch
npm run release-notes:materialize
npm run release-notes:sync
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
- 工作流优先使用 `DOCS_RELEASE_NOTES_TOKEN` 访问上游 GitHub API；只有当当前仓库默认 `GITHUB_TOKEN` 本身就具备跨仓库可见性时，才会回退到它。
- 在 CI 中，`DOCS_RELEASE_NOTES_ALLOW_STALE_ON_SOURCE_ERROR=true` 会在上游仓库暂时不可访问、但当前受管输出已存在时保留现状并继续通过工作流。
- 同步脚本除 Node.js 之外，还依赖系统自带的 `zip` 与 `unzip` 工具。
- 如果历史同步曾留下 `src/content/docs/release-notes/*.md` 或 `src/content/docs/en/release-notes/*.md`，重新运行 `npm run release-notes:sync` 会自动清理这些旧的受管详情页。
- 如果需要排查“为什么页面仍然像旧的多路由模式”，先确认 `src/data/release-notes.index.json` 中是否已经移除了 `routes` 字段并为每个条目生成 `anchorId`。
- 如果 local 模式下同步日志里出现 skipped tags，优先检查 `release-notes` 源文件；如果是 GitHub 模式，再检查上游 Release asset。
- 如果 release discovery 返回 `404`，优先按认证或仓库访问问题排查，并确认 `DOCS_RELEASE_NOTES_TOKEN` 是否能读取 `HagiCode-org/release-notes`。
- 如果是在 monorepo 本地开发，优先使用 `DOCS_RELEASE_NOTES_SOURCE=local` 加 `DOCS_RELEASE_NOTES_LOCAL_REPO_ROOT`。

## 在生态中的角色

当目标是面向用户的说明文档与教学内容时，应优先查看本仓库；产品品牌叙事主要位于 `repos/site`，应用实现则位于 `repos/web`、`repos/hagicode-desktop` 与 `repos/hagicode-core`。
