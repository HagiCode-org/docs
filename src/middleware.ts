/**
 * Astro middleware for handling cross-site language parameter passing
 * Intercepts requests with ?lang parameter and redirects to the correct language path
 */

import { defineMiddleware } from 'astro:middleware';
import {
  parseLangFromUrl,
  mapLangToSiteFormat,
  isValidLanguage,
  buildTargetPath,
} from './lib/i18n';

export const onRequest = defineMiddleware((context, next) => {
  const { request, url } = context;

  // Parse the lang parameter from the URL
  const lang = parseLangFromUrl(url);

  // If no language parameter, proceed with normal routing
  if (!lang) {
    return next();
  }

  // Validate the language parameter
  if (!isValidLanguage(lang)) {
    // Invalid language parameter: remove it and proceed
    const cleanUrl = new URL(url);
    cleanUrl.searchParams.delete('lang');
    return new Response(null, {
      status: 301,
      headers: {
        Location: cleanUrl.toString(),
      },
    });
  }

  // Map the language value to the site format
  const mappedLang = mapLangToSiteFormat(lang);

  // Build the target path with language prefix, preserving the original path
  const targetPath = buildTargetPath(mappedLang, url.pathname);

  // Preserve other query parameters (excluding lang)
  const targetUrl = new URL(url.origin + targetPath);
  url.searchParams.forEach((value, key) => {
    if (key !== 'lang') {
      targetUrl.searchParams.set(key, value);
    }
  });

  // Use 302 redirect for development to avoid caching issues
  // and include localStorage update via a script tag
  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <meta http-equiv="refresh" content="0; url=${targetUrl.toString()}">
  <script>
    (function() {
      try {
        // Set localStorage for Starlight language preference
        const route = localStorage.getItem('starlight-route');
        let routeObj = route ? JSON.parse(route) : {};
        routeObj.lang = '${mappedLang}';
        localStorage.setItem('starlight-route', JSON.stringify(routeObj));
      } catch (e) {
        // Silent fallback when localStorage is unavailable
      }
      // Redirect to target URL
      window.location.href = '${targetUrl.toString()}';
    })();
  </script>
</head>
<body>
  <p>Redirecting to <a href="${targetUrl.toString()}">${targetUrl.toString()}</a>...</p>
</body>
</html>`;

  return new Response(htmlContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
});