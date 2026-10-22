import assert from 'node:assert/strict';
import test from 'node:test';

import { isReleaseNotesRoutePath } from '../src/lib/i18n.ts';
import { resolveDocsLandingRoute } from '../src/lib/langParamHandler.ts';

test('release-notes helper flags only landing routes without confusing other docs pages', () => {
  assert.equal(isReleaseNotesRoutePath('/release-notes/'), true);
  assert.equal(isReleaseNotesRoutePath('/en-US/release-notes/'), true);
  assert.equal(isReleaseNotesRoutePath('/release-notes/v1.0.0/'), false);
  assert.equal(isReleaseNotesRoutePath('/en-US/release-notes/v1.0.0/'), false);
  assert.equal(isReleaseNotesRoutePath('/product-overview/'), false);
});

test('release-notes landing follows saved preference and allows explicit ?lang switches', () => {
  const rooted = resolveDocsLandingRoute(
    new URL('https://docs.hagicode.com/release-notes/'),
    JSON.stringify({ lang: 'en-US' }),
    ['en-US', 'en'],
  );
  assert.equal(rooted.resolvedLocale, 'en-US');
  assert.equal(rooted.targetUrl, 'https://docs.hagicode.com/en-US/release-notes/');
  assert.equal(rooted.shouldRedirect, true);

  const anchoredLanding = resolveDocsLandingRoute(
    new URL('https://docs.hagicode.com/release-notes/#v1.0.0'),
    JSON.stringify({ lang: 'root' }),
    ['zh-CN', 'zh'],
  );
  assert.equal(anchoredLanding.resolvedLocale, 'root');
  assert.equal(anchoredLanding.targetUrl, 'https://docs.hagicode.com/release-notes/#v1.0.0');
  assert.equal(anchoredLanding.shouldRedirect, false);

  const switchLandingToEnglish = resolveDocsLandingRoute(
    new URL('https://docs.hagicode.com/release-notes/?lang=en-US#v1.0.0'),
    JSON.stringify({ lang: 'root' }),
    ['zh-CN', 'zh'],
  );
  assert.equal(switchLandingToEnglish.resolvedLocale, 'en-US');
  assert.equal(switchLandingToEnglish.targetUrl, 'https://docs.hagicode.com/en-US/release-notes/#v1.0.0');
  assert.equal(switchLandingToEnglish.shouldRedirect, true);

  const switchToChinese = resolveDocsLandingRoute(
    new URL('https://docs.hagicode.com/en-US/release-notes/?lang=zh-CN#v1.0.0'),
    JSON.stringify({ lang: 'en-US' }),
    ['en-US', 'en'],
  );
  assert.equal(switchToChinese.resolvedLocale, 'root');
  assert.equal(switchToChinese.targetUrl, 'https://docs.hagicode.com/release-notes/#v1.0.0');
  assert.equal(switchToChinese.shouldRedirect, true);
});
