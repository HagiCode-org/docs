import { describe, expect, it } from 'vitest';
import { z } from 'astro/zod';

import { extendWithAIDisclosureFlags } from './ai-disclosure-schema';

describe('AI disclosure frontmatter schema', () => {
  const schema = extendWithAIDisclosureFlags(
    z.object({
      title: z.string(),
      hideAd: z.boolean().optional(),
    }),
  );

  it('defaults both AI disclosure flags to true when omitted', () => {
    expect(schema.parse({ title: 'Example docs page' })).toEqual({
      title: 'Example docs page',
      isAITranslation: true,
      isAIAuthor: true,
    });
  });

  it('preserves explicit false values without breaking existing fields', () => {
    expect(
      schema.parse({
        title: 'Example blog post',
        hideAd: true,
        isAITranslation: false,
        isAIAuthor: false,
      }),
    ).toEqual({
      title: 'Example blog post',
      hideAd: true,
      isAITranslation: false,
      isAIAuthor: false,
    });
  });
});
