import assert from 'node:assert/strict';

import {
  TRAFFIC_ENTRY_FALLBACK_URL,
  normalizeTrafficEntryTargetPath,
  resolveTrafficEntryRequest,
} from '../src/lib/traffic-entry.mjs';

function assertReachableDocsDestination(destination) {
  const url = new URL(destination);

  assert.equal(url.origin, 'https://docs.hagicode.com');
  assert.equal(url.pathname === '/' || url.pathname.startsWith('/blog/'), true);
}

function runChecks() {
  assert.equal(
    normalizeTrafficEntryTargetPath('/blog/2026-03-16-agent-routing-guide'),
    '/blog/2026-03-16-agent-routing-guide/'
  );

  const valid = resolveTrafficEntryRequest(
    new URL(
      'https://docs.hagicode.com/go?platform=zhihu&target=%2Fblog%2F2026-03-16-agent-routing-guide%2F&utm_source=zhihu'
    )
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.targetPath, '/blog/2026-03-16-agent-routing-guide/');
  assert.equal(
    valid.redirectUrl,
    'https://docs.hagicode.com/blog/2026-03-16-agent-routing-guide/?utm_source=zhihu'
  );
  assertReachableDocsDestination(valid.redirectUrl);

  const missingParams = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?utm_source=homepage')
  );
  assert.equal(missingParams.valid, false);
  assert.equal(missingParams.code, 'missing_params');
  assert.equal(
    missingParams.redirectUrl,
    `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=homepage`
  );
  assertReachableDocsDestination(missingParams.redirectUrl);

  const missingTarget = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=wechat&target=&utm_source=wechat')
  );
  assert.equal(missingTarget.valid, false);
  assert.equal(missingTarget.code, 'missing_target');
  assert.equal(
    missingTarget.redirectUrl,
    `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=wechat`
  );

  const invalidPlatform = resolveTrafficEntryRequest(
    new URL(
      'https://docs.hagicode.com/go?platform=unknown&target=%2Fblog%2F2026-03-16-agent-routing-guide%2F&utm_source=unknown'
    )
  );
  assert.equal(invalidPlatform.valid, false);
  assert.equal(invalidPlatform.code, 'invalid_platform');
  assert.equal(
    invalidPlatform.redirectUrl,
    `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=unknown`
  );

  const invalidTarget = resolveTrafficEntryRequest(
    new URL(
      'https://docs.hagicode.com/go?platform=zhihu&target=https%3A%2F%2Fevil.example.com&utm_source=zhihu&from=feed'
    )
  );
  assert.equal(invalidTarget.valid, false);
  assert.equal(invalidTarget.code, 'invalid_target');
  assert.equal(
    invalidTarget.redirectUrl,
    `${TRAFFIC_ENTRY_FALLBACK_URL}?utm_source=zhihu&from=feed`
  );
  assertReachableDocsDestination(invalidTarget.redirectUrl);
}

try {
  runChecks();
  console.log('[verify-traffic-entry-contract] ok');
} catch (error) {
  console.error('[verify-traffic-entry-contract] failed');
  throw error;
}
