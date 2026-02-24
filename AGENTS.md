# HagiCode Mono - Documentation Site - Agent Configuration

## Root Configuration
Inherits all behavior from `/AGENTS.md` at monorepo root.

## Project Context

The `repos/docs` directory contains the standalone documentation site for the HagiCode ecosystem. This is an Astro 5 site built with Starlight, designed to provide user documentation, tutorials, and blog content for the entire HagiCode platform.

Key features:
- **Documentation site**: Technical documentation for the entire HagiCode ecosystem
- **Blog integration**: Date-stamped blog posts with MDX support
- **Multi-language**: Support for internationalization (currently zh-CN)
- **SEO optimized**: With sitemap generation and meta tags
- **Custom components**: Reusable UI components for documentation content

## Tech Stack

### Core Framework
- **Astro**: 5.x with Starlight theme
- **Starlight**: Official documentation theme for Astro
- **TypeScript**: 5.x for type safety
- **MDX**: Rich documentation with JSX components

### Styling
- **Tailwind CSS**: Utility-first CSS framework
- **Starlight UI**: Pre-built documentation components

### Development Tools
- **Vite**: Fast development server with HMR
- **esbuild**: Fast bundling for development

### Deployment
- **Static site**: Pre-built HTML/CSS/JS output
- **CDN-ready**: Optimized for edge delivery

## Project Structure

```
repos/docs/
├── astro.config.mjs           # Astro configuration
├── package.json              # Project dependencies
├── src/
│   ├── assets/               # Static assets
│   ├── components/           # Custom Astro components
│   ├── content/
│   │   ├── docs/             # Documentation pages
│   │   │   ├── blog/         # Blog posts with date prefixes
│   │   │   └── ...           # Documentation topics
│   │   └── config.ts         # Content configuration
│   ├── layouts/              # Page layouts
│   └── pages/                # Additional pages
├── public/                   # Static assets
│   └── presets/               # AI service configuration presets
│       ├── index.json         # Preset index
│       └── claude-code/      # Claude Code AI presets
│           └── providers/    # Provider preset files
├── illustration-management.md # Image management guidelines
└── ...
```

## Presets Configuration

The `public/presets/` directory contains AI service configuration presets, designed for quick setup of Anthropic-compatible API providers in various applications.

### Presets Structure

```
public/presets/
├── index.json              # Global preset index
└── claude-code/
    └── providers/          # Claude Code AI provider presets
        ├── anthropic.json  # Official Anthropic API
        ├── zai.json        # 智谱 AI (Recommended)
        ├── aliyun.json     # 阿里云 DashScope (Recommended)
        └── minimax.json    # MiniMax (Recommended)
```

### Accessing Presets

**Production URL**: `https://docs.hagicode.com/presets/`

#### Get Preset Index
```bash
curl https://docs.hagicode.com/presets/index.json
```

#### Load Specific Provider Preset
```bash
curl https://docs.hagicode.com/presets/claude-code/providers/zai.json
```

### Available Providers

| Provider | Description | Recommended | Region |
|----------|-------------|-------------|--------|
| **智谱 AI** | 智谱 AI 提供的 Claude API 兼容服务 | ✅ | CN |
| **阿里云 DashScope** | 阿里云灵积平台提供的 Claude API 兼容服务 | ✅ | CN |
| **MiniMax** | MiniMax 提供的 Claude API 兼容服务 | ✅ | CN |
| **Anthropic Official** | 官方 Anthropic API | - | Global |

### Adding New Providers

1. Create provider preset file in `public/presets/claude-code/providers/`
2. Update `presets/index.json` with the new provider entry
3. Validate JSON format

For detailed documentation, see [presets/README.md](public/presets/README.md)

## Agent Behavior

When working in the docs submodule:

1. **Documentation-first**: Prioritize clear, comprehensive documentation
2. **Use MDX**: Leverage MDX for rich documentation content
3. **Astro patterns**: Follow Astro and Starlight best practices
4. **SEO awareness**: Consider SEO and accessibility
5. **Blog workflow**: Use date-prefixed filenames for blog posts
6. **Link validation**: Ensure all internal links are valid

### Development Workflow
```bash
cd repos/docs

# Development server
npm run dev                    # Starts dev server on http://localhost:31265

# Build production site
npm run build                  # Creates static site in ./dist/

# Preview production build
npm run preview                # Serves built site locally
```

### Documentation Structure
- **Organization**: Organize content hierarchically in `src/content/docs/`
- **Blog posts**: Place in `src/content/docs/blog/` with YYYY-MM-DD prefixes
- **Navigation**: Configure in `src/content/config.ts`
- **Illustrations**: Follow guidelines in `illustration-management.md`

## Specific Conventions

### Content Creation
- Use semantic headings (H1 for page titles, H2-H6 for sections)
- Include code blocks with appropriate language annotations
- Use admonitions for notes, warnings, tips
- Add frontmatter to all pages with appropriate metadata

### Blog Posts
- Filename format: `YYYY-MM-DD-title.md` or `YYYY-MM-DD-title.mdx`
- Include author, tags, and excerpt in frontmatter
- Follow consistent post structure

### Internal Linking
- Use relative paths for internal links
- Validate links during development
- Use proper anchor tags for long documents

### Accessibility
- Alt text for all images
- Semantic HTML structure
- Proper heading hierarchy

## Disabled Capabilities

AI assistants should NOT suggest:
- **Backend frameworks**: No Express, Next.js, or other server frameworks (Astro only)
- **Non-static patterns**: No dynamic server-side rendering (this is a static site)
- **Alternative build tools**: No webpack, parcel, rollup configurations (Astro handles this)
- **Client-heavy JS**: Minimize client-side JavaScript (Astro prefers server-first)
- **Alternative documentation tools**: No Docusaurus, GitBook, or MkDocs (Astro Starlight only)

## References

- **Root AGENTS.md**: `/AGENTS.md` at monorepo root
- **Monorepo CLAUDE.md**: See root directory for monorepo-wide conventions
- **OpenSpec Workflow**: Proposal-driven development happens at monorepo root level (`/openspec/`)
- **Starlight docs**: Official Astro Starlight documentation
- **Astro docs**: Official Astro framework documentation