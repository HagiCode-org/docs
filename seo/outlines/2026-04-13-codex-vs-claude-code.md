# Outline - Codex vs Claude Code

## Metadata

- Article ID: `2026-04-13-codex-vs-claude-code`
- Brief: `seo/briefs/2026-04-13-codex-vs-claude-code.yaml`
- Research: `seo/research/2026-04-13-codex-vs-claude-code.md`
- Stage: `outline`
- Status: `approved-for-draft`

## Title Candidates

1. Codex vs Claude Code：在 HagiCode 工作流里怎么选更合适？
2. Codex 和 Claude Code 怎么选：按安装、场景和容器化使用来比较
3. AI 编程 CLI 对比：Codex 与 Claude Code 的差别、适用场景和选择建议

## Meta Description Candidates

1. 这篇对比基于 HagiCode 仓库已写明的安装文档、向导说明与实践文章，帮你按上手路径、任务分工和容器化要求比较 Codex 与 Claude Code。
2. 想知道 Codex 和 Claude Code 怎么选？本文只用仓库内可追溯事实，对比两者的当前支持状态、默认引导位置、角色分工和 Docker 持久化差异。

## Recommended Title

Codex vs Claude Code：在 HagiCode 工作流里怎么选更合适？

## Recommended Meta Description

这篇对比基于 HagiCode 仓库已写明的安装文档、向导说明与实践文章，帮你按上手路径、任务分工和容器化要求比较 Codex 与 Claude Code。

## Structure

### H2: 先说结论，Codex 和 Claude Code 怎么选

- 两者都在当前支持范围内
- 如果你想先沿着当前默认引导理解工作流，Claude Code 更容易对照向导截图
- 如果你更关心精确代码修改角色，Codex 在历史实践文章里定位更明确
- 提醒读者这些结论是仓库语境下的选择建议，不是通用绝对结论

### H2: 这篇对比基于哪些仓库事实

#### H3: 当前安装和支持矩阵
- `/installation`
- `/related-software-installation/ai-agent-cli/`
- 两者都是 `当前支持` 和 `一键安装`

#### H3: 向导中的默认示例
- `quick-start/wizard-setup.mdx`
- Claude Code 是默认示例
- 页面明确说这不是唯一支持项

### H2: 当前文档里能确认的关键差别

#### H3: 上手入口上的差别
- Claude Code 在向导截图里是默认示例
- Codex 在当前支持矩阵中同样属于标准安装入口

#### H3: 工作流角色上的差别
- 历史实践文章中 Claude Code 负责 proposal 和复杂需求理解
- 历史实践文章中 Codex 负责精确代码修改
- 明确标注这是 2026-03 的实践经验

#### H3: 容器化运维上的差别
- Claude 配置目录是 `/home/hagicode/.claude`
- Codex 配置目录是 `/home/hagicode/.codex`
- Claude 在容器文章里有明确 root 限制示例

#### H3: 模型信号能提供什么参考
- `llm-guide/model-comparison-evaluation`
- GPT 5.3 Codex 和 GPT 5.4 的工程输出评价较高
- 说明这是模型层证据，不是 CLI 全量体验结论

### H2: 按场景选择，哪一种更适合你

#### H3: 你想先跟着当前默认引导走
- 更适合先看 Claude Code
- 原因是向导示例与订阅内容更常围绕 Claude Code 展开

#### H3: 你已经有提案流程，只差一个执行修改工具
- 更适合优先考虑 Codex
- 引用多 Agent 实践文章中的角色分工

#### H3: 你准备在 Docker 或团队环境里落地
- 两者都要做持久化卷
- Claude 额外要注意非 root 运行要求
- Codex 要单独保留 `.codex` 数据目录

### H2: 一个保守但实用的决策方法

- 第一步：先确认你是偏上手引导还是偏代码执行
- 第二步：看是否要进 Docker 和团队部署
- 第三步：如果仍不确定，先按当前默认示例落地一个，再补第二个做分工

### H2: FAQ

- Claude Code 是默认示例，是否代表 Codex 不推荐？
- 两者是不是都支持一键安装？
- Docker 里为什么不能只挂一个共享目录？
- 模型评测能不能直接当成 CLI 对比结论？

### H2: 下一步建议

- 先看安装总览
- 再看 AI Agent CLI 安装入口
- 如果要进容器场景，再看 Docker 持久化文章

## FAQ Suggestions

- Claude Code 是默认示例，是否代表 Codex 不适合？
- Codex 和 Claude Code 现在都属于当前支持范围吗？
- 在 Docker 场景里，两者都需要独立持久化目录吗？
- GPT 5.3 Codex 的高评分能不能直接说明 Codex CLI 更强？

## Internal Link Placements

- Opening section: `/installation`
- Support matrix section: `/related-software-installation/ai-agent-cli/`
- Model caveat section: `/llm-guide/model-comparison-evaluation`
- Scenario sections: `/blog/2026-03-17-hagicode-ai-agent-party` and `/blog/2026-03-26-docker-ai-cli-user-isolation-guide`

## CTA Suggestion

- 如果你还没真正安装，先从安装总览和 AI Agent CLI 安装页确认入口。
- 如果你已经准备放进 Docker，再继续看容器隔离与持久化文章。

## Unresolved Risks

- 角色分工依据带有时间语境，发布前最好再确认是否需要加更强提示。
- 当前仓库没有直接的实测 CLI 对打页面，文章应避免写成输赢判断。
- Claude Code 的默认示例地位可能被读者误解为官方唯一推荐，需要在正文里反复澄清。
