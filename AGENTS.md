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

## PR Review Pass

If a task includes PR review (PR number, PR link, or wording like "check PR" / "review PR"), the deliverable is the published PR comment, not the chat message.

### Rules

- Every completed review-pass MUST be published to the PR via `gh pr comment` before the agent reports the verdict to the operator
- Chat messages do NOT count as published review results
- The agent does NOT wait for operator confirmation before publishing the review report
- If publication fails, the agent MUST retry or report a blocker immediately and MUST NOT claim the review-pass is complete
- After successful publication, provide the operator visibility to the published report; include the comment link when available

## Session Completion

**When ending a work session**, you MUST complete all applicable steps below. Work is NOT complete until required PR publication is done, and if code changed, `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** (if code changed) - This is MANDATORY:

   ```bash
   git pull --rebase
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Publish report to PR** (MANDATORY if PR exists and this pass produced a review verdict, fix summary, or merge-readiness status):

   ```bash
   gh pr comment <NUMBER> --body-file <report>
   ```

   > If a PR exists, push WITHOUT a report = incomplete work.
   > Review-only pass WITHOUT a PR comment = incomplete work.

6. **Clean up** - Clear stashes, prune remote branches
7. **Verify** - All applicable obligations are done: code changes committed and pushed if present, report published if required
8. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until all applicable obligations are done: PR publication for review/report passes, and `git push` for code changes
- NEVER stop before pushing code changes - that leaves work stranded locally
- If a PR exists, NEVER stop after a review-pass or push without publishing a report - the team has no visibility
- Every review-pass MUST be published via `gh pr comment` before any user-facing message that claims a verdict or review result
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
- If PR publication fails, retry or report the blocker immediately
- All agents share the operator's GitHub account — use `gh pr comment`, NEVER `gh pr review` (author cannot review their own PR)
<!-- END BEADS INTEGRATION -->
