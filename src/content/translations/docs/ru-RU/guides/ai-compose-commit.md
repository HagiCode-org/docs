---
title: Руководство по фиксации AI Compose
description: Используйте искусственный интеллект для интеллектуального создания сообщений о коммитах Git, улучшая качество и согласованность коммитов.
---

## Обзор

AI Compose Commit считывает текущие изменения кода и генерирует сообщения о фиксации в формате обычных коммитов. Суть проста: тратьте меньше времени на написание коммитов, сохраняя при этом историю более понятной.

### Что такое AI Compose Commit?

AI Compose Commit анализирует ваши изменения и записывает для них стандартизированные сообщения о фиксации. Он заменяет ручное написание коммитов ради более последовательной истории.

Используйте его, когда:
- Большие изменения кода, требующие нескольких коммитов
- Мультирепозиторийные проекты с скоординированными изменениями
- Командам, требующим стандартизированных форматов коммитов
- Разработчики, которые хотят улучшить качество коммитов

### Основные преимущества

| Особенность | Традиционные ручные фиксации | AI Создать фиксацию |
|----------|----------------------|------------------|
| **Обещайте качество** | Зависит от индивидуального опыта | На основе лучших практик, стабильное качество |
| **Фиксированная скорость** | Требует мысли и организации. | Один клик, мгновенное создание |
| **Постоянство** | Может варьироваться в зависимости от коммита | Автоматически следует стандартам |
| **Поддержка нескольких репозиториев** | Требуется ручная координация | Автоматическое распознавание и группировка репо |
| **Экономия времени** | Может занять значительное время | Экономит 10-60+ секунд на каждый коммит. |

## Быстрый старт

### Включить функцию

В настольном приложении HagiCode перейдите к проекту, в котором вы хотите использовать AI Compose Commit, и включите эту функцию.

**Важно**: сначала убедитесь, что ваш проект добавлен в HagiCode.

### Функция триггера

Найдите кнопку «Комбинированная фиксация AI» в разделе «Операции Git».

![Комбинированная кнопка фиксации AI](../../img/screenshots/ai-compose-commit/trigger-ai-compose-commit-button/original.png)

Эта кнопка обычно расположена на видном месте в разделе «Операции Git», рядом с другими действиями по контролю версий.

**Важное примечание**: нажатие этой кнопки приведет к автоматическому созданию сообщения о фиксации. Если вам нужно откатить или изменить коммиты, используйте стандартные команды Git.

### Подсказка о рисках при первом использовании

При первом использовании AI Compose Commit или при наличии неутвержденных изменений система отобразит диалоговое окно подтверждения.

![Второе диалоговое окно подтверждения](../../img/screenshots/ai-compose-commit/second-confirmation-dialog/original.png)

Диалоговое окно содержит параметры, в том числе:
- Подтвердите и начните обработку
- Осознайте риски, больше не показывайте это приглашение
- Установка этой опции делает последующее использование более удобным.

Рекомендуем внимательно прочитать подсказку о рисках во время первого использования, чтобы понять последствия автоматической фиксации.

### Посмотреть результаты

После того, как AI завершит обработку, вы увидите уведомление об успехе.

Сообщения о фиксации созданы и готовы. При необходимости вы можете просмотреть их перед завершением.

## Подробности функции

### Логика анализа ИИ

AI Compose Commit анализирует изменения вашего кода с помощью следующего процесса:

#### 1. Прочтите изменения в рабочей области

Система собирает все измененные, вновь добавленные и удаленные файлы в текущей рабочей области.

#### 2. Анализ содержимого файла

ИИ глубоко анализирует содержимое измененных файлов, чтобы понять:
- Функциональные изменения реализованы
- Исправлены ошибки
- Используемые шаблоны рефакторинга
- Зависимости добавлены или удалены

#### 3. Определите ассоциации изменений

ИИ разумно определяет, какие изменения следует сгруппировать:
- Изменения внешнего и внутреннего интерфейса для одной и той же функции
- Связанные изменения файла конфигурации
- Тестируйте обновления вместе с изменениями реализации

#### 4. Создайте структуру фиксации

ИИ генерирует структурированную информацию о фиксации в соответствии со спецификацией обычных коммитов:

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
&lt;тип&gt;(&lt;область&gt;): &lt;субъект&gt;
  &lt;тело&gt;
    &lt;нижний колонтитул&gt;
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
feat(auth): добавить функцию входа пользователя в систему
Реализована аутентификация OAuth2 с поставщиками Google и GitHub.

Компонент входа в систему теперь поддерживает:
- Интеграция Google OAuth
- Интеграция GitHub OAuth
- Управление сеансами с помощью токенов JWT

Соавтор: Клод Опус 4.6 &lt;noreply@anthropic.com&gt;
```

## Comparison with Traditional Manual Commits

### Manual Commits

Traditional Git commits rely on:
- Developer's experience and mood
- Individual writing habits
- Time constraints affecting quality
- Inconsistent formatting across team

### AI Compose Commit

AI Compose Commit provides:
- **Standardized format**: Always follows Conventional Commits specification
- **Intelligent analysis**: Understands code context and relationships
- **Quality consistency**: Maintains professional tone and accuracy
- **Time efficiency**: Reduces commit writing time from 5-30 minutes to seconds

### When to Use Each

**Use AI Compose Commit When:**
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

When managing monospecs-based multi-repository projects, AI Compose Commit provides enhanced capabilities:

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

AI Compose Commit appends the currently effective `Co-Authored-By` trailer to every generated commit. Interactive Git commits and the OpenSpec v1 archive prompt reuse the same resolution rules, so teams only need to maintain one convention.

The precedence order is fixed:

1. **Project-level config**: local Git config in the current repository (`git config --local`)
2. **Global config**: user-level Git config (`git config --global`)
3. **Built-in default**: `HagiCode &lt;noreply@hagicode.com&gt;`

If a layer is missing `name`, missing `email`, or contains an invalid email address, HagiCode skips that layer and falls back to the next one instead of emitting a malformed trailer.

Default output:

```text
Соавтор: HagiCode &lt;noreply@hagicode.com&gt;
```

Repository override example:

```bash
git config --local coAuthoredBy.name «Платформенный бот»
git config --local coAuthoredBy.email "platform-bot@example.com"
```

Global fallback example:

```bash
git config --global coAuthoredBy.name "HagiCode"
git config --global coAuthoredBy.email "noreply@hagicode.com"
```

With the local override above, the trailer becomes:

```text
Соавтор: Platform Bot <platform-bot@example.com>
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

For optimal AI Compose Commit results:

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

AI Compose Commit has the following usage limitations:

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

When using AI Compose Commit for the first time:
- Start with smaller, safer changes to understand AI behavior
- Verify generated commits before finalizing
- Provide clear code comments to improve AI understanding
- Check that project is properly connected in HagiCode

## Troubleshooting

### Feature Not Available

If you don't see the AI Combined Commit button:
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
