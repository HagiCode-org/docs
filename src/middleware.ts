/**
 * Astro middleware for docs entry routing.
 * - Handles shared traffic-entry redirects on `/go`
 * - Preserves existing cross-site `?lang` entry behavior
 */

import { defineMiddleware } from 'astro:middleware';
import {
  buildDocsCounterpartPath,
  mapLanguageParamToDocsLocale,
  normalizeDocsRoutePath,
} from './lib/i18n';
import {
  TRAFFIC_ENTRY_ROUTE_PATH,
  resolveTrafficEntryRequest,
} from './lib/traffic-entry.mjs';

function redirect(location: string, status: 301 | 302): Response {
  return new Response(null, {
    status,
    headers: {
      Location: location,
    },
  });
}

export const onRequest = defineMiddleware((context, next) => {
  const { url } = context;

  if (url.pathname === TRAFFIC_ENTRY_ROUTE_PATH) {
    const resolution = resolveTrafficEntryRequest(url);
    return redirect(resolution.redirectUrl, 302);
  }

  const canonicalPath = normalizeDocsRoutePath(url.pathname);
  if (canonicalPath !== url.pathname) {
    const targetUrl = new URL(url);
    targetUrl.pathname = canonicalPath;
    return redirect(targetUrl.toString(), 301);
  }

  const lang = url.searchParams.get('lang');
  if (!lang) {
    return next();
  }

  const mappedLang = mapLanguageParamToDocsLocale(lang);
  if (!mappedLang) {
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete('lang');
    return redirect(cleanUrl.toString(), 301);
  }

  const targetPath = buildDocsCounterpartPath(mappedLang, url.pathname);
  const targetUrl = new URL(url.origin + targetPath);
  url.searchParams.forEach((value, key) => {
    if (key !== 'lang') {
      targetUrl.searchParams.set(key, value);
    }
  });
  if (url.hash) {
    targetUrl.hash = url.hash;
  }

  return redirect(targetUrl.toString(), 302);
});
