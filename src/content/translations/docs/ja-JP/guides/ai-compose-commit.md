---
title: Super Commit ガイド
description: AI を使用して Git コミット メッセージをインテリジェントに生成し、コミットの品質と一貫性を向上させます。
---

## 概要

Super Commit は、現在のコード変更を読み取り、従来のコミット形式でコミット メッセージを生成します。ポイントは簡単です。履歴をより明確に保ちながら、コミットの書き込みに費やす時間を短縮します。

### Super Commit とは何ですか?

Super Commit は変更を分析し、標準化されたコミット メッセージを書き込みます。手動によるコミットの書き込みと引き換えに、より一貫性のある履歴が得られます。

次の場合に使用します。
- 複数のコミットを必要とする大規模なコード変更
- 調整された変更を伴うマルチリポジトリ プロジェクト
- 標準化されたコミット形式を必要とするチーム
- コミットの品質を向上させたい開発者

### 主な利点

| 特徴 | 従来の手動コミット | Super Commit |
|----------|----------------------|------------------|
| **品質へのこだわり** | 個人の経験による | ベストプラクティスに基づく、一貫した品質 |
| **コミット速度** | 思考と組織化が必要 | ワンクリックで瞬時に生成 |
| **一貫性** | コミットごとに異なる場合があります | 自動的に標準に従う |
| **マルチリポジトリのサポート** | 手動調整が必要 | リポジトリの自動認識とグループ化 |
| **時間の節約** | かなりの時間がかかる場合があります | コミットごとに 10 ～ 60 秒以上を節約 |

## クイックスタート

### 機能を有効にする

HagiCode デスクトップ アプリケーションで、Super Commit を使用するプロジェクトに移動し、この機能を有効にします。

**重要**: 最初にプロジェクトがHagiCodeに追加されていることを確認してください。

### トリガー機能

Git 操作セクションで [Super Commit] ボタンを見つけます。

![Super Commit ボタン](../../img/screenshots/product/git-super-commit/original.png)

このボタンは通常、Git 操作セクションの他のバージョン管理アクションの近くの目立つ場所にあります。

**重要な注意**: このボタンをクリックすると、コミット メッセージの自動生成がトリガーされます。コミットをロールバックまたは変更する必要がある場合は、標準の Git コマンドを使用します。

### 実行前の確認

ボタンを押してもすぐには実行されません。まず Super Commit の確認ドロワーが開き、変更のあるリポジトリ数が表示され、この実行のオプションを確認できます。

![Super Commit の確認ドロワー](../../img/screenshots/guides/super-commit-confirmation/original.png)

ドロワーには次のオプションがあります。
- **Git 作成者プロファイル**: 保存済みの Git ID を選びます。まだない場合は、先に Git 設定で作成します
- **ターゲットブランチの方針**: 現在のブランチを使い続けるか、現在のブランチから新しいブランチを作成します（任意の名前または AI が生成した名前）
- **コミット後にリモートへ Push**: 任意です。Push の前に pull --rebase を実行できます
- **Co-Authored-By**: この実行の署名方法を選びます
- **Agent**: このコミットを実行する Agent を選びます
- **確認して処理を開始 / キャンセル**: 確認するとジョブはバックグラウンドで続行され、ドロワーを閉じて作業を続けられます

初回は、リポジトリの範囲とブランチの方針を確認してから開始することをお勧めします。

### 結果を見る

AI が処理を完了すると、成功の通知が表示されます。

コミットメッセージが生成され、準備が整いました。必要に応じて、最終決定する前にそれらを確認できます。

## 機能の詳細

### AI分析ロジック

Super Commit は、次のプロセスを通じてコードの変更を分析します。

#### 1. ワークスペースの変更を読み取る

システムは、現在のワークスペースで変更されたファイル、新しく追加されたファイル、および削除されたファイルをすべて収集します。

#### 2. ファイルの内容を分析する

AI は変更されたファイルの内容を深く分析して、以下を理解します。
- 実装された機能変更
- バグ修正が適用されました
- 使用されるリファクタリングパターン
- 依存関係の追加または削除

#### 3. 変更の関連付けを特定する

AI は、どの変更をグループ化する必要があるかをインテリジェントに識別します。
- 同じ機能のフロントエンドとバックエンドの変更
- 関連する構成ファイルの変更
- 実装の変更に伴うテストの更新

#### 4. コミット構造の生成

AI は、従来のコミット仕様に従って構造化されたコミット情報を生成します。

```
&lt;type&gt;(&lt;scope&gt;): &lt;subject&gt;
  &lt;body&gt;
    &lt;footer&gt;
```

#### 5. Write Commit Message

Each change is transformed into a clear, descriptive commit message.

### Commit Format Specification

AI-generated commit messages follow the Conventional Commits format:

```
&lt;タイプ&gt;(&lt;スコープ&gt;): &lt;件名&gt;
  &lt;本文&gt;
    &lt;フッター&gt;
```

**type**: Commit type (required)
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no code change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes
- `perf`: Performance improvements

**scope**: Scope of the change (optional)
- Indicates which part of the project is affected
- Format: `module/name` or `category/name`

**subject**: Short description of the change (required)
- Imperative mood
- Max 50 characters
- Use present tense: "Add" not "Added"

**body**: Detailed description (optional)
- What was changed and why
- Can use multiple paragraphs
- Max 100 characters for first line, 72 for subsequent lines

**footer**: References to related issues (optional)
- `Closes #123`
- `BREAKING CHANGE: ...`
- `Co-Authored-By: &commat;anthropic.com>`

### Example Output

```
feat(auth): ユーザーログイン機能を追加
Google および GitHub プロバイダーによる OAuth2 認証を実装しました。

ログイン コンポーネントは以下をサポートするようになりました。
- Google OAuth の統合
- GitHub OAuth の統合
- JWTトークンによるセッション管理

共著: Claude Opus 4.6 &lt;noreply@anthropic.com&gt;
```

## Comparison with Traditional Manual Commits

### Manual Commits

Traditional Git commits rely on:
- Developer's experience and mood
- Individual writing habits
- Time constraints affecting quality
- Inconsistent formatting across team

### Super Commit

Super Commit provides:
- **Standardized format**: Always follows Conventional Commits specification
- **Intelligent analysis**: Understands code context and relationships
- **Quality consistency**: Maintains professional tone and accuracy
- **Time efficiency**: Reduces commit writing time from 5-30 minutes to seconds

### When to Use Each

**Use Super Commit When:**
- Large batch changes (multiple files, complex features)
- Coordinated changes across multiple repositories
- Need for high-quality, consistent commit messages
- Team projects with multiple contributors

**Use Manual Commits When:**
- Small, focused changes (single file, simple bug fix)
- Personal projects with full control over commit quality
- When you have time to craft thoughtful, personalized messages

## Multi-Repository Support

### monospecs Integration

When managing monospecs-based multi-repository projects, Super Commit provides enhanced capabilities:

#### Read monospecs.yaml

AI automatically reads the `monospecs.yaml` configuration to:
- Identify all configured sub-repositories
- Match file paths to corresponding repositories
- Access display names and icons for UI rendering

#### Match File Changes

AI intelligently matches each changed file to the correct sub-repository:
- Analyzes file path in project structure
- Matches against monospecs repository configurations
- Groups related changes together for logical commits

#### Separate Commits

Each sub-repository receives independent commits:
- Frontend changes committed to `repos/frontend`
- Backend changes committed to `repos/backend`
- Maintains independent git history and version control

### Co-Authored-By Footer

Super Commit appends the currently effective `Co-Authored-By` trailer to every generated commit. Interactive Git commits and the OpenSpec v1 archive prompt reuse the same resolution rules, so teams only need to maintain one convention.

The precedence order is fixed:

1. **Project-level config**: local Git config in the current repository (`git config --local`)
2. **Global config**: user-level Git config (`git config --global`)
3. **Built-in default**: `HagiCode &lt;noreply@hagicode.com&gt;`

If a layer is missing `name`, missing `email`, or contains an invalid email address, HagiCode skips that layer and falls back to the next one instead of emitting a malformed trailer.

Default output:

```text
共著者: はぎコード &lt;noreply@hagicode.com&gt;
```

Repository override example:

```bash
git config --local coAuthoredBy.name "プラットフォーム ボット"
git config --local coAuthoredBy.email "platform-bot@example.com"
```

Global fallback example:

```bash
git config --global coAuthoredBy.name "HagiCode"
git config --global coAuthoredBy.email "noreply@hagicode.com"
```

With the local override above, the trailer becomes:

```text
共著者: プラットフォーム ボット <platform-bot@example.com>
```

Operational details:
- If the commit message already contains the same resolved trailer, HagiCode does not append a duplicate.
- If the message already contains a different `Co-Authored-By` line, HagiCode keeps that line and still appends the resolved AI trailer.
- Teams should treat repository-level config as the canonical rule and keep global config as a personal fallback.

### Advantages for Multi-Repo Projects

**Traceability**: Clear history of which repository received which changes
**Coordination**: Changes across multiple repos can be committed simultaneously or sequentially
**Consistency**: Uniform commit format across all repositories
**Efficiency**: Reduced coordination overhead for changes spanning multiple repositories

## Usage Guidelines

### Best Practices

For optimal Super Commit results:

**1. Keep Changes Focused**
- Each commit should address a single feature or fix
- Avoid bundling unrelated changes in one commit
- Make incremental progress with meaningful commit messages

**2. Clear Code Comments**
- Add comments in complex code to help AI understand intent
- Use descriptive comments for non-obvious implementation details
- Keep comments updated as code evolves

**3. Reasonable File Naming**
- Use clear, descriptive file names
- Follow project naming conventions
- Avoid overly generic names that don't convey purpose

**4. Timely Committing**
- Commit frequently as meaningful changes are completed
- Don't accumulate large batches of uncommitted work
- Each commit should represent a logical unit of progress

**5. Leverage Multi-Repo Intelligence**
- Let AI group related changes across repositories
- Use descriptive scopes to indicate affected modules
- Review AI's suggested groupings before committing

## Usage Restrictions

### Limitations

Super Commit has the following usage limitations:

**1. Network Dependency**
- Requires active connection to AI service
- Processing time depends on network conditions
- Large codebases may take longer to analyze

**2. File Size Limits**
- Very large files (>10MB) may exceed processing limits
- Binary files are not analyzed (only text-based content)
- Split large changes into smaller commits if needed

**3. Codebase Complexity**
- Extremely complex code may be difficult to analyze fully
- Deeply nested or obfuscated code may have reduced accuracy
- Results are best-effort based on visible code

**4. First Use Considerations**

When using Super Commit for the first time:
- Start with smaller, safer changes to understand AI behavior
- Verify generated commits before finalizing
- Provide clear code comments to improve AI understanding
- Check that project is properly connected in HagiCode

## Troubleshooting

### Feature Not Available

If you don't see the Super Commit button:
- Ensure the project is added to HagiCode
- Refresh the interface
- Check if this feature is enabled in your version
- Verify your network connection to AI service

### No Response After Clicking

If nothing happens after clicking the button:
- Check for notification dialogs (may be hidden behind other windows)
- Check browser console for error messages
- Verify network connectivity
- Try restarting the application

### Incorrect Generated Messages

If AI generates incorrect commit messages:
- Manually modify using `git commit --amend`
- Add more descriptive comments to help AI understand
- Check code changes are accurately represented
- Re-trigger the feature after making adjustments

### Processing Takes Too Long

If processing seems to be taking an unusually long time:
- Check if there are very large files being analyzed
- Verify network stability
- Try splitting changes into smaller batches
- Check if AI service is experiencing high load

### Co-Authored-By Footer Missing

If commits don't include the expected footer:
- This may indicate AI service is unavailable
- Check your API token configuration in HagiCode settings
- Verify network connectivity
- Check whether the local `coAuthoredBy.name` / `coAuthoredBy.email` config is incomplete and therefore falling back to another layer
- Consider generating commits manually if issue persists

---

**For more information**, refer to the HagiCode documentation or check the monospecs repository for configuration examples.
