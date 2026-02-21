# HagiCode Documentation

独立的 HagiCode 文档站点，使用 Astro 和 Starlight 构建。

## 仓库结构

```
docs/
├── src/
│   ├── content/docs/    # 文档内容（Markdown 和 MDX 文件）
│   │   └── blog/        # 博客文章
│   ├── components/      # 自定义 UI 组件
│   ├── config/          # 导航和配置
│   ├── integrations/    # Astro 集成
│   ├── pages/           # 页面
│   ├── styles/          # 样式文件
│   └── utils/           # 工具函数
├── public/              # 静态资源（图片、图标等）
├── .github/workflows/   # CI/CD 工作流
├── astro.config.mjs     # Astro 配置
├── package.json         # 依赖和脚本
├── tsconfig.json        # TypeScript 配置
└── illustration-management.md  # 配图管理指南
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

文档站点将在 http://localhost:31265 启动。

### 构建

```bash
npm run build
```

构建输出将生成在 `dist/` 目录。

### 预览构建结果

```bash
npm run preview
```

## 贡献指南

### 编辑文档

文档内容位于 `src/content/docs/` 目录。编辑 Markdown 文件后，更改将自动在开发服务器中反映。

### 添加博客文章

1. 在 `src/content/docs/blog/` 创建新文件
2. 使用日期前缀命名（例如：`2026-02-21-my-post.mdx`）
3. 添加 frontmatter 元数据

### 添加静态资源

将图片和其他静态文件放入 `public/` 目录。它们在构建时会被复制到 `dist/` 目录的根路径。

## CI/CD

文档通过 GitHub Actions 自动部署到 Azure Static Web Apps。

- 推送到 `main` 分支会触发部署
- Pull Requests 会触发构建验证

## 相关资源

- [Astro 文档](https://docs.astro.build)
- [Starlight 文档](https://starlight.astro.build)
- [配图管理指南](./illustration-management.md)
