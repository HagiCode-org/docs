---
title: Technical Reviewer Assignment for Documentation Translation
description: This document outlines technical reviewer assignments for each documentation section in the English translation project.
---

# Technical Reviewer Assignment for Documentation Translation

This document outlines the technical reviewer assignments for each documentation section in the English translation project.

## Reviewer Roles

### Technical Reviewer
Responsible for:
- Verifying code examples are technically accurate and executable
- Checking configuration values and commands are correct
- Ensuring technical concepts are properly explained
- Validating technical terminology accuracy

### Language Reviewer
Responsible for:
- Ensuring English is natural and readable
- Checking grammar and spelling
- Verifying terminology consistency with TERMS.md
- Confirming tone matches documentation style

## Section Assignments

### Phase 1: Core User Journey Documentation

| Section | Files | Technical Reviewer | Language Reviewer |
|---------|-------|-------------------|-------------------|
| Product Overview | `product-overview.mdx` | @newbe36524 | TBD |
| Quick Start Guides | `quick-start/*.mdx` | @newbe36524 | TBD |
| Installation Guides | `installation/*.mdx` | @newbe36524 | TBD |

### Phase 2: Feature Documentation

| Section | Files | Technical Reviewer | Language Reviewer |
|---------|-------|-------------------|-------------------|
| Monospec Guide | `guides/monospecs.mdx` | @newbe36524 | TBD |
| AI Compose Commit | `guides/ai-compose-commit.mdx` | @newbe36524 | TBD |
| Contributor Guide | `contributor-guide.mdx` | @newbe36524 | TBD |

### Phase 3: Extended Documentation

| Section | Files | Technical Reviewer | Language Reviewer |
|---------|-------|-------------------|-------------------|
| Related Software Installation | `related-software-installation/**/*.mdx` | @newbe36524 | TBD |
| Blog Posts | `blog/**/*.mdx` | @newbe36524 | TBD |

## Review Process

### 1. Technical Review Checklist
- [ ] Code examples are syntactically correct
- [ ] Code examples are executable
- [ ] Configuration files have correct keys and values
- [ ] Shell commands are accurate
- [ ] Technical concepts are properly explained
- [ ] No technical information is lost in translation

### 2. Language Review Checklist
- [ ] English is natural and readable
- [ ] Grammar and spelling are correct
- [ ] Terminology matches TERMS.md
- [ ] Capitalization follows style guide
- [ ] No literal translations that sound awkward
- [ ] Tone matches documentation style

### 3. Consistency Review Checklist
- [ ] Internal links use `/en/` prefix
- [ ] External links are preserved
- [ ] Formatting matches other English pages
- [ ] Structure matches original Chinese page

## Review Workflow

1. **PR Created**: Translator submits translation PR
2. **Technical Review**: Assigned technical reviewer validates technical accuracy
3. **Language Review**: Assigned language reviewer validates language quality
4. **Feedback**: Reviewers provide feedback if needed
5. **Revision**: Translator makes required changes
6. **Approval**: Both reviewers approve
7. **Merge**: PR is merged to main branch

## Escalation Path

If reviewers disagree or have questions:
1. Discuss in PR comments
2. If unresolved, escalate to @newbe36524 for final decision
3. Update TERMS.md if new terminology decisions are made

## Onboarding New Reviewers

To add a new reviewer:
1. Assign them to relevant sections in this document
2. Share TERMS.md and style guidelines
3. Provide example translations for reference
4. Walk through review checklist

---

**Last Updated**: 2026-02-26

**Maintainer**: Hagicode Documentation Team

**Version**: 1.0
