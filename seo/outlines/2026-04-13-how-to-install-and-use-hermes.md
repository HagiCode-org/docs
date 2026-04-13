# Outline - How to Install and Use Hermes

## Metadata

- Article ID: `2026-04-13-how-to-install-and-use-hermes`
- Brief: `seo/briefs/2026-04-13-how-to-install-and-use-hermes.yaml`
- Research: `seo/research/2026-04-13-how-to-install-and-use-hermes.md`
- Stage: `outline`
- Status: `approved-for-draft`

## Title Candidates

1. 如何安装和使用 Hermes：从本地 CLI 到 Feishu 接入快速上手
2. Hermes 安装使用教程：一键安装、CLI 上手与 Feishu 配置
3. Hermes CLI 怎么安装和使用？一篇讲清本地上手与消息接入

## Meta Description Candidates

1. 这篇教程介绍如何安装和使用 Hermes，包括一键安装命令、CLI 基本用法、模型配置，以及 Feishu 网关接入的最小步骤。
2. 想快速上手 Hermes？本文整理了 Hermes 的安装方式、首次启动命令、常用操作和 Feishu 接入方法，适合本地开发者快速入门。

## Recommended Title

如何安装和使用 Hermes：从本地 CLI 到 Feishu 接入快速上手

## Recommended Meta Description

这篇教程介绍如何安装和使用 Hermes，包括一键安装命令、CLI 基本用法、模型配置，以及 Feishu 网关接入的最小步骤。

## Structure

### H2: Hermes 是什么，适合谁用

- 简短解释 Hermes 的定位
- 说明有两种主要使用入口：CLI 和 messaging gateway
- 说明本文聚焦快速安装和入门，不展开所有高级能力

### H2: 安装 Hermes 之前要知道什么

#### H3: 支持的平台
- Linux
- macOS
- WSL2
- Android via Termux

#### H3: Windows 用户注意事项
- 原生 Windows 不支持
- 建议使用 WSL2

### H2: 如何安装 Hermes

#### H3: 一键安装命令
- 给出安装命令

#### H3: 安装后如何刷新 shell
- `source ~/.bashrc`
- zsh 用户可用 `source ~/.zshrc`

#### H3: 如何确认 Hermes 已安装成功
- `hermes`
- `hermes doctor`

### H2: 第一次如何开始使用 Hermes

#### H3: 直接从 CLI 开始
- `hermes`
- 说明进入交互式 CLI

#### H3: 先选模型和基础配置
- `hermes model`
- `hermes setup`
- `hermes tools`
- `hermes config set`

### H2: Hermes 最常见的使用方式

#### H3: 在终端里把 Hermes 当成日常开发助手
- 简单说明 CLI 适合什么
- 列出几个高价值命令

#### H3: 通过消息平台使用 Hermes
- `hermes gateway setup`
- `hermes gateway`
- 说明 gateway 是一个后台进程，负责连接平台和会话

### H2: 以 Feishu 为例，如何把 Hermes 接入消息平台

#### H3: 推荐的最小接入方式
- `hermes gateway setup`
- 选择 Feishu / Lark
- 推荐 websocket 模式

#### H3: Feishu 手动配置要点
- `FEISHU_APP_ID`
- `FEISHU_APP_SECRET`
- `FEISHU_DOMAIN`
- `FEISHU_CONNECTION_MODE=websocket`
- `FEISHU_ALLOWED_USERS`
- `FEISHU_HOME_CHANNEL`

#### H3: 群聊里怎么和 Hermes 交互
- 群里需要 @bot
- `/set-home` 或预配 `FEISHU_HOME_CHANNEL`

### H2: 新手最值得先记住的 Hermes 命令

- `/new`
- `/model`
- `/retry`
- `/undo`
- `/compress`
- `/sethome`
- `/help`

### H2: 常见问题

#### H3: 为什么 Windows 不能直接装
- 原生 Windows 不支持
- 使用 WSL2

#### H3: 装好后输入 hermes 没反应怎么办
- 刷新 shell
- 检查安装是否成功
- 跑 `hermes doctor`

#### H3: Feishu 群里为什么 bot 不回复
- 群聊需要 @mention
- 检查 allowlist
- 检查 group policy

### H2: 下一步建议

- 如果主要在本地用，从 CLI 开始
- 如果想在飞书里用，继续配置 gateway
- 后续可以继续写更细分文章：Feishu 接入、slash commands、cron

## FAQ Suggestions

- Hermes 支持 Windows 吗？
- Hermes 和普通 CLI 助手有什么区别？
- Hermes 能直接接入飞书吗？
- Hermes 安装后第一步该做什么？

## Internal Link Notes

Confirmed internal link options in this repo are currently limited.

Safe internal links for now:

- `/blog/`

Potential future internal links once content exists:

- Hermes Feishu setup article
- Hermes slash commands article
- Hermes gateway article

## CTA Suggestion

- 如果你想把 Hermes 放进飞书继续使用，下一篇最适合接着写的是 Feishu 接入指南。
- 如果你想提高日常效率，下一篇最适合接着写的是常用 slash commands 指南。
