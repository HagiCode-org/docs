# Research Note - How to Install and Use Hermes

## Metadata

- Article ID: `2026-04-13-how-to-install-and-use-hermes`
- Brief: `seo/briefs/2026-04-13-how-to-install-and-use-hermes.yaml`
- Stage: `research`
- Status: `ready-for-outline`

## Sources Consulted

- `/home/newbe36524/.hermes/hermes-agent/README.md`
- `/home/newbe36524/.hermes/hermes-agent/website/docs/user-guide/messaging/index.md`
- `/home/newbe36524/.hermes/hermes-agent/website/docs/user-guide/messaging/feishu.md`
- `/home/newbe36524/.hermes/hermes-agent/website/docs/reference/slash-commands.md`
- `/home/newbe36524/repos/hagicode-mono/repos/docs/SEO_ARTICLE_WORKFLOW.md`

## Confirmed Facts

### What Hermes is

- Hermes Agent is positioned as an AI agent built by Nous Research.
- Hermes supports both CLI usage and a messaging gateway workflow.
- The README explicitly describes Hermes as usable from the terminal and from messaging platforms such as Telegram, Discord, Slack, WhatsApp, Signal, and others.

### Installation facts

- The README documents a quick install command:

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

- The README states that this installer works on Linux, macOS, WSL2, and Android via Termux.
- The README states that native Windows is not supported and users should use WSL2.
- After installation, the README instructs users to reload their shell and run:

```bash
source ~/.bashrc
hermes
```

- The README notes that `source ~/.zshrc` may be used on zsh instead of `.bashrc`.

### First-use commands

The README lists these getting-started commands as valid entry points:

```bash
hermes
hermes model
hermes tools
hermes config set
hermes gateway
hermes setup
hermes update
hermes doctor
```

### CLI and messaging model

- Hermes has two main entry points: interactive CLI and messaging gateway.
- The README states that terminal usage starts with `hermes`.
- Messaging setup is done via `hermes gateway setup`, then the user can talk to the bot from a supported platform.

### Messaging gateway facts

- The messaging gateway is described as a single background process that connects to configured platforms and handles sessions and cron jobs.
- The messaging docs list `hermes gateway setup`, `hermes gateway`, `hermes gateway install`, `hermes gateway start`, `hermes gateway stop`, and `hermes gateway status` as supported commands.
- The messaging docs explicitly include Feishu/Lark among supported platforms.

### Feishu-specific facts

- Feishu/Lark integration supports direct messages and group chats.
- In group chats, Hermes only responds when the bot is explicitly @mentioned.
- `hermes gateway setup` is the recommended way to configure Feishu/Lark.
- Feishu has two connection modes:
  - `websocket` is recommended
  - `webhook` is optional
- The docs explicitly show `FEISHU_HOME_CHANNEL=oc_xxx` as a supported setting.
- The docs state that `/set-home` can mark a Feishu/Lark chat as the home channel.
- Feishu production use should restrict access with `FEISHU_ALLOWED_USERS`.

### Slash command facts

The slash command reference confirms these useful commands:

- `/new` or `/reset`
- `/model`
- `/personality`
- `/retry`
- `/undo`
- `/compress`
- `/title`
- `/resume`
- `/background`
- `/reload-mcp`
- `/help`
- messaging-only `/sethome` / `/set-home`
- messaging-only `/status`

These are useful for the "how to use Hermes" section because they let the article show immediate next actions after installation.

## Recommended Article Scope

This article should stay narrow and practical.

Recommended scope:

- explain what Hermes is in one short section
- show quick install
- show first-launch flow
- show model selection and setup basics
- show one CLI usage path
- show one messaging usage path, preferably Feishu because it is already relevant to the user's workflow
- show a short list of high-value slash commands

Do not try to cover every Hermes capability in the first article.

## Useful Commands to Cite

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
source ~/.bashrc
hermes
hermes model
hermes setup
hermes gateway setup
hermes gateway
hermes doctor
hermes update
```

Potential messaging examples:

```bash
FEISHU_CONNECTION_MODE=websocket
FEISHU_HOME_CHANNEL=oc_xxx
FEISHU_ALLOWED_USERS=ou_xxx,ou_yyy
```

## Internal Link Opportunities in the Final Article

Current docs repo does not appear to already host Hermes-specific documentation pages.

Because of that, internal linking options inside this repository are limited. The article may need to:

- link to the docs blog index: `/blog/`
- optionally link to future Hermes-related articles once they exist

Important limitation:

- No repository-backed internal page for Hermes installation was confirmed inside this docs repo during this research pass.
- If this article is published here, it may act as the first anchor article for later internal linking.

## Open Questions / Risks

- The docs repo used for publication is not the official Hermes docs repository, so some links may need to point externally to Hermes upstream documentation.
- Internal links required by the brief are currently thin because the local docs repo does not yet appear to contain Hermes-specific content clusters.
- The first article should avoid over-promising features that are documented upstream but not contextualized yet in this docs repo.
- We have not yet selected whether the article should frame Hermes as a standalone product, an agent workflow tool, or part of a broader HagiCode ecosystem narrative. This affects title tone and CTA.

## Drafting Guidance

- Lead with a quick answer: Hermes can be installed with one command and used either in the terminal or through messaging platforms.
- Keep the installation section concrete and short.
- Keep the usage section split into two flows:
  - local CLI
  - Feishu or messaging gateway
- Use a practical command-driven tone instead of a broad product-marketing tone.
- Include a note for Windows users to use WSL2.
- Include one short security note for gateway users: restrict allowed users.

## Suggested CTA Directions

- Continue to a dedicated article for Feishu setup
- Continue to a dedicated article for Hermes slash commands
- Continue to a deeper article on messaging gateway setup

## Recommendation

Proceed to the outline stage.
