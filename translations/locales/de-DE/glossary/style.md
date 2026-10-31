# Style notes — de-DE (docs, source zh-CN)

- 源文档(简体中文)的语气与人称保持一致;读者一律用正式的 "Sie"(含 "Ihr/Ihre"),不用 "du"。
- 使用德语正字法(新正字法);名词一律大写;标题用句首大写(只有第一个词和名词/专有名词大写),与站点现有德文页一致。
- 中文全角标点译为半角德文标点;德文引号用 „…“;不使用全角标点。
- 列表与表格的句末标点跟随源文档(中文句号译为德文句号)。
- 「」强调的界面元素名保持强调(粗体或原引号形式);界面术语先查 src/i18n/locales/de-DE/*.yml,查不到再按术语表翻译。
- `Yes`/`No`、`Enabled`/`Disabled` 这类固定状态词在整个站点内统一译法(进术语表):是/否 → Ja/Nein,启用/禁用 → Aktiviert/Deaktiviert。
- 产品名与概念词按术语表的 doNotTranslate 保持原写法(产品名写作 MonoSpecs,文件名保持 `monospecs.yaml`)。
- 德语复合词尽量按行业惯例连写或用连字符(如 Repository-Verwaltung);常见英语技术词(Agent, Skill, Provider, Prompt, Session)保留原词,不硬译。
- 明显的技术单词保留原文,任何语言都不翻译(人工裁决,2026-10-30):gateway、proxy、endpoint、profile、prompt、fallback、cooldown、dashboard、agent、self-hosted、gate 等通行的工程术语,以及产品名与平台名;完整清单见 `glossary.json` 的 `doNotTranslate`(`origin: human`)。拿不准时,看它是否属于开发者日常直接说英文的词;普通词汇照常翻译。
