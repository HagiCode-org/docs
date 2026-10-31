# Style notes — pt-BR (docs, source zh-CN)

- 源文档(简体中文)的语气与人称保持一致;读者一律称 "você"(不用 "tu"/"o usuário" 作泛称,除非源文如此)。
- 使用巴西葡萄牙语正字法(新正字法),必须带全部重音符与 cedilha(ç, ã, é 等);旧译文里有无重音的 ASCII 写法(如 "servico"),属缺陷,新译文不得沿用。
- 标题用句首大写(只有第一个词与专有名词大写),与站点现有 pt-BR 页一致。
- 中文全角标点译为半角葡语标点;引号用 "…";不使用全角标点。
- 列表与表格的句末标点跟随源文档(中文句号译为句号)。
- 「」/粗体强调的界面元素名保持强调;界面术语先查 src/i18n/locales/pt-BR/*.yml,查不到再按术语表翻译(设置 → Configurações,测试 API Key → Testar chave de API)。
- `Yes`/`No`、`Enabled`/`Disabled` 这类固定状态词在整个站点内统一译法(进术语表):是/否 → Sim/Não,必填 → Obrigatório,默认值 → Padrão。
- 产品名与概念词按术语表的 doNotTranslate 保持原写法(产品名写作 MonoSpecs,文件名保持 `monospecs.yaml`)。
- 常见英语技术词(Agent, Skill, Provider, Prompt, preset, Token)保留原词,不硬译;"提案" 译 proposta,"会话" 译 sessão,"子仓库" 译 sub-repositório,"主仓库" 译 repositório principal。
- Starlight 提示块关键字必须保持英文(:::tip、:::note、:::caution、:::danger),只翻译方括号里的标题。
- 明显的技术单词保留原文,任何语言都不翻译(人工裁决,2026-10-30):gateway、proxy、endpoint、profile、prompt、fallback、cooldown、dashboard、agent、self-hosted、gate 等通行的工程术语,以及产品名与平台名;完整清单见 `glossary.json` 的 `doNotTranslate`(`origin: human`)。拿不准时,看它是否属于开发者日常直接说英文的词;普通词汇照常翻译。
