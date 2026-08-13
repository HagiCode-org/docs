import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docsRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const forbiddenPatterns = [
  {
    label: 'Aliyun ACR registry address',
    pattern: /registry\.cn-hangzhou\.aliyuncs\.com/iu,
  },
  {
    label: 'ACR deployment instruction',
    pattern: /\bACR\b/iu,
  },
  {
    label: 'Alibaba Cloud container registry instruction',
    pattern: /(?:Alibaba\s+Cloud|Aliyun)\s+Container\s+Registry/iu,
  },
  {
    label: 'Aliyun container image registry instruction',
    pattern: /阿里[云雲].{0,12}(?:容器[镜鏡]像|[镜鏡]像(?:服务|服務|倉庫|仓库))/iu,
  },
];

const dockerHubImagePattern = /newbe36524\/hagicode:\{tag\}/u;

export function findImageSourceViolations(content) {
  return forbiddenPatterns
    .filter(({ pattern }) => pattern.test(content))
    .map(({ label }) => label);
}

export async function collectMaintainedInstallationPages(root = docsRoot) {
  const translationRoot = path.join(root, 'src', 'content', 'translations', 'docs');
  const localeEntries = await readdir(translationRoot, { withFileTypes: true });
  const translatedPages = localeEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      path.join(translationRoot, entry.name, 'installation', 'docker-compose.mdx'),
    );

  return [
    path.join(root, 'src', 'content', 'docs', 'installation', 'docker-compose.mdx'),
    ...translatedPages,
  ];
}

export async function verifyDockerComposeImageSources(root = docsRoot) {
  const files = await collectMaintainedInstallationPages(root);
  const violations = [];

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8');
    const findings = findImageSourceViolations(content);

    if (!dockerHubImagePattern.test(content)) {
      findings.push('supported Docker Hub image address is missing');
    }

    if (findings.length > 0) {
      violations.push({ filePath, findings });
    }
  }

  return { files, violations };
}

async function main() {
  const result = await verifyDockerComposeImageSources();

  if (result.violations.length > 0) {
    console.error('Unsupported image source content found in maintained Docker Compose installation pages:');
    for (const { filePath, findings } of result.violations) {
      console.error(`- ${path.relative(docsRoot, filePath)}: ${findings.join(', ')}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Verified Docker Hub-only guidance in ${result.files.length} maintained installation pages.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
