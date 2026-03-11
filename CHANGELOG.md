# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added - 2026-03-11

- Improve CHANGELOG hook detection and add missing changelog entry: Updated hook prompt for more reliable git commit detection and added prior changelog entry
- Create CHANGELOG hook: Added postToolUse hook to auto-update changelog after git commits
- Per-story sentiment paragraphs with hardened JSON parsing
- Overall sentiment analysis summary to report via Strands agent
- Skills configuration for agent capabilities
- Strands Agents SDK integration for sentiment analysis
  - Real Strands Agent using Amazon Bedrock Claude Sonnet 4.5
  - @strands-agents/sdk and zod dependencies
  - ESLint with flat config format
  - ES2020 modules support in tsconfig
  - ES module support in package.json

### Added - 2026-03-10

- Initial project setup
- Project specifications and documentation
- Agent implementation for HackerNews sentiment analysis
- HackerNews API integration
- Sentiment analysis pipeline
- Markdown report generation

## [0.1.0] - 2026-03-10

### Added

- Initial release
- CLI agent for fetching HackerNews stories
- Comment sentiment analysis
- Daily summary report generation
- Parallel processing for sub-2-minute execution
- Support for top 10 and best 10 stories
- Up to 20 top-level comments per story analysis
