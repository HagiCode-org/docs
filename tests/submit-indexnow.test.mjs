import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INDEXNOW_CONFIG,
  classifyIndexNowResponse,
  createPayloads,
  discoverUrls,
  extractLocValues,
  filterProductionUrls,
  runIndexNowSubmission
} from '../scripts/submit-indexnow.mjs';

const testConfig = {
  ...INDEXNOW_CONFIG,
  sitemapIndexUrl: 'https://docs.hagicode.com/sitemap-index.xml',
  endpoint: 'https://api.indexnow.org/indexnow',
  batchSize: 2
};

function createXmlResponse(xml) {
  return new Response(xml, {
    status: 200,
    headers: { 'content-type': 'application/xml' }
  });
}

function createFetch(routes, calls = []) {
  return async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const route = routes[String(url)];

    if (!route) {
      return new Response('Not found', { status: 404 });
    }

    return typeof route === 'function' ? route(url, options) : route;
  };
}

test('extractLocValues parses sitemap loc entries and decodes XML entities', () => {
  const xml = `
    <urlset>
      <url><loc>https://docs.hagicode.com/a&amp;b</loc></url>
      <url><loc> https://docs.hagicode.com/space </loc></url>
    </urlset>
  `;

  assert.deepEqual(extractLocValues(xml), [
    'https://docs.hagicode.com/a&b',
    'https://docs.hagicode.com/space'
  ]);
});

test('discoverUrls fetches sitemap index and child sitemaps', async () => {
  const calls = [];
  const fetchImpl = createFetch(
    {
      'https://docs.hagicode.com/sitemap-index.xml': createXmlResponse(`
        <sitemapindex>
          <sitemap><loc>https://docs.hagicode.com/sitemap-0.xml</loc></sitemap>
          <sitemap><loc>https://docs.hagicode.com/sitemap-1.xml</loc></sitemap>
        </sitemapindex>
      `),
      'https://docs.hagicode.com/sitemap-0.xml': createXmlResponse(`
        <urlset>
          <url><loc>https://docs.hagicode.com/</loc></url>
        </urlset>
      `),
      'https://docs.hagicode.com/sitemap-1.xml': createXmlResponse(`
        <urlset>
          <url><loc>https://docs.hagicode.com/guide/</loc></url>
        </urlset>
      `)
    },
    calls
  );

  const result = await discoverUrls({ config: testConfig, fetchImpl });

  assert.deepEqual(calls.map((call) => call.url), [
    'https://docs.hagicode.com/sitemap-index.xml',
    'https://docs.hagicode.com/sitemap-0.xml',
    'https://docs.hagicode.com/sitemap-1.xml'
  ]);
  assert.equal(result.sitemapCount, 2);
  assert.equal(result.candidateCount, 2);
  assert.deepEqual(result.urls, ['https://docs.hagicode.com/', 'https://docs.hagicode.com/guide/']);
});

test('filterProductionUrls normalizes URLs, removes duplicates, and excludes non-docs hosts', () => {
  const result = filterProductionUrls(
    [
      'https://docs.hagicode.com/guide/#intro',
      'https://docs.hagicode.com/guide/',
      'http://docs.hagicode.com/insecure/',
      'https://example.com/foreign/',
      'not a url',
      'https://docs.hagicode.com/reference/'
    ],
    testConfig
  );

  assert.deepEqual(result.urls, [
    'https://docs.hagicode.com/guide/',
    'https://docs.hagicode.com/reference/'
  ]);
  assert.equal(result.excludedCount, 3);
});

test('createPayloads batches IndexNow payloads with required fields', () => {
  const payloads = createPayloads(
    [
      'https://docs.hagicode.com/a/',
      'https://docs.hagicode.com/b/',
      'https://docs.hagicode.com/c/'
    ],
    testConfig
  );

  assert.equal(payloads.length, 2);
  assert.deepEqual(payloads[0], {
    host: 'docs.hagicode.com',
    key: 'cb0f18b465754a0da8d353672ff9982c',
    keyLocation: 'https://docs.hagicode.com/cb0f18b465754a0da8d353672ff9982c.txt',
    urlList: ['https://docs.hagicode.com/a/', 'https://docs.hagicode.com/b/']
  });
  assert.deepEqual(payloads[1].urlList, ['https://docs.hagicode.com/c/']);
});

test('classifyIndexNowResponse maps known IndexNow statuses', () => {
  assert.deepEqual(classifyIndexNowResponse(200), {
    ok: true,
    label: 'accepted',
    message: 'IndexNow accepted the batch.'
  });
  assert.deepEqual(classifyIndexNowResponse(202), {
    ok: true,
    label: 'accepted_for_processing',
    message: 'IndexNow accepted the batch for processing.'
  });
  assert.equal(classifyIndexNowResponse(400).label, 'malformed_payload');
  assert.equal(classifyIndexNowResponse(403).label, 'key_verification_failed');
  assert.equal(classifyIndexNowResponse(422).label, 'invalid_url');
  assert.equal(classifyIndexNowResponse(429).label, 'rate_limited');
  assert.equal(classifyIndexNowResponse(500, 'oops').label, 'unexpected_status');
});

test('runIndexNowSubmission dry-run discovers and batches URLs without posting', async () => {
  const calls = [];
  const fetchImpl = createFetch(
    {
      'https://docs.hagicode.com/sitemap-index.xml': createXmlResponse(`
        <sitemapindex><sitemap><loc>https://docs.hagicode.com/sitemap-0.xml</loc></sitemap></sitemapindex>
      `),
      'https://docs.hagicode.com/sitemap-0.xml': createXmlResponse(`
        <urlset>
          <url><loc>https://docs.hagicode.com/a/</loc></url>
          <url><loc>https://docs.hagicode.com/b/</loc></url>
          <url><loc>https://docs.hagicode.com/c/</loc></url>
        </urlset>
      `)
    },
    calls
  );

  const result = await runIndexNowSubmission({
    config: testConfig,
    fetchImpl,
    dryRun: true,
    logger: { log() {}, error() {} }
  });

  assert.equal(result.dryRun, true);
  assert.equal(result.discovery.urls.length, 3);
  assert.equal(result.payloads.length, 2);
  assert.equal(result.acceptedUrlCount, 0);
  assert.deepEqual(calls.map((call) => call.url), [
    'https://docs.hagicode.com/sitemap-index.xml',
    'https://docs.hagicode.com/sitemap-0.xml'
  ]);
});

test('runIndexNowSubmission posts batches and fails classified non-success responses', async () => {
  const calls = [];
  const fetchImpl = createFetch(
    {
      'https://docs.hagicode.com/sitemap-index.xml': createXmlResponse(`
        <sitemapindex><sitemap><loc>https://docs.hagicode.com/sitemap-0.xml</loc></sitemap></sitemapindex>
      `),
      'https://docs.hagicode.com/sitemap-0.xml': createXmlResponse(`
        <urlset><url><loc>https://docs.hagicode.com/a/</loc></url></urlset>
      `),
      'https://api.indexnow.org/indexnow': new Response('bad key', { status: 403 })
    },
    calls
  );

  await assert.rejects(
    runIndexNowSubmission({
      config: testConfig,
      fetchImpl,
      logger: { log() {}, error() {} }
    }),
    /key_verification_failed/
  );

  const postCall = calls.find((call) => call.url === 'https://api.indexnow.org/indexnow');
  assert.equal(postCall.options.method, 'POST');
  assert.equal(JSON.parse(postCall.options.body).host, 'docs.hagicode.com');
});
