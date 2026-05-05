import { REQUIRED_BLOG_LOCALES, validateBlogI18nCompleteness } from './verify-blog-i18n-completeness.mjs';
import './verify-blog-sidebar-i18n.mjs';

const completeness = await validateBlogI18nCompleteness();
if (!completeness.ok) {
  for (const diagnostic of completeness.diagnostics) {
    console.error(`- [${diagnostic.code}] ${diagnostic.message}`);
  }
  throw new Error(`Blog i18n completeness failed with ${completeness.diagnostics.length} diagnostics.`);
}

console.log(`Verified blog i18n build output for ${REQUIRED_BLOG_LOCALES.length} desktop languages.`);
