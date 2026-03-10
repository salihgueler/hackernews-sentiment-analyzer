# Tasks: HackerNews Daily Intelligence Agent

**Input**: Design documents from `/specs/001-hn-sentiment-analyzer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are OPTIONAL per constitution and not requested in spec. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Single project structure: `src/`, `output/` at repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Initialize Node.js project with package.json (name: hackernews-sentiment-analyzer, version: 1.0.0)
- [X] T002 Install Strands Agents TypeScript SDK as dependency
- [X] T003 [P] Install axios for HTTP requests as dependency
- [X] T004 [P] Create tsconfig.json with strict mode enabled and target ES2020
- [X] T005 [P] Create .gitignore with node_modules, dist, output/*.md entries
- [X] T006 Create src/ directory structure: src/agents/, src/tools/, src/types/
- [X] T007 Add build script to package.json: "build": "tsc"
- [X] T008 Add start script to package.json: "start": "node dist/index.js"
- [X] T009 [P] Add lint script to package.json: "lint": "eslint src --ext .ts"

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Create TypeScript type definitions in src/types/index.ts (Story, Comment, SentimentResult, StoryWithComments)
- [X] T011 Create HackerNews API tool skeleton in src/tools/hackernews.ts with axios setup and base URL constant
- [X] T012 [P] Create main agent skeleton in src/agents/main.ts with Strands SDK initialization
- [X] T013 [P] Create sentiment subagent skeleton in src/agents/sentiment.ts with Strands SDK initialization
- [X] T014 [P] Create summary subagent skeleton in src/agents/summary.ts with Strands SDK initialization
- [X] T015 Create entry point in src/index.ts that initializes and invokes main agent

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Fetch Daily Stories (Priority: P1) 🎯 MVP

**Goal**: Fetch 20 HackerNews stories (10 top + 10 best) and display basic information

**Independent Test**: Run `npm run start` and verify 20 stories are fetched with id, title, url, score

### Implementation for User Story 1

- [X] T016 [P] [US1] Implement fetchTopStories() in src/tools/hackernews.ts (GET /v0/topstories.json, return first 10 IDs)
- [X] T017 [P] [US1] Implement fetchBestStories() in src/tools/hackernews.ts (GET /v0/beststories.json, return first 10 IDs)
- [X] T018 [P] [US1] Implement fetchStory(id) in src/tools/hackernews.ts (GET /v0/item/{id}.json, return Story or null)
- [X] T019 [US1] Implement main agent story fetching logic in src/agents/main.ts (call fetchTopStories, fetchBestStories)
- [X] T020 [US1] Implement parallel story detail fetching in src/agents/main.ts (fetch all 20 stories concurrently, max 20 concurrent)
- [X] T021 [US1] Add error handling in src/tools/hackernews.ts (try/catch, log to stderr, continue on failures)
- [X] T022 [US1] Add basic console output in src/agents/main.ts (log fetched story count and titles to stdout)

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Analyze Comment Sentiment (Priority: P2)

**Goal**: Retrieve top 20 comments per story and analyze aggregated sentiment via LLM

**Independent Test**: Given fetched stories, verify sentiment analysis returns valid labels and confidence scores

### Implementation for User Story 2

- [X] T023 [US2] Implement fetchComments(storyId, commentIds) in src/tools/hackernews.ts (fetch up to 20 comments, return Comment[])
- [X] T024 [US2] Add comment fetching to main agent in src/agents/main.ts (for each story, fetch comments from story.kids)
- [X] T025 [US2] Implement sentiment subagent LLM prompt construction in src/agents/sentiment.ts (aggregate comment text, format prompt)
- [X] T026 [US2] Implement LLM call in src/agents/sentiment.ts (use Strands SDK LLM access, parse response to SentimentResult)
- [X] T027 [US2] Handle zero-comment case in src/agents/sentiment.ts (return "No sentiment" with confidence 0)
- [X] T028 [US2] Implement parallel sentiment analysis in src/agents/main.ts (spawn sentiment subagent for each story concurrently)
- [X] T029 [US2] Add sentiment results to Story objects in src/agents/main.ts (populate sentiment field after analysis)
- [X] T030 [US2] Add error handling for LLM failures in src/agents/sentiment.ts (log to stderr, return neutral with low confidence)

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Generate Daily Summary Report (Priority: P3)

**Goal**: Generate human-readable Markdown report and save to output/report.md

**Independent Test**: Given stories with sentiment, verify valid Markdown report is generated with all sections

### Implementation for User Story 3

- [X] T031 [US3] Implement output directory creation in src/agents/summary.ts (check if output/ exists, create if missing)
- [X] T032 [US3] Implement Markdown header generation in src/agents/summary.ts (title with current date)
- [X] T033 [US3] Implement Top Stories section formatting in src/agents/summary.ts (iterate stories, format with title, URL, score, sentiment)
- [X] T034 [US3] Implement Best Stories section formatting in src/agents/summary.ts (iterate stories, format with title, URL, score, sentiment)
- [X] T035 [US3] Implement file write in src/agents/summary.ts (write Markdown to output/report.md)
- [X] T036 [US3] Implement parallel summary generation in src/agents/main.ts (spawn summary subagent with analyzed stories)
- [X] T037 [US3] Add stdout printing in src/agents/main.ts (print report content after file write)
- [X] T038 [US3] Add final success message in src/agents/main.ts (log completion time and report path)

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T039 [P] Add performance logging in src/agents/main.ts (track start time, log total runtime at end)
- [X] T040 [P] Validate sub-2-minute performance requirement (run full pipeline, verify timing)
- [X] T041 [P] Add README.md with installation and usage instructions
- [X] T042 Verify constitution compliance (check all 5 principles against implementation)
- [X] T043 Run quickstart.md validation (follow quickstart guide end-to-end)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1 but independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Integrates with US1+US2 but independently testable

### Within Each User Story

- US1: API tool functions before main agent logic
- US2: Comment fetching before sentiment analysis, sentiment before integration
- US3: Directory creation before file operations, formatting before writing

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- Within US1: All three fetch functions (T016, T017, T018) can be implemented in parallel
- Within US2: No parallel opportunities (sequential dependencies)
- Within US3: No parallel opportunities (sequential dependencies)
- Polish phase: T039, T040, T041 can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all API tool functions for User Story 1 together:
Task: "Implement fetchTopStories() in src/tools/hackernews.ts"
Task: "Implement fetchBestStories() in src/tools/hackernews.ts"
Task: "Implement fetchStory(id) in src/tools/hackernews.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Tests not included (optional per constitution, not requested in spec)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
