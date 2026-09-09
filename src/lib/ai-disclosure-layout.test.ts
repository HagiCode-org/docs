import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const componentsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../components');
const markdownContent = readFileSync(path.join(componentsDir, 'MarkdownContent.astro'), 'utf8');
const disclosureNotices = readFileSync(path.join(componentsDir, 'AIDisclosureNotices.astro'), 'utf8');

describe('AI disclosure layout', () => {
  it('places author notices before and translation notices after each article slot', () => {
    const authorFilters = [...markdownContent.matchAll(/filter="author"/g)].map((match) => match.index ?? -1);
    const translationFilters = [...markdownContent.matchAll(/filter="translation"/g)].map((match) => match.index ?? -1);
    const slots = [...markdownContent.matchAll(/<slot \/>/g)].map((match) => match.index ?? -1);

    expect(authorFilters).toHaveLength(2);
    expect(translationFilters).toHaveLength(2);
    expect(slots).toHaveLength(2);
    expect(authorFilters[0]).toBeLessThan(slots[0]);
    expect(slots[0]).toBeLessThan(translationFilters[0]);
    expect(authorFilters[1]).toBeLessThan(slots[1]);
    expect(slots[1]).toBeLessThan(translationFilters[1]);
  });

  it('supports both filtered and unfiltered notice rendering', () => {
    expect(disclosureNotices).toContain("filter?: 'author' | 'translation'");
    expect(disclosureNotices).toContain('filter ? notices.filter((notice) => notice.kind === filter) : notices');
  });

  it('keeps translation suppression and source-link resolution in the shared builder', () => {
    const source = readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'ai-disclosures.ts'), 'utf8');

    expect(source).toContain("if (isAITranslation && currentLocale !== 'root')");
    expect(source).toContain("buildDocsCounterpartPath('root', pathname)");
  });
});
