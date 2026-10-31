# Style notes — zh-Hant (docs, source zh-CN)

- 源文檔(簡體中文)的語氣與人稱保持一致;讀者稱「你」,不稱「您」(現有繁中頁多用「您」,重譯時一併改為「你」)。
- 使用台灣慣用詞彙與繁體字形:軟體、專案、設定、網路、程式、預設、檔案、使用者、伺服器、資料庫、影片等,不使用大陸用語。
- 全形標點(,。:;!?、「」());中文與英文、中文與數字之間加一個半形空格;英文單詞與代碼保持原寫法。
- 列表與表格的句末標點跟隨源文檔。
- `Yes`/`No`、`Enabled`/`Disabled` 這類固定狀態詞在整個站點內統一譯法(進術語表):是/否、已啟用/已停用。
- 產品名與概念詞按術語表的 doNotTranslate 保持原寫法;產品名寫作 MonoSpecs,檔名 `monospecs.yaml` 不變。
- 界面按鈕與選單名以 src/i18n/locales/zh-Hant/*.yml 的譯法為準;源文用「」或粗體標出的保持這種強調形式。
- 重譯時以站點現有繁中譯文為底稿,只改基線變化的部分,沿用原有術語與措辭。
- 明显的技术单词保留原文,任何语言都不翻译(人工裁决,2026-10-30):gateway、proxy、endpoint、profile、prompt、fallback、cooldown、dashboard、agent、self-hosted、gate 等通行的工程术语,以及产品名与平台名;完整清单见 `glossary.json` 的 `doNotTranslate`(`origin: human`)。拿不准时,看它是否属于开发者日常直接说英文的词;普通词汇照常翻译。
