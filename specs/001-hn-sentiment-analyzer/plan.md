# Implementation Plan: HackerNews Daily Intelligence Agent

**Branch**: `001-hn-sentiment-analyzer` | **Date**: 2026-03-10 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-hn-sentiment-analyzer/spec.md`

## Summary

Build a CLI agent using Strands Agents TypeScript SDK that fetches 20 HackerNews stories daily (10 top + 10 best), retrieves top 20 comments per story, analyzes aggregated sentiment via LLM, and generates a human-readable Markdown report. Parallel subagent execution ensures sub-2-minute runtime.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS)  
**Primary Dependencies**: Strands Agents TypeScript SDK, node-fetch or axios for HTTP  
**Storage**: File system only (output/report.md)  
**Testing**: NEEDS CLARIFICATION (tests optional per constitution)  
**Target Platform**: Node.js CLI  
**Project Type**: CLI agent application  
**Performance Goals**: Complete full pipeline in under 2 minutes  
**Constraints**: Max 20 concurrent API requests, max 20 stories, max 20 comments per story  
**Scale/Scope**: Single-user CLI tool, 20 stories per run, ~400 comments per run

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

✅ **Agent-First Architecture**: 3 agents planned (main orchestrator, sentiment subagent, summary subagent) with parallel execution  
✅ **Strict Resource Limits**: 20 stories (10+10), 20 comments per story, 20 concurrent requests enforced  
✅ **TypeScript Strict Mode**: All code will use strict mode with explicit types  
✅ **Centralized API Access**: All HN API calls routed through `src/tools/hackernews.ts`  
✅ **CLI-Native Output**: Markdown to `output/report.md` and stdout, errors to stderr  

**Status**: All gates passed. No complexity violations.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── index.ts          # Entry point, initializes main agent
├── agents/
│   ├── main.ts       # Main orchestrator agent
│   ├── sentiment.ts  # Sentiment analysis subagent
│   └── summary.ts    # Report generation subagent
├── tools/
│   └── hackernews.ts # HN API HTTP calls (fetch stories, comments)
└── types/
    └── index.ts      # Shared TypeScript types (Story, Comment, SentimentResult)

output/
└── report.md         # Generated daily report (created at runtime)

package.json
tsconfig.json
```

**Structure Decision**: Single project structure (Option 1) selected. This is a standalone CLI agent with no frontend/backend split or mobile components. All code in `src/` following constitution's prescribed organization.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No complexity violations. All constitution gates passed.

---

## Phase 0: Research (COMPLETE)

**Output**: [research.md](./research.md)

**Decisions Made**:
1. Testing framework: None initially (tests optional per constitution)
2. Strands Agents SDK: Use for agent orchestration and LLM access
3. HN API: Firebase REST API with node-fetch/axios
4. Sentiment: LLM via Strands SDK, aggregate per story
5. Report: Template-based Markdown generation

**Status**: All technical unknowns resolved. Ready for Phase 1.

---

## Phase 1: Design & Contracts (COMPLETE)

**Outputs**:
- [data-model.md](./data-model.md) - Story, Comment, SentimentResult, DailyReport entities
- [contracts/agent-contracts.md](./contracts/agent-contracts.md) - Agent communication contracts
- [quickstart.md](./quickstart.md) - Setup and usage guide
- AGENTS.md - Updated with TypeScript + Strands Agents stack

**Constitution Re-Check**:

✅ **Agent-First Architecture**: Contracts defined for main → sentiment, main → summary  
✅ **Strict Resource Limits**: Data model enforces 20 stories, 20 comments limits  
✅ **TypeScript Strict Mode**: Type definitions in data-model.md, strict mode in tsconfig  
✅ **Centralized API Access**: Tool contracts in agent-contracts.md route all HN calls through tools/hackernews.ts  
✅ **CLI-Native Output**: Report format defined in data-model.md (Markdown to file + stdout)  

**Status**: All gates passed. Design complete. Ready for task breakdown.

---

## Next Steps

Run `/speckit.tasks` to generate task breakdown from this plan.
