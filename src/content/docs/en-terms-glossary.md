---
title: Hagicode Terminology Dictionary
description: Official English translations for Hagicode-specific terms to ensure consistency across all translated documentation.
---

# Hagicode Terminology Dictionary

This document provides the official English translations for Hagicode-specific terms to ensure consistency across all translated documentation.

## Core Concepts

| Chinese | English | Context Notes |
|---------|---------|---------------|
| 提案驱动开发 | Proposal-driven development | Core Hagicode development philosophy |
| 提案会话 | Proposal session | Session type for structured development workflows |
| 只读模式 | Read-only mode | Mode for code exploration without modifications |
| 编辑模式 | Edit mode | Mode for code modification and implementation |
| 普通会话 | Conversation session | Traditional chat-based interaction with AI |
| 只读会话 | Read-only session | Session operating in read-only mode |
| 编辑会话 | Edit session | Session operating in edit mode |
| OpenSpec 工作流 | OpenSpec workflow | Always capitalize "OpenSpec" |
| 提案 | Proposal | Structured document outlining change implementation |
| 归档 | Archive | Process of storing completed proposals |

## Technical Terms (Preserve Original)

| Term | Notes |
|------|-------|
| Grain | Orleans framework concept - always capitalize |
| Monospec | Monorepo configuration - always capitalize |
| OpenSpec | Specification-driven workflow - always capitalize |
| SDD | Software Design Document - always uppercase |

## UI Elements

| Chinese | English | Context Notes |
|---------|---------|---------------|
| 只读会话按钮 | Read-only session button | Button for creating read-only sessions |
| 编辑会话按钮 | Edit session button | Button for creating edit sessions |
| 提案会话按钮 | Proposal session button | Button for creating proposal sessions |
| 会话切换 | Session switcher | UI component for switching between sessions |
| 语言切换器 | Language switcher | UI component for switching languages |
| 提交 | Submit | Form action button |
| 取消 | Cancel | Form action button |

## Development Concepts

| Chinese | English | Context Notes |
|---------|---------|---------------|
| 双模式设计 | Dual-mode design | Read-only/Edit mode architecture |
| 自举 | Self-bootstrapping | Using the tool to develop itself |
| 规范驱动开发 | Specification-driven development | Development following defined specifications |
| 验证标准 | Validation criteria | Criteria for verifying task completion |
| 任务清单 | Task list | List of tasks in a proposal |
| 设计决策 | Design decision | Recorded decision made during development |
| 代码审查 | Code review | Review of code changes |
| 知识沉淀 | Knowledge retention | Capturing and storing team knowledge |

## Features and Components

| Chinese | English | Context Notes |
|---------|---------|---------------|
| Monospec - 多仓库统一管理 | Monospec - Multi-repository unified management | Feature name |
| AI Compose Commit | AI Compose Commit | Feature name - preserve original |
| 深度代码理解 | Deep code understanding | AI capability |
| 智能对话交互 | Intelligent conversation interaction | AI capability |
| 多会话并发 | Concurrent multi-session | Feature allowing multiple sessions |
| 项目列表 | Project list | UI component |
| 项目详情 | Project details | UI component |
| SDD 管理 | SDD management | Software Design Document management |

## Git and Version Control

| Chinese | English | Context Notes |
|---------|---------|---------------|
| 提交信息 | Commit message | Git commit description |
| 符合规范 | Compliant with standards | Following conventions |
| 提交历史 | Commit history | History of commits |

## Documentation Terms

| Chinese | English | Context Notes |
|---------|---------|---------------|
| 产品概述 | Product overview | Main product introduction |
| 快速入门 | Quick start | Getting started guides |
| 安装指南 | Installation guide | Installation instructions |
| 贡献者指南 | Contributor guide | Guide for contributors |
| 功能指南 | Feature guide | Feature documentation |
| 使用示例 | Usage example | Example showing how to use |
| 核心特性 | Core features | Main product features |

## Messages and Notifications

| Chinese | English | Context Notes |
|---------|---------|---------------|
| 即将推出 | Coming soon | Placeholder for future content |
| 需要帮助 | Need help | Help section header |
| 在 GitHub 上提 Issue | Open an issue on GitHub | Call to action |
| 查看文档 | View documentation | Navigation link |

## Style Guidelines

### Capitalization Rules
- **Always Capitalize**: OpenSpec, Monospec, Grain, SDD, AI Compose Commit
- **Title Case**: Use for page titles, section headings, button labels
- **Sentence Case**: Use for descriptions, body text, list items

### Technical Accuracy Rules
- Preserve all code syntax and logic exactly as-is
- Translate code comments to English
- Keep configuration keys and values unchanged
- Translate descriptive comments within configuration files

### Consistency Rules
- Always use the exact English translation specified in this dictionary
- Do not create alternative translations for the same Chinese term
- When translating, reference this dictionary first
- If a term is not in this dictionary, add it before using

### Code Example Handling

```typescript
// Chinese original:
// 创建新会话
const createSession = async (data: SessionData) => {
  // ...
}

// English translation:
// Create new session
const createSession = async (data: SessionData) => {
  // ...
}
```

### Mermaid Diagram Handling
- Translate node and edge labels to English
- Preserve diagram structure and syntax
- Use terminology from this dictionary for labels

### Link Handling
- Update internal links to include `/en/` prefix
- Preserve external link URLs unchanged
- Example: `/quick-start/create-first-project` → `/en/quick-start/create-first-project`

---

**Last Updated**: 2026-02-26

**Maintainer**: Hagicode Documentation Team

**Version**: 1.0
