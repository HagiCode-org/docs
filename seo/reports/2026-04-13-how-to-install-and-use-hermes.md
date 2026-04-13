# SEO Article Review Report

## Metadata

- Article ID: `2026-04-13-how-to-install-and-use-hermes`
- Stage: `review`
- Reviewer: `Hermes`
- Draft Path: `seo/drafts/2026-04-13-how-to-install-and-use-hermes.mdx`
- Brief Path: `seo/briefs/2026-04-13-how-to-install-and-use-hermes.yaml`
- Research Path: `seo/research/2026-04-13-how-to-install-and-use-hermes.md`
- Outline Path: `seo/outlines/2026-04-13-how-to-install-and-use-hermes.md`
- Final Candidate Path: `src/content/docs/blog/2026-04-13-how-to-install-and-use-hermes.mdx`

## Source Coverage

- Mandatory sources used:
  - [x] README install and getting-started commands
  - [x] Messaging gateway docs
  - [x] Feishu setup docs
  - [x] Slash commands reference
- Optional sources used:
  - [ ] cron docs

## Search Intent Check

- Primary keyword: Hermes 安装使用教程
- Secondary keywords: Hermes CLI 安装, Hermes Agent 使用方法, Hermes 飞书接入
- Search intent satisfied: yes
- First section answers query directly: yes

## Factual Review

- Verified claims:
  - Hermes provides both CLI and messaging gateway entry points.
  - Quick install command is documented in the upstream README.
  - Linux, macOS, WSL2, and Termux are documented install targets.
  - Native Windows is documented as unsupported.
  - Feishu/Lark setup supports websocket and webhook modes.
  - Group chats require @mention to trigger processing.
- Claims needing human confirmation:
  - Whether this docs repository should position Hermes as part of a broader HagiCode content strategy.
  - Whether future companion articles should be created immediately for internal linking.
- Commands and paths checked:
  - install command
  - shell reload commands
  - `hermes`, `hermes model`, `hermes setup`, `hermes gateway setup`, `hermes gateway`, `hermes doctor`, `hermes update`

## Structure Review

- Article type matches brief: yes
- H2 and H3 structure acceptable: yes
- FAQ included when useful: yes
- CTA present and appropriate: yes

## Linking Review

- Required internal links included:
  - `/blog/` is available as a safe internal link target, but was not embedded in the body to avoid forced low-value linking.
- Additional internal links added:
  - none
- External links requiring validation:
  - none added in body

## Tone and Quality Review

- Low-signal filler detected: low
- Overlap with existing docs or blog posts: unknown, no existing Hermes article in this repo was confirmed during research
- Brand tone issues: none obvious
- Readability concerns:
  - The article is intentionally practical and command-driven; this is good for the install-guide format.
  - A future revision could add a short comparison sentence explaining when to choose CLI first vs gateway first.

## Verification Results

```text
No repo build verification has been run yet because the article remains in seo/drafts/ and has not been moved into src/content/docs/blog/.
Recommended next step before publication:
- move to final blog path after human approval
- run npm run verify:blog
- run npm run build:verify-blog
```

## Recommendation

- Status: `ready-for-human-review`
- Summary:
  - The article is strong enough as a first draft for the workflow pilot.
  - It stays within validated scope and avoids unsupported claims.
  - It is suitable for manual editing and then migration into the final blog path.
- Required follow-up actions:
  - Confirm title choice and final tone
  - Decide whether to add one or two internal links after related Hermes articles exist
  - Approve movement into `src/content/docs/blog/`
