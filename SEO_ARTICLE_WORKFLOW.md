# SEO Article Workflow

This document defines a stable SEO article generation workflow for the docs repository at `/home/newbe36524/repos/hagicode-mono/repos/docs`.

The goal is not to let an agent publish large batches of low-signal content. The goal is to create a repeatable process where Hermes helps with research, outlining, drafting, and verification while a human approves scope and publishing decisions.

## Goals

- Produce SEO articles that are grounded in real repository facts and approved source material.
- Keep article structure, metadata, links, and review criteria consistent across runs.
- Make every generated article traceable back to a brief, research pass, and review report.
- Default to draft-first, never publish-first.

## Core Principles

1. Facts before prose.
2. Outline before draft.
3. Draft before publish.
4. Human approval at every irreversible step.
5. Repository sources win over memory or guesswork.
6. A failed verification blocks publication.

## Workflow Assets

Create and maintain these assets for each article:

- `seo/briefs/` - topic briefs and article requests.
- `seo/research/` - Hermes research notes and source extraction.
- `seo/outlines/` - approved outlines.
- `seo/drafts/` - generated drafts before publication.
- `seo/reports/` - verification and review reports.
- `src/content/docs/blog/` - final approved blog posts only.

Recommended file naming pattern:

- `seo/briefs/YYYY-MM-DD-slug.yaml`
- `seo/research/YYYY-MM-DD-slug.md`
- `seo/outlines/YYYY-MM-DD-slug.md`
- `seo/drafts/YYYY-MM-DD-slug.mdx`
- `seo/reports/YYYY-MM-DD-slug.md`

## Roles

### Human owner

Responsible for:

- Approving topic selection.
- Defining target keywords and search intent.
- Deciding whether the article should continue after research or outline review.
- Approving publication.

### Hermes agent

Responsible for:

- Reading the brief.
- Gathering repository-backed facts.
- Producing research notes.
- Producing outline candidates.
- Producing a draft from the approved outline.
- Running repository verification steps.
- Writing a review report.

Hermes must not:

- Invent commands, product capabilities, version support, or links.
- Publish directly to the final blog path without explicit approval.
- Treat generated related-materials pages as automatically shippable.
- Use external claims unless the brief explicitly allows and cites them.

## Supported Article Types

Support only these article types until the workflow is stable:

- `install-guide`
- `troubleshooting`
- `comparison`
- `best-practice`

Use a fixed structural expectation for each type.

### install-guide

Expected sections:

- Who this guide is for
- Prerequisites
- Installation steps
- Verification
- Common problems
- Next steps

### troubleshooting

Expected sections:

- Symptom
- Likely causes
- Diagnosis steps
- Fixes
- Prevention notes

### comparison

Expected sections:

- What is being compared
- Key differences
- Fit by scenario
- Decision guidance
- Recommended path

### best-practice

Expected sections:

- Context
- Common mistakes
- Recommended approach
- Concrete examples
- Summary

## Stage-by-Stage SOP

### Stage 1: Topic brief

Human creates a brief from `templates/seo/article-brief.template.yaml`.

The brief must define:

- article id and slug
- language
- article type
- primary and secondary keywords
- search intent
- target audience
- success criteria
- mandatory sources
- mandatory internal links
- forbidden content
- desired CTA

A brief is the contract for the rest of the workflow.

### Stage 2: Research

Hermes reads the brief and produces a research note in `seo/research/`.

The research note must separate:

- confirmed facts
- open questions
- repository files consulted
- reusable commands and paths
- internal link opportunities
- claims that still need human validation

If mandatory facts are missing, stop here and do not draft.

### Stage 3: Outline

Hermes generates an outline from the research note.

The outline must include:

- 3 title candidates
- 2 meta description candidates
- H2 and H3 structure
- FAQ suggestions
- internal link placements
- CTA suggestion
- unresolved risk list

Human reviews and either:

- approves the outline
- asks for revision
- cancels the article

No draft starts without outline approval.

### Stage 4: Draft generation

Hermes generates the article draft into `seo/drafts/` using the approved outline.

Draft requirements:

- include frontmatter
- use only approved facts
- use repository-aligned product naming
- include internal links from the brief where appropriate
- use concrete commands and file paths when relevant
- avoid keyword stuffing
- avoid generic AI filler language

The draft stays out of `src/content/docs/blog/` until it passes review.

### Stage 5: Self-review

Hermes performs a structured self-review and writes a report to `seo/reports/`.

The self-review must answer:

- Does the draft directly satisfy the search intent?
- Does the opening section answer the user question quickly?
- Are the commands and paths verified against repository sources?
- Are all major claims traceable?
- Are internal links useful and valid?
- Does the article avoid unsupported marketing language?
- Does the article overlap too much with existing content?

### Stage 6: Repository verification

Run repository checks before approval.

Current available verification commands:

```bash
npm run verify:blog
npm run build:verify-blog
```

Current repo checks validate blog structure and rendering, but they do not yet validate SEO workflow metadata. Add more checks over time.

Future recommended checks:

- `verify:seo-frontmatter`
- `verify:seo-source-traceability`
- `verify:seo-internal-links`
- `verify:seo-metadata-length`
- `verify:seo-duplicate-topics`

### Stage 7: Human review

Human reviews the draft and report.

Review focus:

- usefulness
- factual correctness
- brand tone
- duplication with existing docs
- actual SEO value instead of article volume

Approval options:

- reject
- revise
- approve for publication

### Stage 8: Publication

After approval:

- move the final article into `src/content/docs/blog/`
- set the correct date and frontmatter
- remove or update any draft marker according to the publishing policy
- keep the brief, research note, outline, and report for traceability

## Hermes Operating Contract

When Hermes is asked to work on an SEO article, the task should explicitly state the stage.

Recommended stage prompts:

- `research`: read the brief and produce a research note only
- `outline`: read the brief and research note and produce an outline only
- `draft`: read the approved outline and produce a draft only
- `review`: read the draft and produce a review report only

Never ask Hermes to skip directly from topic idea to final published article.

## Quality Gates

An article is blocked if any of the following is true:

- mandatory sources were not used
- key claims are not traceable
- the article does not match the requested article type
- internal linking is missing where required
- repository verification fails
- the human reviewer marks the draft as low-signal or off-brand

## Definition of Done

An SEO article is complete only when all of the following exist:

- brief
- research note
- approved outline
- draft
- review report
- successful verification output
- approved final article in `src/content/docs/blog/`

## Initial Rollout Strategy

Do not start with bulk generation.

Roll out in this order:

1. one article through the full workflow
2. refine templates and review criteria
3. three more articles across different article types
4. add automation only after the manual workflow is stable

## Notes for This Repository

Current repo status:

- the docs repository already has a blog system and blog verification scripts
- it does not currently have a stable SEO generation pipeline checked into the repo
- generated related-materials pages should be treated as optional outputs, not default publish targets

Use this SOP as the governing process before rebuilding any `seo-pipeline` scripts.
