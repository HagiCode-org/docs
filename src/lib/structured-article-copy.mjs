// Reader-facing labels of the structured comparison articles, one entry per docs locale.
// Same wording as the `compare.*` copy of the marketing site so both surfaces read alike.
import { resolveArticleLocale } from './articles.mjs';

const COPY = {
  "en-US": {
    faqTitle: "Frequently asked questions",
    chooseWhen: "Choose {name} when",
    relatedTitle: "More comparisons",
    vsLabel: "{agent} vs HagiCode",
    ctaTitle: "Try HagiCode on top of the agent you already use",
    ctaDescription: "Install HagiCode Desktop, connect your existing CLI, and keep working the way you do today.",
    ctaButton: "Install HagiCode Desktop",
  },
  "zh-CN": {
    faqTitle: "常见问题",
    chooseWhen: "这些情况选 {name}",
    relatedTitle: "更多对比",
    vsLabel: "{agent} 对比 HagiCode",
    ctaTitle: "在你已有的 Agent 之上试试 HagiCode",
    ctaDescription: "安装 HagiCode 桌面版,接入你现有的 CLI,保持原来的工作方式。",
    ctaButton: "安装 HagiCode 桌面版",
  },
  "zh-Hant": {
    faqTitle: "常見問題",
    chooseWhen: "這些情況選 {name}",
    relatedTitle: "更多比較",
    vsLabel: "{agent} 對比 HagiCode",
    ctaTitle: "在你既有的 Agent 之上試試 HagiCode",
    ctaDescription: "安裝 HagiCode 桌面版,接入你現有的 CLI,維持原本的工作方式。",
    ctaButton: "安裝 HagiCode 桌面版",
  },
  "ja-JP": {
    faqTitle: "よくある質問",
    chooseWhen: "{name} が向いている場面",
    relatedTitle: "ほかの比較",
    vsLabel: "{agent} と HagiCode の比較",
    ctaTitle: "今使っているエージェントの上で HagiCode を試す",
    ctaDescription: "HagiCode デスクトップをインストールし、既存の CLI を接続して、今の作業スタイルのまま使えます。",
    ctaButton: "HagiCode デスクトップをインストール",
  },
  "ko-KR": {
    faqTitle: "자주 묻는 질문",
    chooseWhen: "{name}가 맞는 경우",
    relatedTitle: "다른 비교",
    vsLabel: "{agent} vs HagiCode",
    ctaTitle: "이미 쓰는 에이전트 위에서 HagiCode 사용해 보기",
    ctaDescription: "HagiCode 데스크톱을 설치하고 기존 CLI를 연결해 지금의 작업 방식을 그대로 유지하세요.",
    ctaButton: "HagiCode 데스크톱 설치",
  },
  "de-DE": {
    faqTitle: "Häufige Fragen",
    chooseWhen: "{name} passt, wenn",
    relatedTitle: "Weitere Vergleiche",
    vsLabel: "{agent} vs. HagiCode",
    ctaTitle: "HagiCode auf dem Agenten testen, den Sie schon nutzen",
    ctaDescription: "Installieren Sie HagiCode Desktop, verbinden Sie Ihr bestehendes CLI und arbeiten Sie weiter wie bisher.",
    ctaButton: "HagiCode Desktop installieren",
  },
  "es-ES": {
    faqTitle: "Preguntas frecuentes",
    chooseWhen: "Elige {name} cuando",
    relatedTitle: "Más comparativas",
    vsLabel: "{agent} vs HagiCode",
    ctaTitle: "Prueba HagiCode sobre el agente que ya usas",
    ctaDescription: "Instala HagiCode Desktop, conecta tu CLI actual y sigue trabajando como hasta ahora.",
    ctaButton: "Instalar HagiCode Desktop",
  },
  "fr-FR": {
    faqTitle: "Questions fréquentes",
    chooseWhen: "Choisissez {name} quand",
    relatedTitle: "Autres comparatifs",
    vsLabel: "{agent} vs HagiCode",
    ctaTitle: "Essayez HagiCode au-dessus de l'agent que vous utilisez déjà",
    ctaDescription: "Installez HagiCode Desktop, connectez votre CLI actuel et continuez à travailler comme aujourd'hui.",
    ctaButton: "Installer HagiCode Desktop",
  },
  "pt-BR": {
    faqTitle: "Perguntas frequentes",
    chooseWhen: "Escolha {name} quando",
    relatedTitle: "Mais comparações",
    vsLabel: "{agent} vs HagiCode",
    ctaTitle: "Experimente o HagiCode sobre o agente que você já usa",
    ctaDescription: "Instale o HagiCode Desktop, conecte seu CLI atual e continue trabalhando como hoje.",
    ctaButton: "Instalar o HagiCode Desktop",
  },
  "ru-RU": {
    faqTitle: "Частые вопросы",
    chooseWhen: "Выбирайте {name}, если",
    relatedTitle: "Другие сравнения",
    vsLabel: "{agent} и HagiCode: сравнение",
    ctaTitle: "Попробуйте HagiCode поверх агента, который вы уже используете",
    ctaDescription: "Установите HagiCode Desktop, подключите свой CLI и работайте так же, как сейчас.",
    ctaButton: "Установить HagiCode Desktop",
  },
};

export function getStructuredArticleCopy(locale) {
  return COPY[resolveArticleLocale(locale)] ?? COPY['en-US'];
}
