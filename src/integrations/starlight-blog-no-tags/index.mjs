import {
  validateConfig,
} from '../../../node_modules/starlight-blog/libs/config.ts';
import {
  isNavigationWithCustomCss,
  isNavigationOverride,
} from '../../../node_modules/starlight-blog/libs/navigation.ts';
import {
  stripLeadingSlash,
  stripTrailingSlash,
} from '../../../node_modules/starlight-blog/libs/path.ts';
import { remarkStarlightBlog } from '../../../node_modules/starlight-blog/libs/remark.ts';
import { vitePluginStarlightBlogConfig } from '../../../node_modules/starlight-blog/libs/vite.ts';
import { Translations } from '../../../node_modules/starlight-blog/translations.ts';

const LOCAL_MIDDLEWARE = './src/integrations/starlight-blog-no-tags/middleware.mjs';
const LOCAL_ROUTES_BASE = './src/integrations/starlight-blog-no-tags/routes';

export default function starlightBlogPlugin(userConfig) {
  const config = validateConfig(userConfig);

  return {
    name: 'starlight-blog-no-tags',
    hooks: {
      'i18n:setup'({ injectTranslations }) {
        injectTranslations(Translations);
      },
      'config:setup'({
        addIntegration,
        addRouteMiddleware,
        astroConfig,
        config: starlightConfig,
        logger,
        updateConfig: updateStarlightConfig,
      }) {
        addRouteMiddleware({ entrypoint: LOCAL_MIDDLEWARE });

        const rssLink =
          astroConfig.site && config.rss
            ? `${stripTrailingSlash(astroConfig.site)}${stripTrailingSlash(astroConfig.base)}/${stripLeadingSlash(
                stripTrailingSlash(config.prefix),
              )}/rss.xml`
            : undefined;

        const configIncludesRSSSocial = starlightConfig.social?.some((social) => social.icon === 'rss') ?? false;

        const components = { ...starlightConfig.components };
        overrideComponent(components, logger, 'MarkdownContent');
        if (config.navigation === 'header-start') overrideComponent(components, logger, 'SiteTitle');
        if (config.navigation === 'header-end') overrideComponent(components, logger, 'ThemeSelect');

        const customCss = [...(starlightConfig.customCss ?? [])];
        if (isNavigationWithCustomCss(config)) customCss.push('starlight-blog/styles');

        const head = [...(starlightConfig.head ?? [])];
        if (rssLink) {
          head.push({
            tag: 'link',
            attrs: {
              href: rssLink,
              rel: 'alternate',
              title: typeof config.title === 'string' ? config.title : 'Blog',
              type: 'application/rss+xml',
            },
          });
        }

        const social = [...(starlightConfig.social ?? [])];
        if (rssLink && !configIncludesRSSSocial) {
          social.push({
            href: rssLink,
            icon: 'rss',
            label: 'RSS',
          });
        }

        updateStarlightConfig({ components, customCss, head, social });

        addIntegration({
          name: 'starlight-blog-no-tags-integration',
          hooks: {
            'astro:config:setup': ({ injectRoute, updateConfig }) => {
              injectRoute({
                entrypoint: `${LOCAL_ROUTES_BASE}/Authors.astro`,
                pattern: '/[...prefix]/authors/[author]',
                prerender: true,
              });

              injectRoute({
                entrypoint: `${LOCAL_ROUTES_BASE}/Tags.astro`,
                pattern: '/[...prefix]/tags',
                prerender: true,
              });

              injectRoute({
                entrypoint: `${LOCAL_ROUTES_BASE}/Blog.astro`,
                pattern: '/[...prefix]/[...page]',
                prerender: true,
              });

              if (rssLink) {
                injectRoute({
                  entrypoint: 'starlight-blog/routes/rss',
                  pattern: '/[...prefix]/rss.xml',
                  prerender: true,
                });
              }

              updateConfig({
                markdown: {
                  remarkPlugins: [[remarkStarlightBlog]],
                },
                vite: {
                  plugins: [
                    vitePluginStarlightBlogConfig(config, {
                      description: starlightConfig.description,
                      rootDir: astroConfig.root.pathname,
                      site: astroConfig.site,
                      srcDir: astroConfig.srcDir.pathname,
                      title: starlightConfig.title,
                      titleDelimiter: starlightConfig.titleDelimiter,
                      trailingSlash: astroConfig.trailingSlash,
                    }),
                  ],
                },
              });
            },
          },
        });
      },
    },
  };
}

function overrideComponent(components, logger, component) {
  if (components[component]) {
    logger.warn(`It looks like you already have a \`${component}\` component override in your Starlight configuration.`);
    logger.warn(
      `To use \`starlight-blog\`, either${isNavigationOverride(component) ? ' update the \`navigation\` plugin option,' : ''} remove your override or update it to render the content from \`starlight-blog/components/${component}.astro\`.`,
    );
    return;
  }

  components[component] = `starlight-blog/overrides/${component}.astro`;
}
