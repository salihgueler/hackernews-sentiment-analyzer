# Feature Specification: HackerNews Daily Intelligence Agent

**Feature Branch**: `001-hn-sentiment-analyzer`  
**Created**: 2026-03-10  
**Status**: Draft  
**Input**: User description: "CLI agent that fetches HackerNews stories, analyzes comment sentiment, and generates daily summary reports"

## Clarifications

### Session 2026-03-10

- Q: How should sentiment analysis be implemented for comment text? → A: Agent uses LLM via Strands Agents framework
- Q: Should sentiment analysis produce per-comment results or aggregated per-story results? → A: Aggregate all comments per story into a single sentiment
- Q: How should stories with zero comments be handled in the report? → A: Just write No sentiment
- Q: What should happen if the output/ directory doesn't exist when generating the report? → A: Create output/ directory automatically if missing
- Q: When the HackerNews API fails for a specific story or comment fetch, should the system fail completely or continue? → A: Log error to stderr, continue processing remaining stories

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fetch Daily Stories (Priority: P1) 🎯 MVP

As a user, I run `npm run start` and the system fetches today's top 10 and best 10 HackerNews stories, displaying basic story information (title, URL, score) in the terminal.

**Why this priority**: Core data retrieval is the foundation. Without stories, no sentiment analysis or reporting is possible.

**Independent Test**: Run the CLI and verify 20 stories are fetched and displayed with correct data structure.

**Acceptance Scenarios**:

1. **Given** the HackerNews API is available, **When** I run `npm run start`, **Then** the system fetches exactly 10 top stories and 10 best stories
2. **Given** stories are fetched, **When** the process completes, **Then** each story includes id, title, url, and score
3. **Given** the API request fails, **When** fetching stories, **Then** an error message is printed to stderr and the process exits gracefully

---

### User Story 2 - Analyze Comment Sentiment (Priority: P2)

As a user, after stories are fetched, the system retrieves the top 20 comments for each story and analyzes their sentiment (positive/negative/neutral with confidence percentage), running in parallel for speed.

**Why this priority**: Sentiment analysis is the core intelligence feature that differentiates this from a simple story fetcher.

**Independent Test**: Given a set of stories with comments, verify sentiment analysis returns valid labels and confidence scores for each story.

**Acceptance Scenarios**:

1. **Given** 20 stories are fetched, **When** sentiment analysis runs, **Then** exactly the top 20 comments per story are retrieved (no more, no less)
2. **Given** comments are retrieved, **When** sentiment analysis completes, **Then** each story has a sentiment label (positive/negative/neutral) and confidence percentage (0-100)
3. **Given** a story has fewer than 20 comments, **When** fetching comments, **Then** all available comments are retrieved without error
4. **Given** sentiment and summary agents are invoked, **When** processing begins, **Then** both subagents run in parallel, not sequentially

---

### User Story 3 - Generate Daily Summary Report (Priority: P3)

As a user, after sentiment analysis completes, the system generates a human-readable Markdown report summarizing the day's stories with sentiment insights, saved to `output/report.md` and printed to stdout.

**Why this priority**: The report is the final deliverable that makes the data actionable and shareable.

**Independent Test**: Given stories with sentiment data, verify a valid Markdown report is generated with all required sections.

**Acceptance Scenarios**:

1. **Given** stories with sentiment analysis, **When** the summary agent runs, **Then** a Markdown report is generated in `output/report.md`
2. **Given** the report is generated, **When** viewing the output, **Then** it includes story titles, URLs, scores, sentiment labels, and confidence percentages
3. **Given** the report is complete, **When** the process finishes, **Then** the report content is printed to stdout for immediate viewing
4. **Given** the full pipeline runs, **When** timing the execution, **Then** the entire process completes in under 2 minutes

---

### Edge Cases

- When the HackerNews API is unavailable or returns errors for specific stories/comments, log error to stderr and continue processing remaining stories
- Stories with zero comments display "No sentiment" in the report
- What if a story URL is missing or malformed?
- How are non-English comments handled in sentiment analysis?
- The output/ directory is created automatically if it doesn't exist

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST fetch exactly 10 top stories and 10 best stories from HackerNews API
- **FR-002**: System MUST retrieve exactly the top 20 comments per story (or all available if fewer than 20)
- **FR-003**: System MUST analyze sentiment by aggregating all comments per story using LLM calls via Strands Agents framework, producing a single aggregated label (positive/negative/neutral) and confidence percentage per story; stories with zero comments display "No sentiment"
- **FR-004**: System MUST run sentiment and summary subagents in parallel for performance
- **FR-005**: System MUST generate a Markdown report in `output/report.md` with story details and sentiment analysis, creating the output/ directory automatically if it doesn't exist
- **FR-006**: System MUST print the report to stdout for immediate viewing
- **FR-007**: System MUST complete the full pipeline in under 2 minutes
- **FR-008**: System MUST use TypeScript strict mode for all code
- **FR-009**: System MUST route all HackerNews API calls through `src/tools/hackernews.ts` only
- **FR-010**: System MUST limit concurrent API requests to 20 maximum
- **FR-011**: System MUST fetch only top-level comments (no nested comment recursion)
- **FR-012**: System MUST log errors to stderr for failed API calls and continue processing remaining stories gracefully (partial failure tolerance)

### Key Entities *(include if feature involves data)*

- **Story**: Represents a HackerNews story with id, title, url, score, and optional sentiment result
- **Comment**: Represents a top-level comment with text content for sentiment analysis
- **SentimentResult**: Contains aggregated sentiment label (positive/negative/neutral) and confidence percentage (0-100) for all comments on a story
- **DailyReport**: Markdown-formatted summary of stories with sentiment insights

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Running `npm run start` successfully fetches 20 stories (10 top + 10 best) with 100% success rate when API is available
- **SC-002**: Each story retrieves exactly 20 comments (or all available if fewer) with no nested comments
- **SC-003**: Sentiment analysis produces valid labels and confidence scores for 100% of stories with comments
- **SC-004**: Full pipeline completes in under 2 minutes for 20 stories with 20 comments each
- **SC-005**: Generated Markdown report is valid, human-readable, and contains all required data fields
- **SC-006**: Parallel subagent execution reduces total runtime by at least 30% compared to sequential execution
- **SC-007**: System handles API errors gracefully without crashing, logging clear error messages to stderr and continuing to process remaining stories (partial failure tolerance)
