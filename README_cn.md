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

Desktop 下载数据以运行时从公开 desktop 索引端点拉取为主。
仓库内保留的 `public/version-index.json` 仅作为离线 fallback 细节存在，不代表 docs 仓库需要维护版本新鲜度工作流。

## 在生态中的角色

当目标是面向用户的说明文档与教学内容时，应优先查看本仓库；产品品牌叙事主要位于 `repos/site`，应用实现则位于 `repos/web`、`repos/hagicode-desktop` 与 `repos/hagicode-core`。
