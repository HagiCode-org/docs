import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeTrafficEntryTargetPath,
  resolveTrafficEntryRequest,
} from '../src/lib/traffic-entry.mjs';

test('normalizes blog targets with a trailing slash', () => {
  assert.equal(
    normalizeTrafficEntryTargetPath('/blog/2026-03-16-agent-routing-guide'),
    '/blog/2026-03-16-agent-routing-guide/'
  );
});

test('rejects unsupported traffic-entry platforms', () => {
  const result = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=unknown&target=%2Fblog%2F2026-03-16-agent-routing-guide%2F')
  );

  assert.equal(result.valid, false);
  assert.equal(result.code, 'invalid_platform');
});

test('redirects valid traffic-entry requests to canonical docs targets and preserves extra query params', () => {
  const result = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=wechat&target=%2Fblog%2F2026-03-16-agent-routing-guide%2F&utm_source=wechat&from=timeline')
  );

  assert.equal(result.valid, true);
  assert.equal(result.platformId, 'wechat');
  assert.equal(result.targetPath, '/blog/2026-03-16-agent-routing-guide/');
  assert.equal(
    result.redirectUrl,
    'https://docs.hagicode.com/blog/2026-03-16-agent-routing-guide/?utm_source=wechat&from=timeline'
  );
});

test('rejects non-blog targets and absolute URLs', () => {
  const nonBlog = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=zhihu&target=%2Fguides%2Fintro%2F')
  );
  assert.equal(nonBlog.valid, false);
  assert.equal(nonBlog.code, 'invalid_target');

  const absolute = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=zhihu&target=https%3A%2F%2Fevil.example.com')
  );
  assert.equal(absolute.valid, false);
  assert.equal(absolute.code, 'invalid_target');
});
