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

## 多仓库 Changelog 数据

文档站现于 `src/data/changelog/` 维护 `core`、`web`、`desktop` 三份静态 changelog 数据。
这些文件由 `scripts/generate-multi-repo-changelog.mjs` 从 `repos/hagicode-core`、`repos/web`、`repos/hagicode-desktop` 的相邻 Git tag 区间生成。

```bash
npm run changelog:generate
npm run verify:repo-changelog
```

第三数据源刻意采用 `desktop`，而非 `site`。
此假设遵循 OpenSpec 变更正文，同时保留脚本内仓库映射可配置，以便后续切换。
生成器只写入 `repos/docs/src/data/changelog/`；参考仓库始终保持只读输入，不承担页面渲染逻辑。

## Desktop 版本数据

Desktop 下载数据在运行时直接读取 `repos/index` 发布的 canonical index 端点。
当运行时加载最终失败时，docs 会回退到 Index Desktop 版本历史页：`https://index.hagicode.com/desktop/history/`。
`repos/index` 在此仅作为被引用依赖；稳定 fallback surface 为 `https://index.hagicode.com/desktop/history/` 与 `https://index.hagicode.com/desktop/index.json`。
本仓库仍提供 `public/version-index.json` 作为离线 fallback 快照，但维护者应先排查运行时拉取链路与 index 部署结果，而非在 docs 内新增第二套版本历史页。

## 在生态中的角色

当目标是面向用户的说明文档与教学内容时，应优先查看本仓库；产品品牌叙事主要位于 `repos/site`，应用实现则位于 `repos/web`、`repos/hagicode-desktop` 与 `repos/hagicode-core`。
