---
name: Documentation Translation
about: Template for submitting English translations of Chinese documentation
title: '[Translation] Translate [Page Name] to English'
labels: documentation, translation
assignees: ''
---

## Translation Type

- [ ] New page translation
- [ ] Update to existing translation
- [ ] Bug fix in translation
- [ ] Terminology update

## Pages Affected

List all pages being translated or updated in this PR:
- `/en/page-name.mdx`

## Translation Scope

Briefly describe what this PR translates:
- [ ] Documentation page
- [ ] Blog post
- [ ] Guide/tutorial
- [ ] Code examples
- [ ] Screenshots/images

## Changes Made

### What was translated:
- [ ] Page content (full translation)
- [ ] Frontmatter (title, description, metadata)
- [ ] Code comments
- [ ] Mermaid diagram labels
- [ ] Internal links (updated to `/en/` prefix)

### Special considerations:
- Preserved technical terms per [TERMS.md](/en/TERMS.md)
- Updated image paths for language-specific versions
- Noted any Chinese screenshots requiring English versions

## Terminology Check

Confirm that Hagicode-specific terms are translated consistently:

- [ ] Checked against [TERMS.md](/en/TERMS.md)
- [ ] Used "Proposal-driven development" for "提案驱动开发"
- [ ] Used "Read-only mode/Edit mode" for "只读模式/编辑模式"
- [ ] Preserved "OpenSpec", "Monospec", "Grain" as-is
- [ ] Capitalized technical terms correctly

## Code Accuracy

- [ ] All code examples are syntactically correct
- [ ] Code comments are translated but code is unchanged
- [ ] Configuration files preserve keys and values
- [ ] Shell commands are unchanged

## Link Validation

- [ ] Internal links use `/en/` prefix
- [ ] External links are preserved
- [ ] No broken links in translated content

## Testing

- [ ] Verified Starlight components render correctly
- [ ] Checked Mermaid diagrams render properly
- [ ] Tested code blocks have correct syntax highlighting
- [ ] Verified language switcher works on affected pages
- [ ] Checked mobile responsiveness (if applicable)

## Screenshots

[ ] English screenshots created and saved to `src/content/docs/img/en/`
[ ] Fallback notice added for Chinese screenshots
[ ] No screenshots require translation

### Screenshot Notes:
List any screenshots with Chinese text that still need English versions:
- `img/path/screenshot.png` - [Description of what needs English version]

## Review Checklist

### Technical Review
- [ ] Code examples are accurate and executable
- [ ] Technical terminology is correct
- [ ] Configuration values are correct
- [ ] Technical concepts are explained clearly

### Language Review
- [ ] English is natural and readable
- [ ] Grammar and spelling are correct
- [ ] Tone matches documentation style
- [ ] No literal translations that sound awkward

### Consistency Review
- [ ] Terminology matches TERMS.md
- [ ] Formatting matches other English pages
- [ ] Capitalization follows style guide
- [ ] Structure matches original Chinese page

## Additional Notes

Any context, questions, or notes for reviewers:

## Related Issues

Related issue number or discussion:
