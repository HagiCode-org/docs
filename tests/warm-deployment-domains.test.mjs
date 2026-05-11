import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DOCS_WARMUP_CONFIG,
  WarmupRunError,
  renderWarmupSummary,
  runWarmup,
} from '../scripts/warm-deployment-domains.mjs';

function createLogger() {
  return {
    log() {},
    warn() {},
    error() {},
  };
}

function createFetch(routes, calls = []) {
  return async (url, options = {}) => {
    const normalizedUrl = String(url);
    calls.push({ url: normalizedUrl, options });
    const handler = routes[normalizedUrl];

    if (!handler) {
      throw new Error(`Unexpected warmup URL: ${normalizedUrl}`);
    }

    return typeof handler === 'function' ? handler(url, options) : handler;
  };
}

test('docs warmup retries transient failures and summarizes success for both domains', async () => {
  const calls = [];
  const waits = [];
  const fetchImpl = createFetch(
    {
      'https://docs.472158246.workers.dev/': async () => new Response('warming', { status: 503 }),
      'https://docs.hagicode.com/': async () => new Response(null, { status: 302 }),
    },
    calls,
  );
  let docsAttemptCount = 0;
  const retryingFetch = async (url, options) => {
    if (String(url) === 'https://docs.472158246.workers.dev/') {
      docsAttemptCount += 1;
      if (docsAttemptCount === 1) {
        calls.push({ url: String(url), options });
        return new Response('warming', { status: 503 });
      }

      calls.push({ url: String(url), options });
      return new Response('ready', { status: 200 });
    }

    calls.push({ url: String(url), options });
    return new Response(null, { status: 302 });
  };

  const result = await runWarmup({
    fetchImpl: retryingFetch,
    wait: async (milliseconds) => {
      waits.push(milliseconds);
    },
    logger: createLogger(),
  });

  assert.equal(result.successCount, 2);
  assert.equal(result.failureCount, 0);
  assert.equal(result.domainResults[0].domain, 'docs.472158246.workers.dev');
  assert.equal(result.domainResults[0].retriesUsed, 1);
  assert.equal(result.domainResults[1].domain, 'docs.hagicode.com');
  assert.equal(result.domainResults[1].finalDetail, 'HTTP 302');
  assert.deepEqual(waits, [DOCS_WARMUP_CONFIG.retryDelayMs]);
  assert.deepEqual(calls.map((call) => call.url), [
    'https://docs.472158246.workers.dev/',
    'https://docs.472158246.workers.dev/',
    'https://docs.hagicode.com/',
  ]);

  const summary = renderWarmupSummary(result);
  assert.match(summary, /`docs\.472158246\.workers\.dev`/u);
  assert.match(summary, /`docs\.hagicode\.com`/u);
  assert.match(summary, /warmed after retry/u);
});

test('docs warmup reports exhausted retries and keeps later-domain diagnostics', async () => {
  const waits = [];
  let error;

  try {
    await runWarmup({
      fetchImpl: createFetch({
        'https://docs.472158246.workers.dev/': async () => new Response('gateway issue', { status: 502 }),
        'https://docs.hagicode.com/': async () => new Response('ok', { status: 200 }),
      }),
      wait: async (milliseconds) => {
        waits.push(milliseconds);
      },
      logger: createLogger(),
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert.ok(error instanceof WarmupRunError);
  assert.equal(error.result.failureCount, 1);
  assert.equal(error.result.successCount, 1);
  assert.match(error.result.domainResults[0].finalDetail, /HTTP 502 - gateway issue/u);
  assert.match(error.result.domainResults[0].finalDetail, /retries exhausted/u);
  assert.equal(error.result.domainResults[1].domain, 'docs.hagicode.com');
  assert.equal(error.result.domainResults[1].finalDetail, 'HTTP 200');
  assert.deepEqual(waits, Array(DOCS_WARMUP_CONFIG.maxAttempts - 1).fill(DOCS_WARMUP_CONFIG.retryDelayMs));

  const summary = renderWarmupSummary(error.result);
  assert.match(summary, /failed/u);
  assert.match(summary, /does not roll back the published `gh-pages` snapshot/u);
});
