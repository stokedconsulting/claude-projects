# Review Commands Documentation

Three hierarchical commands for comprehensive project quality review.

## Installation

The review commands are installed as global Claude Code slash commands:

```bash
# Commands are located in:
~/.claude/commands/review-item.md
~/.claude/commands/review-phase.md
~/.claude/commands/review-project.md
```

## Command Hierarchy

```
/review-project (Top Level)
    ↓ launches
/review-phase (Middle Level)
    ↓ launches
/review-item (Base Level)
```

## Commands

### 1. `/review-item` - Individual Issue Review

Reviews a single GitHub issue or project item.

**Usage:**
```bash
# Review by issue number
claude /review-item 59

# Review by project + phase item
claude /review-item 70 2.2
```

**Persona:** Senior Software Engineer turned SET (Software Engineer in Test)

**What it does:**
1. Fetches the issue and reads requirements/comments
2. Validates acceptance criteria exist and are clear
3. Reviews code changes and tests
4. Marks issue as Done if complete, or back to Todo if not
5. Adds detailed comments explaining status
6. Notifies VSCode extension to refresh

**Example Output:**
```
📋 Review Summary: Issue #2

Status: ✅ Complete

Acceptance Criteria:
- [✅] MongoDB schema defined with all required fields
- [✅] Indexes configured for performance
- [✅] TypeScript types match schema
- [✅] Validation rules implemented

Action Taken:
- ✅ Marked as "Done" in project #70
- ✅ Added verification comment
- ✅ Closed issue #2

Next Steps: None - ready for production
```

---

### 2. `/review-phase` - Phase Orchestration

Reviews all items in a project phase by launching parallel reviewers.

**Usage:**
```bash
# Review by project + phase number
claude /review-phase 70 2

# Review by phase master issue number
claude /review-phase 1
```

**Persona:** Engineering Manager coordinating quality review

**What it does:**
1. Identifies all items in the phase
2. Launches parallel `/review-item` sub-agents for each item
3. Aggregates results into phase summary
4. Updates phase master issue
5. Provides completion percentage and blockers

**Example Output:**
```
📊 Phase 2 Review Summary

Total Items: 8
✅ Complete: 5 (62%)
❌ Incomplete: 2 (25%)
ℹ️ Not Started: 1 (13%)

Complete Items:
  ✅ Phase 2.1 - NestJS Project Setup (#2)
  ✅ Phase 2.2 - MongoDB Schema Design (#3)
  ✅ Phase 2.3 - API Key Authentication (#4)
  ✅ Phase 2.4 - Health Check Endpoints (#10)
  ✅ Phase 2.5 - Project Fields API (#11)

Incomplete Items:
  ❌ Phase 2.6 - SST Deployment (#7)
     Missing: Production environment configuration

  ❌ Phase 2.7 - Custom Domain (#8)
     Missing: SSL certificate setup

Not Started:
  ℹ️ Phase 2.8 - E2E Tests (#9)

Phase Status: ⚠️ In Progress (62% complete)

Recommendation: Complete items 2.6 and 2.7 before marking phase as done.
```

---

### 3. `/review-project` - Project-Wide Orchestration

Reviews entire project across all phases with executive summary.

**Usage:**
```bash
# Review entire project
claude /review-project 70
```

**Persona:** Director of Engineering providing executive oversight

**What it does:**
1. Identifies all phases in the project
2. Launches parallel `/review-phase` sub-agents for each phase
3. Aggregates into comprehensive project health report
4. Identifies critical path and blockers
5. Provides strategic recommendations
6. Generates stakeholder-ready executive summary

**Example Output:**
```
🎯 PROJECT HEALTH REPORT: Build Claude Projects State Tracking API

Project: #70
Last Updated: 2026-01-20 10:30 UTC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 OVERALL STATUS: 🟡 ON TRACK (with concerns)

Progress: 52% complete (22/42 items)
Velocity: 4.2 items/week
Estimated Completion: 2 weeks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ COMPLETED WORK:
- Phase 1: Foundation complete (8/8 items)
- Core schemas validated and tested
- Authentication system implemented

🟡 IN PROGRESS:
- Phase 2: Session tracking (6/8 items, 75%)
- Phase 3: Recovery system (5/10 items, 50%)

🚨 BLOCKERS:
1. Phase 2.6: SST deployment config needed
   Impact: Blocking Phases 4 & 5 (18 items)
   ETA: 2 days

2. Phase 3.2: Failure detection tests failing
   Impact: Blocking Phase 3 completion
   ETA: 1 day

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 CRITICAL NEXT STEPS:

IMMEDIATE (0-2 days):
1. ⚠️ Configure AWS credentials for SST
2. ⚠️ Fix failure detection test failures
3. Complete Phase 2 heartbeat testing

SHORT TERM (3-7 days):
4. Begin Phase 4 deployment pipeline
5. Complete Phase 3 recovery logic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💡 RECOMMENDATIONS:

1. PRIORITIZE: Resolve SST deployment blocker
   - Unblocks 18 items in Phases 4 & 5

2. RELEASE STRATEGY: Deploy Phases 1-2 to staging
   - Get early feedback
   - Validate infrastructure

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 NEXT REVIEW: In 3 days (2026-01-23)
```

## Usage Patterns

### Quick Item Check
```bash
# Just finished implementing issue #5, verify it's complete
claude /review-item 5
```

### Phase Sign-Off
```bash
# Before moving to next phase, verify Phase 1 is done
claude /review-phase 70 1
```

### Weekly Status Report
```bash
# Generate comprehensive status for stakeholders
claude /review-project 70
```

### Pre-Release Validation
```bash
# Before deploying to production, full review
claude /review-project 70
```

## Integration with VSCode Extension

The review commands automatically notify the VSCode extension when they make changes:

1. Commands update GitHub issues/projects via `gh` CLI
2. Commands write signal files to `.claude-sessions/`
3. Extension detects signal file changes
4. Extension auto-refreshes project view
5. User sees updated status immediately

## Best Practices

### When to use `/review-item`
- ✅ After completing a feature
- ✅ Before marking an issue "Done"
- ✅ During code review
- ✅ When unsure if work is complete

### When to use `/review-phase`
- ✅ End of sprint/milestone
- ✅ Before phase sign-off
- ✅ Weekly team reviews
- ✅ When stuck (identify blockers)

### When to use `/review-project`
- ✅ Weekly stakeholder updates
- ✅ Pre-release validation
- ✅ Project health checks
- ✅ Strategic planning sessions

## Requirements

- **GitHub CLI**: `brew install gh` (must be authenticated)
- **Git repository**: Must be in a git repo with GitHub remote
- **Claude Code**: Latest version with skills support
- **VSCode Extension**: Claude Projects extension installed

## Tips

1. **Run in project root**: Commands need access to `.git` and project files
2. **Parallel execution**: Phase and project reviews run in parallel for speed
3. **Be patient**: Full project reviews can take 5-10 minutes
4. **Check logs**: Use `--verbose` flag for detailed output
5. **Rerun safely**: Commands are idempotent - safe to rerun

## Troubleshooting

### "Could not find issue #X"
- Check you're in the right repository
- Verify issue exists: `gh issue view X`

### "Permission denied"
- Authenticate with GitHub: `gh auth login`
- Check repo access: `gh repo view`

### Extension not refreshing
- Check signal files exist: `ls .claude-sessions/*.signal`
- Reload VSCode: Cmd+Shift+P → "Reload Window"

### Reviews taking too long
- Reduce parallelism (file an issue - we can add flags)
- Run phase reviews instead of full project

## Future Enhancements

- [ ] Add `--dry-run` flag to preview without making changes
- [ ] Add `--parallel=N` to control concurrency
- [ ] Add `--format=json` for programmatic use
- [ ] Add `--since=date` to review recent changes only
- [ ] Integration with CI/CD pipelines
- [ ] Slack/Teams notifications
- [ ] Automated scheduling (daily/weekly reviews)

---

**Questions or issues?** File an issue in the repository with the `review-commands` label.
