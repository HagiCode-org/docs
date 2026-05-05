import { buildDocsCounterpartPath, resolveDocsLocale } from './i18n';

export type AIDisclosureNotice =
  | {
      kind: 'translation';
      sourceHref: string;
    }
  | {
      kind: 'author';
    };

export function buildAIDisclosureNotices(options: {
  isAITranslation: boolean;
  isAIAuthor: boolean;
  locale: string | null | undefined;
  pathname: string;
}): AIDisclosureNotice[] {
  const { isAITranslation, isAIAuthor, locale, pathname } = options;
  const currentLocale = resolveDocsLocale(locale);
  const notices: AIDisclosureNotice[] = [];

  if (isAITranslation && currentLocale !== 'root') {
    notices.push({
      kind: 'translation',
      sourceHref: buildDocsCounterpartPath('root', pathname),
    });
  }

  if (isAIAuthor) {
    notices.push({
      kind: 'author',
    });
  }

  return notices;
}
