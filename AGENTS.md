# HagiCode Docs - Agent Configuration

## Root Configuration

Inherits all behavior from `/AGENTS.md` at the monorepo root. Local rules extend or override the root file for this repository.

## Project Context

This repository is the standalone HagiCode documentation site built with Astro and Starlight.

- User docs, guides, and reference pages live here.
- Blog content and release-note related flows also run here.
- The marketing website lives in `repos/site`.

## Working Directory

Run commands from `repos/docs/`.

## Key Commands

```bash
npm install
npm run dev
npm run build
npm run build:ci
npm run typecheck
npm run verify:blog
```

## Key Paths

- `src/content/docs/`: documentation and blog content
- `src/components/`: custom site components
- `scripts/`: content preparation, verification, and sync tooling
- `tests/`: script and content workflow tests

## Agent Guidelines

- Favor clear documentation structure over marketing language.
- Keep content in Markdown or MDX patterns already established in the repo.
- Preserve frontmatter, heading structure, internal links, and verification-script expectations.
- Use repo scripts for content materialization, translation, release notes, and screenshot workflows instead of editing generated output directly.
- Keep docs-specific concerns here; broader product marketing belongs in `repos/site`.

## References

- `README.md`
- `illustration-management.md`
- `scripts/`
