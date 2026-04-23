import { describe, expect, it } from "vitest";

import {
  type DocsEditLinkRoute,
  resolveDocsEditLink,
} from "@/lib/docs-edit-link";

function createRoute(
  route: Partial<DocsEditLinkRoute> = {},
): DocsEditLinkRoute {
  return {
    id: "",
    locale: "root",
    entry: {},
    ...route,
  };
}

describe("resolveDocsEditLink", () => {
  it("points root-locale content files at the docs repository root", () => {
    const result = resolveDocsEditLink(
      createRoute({
        id: "legal/privacy-policy",
        entry: {
          filePath: "src/content/docs/legal/privacy-policy.mdx",
        },
      }),
    );

    expect(result).toMatchObject({
      isVisible: true,
      sourcePath: "src/content/docs/legal/privacy-policy.mdx",
      repoPath: "src/content/docs/legal/privacy-policy.mdx",
      href: "https://github.com/HagiCode-org/docs/edit/main/src/content/docs/legal/privacy-policy.mdx",
    });
  });

  it("preserves localized English paths when building edit links", () => {
    const result = resolveDocsEditLink(
      createRoute({
        id: "en/blog/2026-04-11-border-light-animation-effect",
        locale: "en",
        entry: {
          filePath:
            "src/content/docs/en/blog/2026-04-11-border-light-animation-effect.mdx",
        },
      }),
    );

    expect(result).toMatchObject({
      isVisible: true,
      sourcePath:
        "src/content/docs/en/blog/2026-04-11-border-light-animation-effect.mdx",
      repoPath:
        "src/content/docs/en/blog/2026-04-11-border-light-animation-effect.mdx",
      href: "https://github.com/HagiCode-org/docs/edit/main/src/content/docs/en/blog/2026-04-11-border-light-animation-effect.mdx",
    });
  });

  it("preserves concrete index source files for root and English routes", () => {
    const rootResult = resolveDocsEditLink(
      createRoute({
        id: "release-notes",
        entry: {
          filePath: "src/content/docs/release-notes/index.mdx",
        },
      }),
    );
    const englishResult = resolveDocsEditLink(
      createRoute({
        id: "en/release-notes",
        locale: "en",
        entry: {
          filePath: "src/content/docs/en/release-notes/index.mdx",
        },
      }),
    );

    expect(rootResult.repoPath).toBe(
      "src/content/docs/release-notes/index.mdx",
    );
    expect(englishResult.repoPath).toBe(
      "src/content/docs/en/release-notes/index.mdx",
    );
  });

  it("keeps the original file extension when the source file is markdown", () => {
    const result = resolveDocsEditLink(
      createRoute({
        id: "en-terms-glossary",
        entry: {
          filePath: "src/content/docs/en-terms-glossary.md",
        },
      }),
    );

    expect(result).toMatchObject({
      isVisible: true,
      sourcePath: "src/content/docs/en-terms-glossary.md",
      repoPath: "src/content/docs/en-terms-glossary.md",
    });
    expect(result.href).toContain("en-terms-glossary.md");
  });

  it("falls back to a locale-aware route lookup when filePath metadata is unavailable", () => {
    const result = resolveDocsEditLink(
      createRoute({
        id: "en/legal/privacy-policy",
        locale: "en",
      }),
      {
        fileExists: (sourcePath) =>
          sourcePath === "src/content/docs/en/legal/privacy-policy.mdx",
      },
    );

    expect(result).toMatchObject({
      isVisible: true,
      sourcePath: "src/content/docs/en/legal/privacy-policy.mdx",
      repoPath: "src/content/docs/en/legal/privacy-policy.mdx",
    });
  });

  it("resolves the turbo engine dlc page to the real docs repository file", () => {
    const result = resolveDocsEditLink(
      createRoute({
        id: "dlc/turbo-engine-dlc",
        entry: {
          filePath: "src/content/docs/dlc/turbo-engine-dlc.mdx",
        },
      }),
    );

    expect(result).toMatchObject({
      isVisible: true,
      sourcePath: "src/content/docs/dlc/turbo-engine-dlc.mdx",
      repoPath: "src/content/docs/dlc/turbo-engine-dlc.mdx",
      href: "https://github.com/HagiCode-org/docs/edit/main/src/content/docs/dlc/turbo-engine-dlc.mdx",
    });
  });

  it("hides the CTA when the route cannot be mapped to a docs markdown file", () => {
    const invalidFileResult = resolveDocsEditLink(
      createRoute({
        id: "blog/authors",
        entry: {
          filePath: "src/content/docs/blog/authors.yml",
        },
      }),
    );
    const missingRouteResult = resolveDocsEditLink(
      createRoute({
        id: "contributors",
      }),
      {
        fileExists: () => false,
      },
    );
    const syntheticRouteResult = resolveDocsEditLink(
      createRoute({
        id: "blog",
        entry: {
          filePath: "src/content/docs/blog.md",
        },
      }),
      {
        fileExists: () => false,
      },
    );

    expect(invalidFileResult).toEqual({ isVisible: false });
    expect(missingRouteResult).toEqual({ isVisible: false });
    expect(syntheticRouteResult).toEqual({ isVisible: false });
  });
});
