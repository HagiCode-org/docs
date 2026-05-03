import { existsSync } from "node:fs";
import path from "node:path";

export const DOCS_CONTENT_PREFIX = "src/content/docs/";
export const DOCS_REPO_PREFIX = "";
export const DOCS_LEGACY_MONOREPO_PREFIX = "repos/docs/";
export const DOCS_GITHUB_EDIT_BASE_URL =
  "https://github.com/HagiCode-org/docs/edit/main/";

const MARKDOWN_FILE_PATTERN = /\.mdx?$/i;
const docsProjectRoot = process.cwd();

export interface DocsEditLinkRoute {
  id?: string;
  locale?: string | undefined;
  entry?: {
    filePath?: string | undefined;
  };
}

export interface DocsEditLinkResolution {
  href?: string;
  repoPath?: string;
  sourcePath?: string;
  isVisible: boolean;
}

export interface ResolveDocsEditLinkOptions {
  githubEditBaseUrl?: string;
  fileExists?: (sourcePath: string) => boolean;
}

export function resolveDocsEditLink(
  route: DocsEditLinkRoute,
  options: ResolveDocsEditLinkOptions = {},
): DocsEditLinkResolution {
  const sourcePath = resolveDocsSourcePath(route, options);

  if (!sourcePath) {
    return { isVisible: false };
  }

  const repoPath = toRepoRelativeDocsPath(sourcePath);

  return {
    href: buildDocsEditHref(repoPath, options.githubEditBaseUrl),
    repoPath,
    sourcePath,
    isVisible: true,
  };
}

export function resolveDocsSourcePath(
  route: DocsEditLinkRoute,
  options: Pick<ResolveDocsEditLinkOptions, "fileExists"> = {},
): string | undefined {
  const fileExists = options.fileExists ?? defaultFileExists;
  const directSourcePath = normalizeSourcePath(route.entry?.filePath);

  if (
    isSupportedDocsSourcePath(directSourcePath) &&
    fileExists(directSourcePath)
  ) {
    return directSourcePath;
  }

  const normalizedRouteId = normalizeRouteId(route.id, route.locale);
  const localePrefix =
    route.locale && route.locale !== "root"
      ? `${toDocsContentLocaleDirectory(route.locale)}/`
      : "";

  const candidateRoot = `${DOCS_CONTENT_PREFIX}${localePrefix}`;
  const candidates =
    normalizedRouteId.length === 0
      ? [`${candidateRoot}index.mdx`, `${candidateRoot}index.md`]
      : [
          `${candidateRoot}${normalizedRouteId}.mdx`,
          `${candidateRoot}${normalizedRouteId}.md`,
          `${candidateRoot}${normalizedRouteId}/index.mdx`,
          `${candidateRoot}${normalizedRouteId}/index.md`,
        ];

  return candidates.find((candidate) => fileExists(candidate));
}

function toDocsContentLocaleDirectory(locale: string): string {
  return locale;
}

export function buildDocsEditHref(
  repoPath: string,
  githubEditBaseUrl = DOCS_GITHUB_EDIT_BASE_URL,
): string {
  return new URL(repoPath, ensureTrailingSlash(githubEditBaseUrl)).toString();
}

export function toRepoRelativeDocsPath(sourcePath: string): string {
  return DOCS_REPO_PREFIX ? `${DOCS_REPO_PREFIX}${sourcePath}` : sourcePath;
}

function defaultFileExists(sourcePath: string): boolean {
  return existsSync(path.resolve(docsProjectRoot, sourcePath));
}

function normalizeSourcePath(filePath?: string): string | undefined {
  if (!filePath) {
    return undefined;
  }

  let normalized = filePath.replaceAll("\\", "/");
  const contentPrefixIndex = normalized.indexOf(DOCS_CONTENT_PREFIX);

  if (contentPrefixIndex >= 0) {
    normalized = normalized.slice(contentPrefixIndex);
  } else {
    normalized = normalized.replace(/^\/+/, "").replace(/^\.\//, "");

    if (
      DOCS_LEGACY_MONOREPO_PREFIX &&
      normalized.startsWith(DOCS_LEGACY_MONOREPO_PREFIX)
    ) {
      normalized = normalized.slice(DOCS_LEGACY_MONOREPO_PREFIX.length);
    }
  }

  if (normalized.startsWith("../")) {
    return undefined;
  }

  return normalized;
}

function normalizeRouteId(
  routeId?: string,
  locale?: string | undefined,
): string {
  if (!routeId) {
    return "";
  }

  let normalized = routeId.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
  const localePrefix =
    locale && locale !== "root" ? `${locale.replace(/\/+$/g, "")}/` : "";

  if (localePrefix && normalized.startsWith(localePrefix)) {
    normalized = normalized.slice(localePrefix.length);
  }

  if (normalized === "index") {
    return "";
  }

  if (normalized.endsWith("/index")) {
    return normalized.slice(0, -"/index".length);
  }

  return normalized;
}

function isSupportedDocsSourcePath(
  sourcePath?: string,
): sourcePath is string {
  return (
    typeof sourcePath === "string" &&
    sourcePath.startsWith(DOCS_CONTENT_PREFIX) &&
    MARKDOWN_FILE_PATTERN.test(sourcePath)
  );
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}
