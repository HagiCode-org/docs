# SEO Hourly Cron Workflow

This file defines how Hermes cron should run the SEO article workflow in this repository.

## Goal

Generate one new candidate SEO article every hour, submit the result for human review in chat, and publish only after explicit approval.

## Operating Mode

- Frequency: every 1 hour
- Output mode: draft-first
- Publication mode: manual approval only
- Articles per run: 1

## Input Files

- SOP: `SEO_ARTICLE_WORKFLOW.md`
- Topic pool: `seo/topic-pool.json`
- Pipeline config: `seo/pipeline-config.json`
- Templates:
  - `templates/seo/article-brief.template.yaml`
  - `templates/seo/article-review-report.template.md`
  - `templates/seo/blog-draft.template.mdx`
- Hermes stage prompt: `prompts/seo-article-workflow.txt`

## Cron Run Rules

Each hourly run should:

1. Read `seo/topic-pool.json` and `seo/pipeline-config.json`.
2. Select exactly one topic that is not already covered by:
   - a published file in `src/content/docs/blog/`
   - an existing brief in `seo/briefs/`
   - an existing draft in `seo/drafts/`
3. Create a brief in `seo/briefs/`.
4. Create a research note in `seo/research/`.
5. Create an outline in `seo/outlines/`.
6. Create a draft in `seo/drafts/`.
7. Create a review report in `seo/reports/`.
8. Do not move the draft into `src/content/docs/blog/` automatically.
9. Return a concise summary to chat with:
   - selected topic
   - generated file paths
   - a short quality/risk note
   - a recommendation on whether the draft looks strong enough for manual publication review

## Human Approval Policy

A generated draft is only approved for publication when a human explicitly asks to:

- move the draft into `src/content/docs/blog/`
- set `draft: false`
- run the blog verification commands

Until then, the draft remains in `seo/drafts/`.

## Publishing Checklist

When a human approves a draft for publication, the follow-up task should:

1. move the file from `seo/drafts/` to `src/content/docs/blog/`
2. set `draft: false`
3. run:

```bash
npm run verify:blog
npm run build:verify-blog
```

4. report the result back to chat

## Quality Guardrails

The cron run must stop or downgrade if any of the following is true:

- the topic substantially duplicates an existing article
- there are not enough repository-backed facts to support a useful article
- the article would rely mainly on speculation
- the draft becomes generic SEO filler instead of a useful tutorial or comparison

## Recommended Topic Buckets

- Hermes installation and usage
- Hermes gateway and messaging setup
- Hermes slash commands and workflows
- Codex installation and usage
- Claude Code installation and usage
- Codex vs Claude Code vs Hermes style comparisons
- GPT, GLM, MiniMax model selection and usage guides
- AI CLI and agent workflow best practices

## Delivery Format

Every cron result should end with a review-oriented summary such as:

- topic selected
- files created
- why this topic was chosen
- whether it is ready for your publication review

This keeps the hourly workflow useful without letting low-quality drafts auto-publish.
