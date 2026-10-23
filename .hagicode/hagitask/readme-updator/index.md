---
public: true
multilingual: true
languages:
  - en-US
  - zh-CN
sourceLanguage: en-US
style: product
---

# README requirements

## Product focus

- Introduce HagiCode Docs as the documentation site that helps people understand, install, and use HagiCode.
- Address people evaluating HagiCode, new users getting started, and existing users looking up features or changes.
- Keep the introduction concise, clear, reliable, and focused on what readers can learn and do.

## Required content

- Open with a short product introduction and a prominent link to the public documentation site at https://docs.hagicode.com.
- Explain who the documentation is for and the questions it helps readers answer.
- Describe the available reading topics with links to existing pages: product overview, installation, quick start, user guide, FAQ, release notes, and blog.
- Offer a short getting-started reading path: choose an installation method, complete the initialization wizard, and create a first conversation session.
- Mention language selection as a reader-facing feature. Keep descriptions and links grounded in the current documentation pages; do not invent capabilities or promise complete translation coverage.

## README languages

- Maintain English in `README.md` and Simplified Chinese in `README_cn.md`, preserving their reciprocal language links and existing filenames.
- Keep both READMEs aligned in scope and meaning, using the matching language's public documentation links.

## Exclusions

- Keep repository maintenance instructions out of the READMEs: repository layout, implementation architecture, local development, build and test commands, CI, deployment, dependency versions, and content-generation details.
- Exclude ecosystem and cross-repository responsibilities, screenshot analysis, translation maintenance, analytics integration, version-data plumbing, and release-notes synchronization workflows. Release notes may appear as a reading destination.
- Exclude credentials, secret values, internal hosts, machine-specific paths, private links, and local AI gateway endpoints.
- Do not assert a license or other product claims without repository evidence.
