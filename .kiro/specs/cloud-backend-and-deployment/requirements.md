# Requirements Document

## Introduction

The Hacker News Sentiment Analyzer currently ships as a static site: reports are Markdown files with YAML front-matter under `strands-agent-typescript/reports/`, copied at prebuild into `hacker-news-portal/public/reports/` with a derived `index.json`, and new generations are invoked through a Vite dev/preview middleware at `POST /__api/generate`. Everything runs on a developer workstation.

This feature replaces that mocked backend with a production cloud deployment on AWS. It introduces three intertwined capability areas:

1. **Report persistence** — Generated reports are written to and read from a managed database instead of the local filesystem, while preserving the existing report shape and the "latest on `/`, archive in the sidebar" UX consumed by `src/wireBackend/`.
2. **Generation triggering** — The existing portal button continues to work against the cloud backend, and a new scheduled run fires every day at 21:00 UTC. Operators may also invoke the scheduled pipeline manually from AWS for backfill and testing. The scheduler never runs inside the browser bundle.
3. **AWS deployment** — The React frontend is hosted on AWS over HTTPS, the generation and read APIs are exposed with abuse/cost protection given the absence of user accounts, and secrets, credentials, and resource identifiers are handled per the workspace steering rules.

The feature MUST preserve all explicit product non-goals: no user accounts, no auth/multi-tenant concerns in the product surface, no streaming in the UI, and no generation logic in the portal bundle. Requirements are written against _what_ must be true; service selection (DynamoDB was chosen for the database shape, us-east-1 for the region) is constrained where the user pinned it and otherwise left for the design phase.

## Glossary

- **Portal** — The `hacker-news-portal/` React + Vite frontend served to Visitors.
- **Sentiment_Agent** — The `strands-agent-typescript/` agent that produces a sentiment report using Bedrock Claude Haiku 4.5 via the global cross-Region inference profile ID `global.anthropic.claude-haiku-4-5-20251001-v1:0`.
- **Title_Agent** — The secondary agent that assigns each report a short title and a kebab-case slug (existing `src/generation/titleAgent.ts` behavior).
- **Report** — A single generated artifact with metadata (`id`, `title`, `slug`, `generatedAt`, `prompt`) and a Markdown `body` (with front-matter stripped on read), as defined by `ReportMetadata` / `ReportPayload` in `src/wireBackend/types.ts`.
- **Report_Store** — The managed AWS database that persists every Report. Pinned to Amazon DynamoDB per user decision.
- **Read_API** — The HTTPS endpoint(s) the Portal calls to list Reports, get a Report by slug, and get the latest Report.
- **Generate_API** — The HTTPS endpoint the Portal's Generate button calls to start a generation run, and that returns the resulting `ReportMetadata` on success.
- **Scheduler** — The AWS-side component that fires the generation pipeline on a daily schedule and on operator invocation.
- **Generation_Runner** — The server-side executable path that invokes the Sentiment_Agent and the Title_Agent, validates outputs, and persists the resulting Report to the Report_Store. Corresponds conceptually to today's `src/generation/GenerationRunner.ts` but runs on AWS, not in Vite.
- **Schedule_Slot** — A specific calendar day (in UTC) on which the Scheduler is expected to fire exactly once at 21:00:00 UTC.
- **Generation_Run** — A single attempted or completed execution of the Generation_Runner, identified by a unique `runId`.
- **Abuse_Control** — The combination of AWS WAF, API throttling, and per-source-IP rate limits that protects the Generate_API from cost amplification and bot traffic.
- **Operator** — A human with AWS credentials for this account who can invoke the Scheduler's generation pipeline manually (for backfill / testing).
- **Visitor** — An unauthenticated human loading the Portal in a browser.
- **Target_Region** — The primary AWS region for all cloud resources in this feature. Pinned to `us-east-1` per user decision.
- **Default_Credential_Chain** — The AWS SDK default credential provider chain (environment, shared config, IAM role, etc.) as referenced by the workspace tech steering.

## Requirements

### Requirement 1: Report persistence shape and identity

**User Story:** As a Visitor, I want the Portal to show exactly the same Report fields and ordering after the cloud migration as it does today, so that the UX does not regress.

#### Acceptance Criteria

1. THE Report_Store SHALL persist each Report with the fields `id`, `title`, `slug`, `generatedAt`, `prompt`, and `body`, where `id`, `title`, `slug`, `generatedAt`, and `prompt` match the `ReportMetadataSchema` in `src/wireBackend/types.ts` and `body` is the Markdown content with the YAML front-matter block stripped.
2. THE Report_Store SHALL enforce uniqueness of `id` across all persisted Reports.
3. THE Report_Store SHALL enforce uniqueness of `slug` across all persisted Reports.
4. WHEN a Generation_Runner attempts to persist a Report whose `id` or `slug` collides with an existing Report, THE Generation_Runner SHALL reject the persistence attempt with a distinguishable collision error and SHALL NOT overwrite the existing Report.
5. THE Report_Store SHALL persist `generatedAt` as an ISO-8601 UTC timestamp matching the regex `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$`.
6. THE Report_Store SHALL persist `slug` as a value matching the regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` with length between 1 and 80 characters inclusive.

### Requirement 2: Read paths consumed by the Portal

**User Story:** As a Visitor, I want the Portal's sidebar and landing route to work against the cloud backend unchanged, so that I see the archive and the latest Report without extra clicks.

#### Acceptance Criteria

1. THE Read_API SHALL expose a list operation that returns every persisted Report's metadata (`id`, `title`, `slug`, `generatedAt`, `prompt`) and SHALL NOT include the `body` in the list response.
2. THE Read_API SHALL order the list response by `generatedAt` descending, so the most recently generated Report appears first.
3. THE Read_API SHALL expose a get-by-slug operation that returns a Report's full `ReportPayload` (metadata plus `body`).
4. THE Read_API SHALL expose a get-latest operation that returns the Report with the greatest `generatedAt` value, equivalent to the first element of the list operation's response.
5. IF a get-by-slug request names a slug not present in the Report_Store, THEN THE Read_API SHALL respond with an HTTP status that the existing `staticBackend`/`generationClient` logic maps to `NOT_FOUND` (today: HTTP 404).
6. IF the Report_Store is unreachable, THEN THE Read_API SHALL respond with HTTP 503 and a structured error body whose `error.code` is `STORE_UNREACHABLE`, which the existing client logic maps to `DATA_SOURCE_UNAVAILABLE`.
7. IF the Report_Store responds but returns data that fails `ReportMetadataSchema` validation, THEN THE Read_API SHALL respond with HTTP 502 and a structured error body whose `error.code` is `STORE_MALFORMED`, which the existing client logic maps to `DATA_SOURCE_UNAVAILABLE`.
8. THE Read_API SHALL return JSON payloads whose shapes validate against `ReportMetadataSchema` (for list and metadata portions) without requiring changes to the schema.

### Requirement 3: Portal integration with the cloud Read_API

**User Story:** As a Portal maintainer, I want the cloud migration to be confined to `src/wireBackend/`, so that feature components keep consuming the same `BackendInterface`.

#### Acceptance Criteria

1. THE Portal SHALL continue to consume Reports exclusively through the `BackendInterface` defined in `src/wireBackend/types.ts`.
2. THE Portal SHALL replace the static-asset read path (`/reports/index.json`, `/reports/<slug>.md`) with calls to the Read_API without modifying any feature component outside `src/wireBackend/`.
3. THE Portal SHALL continue to return the same four `BackendErrorCode` values (`NOT_FOUND`, `DATA_SOURCE_UNAVAILABLE`, `GENERATION_IN_PROGRESS`, `GENERATION_FAILED`) for Read_API and Generate_API failures.
4. WHEN the cloud deployment is active, THE Portal SHALL NOT require `hacker-news-portal/public/reports/` or `index.json` to exist at runtime for list, get-by-slug, or get-latest to succeed.
5. WHEN the Portal validates a Read_API response, THE Portal SHALL validate it with Zod against `ReportMetadataSchema` before surfacing it to UI code.

### Requirement 4: Manual generation trigger from the Portal

**User Story:** As a Visitor, I want to click the Generate button and have a new Report appear in the archive when it succeeds, so that the behavior I see today continues to work against the cloud backend.

#### Acceptance Criteria

1. WHEN a Visitor clicks the Generate button in the Portal, THE Portal SHALL issue a `POST` request to the Generate_API.
2. WHEN the Generate_API returns a successful response, THE Portal SHALL extract the `ReportMetadata` from the response body and validate it against `ReportMetadataSchema` before surfacing it.
3. WHEN the Generate_API returns a successful response, THE Portal SHALL advance the generation cache token (per existing `bumpGenerationCacheToken` behavior) so that subsequent list calls bypass any cached response.
4. WHILE a Generation_Run is in progress on the server side, IF the Portal issues a new generation request, THEN THE Generate_API SHALL respond with an HTTP status the client maps to `GENERATION_IN_PROGRESS` (today: HTTP 409).
5. IF the Generate_API returns a non-success HTTP status other than the mapped `GENERATION_IN_PROGRESS` and `GENERATION_FAILED` statuses, or is unreachable from the browser (network error, timeout, malformed response), THEN THE Portal SHALL surface `DATA_SOURCE_UNAVAILABLE` to UI code without writing partial state.
6. IF the Generate_API returns a structured failure response identifying a `GenerationStage`, THEN THE Portal SHALL surface `GENERATION_FAILED` with the same `stage` to UI code.

### Requirement 5: Scheduled daily generation

**User Story:** As the product owner, I want a new Report to be generated automatically every day, so that the archive stays fresh without human intervention.

#### Acceptance Criteria

1. THE Scheduler SHALL fire the Generation_Runner once per calendar day at 21:00:00 UTC.
2. THE Scheduler SHALL operate independently of the Portal runtime and SHALL NOT require the Portal to be loaded in any browser for the scheduled run to occur.
3. WHEN a Schedule_Slot fires, THE Generation_Runner SHALL execute using the Default_Credential_Chain and SHALL NOT read secrets from environment variables set by the Portal.
4. THE Scheduler SHALL record an observability event (structured log or metric) for each Schedule_Slot containing at least the `runId`, the firing timestamp, and the terminal state (`completed`, `failed`, or `skipped`).
5. THE Scheduler SHALL preserve the existing Generation_Runner pipeline stages (`sentiment`, `title`, `titleValidation`, `slugResolution`, `persist`, `reindex`) as defined in `GenerationStage`.

### Requirement 6: Scheduled run idempotency

**User Story:** As an operator, I want at most one Report produced per scheduled day even if the scheduler, retry logic, or a manual invocation overlap, so that the archive does not gain duplicate daily entries.

#### Acceptance Criteria

1. WHEN the Scheduler fires for a Schedule_Slot that has already produced a successfully persisted Report, THE Scheduler SHALL skip invoking the Generation_Runner and SHALL record the skip in the observability event for that slot.
2. WHILE a Generation_Run is executing for a given Schedule_Slot, IF another scheduled or operator-initiated run attempts to start for the same Schedule_Slot, THEN THE Scheduler SHALL refuse the second start with a distinguishable "already running" signal and SHALL NOT start a parallel Generation_Runner.
3. WHILE a Visitor-initiated Generation_Run is executing, IF a scheduled Generation_Run attempts to start, THEN THE Scheduler SHALL refuse the scheduled start with a distinguishable "already running" signal and SHALL NOT start a parallel Generation_Runner.
4. IF a scheduled Generation_Run fails before persistence, THEN the Schedule_Slot SHALL be considered not-yet-produced for the purposes of criterion 6.1, so that a retry or operator re-invocation for that same slot may proceed.

### Requirement 7: Scheduled run failure handling and retry

**User Story:** As an operator, I want the scheduled run to recover from transient failures on its own and alert me on sustained failures, so that a single bad Bedrock call does not silently skip a day.

#### Acceptance Criteria

1. IF a scheduled Generation_Run fails at any stage before persistence, THEN THE Scheduler SHALL retry the Generation_Run at most 2 additional times within 60 minutes of the Schedule_Slot firing time.
2. WHEN all scheduled retries for a Schedule_Slot have been exhausted without success, THE Scheduler SHALL record a structured failure event identifying the `runId`, the final `GenerationStage`, and the underlying error class.
3. IF a scheduled Generation_Run fails after successfully persisting a Report (for example, in the `reindex` stage), THEN THE Scheduler SHALL NOT retry persistence and SHALL NOT retry the post-persist stage, and SHALL record the failure as a post-persist event while leaving the persisted Report intact.
4. THE Scheduler SHALL expose its structured failure events through the AWS-native observability surface (CloudWatch Logs and/or CloudWatch Metrics) configured in Target_Region.

### Requirement 8: Operator-initiated scheduled runs

**User Story:** As an operator, I want to invoke the same scheduled-generation pipeline manually from AWS (CLI or console) for backfill and testing, so that I do not have to rely on the portal button or wait for 21:00 UTC.

#### Acceptance Criteria

1. THE Scheduler SHALL expose an operator-only invocation path on the AWS side that triggers the Generation_Runner using the same configuration (model, credentials, persistence target) as the daily scheduled run.
2. WHEN an Operator invokes the scheduled-generation pipeline, THE Scheduler SHALL treat the invocation as a Generation_Run with a distinct `runId` and SHALL subject it to the same idempotency rules in Requirement 6.
3. THE Scheduler SHALL restrict the operator-only invocation path with IAM policies so that invocation is granted only to principals explicitly authorized in the target AWS account, and SHALL NOT expose the operator-only path on the public internet.
4. WHEN an operator-initiated run completes, THE Scheduler SHALL record the same observability event shape as a daily scheduled run (per Requirement 5.4), tagged with an `origin` field distinguishing `scheduled`, `operator`, and `visitor` runs.

### Requirement 9: Generate_API security posture

**User Story:** As the product owner, I want the public Generate button to be protected from bots and cost amplification without introducing user-visible friction, so that I do not pay for runaway Bedrock usage.

#### Acceptance Criteria

1. THE Generate_API SHALL be served exclusively over HTTPS.
2. THE Abuse_Control SHALL enforce a per-source-IP rate limit on the Generate_API sized to permit normal Visitor demonstration use and block bot-scale traffic.
3. THE Abuse_Control SHALL enforce an absolute global rate limit on the Generate_API that bounds the maximum number of Generation_Runs the system can accept per day.
4. IF the Abuse_Control's per-source-IP limit or global limit is exceeded, THEN THE Generate_API SHALL respond with an HTTP status the client can present as a user-facing "try again later" state, distinguishable from `GENERATION_IN_PROGRESS` and `GENERATION_FAILED`.
5. THE Abuse_Control SHALL apply AWS WAF managed rule groups appropriate for blocking common bot signatures in front of the Generate_API.
6. THE Abuse_Control SHALL NOT require Visitors to solve a CAPTCHA, log in, or present a shared secret in order to trigger a Generation_Run under normal demonstration traffic.
7. THE Abuse_Control SHALL emit observability events (metrics and/or logs) counting blocked and throttled requests so that sustained abuse is visible to Operators.

### Requirement 10: Frontend hosting over HTTPS

**User Story:** As a Visitor, I want to load the Portal over a secure connection from a predictable URL, so that the talk audience sees a production-quality site.

#### Acceptance Criteria

1. THE Portal SHALL be served over HTTPS with a TLS certificate issued by a publicly trusted certificate authority (AWS Certificate Manager is acceptable).
2. THE Portal SHALL be reachable at a stable DNS name in Target_Region.
3. THE Portal SHALL redirect HTTP requests to HTTPS.
4. THE Portal's HTTPS responses SHALL include the `Strict-Transport-Security` header with a `max-age` of at least 15768000 seconds (six months).
5. THE Portal's HTTPS responses SHALL include a `Content-Security-Policy` header restricting script, style, and connect sources to the Portal's origin and, where required, the Read_API and Generate_API origins; `unsafe-eval` SHALL NOT be permitted.
6. THE Portal SHALL NOT expose any AWS account identifiers, credentials, or private resource identifiers in its built assets or runtime HTML.

### Requirement 11: Credential and secret handling

**User Story:** As the workspace steward, I want every cloud component to obtain AWS credentials through the default credential chain and to pin the Claude Haiku 4.5 inference profile, so that the deployment stays within the steering rules.

#### Acceptance Criteria

1. THE Generation_Runner SHALL authenticate to AWS services using the Default_Credential_Chain exclusively and SHALL NOT read AWS access keys, secret keys, or session tokens from process environment variables managed by application code, even as a fallback when the Default_Credential_Chain is unavailable.
2. THE Scheduler SHALL authenticate to AWS services using the Default_Credential_Chain exclusively and SHALL NOT read AWS access keys, secret keys, or session tokens from process environment variables managed by application code, even as a fallback when the Default_Credential_Chain is unavailable.
3. THE Generation_Runner SHALL invoke Amazon Bedrock using the inference profile identifier `global.anthropic.claude-haiku-4-5-20251001-v1:0` and SHALL NOT substitute any other model identifier at runtime.
4. THE cloud deployment SHALL NOT hardcode AWS account IDs, client IDs, client secrets, API keys, or resource ARNs in source files committed to the repository.
5. IF any component requires a non-AWS secret at runtime, THEN THE component SHALL retrieve that secret from AWS Secrets Manager or AWS Systems Manager Parameter Store (SecureString) resolved at runtime through the Default_Credential_Chain.
6. THE Generate_API, Read_API, Scheduler, and Generation_Runner SHALL each run with IAM role permissions scoped to exactly the Report_Store items, Bedrock model invocations, secret parameters, and log groups they require, with no account-wide wildcards such as `*` on resources they do not own.

### Requirement 12: Backfill of existing local reports

**User Story:** As the product owner, I want the four existing local Reports under `strands-agent-typescript/reports/` to appear in the Portal's archive after the cloud cut-over, so that the archive does not lose history.

#### Acceptance Criteria

1. WHEN the cloud deployment is first promoted to a state where the Read_API is live, THE cloud deployment SHALL ensure that every Report currently present under `strands-agent-typescript/reports/` is persisted in the Report_Store exactly once, keyed by its existing `id` and `slug`.
2. THE backfill SHALL preserve each existing Report's `id`, `title`, `slug`, `generatedAt`, `prompt`, and `body` (front-matter-stripped) byte-for-byte relative to the parsed front-matter and Markdown content on disk.
3. IF a backfill attempt encounters a Report whose parsed front-matter fails `ReportMetadataSchema` validation, THEN THE backfill SHALL skip that Report and record a structured error identifying the file name and the Zod failure, without aborting the backfill of the remaining Reports.
4. THE backfill SHALL be idempotent: when invoked against a Report_Store that already contains every Report currently present under `strands-agent-typescript/reports/` keyed by `id` and `slug`, THE backfill SHALL skip all persistence operations for those Reports, SHALL NOT create duplicate Reports, and SHALL NOT mutate fields of existing Reports.
5. WHEN the backfill completes, THE Read_API's list operation SHALL return at least the set of successfully backfilled Reports in the ordering defined by Requirement 2.2.

### Requirement 13: Regional placement

**User Story:** As the product owner, I want all cloud resources to live in a single region I control, so that costs, latency, and data residency are predictable.

#### Acceptance Criteria

1. THE Report_Store, Scheduler, Generation_Runner, Read_API, Generate_API, Abuse_Control, and frontend origin SHALL be provisioned in Target_Region (`us-east-1`).
2. WHERE the frontend is distributed through a CDN, THE CDN origin SHALL point at an AWS endpoint in Target_Region.
3. THE Generation_Runner SHALL invoke Bedrock through an endpoint compatible with the global cross-Region inference profile identifier defined in Requirement 11.3.
4. IF a required AWS service is unavailable in Target_Region, THEN THE cloud deployment SHALL NOT provision that service outside Target_Region until the design document and this requirements document have been updated to record the deviation, the affected service, and the alternative region.
5. THE cloud deployment SHALL provision the CloudWatch Logs log groups, CloudWatch Metrics, and any AWS Secrets Manager or Systems Manager Parameter Store parameters used by the Scheduler, Generation_Runner, Read_API, or Generate_API exclusively in Target_Region.

### Requirement 14: Read_API performance and availability

**User Story:** As a Visitor, I want the archive and Report views to load quickly and reliably, so that the Portal feels production-grade.

#### Acceptance Criteria

1. WHEN the Read_API receives a list request under normal load, THE Read_API SHALL return a response within 500 milliseconds measured at the API origin in Target_Region for the 95th percentile of requests.
2. WHEN the Read_API receives a get-by-slug request under normal load, THE Read_API SHALL return a response within 500 milliseconds measured at the API origin in Target_Region for the 95th percentile of requests.
3. THE Read_API SHALL target a monthly availability of at least 99.5 percent measured from the API origin in Target_Region.
4. THE Portal's static assets SHALL be served with HTTP caching headers permitting caching by a CDN edge for at least 60 seconds.

### Requirement 15: Generate_API performance expectations

**User Story:** As a Visitor, I want the Portal to give me feedback quickly after I click Generate, so that I know the click was accepted even though the underlying run takes longer.

#### Acceptance Criteria

1. WHEN a Visitor's `POST` to the Generate_API is accepted, THE Generate_API SHALL return an HTTP response acknowledging acceptance within 2000 milliseconds measured at the API origin in Target_Region for the 95th percentile of accepted requests.
2. THE Generate_API SHALL bound the maximum total duration of a single Generation_Run at 300 seconds, after which the run SHALL be marked failed with a distinguishable `stage` value that UI code maps to `GENERATION_FAILED`.
3. WHILE a Generation_Run is executing, IF the Portal polls the Generate_API for run state, THEN THE Generate_API SHALL return the current `GenerationState` (as defined in `src/wireBackend/types.ts`) within 500 milliseconds measured at the API origin for the 95th percentile of polls.

### Requirement 16: Cost boundaries

**User Story:** As the product owner, I want the cloud deployment to stay within a predictable monthly cost envelope even under bursty public access, so that the project does not accumulate surprise charges.

#### Acceptance Criteria

1. THE Abuse_Control SHALL enforce a daily cap on the number of Generation_Runs such that the cap multiplied by a single run's bounded Bedrock usage cost stays under a ceiling the Operator can configure.
2. THE Report_Store SHALL be provisioned in a mode whose billed-capacity footprint does not grow with idle time (for example, DynamoDB on-demand capacity).
3. THE Scheduler SHALL NOT maintain always-on compute whose idle cost exceeds the cost of the scheduled Generation_Runs themselves.
4. THE cloud deployment SHALL emit a billing observability signal (AWS Budgets alarm or equivalent) that alerts Operators before monthly spend exceeds a configurable threshold.

### Requirement 17: Observability coverage

**User Story:** As an operator, I want to see what the Scheduler and the APIs are doing, so that I can diagnose a broken run or abusive traffic.

#### Acceptance Criteria

1. THE Scheduler, Generation_Runner, Read_API, and Generate_API SHALL emit structured logs in Target_Region's CloudWatch Logs, each log entry including at least the `runId` where applicable and the component name.
2. THE Generation_Runner SHALL emit a metric for every completed Generation_Run tagged by terminal state (`completed` or `failed`) and by `origin` (`scheduled`, `operator`, or `visitor`).
3. THE Generate_API SHALL emit metrics for accepted, rate-limited, and rejected generation requests.
4. THE Read_API SHALL emit metrics for list, get-by-slug, and get-latest request counts and latencies.
5. THE cloud deployment SHALL NOT log AWS access keys, secret keys, or session tokens under any circumstance, SHALL NOT log Bedrock raw responses containing credential material, and SHALL NOT log secrets retrieved from Secrets Manager or Parameter Store.

### Requirement 18: Bedrock model selection validation

**User Story:** As the workspace steward, I want the runtime to fail fast if someone accidentally swaps the Bedrock model identifier, so that the "Claude Haiku 4.5 only" rule is enforced in production as well as in code review.

#### Acceptance Criteria

1. WHEN the Generation_Runner initializes its Bedrock client, THE Generation_Runner SHALL read the model identifier from a named constant defined in source and SHALL NOT compute or mutate the identifier at runtime.
2. IF the resolved model identifier at Generation_Runner startup is not exactly `global.anthropic.claude-haiku-4-5-20251001-v1:0`, THEN THE Generation_Runner SHALL refuse to start and SHALL emit a structured error identifying the mismatch.

### Requirement 19: Infrastructure-as-code and repeatability

**User Story:** As the workspace steward, I want the cloud topology to be reproducible from source, so that the deployment is reviewable and recoverable without console clicks.

#### Acceptance Criteria

1. THE cloud deployment SHALL be defined by infrastructure-as-code artifacts committed to the repository.
2. THE infrastructure-as-code artifacts SHALL NOT contain hardcoded AWS account IDs, resource ARNs, or secret values.
3. WHEN the infrastructure-as-code is applied against an empty AWS account in Target_Region, THE cloud deployment SHALL provision the Report_Store, Scheduler, Generation_Runner, Read_API, Generate_API, frontend hosting, and observability resources required by Requirements 1 through 18 without manual console steps.
4. WHILE the cloud deployment is fully provisioned, THE cloud deployment SHALL NOT require manual AWS console steps for ongoing operation, including scheduled runs, operator-initiated runs, and Portal traffic serving.
5. THE infrastructure-as-code SHALL express the 21:00:00 UTC daily schedule in Requirement 5.1 as a declarative schedule expression, SHALL NOT compute the schedule at deploy time, and SHALL NOT embed a timezone other than UTC in the expression.
