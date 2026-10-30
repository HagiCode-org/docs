# Style notes — es-ES (docs, source zh-CN)

- 源文档(简体中文)的语气与人称保持一致;沿用站点现有西班牙文页的中性/非人称表达:读者称呼用 usted 的命令式与第三人称(Consulte, Haga clic, Seleccione, puede),不用 tú(现有页混用,取多数写法);标题与描述可用名词短语或不定式。
- 使用西班牙(es-ES)拼写;疑问句与感叹句使用倒置的 ¿ ¡;不使用全角标点,中文引号 「」 与 "" 译为西语引号 «…» 或保持强调形式(粗体)。
- 标题只有第一个词(及专有名词)首字母大写(sentence case),与站点现有西班牙文页一致。
- 列表与表格的句末标点跟随源文档(中文句号译为西语句号)。
- 「」强调的界面元素名保持强调(粗体或原引号形式);界面术语先查 src/i18n/locales/es-ES/*.yml,查不到再按术语表翻译。
- `Yes`/`No`、`Enabled`/`Disabled` 这类固定状态词在整个站点内统一译法(进术语表):是/否 → Sí/No,启用/禁用 → Activado/Desactivado。
- 产品名与概念词按术语表的 doNotTranslate 保持原写法(产品名写作 MonoSpecs,文件名保持 `monospecs.yaml`)。
- Starlight 提示块的关键字保持英文(`:::tip`、`:::note`、`:::caution`、`:::danger`),只翻译方括号里的标题;表格里的代码/标识符值保持英文。
- 常见英语技术词(Agent, Skill, Provider, Prompt, token)保留原词,不硬译;"会话"统一为 sesión,"提案"为 propuesta,"子仓库"为 subrepositorio。
