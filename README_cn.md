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

## Desktop 版本数据

Desktop 下载数据在运行时直接读取 `repos/index` 发布的 canonical index 端点。
当运行时加载最终失败时，docs 会回退到 Index Desktop 版本历史页：`https://index.hagicode.com/desktop/history/`。
`repos/index` 在此仅作为被引用依赖；稳定 fallback surface 为 `https://index.hagicode.com/desktop/history/` 与 `https://index.hagicode.com/desktop/index.json`。
本仓库仍提供 `public/version-index.json` 作为离线 fallback 快照，但维护者应先排查运行时拉取链路与 index 部署结果，而非在 docs 内新增第二套版本历史页。
按仓库拆分的更新详情页已不再由 docs 托管；后续版本信息入口会在未来的单独变更中重新引入。

## Release Notes 同步工作流

新的版本更新说明入口现在由本仓库托管，受管输出位于 `src/content/docs/release-notes/`、`src/content/docs/en/release-notes/` 与 `src/data/release-notes.index.json`。
这些文件统一从 `HagiCode-org/release-notes` 发布的 GitHub Release asset 生成。

### 常用命令

```bash
npm run release-notes:fetch
npm run release-notes:materialize
npm run release-notes:sync
npm run test:release-notes
```

### 上游资产契约

- docs 同步流程只接受命名为 `release-notes-<tag>-history.zip` 的 asset。
- 每个可接受的压缩包都必须包含 `artifacts/tags/<tag>/<tag>.json`。
- 每个可接受的压缩包还必须同时包含 `published/<tag>.zh-CN.md` 与 `published/<tag>.en.md`。
- 如果 JSON 缺失、JSON 非法、tag 不一致，或某个语言正文缺失，则该 tag 会按确定性原因跳过，不会发布部分页面。

### 自动化与排障

- `.github/workflows/release-notes-sync.yml` 会按日程运行，也支持 `workflow_dispatch` 手动触发。
- 工作流优先使用 `DOCS_RELEASE_NOTES_TOKEN` 访问上游 GitHub API；只有当当前仓库默认 `GITHUB_TOKEN` 本身就具备跨仓库可见性时，才会回退到它。
- 同步脚本除 Node.js 之外，还依赖系统自带的 `zip` 与 `unzip` 工具。
- 如果同步日志里出现 skipped tags，优先检查上游 Release asset 是否缺文件或内容异常，而不是直接手改本仓库里的生成文件。
- 如果 release discovery 返回 `404`，优先按认证或仓库访问问题排查，并确认 `DOCS_RELEASE_NOTES_TOKEN` 是否能读取 `HagiCode-org/release-notes`。

## 在生态中的角色

当目标是面向用户的说明文档与教学内容时，应优先查看本仓库；产品品牌叙事主要位于 `repos/site`，应用实现则位于 `repos/web`、`repos/hagicode-desktop` 与 `repos/hagicode-core`。
