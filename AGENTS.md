# Agent Instructions

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

## Documentation Artifacts

- Do not delete completed specs, plans, or other AI-generated working artifacts unless the user explicitly asks.
- Move obsolete or completed AI-generated artifacts into `docs/archive/` instead of removing them.

## Root Instruction Files Maintenance

- Keep `AGENTS.md` and `CLAUDE.md` focused on stable project-wide guidance, not temporary task notes.
- Propose changes to the user before editing `AGENTS.md` or `CLAUDE.md`.
- After editing, review the whole file for contradictions or stale rules.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds AND report is published in PR (if PR exists).

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:

   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Publish report to PR** (if PR exists) — summarize what was done/fixed:

   ```bash
   gh pr comment <NUMBER> --body-file <report>
   ```

   > If a PR exists, push WITHOUT a report = incomplete work.

6. **Clean up** - Clear stashes, prune remote branches
7. **Verify** - All changes committed AND pushed, report published (if PR exists)
8. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds AND report is published in PR (if PR exists)
- NEVER stop before pushing - that leaves work stranded locally
- If a PR exists, NEVER stop after pushing without publishing a report - the team has no visibility
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- All agents share the operator's GitHub account — use `gh pr comment`, NEVER `gh pr review` (author cannot review their own PR)
<!-- END BEADS INTEGRATION -->
