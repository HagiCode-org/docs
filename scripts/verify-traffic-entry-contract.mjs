import assert from 'node:assert/strict';

import {
  normalizeTrafficEntryTargetPath,
  resolveTrafficEntryRequest,
} from '../src/lib/traffic-entry.mjs';

function runChecks() {
  assert.equal(
    normalizeTrafficEntryTargetPath('/blog/2026-03-16-agent-routing-guide'),
    '/blog/2026-03-16-agent-routing-guide/'
  );

  const valid = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=zhihu&target=%2Fblog%2F2026-03-16-agent-routing-guide%2F&utm_source=zhihu')
  );
  assert.equal(valid.valid, true);
  assert.equal(valid.targetPath, '/blog/2026-03-16-agent-routing-guide/');
  assert.equal(
    valid.redirectUrl,
    'https://docs.hagicode.com/blog/2026-03-16-agent-routing-guide/?utm_source=zhihu'
  );

  const invalidPlatform = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=unknown&target=%2Fblog%2F2026-03-16-agent-routing-guide%2F')
  );
  assert.equal(invalidPlatform.valid, false);
  assert.equal(invalidPlatform.code, 'invalid_platform');

  const invalidTarget = resolveTrafficEntryRequest(
    new URL('https://docs.hagicode.com/go?platform=zhihu&target=https%3A%2F%2Fevil.example.com')
  );
  assert.equal(invalidTarget.valid, false);
  assert.equal(invalidTarget.code, 'invalid_target');
}

try {
  runChecks();
  console.log('[verify-traffic-entry-contract] ok');
} catch (error) {
  console.error('[verify-traffic-entry-contract] failed');
  throw error;
}
