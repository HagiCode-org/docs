# Style notes — fr-FR (docs, source zh-CN)

- 源文档(简体中文)的语气与人称保持一致;读者一律用 « vous »(含 « votre/vos »),不用 « tu »。
- 使用法语正字法;标题用句首大写(只有第一个词和专有名词大写),与站点现有法文页一致。
- 中文全角标点译为法文标点;冒号、分号、感叹号、问号前加不换行空格(U+00A0),与站点现有页一致;法文引号用 « … »(内侧各加不换行空格);不使用全角标点。
- 行内代码、代码块、链接目标、HTML 标签、frontmatter 键保持原样;代码块里的中文注释也不翻译。
- 列表与表格的句末标点跟随源文档(中文句号译为法文句号)。
- 「」强调的界面元素名保持强调(粗体或原引号形式);界面术语先查 src/i18n/locales/fr-FR/*.yml,查不到再按术语表翻译。
- Starlight 提示块名保持英文:`:::tip`、`:::note`、`:::caution`、`:::danger`,只翻译方括号里的标题。
- `Yes`/`No`、`Enabled`/`Disabled` 这类固定状态词在整个站点内统一译法(进术语表):是/否 → Oui/Non,启用/禁用 → Activé/Désactivé。
- 产品名与概念词按术语表的 doNotTranslate 保持原写法(产品名写作 MonoSpecs,文件名保持 `monospecs.yaml`)。
- 常见英语技术词(Agent, Skill, Provider, Prompt, Session)按站点现有法文页惯例处理:session → session,prompt → prompt;不硬译。
- 撇号用直引号 '(站点现有法文页多数如此,与 zai/aliyun 页一致),不用弯引号 ’;法文必须带重音符号(é è ê à ç ù 等),旧译文中无重音的页面需重译。
- 提交(commit):OpenSpec/Git 语境下用 commit/commiter/commité,不用 valider(与 OpenSpec 的 validate 冲突);在 Steam 审核、提案等语境中的 提交 = soumettre。
- 明显的技术单词保留原文,任何语言都不翻译(人工裁决,2026-10-30):gateway、proxy、endpoint、profile、prompt、fallback、cooldown、dashboard、agent、self-hosted、gate 等通行的工程术语,以及产品名与平台名;完整清单见 `glossary.json` 的 `doNotTranslate`(`origin: human`)。拿不准时,看它是否属于开发者日常直接说英文的词;普通词汇照常翻译。
