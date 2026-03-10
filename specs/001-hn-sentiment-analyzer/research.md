# Research: HackerNews Daily Intelligence Agent

**Date**: 2026-03-10  
**Feature**: 001-hn-sentiment-analyzer

## Research Tasks

### 1. Testing Framework Decision

**Decision**: No testing framework initially (tests optional per constitution)

**Rationale**: 
- Constitution explicitly states "Tests are OPTIONAL unless explicitly requested"
- Feature spec does not request tests
- Focus on MVP delivery with basic error handling
- If tests are added later, use Jest (standard for TypeScript/Node.js projects)

**Alternatives Considered**:
- Jest: Industry standard for TypeScript, good mocking support
- Vitest: Faster, modern alternative
- Mocha + Chai: More configuration required

**Conclusion**: Proceed without tests initially. Testing framework selection deferred until explicitly requested.

---

### 2. Strands Agents TypeScript SDK Best Practices

**Decision**: Use Strands Agents SDK for agent orchestration with parallel subagent execution

**Rationale**:
- SDK provides built-in support for agent delegation and parallel execution
- LLM access is built into the framework (clarified in spec)
- Handles agent communication and state management
- Aligns with Agent-First Architecture principle

**Key Patterns**:
- Main agent spawns sentiment and summary subagents in parallel
- Agents communicate via structured data contracts (TypeScript types)
- Each agent has single responsibility (orchestration, sentiment, summary)
- Use SDK's built-in LLM access for sentiment analysis

---

### 3. HackerNews API Integration Patterns

**Decision**: Use HackerNews Firebase REST API with node-fetch or axios

**Rationale**:
- Public API, no authentication required
- REST endpoints: `/v0/topstories.json`, `/v0/beststories.json`, `/v0/item/{id}.json`
- Simple JSON responses, easy to type with TypeScript
- Rate limiting handled by max 20 concurrent requests constraint

**API Endpoints**:
- Top stories: `https://hacker-news.firebaseio.com/v0/topstories.json`
- Best stories: `https://hacker-news.firebaseio.com/v0/beststories.json`
- Item details: `https://hacker-news.firebaseio.com/v0/item/{id}.json`

**Error Handling Pattern**:
- Wrap all API calls in try/catch
- Log errors to stderr
- Continue processing remaining stories (partial failure tolerance)
- Return typed results with optional fields for failed fetches

---

### 4. Sentiment Analysis via LLM

**Decision**: Use Strands Agents SDK's built-in LLM access for sentiment analysis

**Rationale**:
- Clarified in spec: "Agent uses LLM via Strands Agents framework"
- Aggregate all comments per story into single sentiment (per clarification)
- LLM prompt: Analyze aggregated comments, return label + confidence
- No external NLP libraries needed

**Implementation Approach**:
- Sentiment subagent receives story with comments
- Constructs prompt: "Analyze sentiment of these comments: [comments]. Return: positive/negative/neutral with confidence 0-100"
- Parses LLM response into SentimentResult type
- Stories with zero comments return "No sentiment" (per clarification)

---

### 5. Markdown Report Generation

**Decision**: Template-based Markdown generation in summary subagent

**Rationale**:
- Simple string concatenation for Markdown format
- No templating library needed (YAGNI)
- Human-readable output with story details and sentiment

**Report Structure**:
```markdown
# HackerNews Daily Intelligence Report
**Date**: YYYY-MM-DD

## Top Stories
1. [Story Title](url) - Score: X - Sentiment: positive (85%)
...

## Best Stories
1. [Story Title](url) - Score: X - Sentiment: No sentiment
...
```

**File Operations**:
- Create `output/` directory if missing (per clarification)
- Write to `output/report.md`
- Print same content to stdout

---

## Unresolved Items

None. All technical decisions resolved.
