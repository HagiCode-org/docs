# Store and product screenshots (en-US, dark theme)

Full-resolution, lossless 1920x1080 PNG captures of the current HagiCode web UI. They are the source for the
product overview page (`src/content/docs/img/screenshots/product/**` holds byte-identical copies of the
ones the page uses, which the build converts) and are sized for store listings (16:9, 1920x1080).

All captures use the dark theme, the English UI and one English demo workspace (`acme-platform`, a ten-repository
MonoSpecs project). No real project names, paths or accounts appear. The AI Monitoring paths are placeholders
and the Vault paths are demo paths.

| File | Shows | Docs page |
| --- | --- | --- |
| `en-US/01-session-board.png` | Session board with project quick actions and repository status | Product overview |
| `en-US/02-command-view.png` | Command View wall of live session tiles | Product overview |
| `en-US/03-conversation-session.png` | Read-only conversation session with a tool call | Product overview |
| `en-US/04-create-proposal.png` | Create Proposal drawer with repository scope and combined preview | Product overview |
| `en-US/05-proposal-complete.png` | Finished proposal session (all stages, Tasks 6/6) | Product overview |
| `en-US/06-proposal-running.png` | Proposal session at the Executing Plan stage (Tasks 3/5) | Store only |
| `en-US/07-monospecs-repositories.png` | Project Git tab with ten MonoSpecs repositories | Product overview |
| `en-US/08-agents-workspace.png` | Agents Workspace grouped by Agent CLI | Product overview |
| `en-US/09-agent-cli-monitoring.png` | AI Monitoring popover in the status bar | Product overview |
| `en-US/10-skills-gallery.png` | Skills Gallery with source filters and install counts | Product overview |
| `en-US/11-vault-browser.png` | Vault drawer with Markdown preview | Product overview |
| `en-US/12-git-super-commit.png` | Git tab with changed repositories selected, Super Commit highlighted | Product overview |
| `en-US/13-super-commit-confirmation.png` | Super Commit confirmation drawer | Store only |
| `en-US/14-achievements.png` | Achievement Hall | Product overview |
| `en-US/15-scheduled-plans.png` | Scheduled plans calendar | Store only |
| `en-US/16-hagitask-workspace.png` | HagiTask workspace package management | Store only |

Suggested order for a ten-image store listing: 01, 02, 04, 05, 07, 08, 10, 11, 15, 14.

## How they were captured

Headless Chromium (Playwright) at 1920x1080, scale 1, `en-US`, `pcode-theme=dark`, against the web dev server.
Project, session, message, vault, plan, agent and Git responses are replaced with English demo data, all other
requests are read-only passthrough, writes are blocked and the SignalR socket is faked. To refresh them after a UI
change, re-run the same scenes, keep the filenames and copy the lossless PNGs to `img/screenshots/product/<slug>/original.png`.
