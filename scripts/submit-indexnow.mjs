export const INDEXNOW_CONFIG = Object.freeze({
  host: 'docs.hagicode.com',
  key: 'cb0f18b465754a0da8d353672ff9982c',
  keyLocation: 'https://docs.hagicode.com/cb0f18b465754a0da8d353672ff9982c.txt',
  sitemapIndexUrl: 'https://docs.hagicode.com/sitemap-index.xml',
  endpoint: 'https://api.indexnow.org/indexnow',
  batchSize: 10000
});

const locPattern = /<loc>\s*([^<]+?)\s*<\/loc>/giu;

export function extractLocValues(xml) {
  return Array.from(String(xml).matchAll(locPattern), (match) => decodeXmlText(match[1].trim())).filter(Boolean);
}

function decodeXmlText(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

export function normalizeUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function filterProductionUrls(values, config = INDEXNOW_CONFIG) {
  const seen = new Set();
  const urls = [];
  let excludedCount = 0;

  for (const value of values) {
    const normalizedUrl = normalizeUrl(value);

    if (!normalizedUrl) {
      excludedCount += 1;
      continue;
    }

    const url = new URL(normalizedUrl);
    if (url.protocol !== 'https:' || url.host !== config.host) {
      excludedCount += 1;
      continue;
    }

    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      urls.push(normalizedUrl);
    }
  }

  return { urls, excludedCount };
}

export function createBatches(items, batchSize = INDEXNOW_CONFIG.batchSize) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error(`Invalid IndexNow batch size: ${batchSize}`);
  }

  const batches = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

export function createPayload(urlList, config = INDEXNOW_CONFIG) {
  return {
    host: config.host,
    key: config.key,
    keyLocation: config.keyLocation,
    urlList
  };
}

export function createPayloads(urls, config = INDEXNOW_CONFIG) {
  return createBatches(urls, config.batchSize).map((batch) => createPayload(batch, config));
}

export function classifyIndexNowResponse(status, body = '') {
  if (status === 200) {
    return { ok: true, label: 'accepted', message: 'IndexNow accepted the batch.' };
  }

  if (status === 202) {
    return { ok: true, label: 'accepted_for_processing', message: 'IndexNow accepted the batch for processing.' };
  }

  const knownFailures = {
    400: ['malformed_payload', 'Malformed IndexNow payload. Check the JSON request body.'],
    403: ['key_verification_failed', 'IndexNow could not verify the key file for the docs host.'],
    422: ['invalid_url', 'IndexNow rejected at least one submitted URL as invalid.'],
    429: ['rate_limited', 'IndexNow rate-limited the submission. Retry later.']
  };

  if (Object.hasOwn(knownFailures, status)) {
    const [label, message] = knownFailures[status];
    return { ok: false, label, message, body };
  }

  return {
    ok: false,
    label: 'unexpected_status',
    message: `IndexNow returned unexpected HTTP status ${status}.`,
    body
  };
}

async function fetchText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    headers: {
      accept: 'application/xml,text/xml,text/plain;q=0.9,*/*;q=0.8'
    }
  });

  if (!response.ok) {
    const body = await safeReadText(response);
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}${body ? ` - ${body}` : ''}`);
  }

  return response.text();
}

export async function discoverUrls({ config = INDEXNOW_CONFIG, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required for sitemap discovery.');
  }

  const sitemapIndexXml = await fetchText(config.sitemapIndexUrl, fetchImpl);
  const childSitemapUrls = extractLocValues(sitemapIndexXml);

  if (childSitemapUrls.length === 0) {
    throw new Error(`No child sitemap URLs found in ${config.sitemapIndexUrl}.`);
  }

  const pageUrlCandidates = [];
  for (const childSitemapUrl of childSitemapUrls) {
    const childSitemapXml = await fetchText(childSitemapUrl, fetchImpl);
    pageUrlCandidates.push(...extractLocValues(childSitemapXml));
  }

  return {
    sitemapCount: childSitemapUrls.length,
    candidateCount: pageUrlCandidates.length,
    ...filterProductionUrls(pageUrlCandidates, config)
  };
}

export async function submitPayload(payload, { config = INDEXNOW_CONFIG, fetchImpl = globalThis.fetch } = {}) {
  const response = await fetchImpl(config.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(payload)
  });
  const body = await safeReadText(response);
  const classification = classifyIndexNowResponse(response.status, body);

  return {
    status: response.status,
    body,
    classification
  };
}

async function safeReadText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

export async function runIndexNowSubmission({
  config = INDEXNOW_CONFIG,
  fetchImpl = globalThis.fetch,
  dryRun = false,
  logger = console
} = {}) {
  logger.log(`IndexNow URL discovery from ${config.sitemapIndexUrl}`);
  const discovery = await discoverUrls({ config, fetchImpl });

  if (discovery.urls.length === 0) {
    throw new Error('No valid production URLs were available for IndexNow submission.');
  }

  const payloads = createPayloads(discovery.urls, config);
  logger.log(`Discovered ${discovery.candidateCount} URL entries from ${discovery.sitemapCount} sitemap(s).`);
  logger.log(`Prepared ${discovery.urls.length} production URL(s) in ${payloads.length} batch(es).`);
  logger.log(`Excluded ${discovery.excludedCount} non-production or invalid URL entr${discovery.excludedCount === 1 ? 'y' : 'ies'}.`);

  if (dryRun) {
    logger.log('Dry run enabled; skipping IndexNow API submission.');
    return {
      dryRun: true,
      discovery,
      payloads,
      submittedUrlCount: 0,
      acceptedUrlCount: 0
    };
  }

  let acceptedUrlCount = 0;
  for (const [index, payload] of payloads.entries()) {
    const result = await submitPayload(payload, { config, fetchImpl });
    const batchNumber = index + 1;
    const urlCount = payload.urlList.length;

    if (!result.classification.ok) {
      logger.error(`Batch ${batchNumber}/${payloads.length} failed with HTTP ${result.status}: ${result.classification.message}`);
      if (result.body) {
        logger.error(`Response body: ${result.body}`);
      }
      throw new Error(`IndexNow submission failed: ${result.classification.label}`);
    }

    acceptedUrlCount += urlCount;
    logger.log(`Batch ${batchNumber}/${payloads.length}: ${result.classification.message} URLs: ${urlCount}.`);
  }

  logger.log(`IndexNow submission complete. Accepted ${acceptedUrlCount}/${discovery.urls.length} URL(s).`);

  return {
    dryRun: false,
    discovery,
    payloads,
    submittedUrlCount: discovery.urls.length,
    acceptedUrlCount
  };
}

export function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run')
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { dryRun } = parseArgs(process.argv.slice(2));

  runIndexNowSubmission({ dryRun }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
