# Research Note - Codex vs Claude Code

## Metadata

- Article ID: `2026-04-13-codex-vs-claude-code`
- Brief: `seo/briefs/2026-04-13-codex-vs-claude-code.yaml`
- Stage: `research`
- Status: `ready-for-outline`

## Sources Consulted

- `src/content/docs/installation/index.mdx`
- `src/content/docs/related-software-installation/ai-agent-cli/index.mdx`
- `src/content/docs/quick-start/wizard-setup.mdx`
- `src/content/docs/blog/2026-03-17-hagicode-ai-agent-party.mdx`
- `src/content/docs/blog/2026-03-26-docker-ai-cli-user-isolation-guide.mdx`
- `src/content/docs/llm-guide/model-comparison-evaluation.mdx`
- `SEO_ARTICLE_WORKFLOW.md`

## Confirmed Facts

### Current support and install status

- `src/content/docs/installation/index.mdx` states that both Claude Code and Codex are inside the current active Agent CLI support range.
- `src/content/docs/installation/index.mdx` also states that Hermes, Gemini, and DeepAgents require manual install or authentication, while the remaining CLIs expose one-click install or guided install flows. That means Codex and Claude Code fall into the one-click or guided-install group.
- `src/content/docs/related-software-installation/ai-agent-cli/index.mdx` lists both Claude Code and Codex as `当前支持` and `一键安装`.
- The same page uses Claude Code as row 1 and Codex as row 2 in the current support matrix.

### What the onboarding flow implies

- `src/content/docs/quick-start/wizard-setup.mdx` shows Claude Code as the example default Agent CLI in the setup wizard screenshot.
- The same page explicitly says that Claude Code in that screenshot is only a default example and not the only supported choice.
- The note under the screenshot confirms Codex remains in the current active support range.

### Historical role split documented in the blog

- `src/content/docs/blog/2026-03-17-hagicode-ai-agent-party.mdx` contains a time-context note saying the post records 2026-03-17 practice and that current support scope should follow the installation pages.
- In that same article, the published role table assigns ClaudeCodeCli to proposal generation and CodexCli to precise code modification.
- The article further explains that Claude Code is used for stronger context understanding and complex requirement analysis, while Codex is used for more precise code changes.
- These statements are useful comparison inputs, but they are documented as historical practice rather than permanent product rules.

### Operational differences found in container workflow documentation

- `src/content/docs/blog/2026-03-26-docker-ai-cli-user-isolation-guide.mdx` says Claude CLI explicitly refuses to run as root in the container example.
- The same article says Claude Code, Codex, and OpenCode each need persistent configuration storage in containers.
- The documented persistent directories differ:
  - Claude: `/home/hagicode/.claude`
  - Codex: `/home/hagicode/.codex`
- The article recommends named volumes for these directories and shows both `claude-data` and `codex-data` in the compose example.

### Model-level evidence that can inform, but not replace, CLI comparison

- `src/content/docs/llm-guide/model-comparison-evaluation.mdx` is explicitly a model evaluation page, not a CLI UX benchmark.
- That page ranks GPT 5.3 Codex and GPT 5.4 near the top for task completion quality and engineering output quality in HagiCode's real tasks.
- The same page says GPT 5.3 Codex and GPT 5.4 usually provide better engineering practices and implementation quality.
- This can support a careful statement about Codex-aligned model quality signals, but it must not be presented as a full Codex CLI product verdict.

## Reusable Repository-Backed Claims

- Both Claude Code and Codex are currently supported in HagiCode.
- Both are treated as one-click or guided install paths in current docs.
- Claude Code appears as the default example in the setup wizard, but that example is not exclusive.
- A published historical-practice article assigns Claude Code to proposal generation and Codex to precise code execution.
- In Docker workflows, both tools need separate persistent config directories.
- Claude has an explicit root-user restriction called out in the container article.

## Recommended Article Scope

Keep the article focused on the HagiCode docs context rather than generic internet discourse.

Recommended scope:

- quickly answer how to choose between the two
- compare only dimensions that are actually documented in this repo
- separate current support facts from historical workflow preferences
- cover install path, onboarding position, role fit, and container operations
- add one short note on model-evaluation evidence with a clear caveat

Do not try to cover:

- pricing
- upstream feature-by-feature comparisons not documented here
- broad external benchmark claims
- unsupported statements about which CLI is universally better

## Useful Paths and Link Opportunities

Safe internal links confirmed in this repo:

- `/installation`
- `/related-software-installation/ai-agent-cli/`
- `/llm-guide/model-comparison-evaluation`
- `/blog/2026-03-17-hagicode-ai-agent-party`
- `/blog/2026-03-26-docker-ai-cli-user-isolation-guide`

## Open Questions / Risks

- The strongest role-based distinction comes from a dated practice article, not from a current product specification page.
- The setup wizard uses Claude Code as the screenshot default, but that should not be overstated into a blanket recommendation.
- The model evaluation page compares models, not complete CLI workflows.
- The docs repo does not currently contain a dedicated side-by-side benchmark page for Codex vs Claude Code, so the article should stay pragmatic and conservative.

## Drafting Guidance

- Lead with a quick answer that both are supported and the better first choice depends on whether the reader wants the default guided path or a more code-execution-oriented lane.
- Use a comparison structure: what is being compared, key differences, fit by scenario, decision guidance, recommended path.
- Explicitly label historical-practice observations so readers do not mistake them for permanent guarantees.
- Mention Docker persistence because it is one of the few concrete operational differences documented in this repo.
- Keep the tone practical and avoid vendor-war phrasing.

## Recommendation

Proceed to the outline stage.
