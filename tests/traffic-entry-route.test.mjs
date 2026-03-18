import assert from 'node:assert/strict';
import test from 'node:test';

import {
  TRAFFIC_ENTRY_FALLBACK_URL,
  normalizeTrafficEntryTargetPath,
  resolveTrafficEntryRequest,
} from '../src/lib/traffic-entry.mjs';

test('normalizes blog targets with a trailing slash', () => {
  assert.equal(
    normalizeTrafficEntryTargetPath('/blog/2026-03-16-agent-routing-guide'),
    '/blog/2026-03-16-agent-routing-guide/'
  );
});

test('falls back to docs root when no traffic-entry params are provided', () => {
  const result = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?utm_source=homepage')
  );

  assert.equal(result.valid, false);
  assert.equal(result.hasTrafficEntryParams, false);
  assert.equal(result.code, 'missing_params');
  assert.equal(result.redirectUrl, `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=homepage`);
  assert.deepEqual(result.preservedSearchParams, [['utm_source', 'homepage']]);
});

test('falls back to docs root for unsupported traffic-entry platforms', () => {
  const result = resolveTrafficEntryRequest(
    new URL(
      'https://docs.hagicode.com/go?platform=unknown&target=%2Fblog%2F2026-03-16-agent-routing-guide%2F&utm_source=unknown'
    )
  );

  assert.equal(result.valid, false);
  assert.equal(result.code, 'invalid_platform');
  assert.equal(result.redirectUrl, `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=unknown`);
});

test('redirects valid traffic-entry requests to canonical docs targets and preserves extra query params', () => {
  const result = resolveTrafficEntryRequest(
    new URL(
      'https://docs.hagicode.com/go?platform=wechat&target=%2Fblog%2F2026-03-16-agent-routing-guide%2F&utm_source=wechat&from=timeline'
    )
  );

  assert.equal(result.valid, true);
  assert.equal(result.platformId, 'wechat');
  assert.equal(result.targetPath, '/blog/2026-03-16-agent-routing-guide/');
  assert.equal(
    result.redirectUrl,
    'https://docs.hagicode.com/blog/2026-03-16-agent-routing-guide/?utm_source=wechat&from=timeline'
  );
});

test('falls back to docs root when target is missing and strips reserved fields', () => {
  const result = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=wechat&target=&utm_source=wechat&from=timeline')
  );

  assert.equal(result.valid, false);
  assert.equal(result.code, 'missing_target');
  assert.equal(
    result.redirectUrl,
    `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=wechat&from=timeline`
  );
  assert.deepEqual(result.preservedSearchParams, [
    ['utm_source', 'wechat'],
    ['from', 'timeline'],
  ]);
});

test('falls back to docs root for invalid targets while preserving non-reserved query params', () => {
  const nonBlog = resolveTrafficEntryRequest(
    new URL(
      'https://docs.hagicode.com/go?platform=zhihu&target=%2Fguides%2Fintro%2F&utm_source=zhihu'
    )
  );
  assert.equal(nonBlog.valid, false);
  assert.equal(nonBlog.code, 'invalid_target');
  assert.equal(nonBlog.redirectUrl, `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=zhihu`);

  const absolute = resolveTrafficEntryRequest(
    new URL(
      'https://docs.hagicode.com/go?platform=zhihu&target=https%3A%2F%2Fevil.example.com&utm_source=zhihu&from=feed'
    )
  );
  assert.equal(absolute.valid, false);
  assert.equal(absolute.code, 'invalid_target');
  assert.equal(
    absolute.redirectUrl,
    `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=zhihu&from=feed`
  );
  assert.deepEqual(absolute.preservedSearchParams, [
    ['utm_source', 'zhihu'],
    ['from', 'feed'],
  ]);
});
