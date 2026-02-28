/**
 * Astro middleware for handling cross-site language parameter passing
 * Intercepts requests with ?lang parameter and redirects to the correct language path
 */

import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware((context, next) => {
  const { url } = context;

  // Parse the lang parameter from the URL
  const lang = url.searchParams.get('lang');

  console.log('Middleware - url:', url.pathname, 'lang param:', lang);

  // If no language parameter, proceed with normal routing
  if (!lang) {
    return next();
  }

  // Validate the language parameter - only support 'en' and 'zh-CN'
  if (lang !== 'en' && lang !== 'zh-CN') {
    // Invalid language parameter: remove it and redirect
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
  // 'zh-CN' -> 'root' (no prefix), 'en' -> 'en' (with /en/ prefix)
  const mappedLang = lang === 'en' ? 'en' : 'root';
  console.log('Middleware - mappedLang:', mappedLang, 'pathname:', url.pathname);

  // Build the target path with language prefix
  let targetPath: string;
  if (mappedLang === 'en') {
    // Add /en/ prefix to the path
    const cleanPath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
    targetPath = `/en${cleanPath}`;
  } else {
    // For root (Chinese), use the original path
    targetPath = url.pathname;
  }

  console.log('Middleware - targetPath:', targetPath);

  // Preserve other query parameters (excluding lang) and hash
  const targetUrl = new URL(url.origin + targetPath);
  url.searchParams.forEach((value, key) => {
    if (key !== 'lang') {
      targetUrl.searchParams.set(key, value);
    }
  });
  if (url.hash) {
    targetUrl.hash = url.hash;
  }

  console.log('Middleware - redirecting to:', targetUrl.toString());

  // Return HTTP 302 redirect to target URL
  return new Response(null, {
    status: 302,
    headers: {
      Location: targetUrl.toString(),
    },
  });
});