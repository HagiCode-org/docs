import { z } from 'astro/zod';

export const AI_DISCLOSURE_FRONTMATTER_FIELDS = {
  isAITranslation: z.boolean().default(true),
  isAIAuthor: z.boolean().default(true),
};

type ExtendableSchema = {
  extend: (shape: typeof AI_DISCLOSURE_FRONTMATTER_FIELDS) => unknown;
};

export function extendWithAIDisclosureFlags<
  TSchema extends ExtendableSchema,
  TOutput extends ReturnType<TSchema['extend']>,
>(schema: TSchema): TOutput {
  return schema.extend(AI_DISCLOSURE_FRONTMATTER_FIELDS) as TOutput;
}
