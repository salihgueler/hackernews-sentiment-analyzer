# Requirements Document

## Introduction

The Hacker News Portal is a web frontend that surfaces the sentiment reports produced by the existing Strands-based Hacker News sentiment analyzer. Visitors land on the most recent report, browse the full archive through a sidebar, navigate between reports via slug-based URLs, and trigger a new generation on demand. A second Strands agent (the Title Agent) proposes a short title and URL-safe slug for each report. Reports continue to live as Markdown files with YAML front-matter on disk; a pre-build script parses the front-matter, emits a `reports/index.json` manifest, and copies the Markdown files into the Vite `public/` folder so the frontend can serve them as static assets in both dev and build. The scope of this spec is the first two delivery phases: scaffolding the `hacker-news-portal` project, and a frontend-only slice that reads real reports through a `wireBackend` data-layer module whose interface matches the future production backend.

## Glossary

- **Portal**: The React + Vite + TypeScript web frontend scaffolded under `hacker-news-portal/`.
- **Report**: A single Hacker News sentiment analysis stored as a Markdown file with YAML front-matter.
- **Report_Metadata**: The structured fields `id`, `title`, `slug`, `generatedAt`, and `prompt` extracted from a Report's YAML front-matter.
- **Report_Index**: The `index.json` manifest that lists every Report's metadata in reverse-chronological order by `generatedAt`.
- **Sentiment_Agent**: The existing Strands-based Hacker News sentiment analyzer that produces Report Markdown content. Reused unchanged.
- **Title_Agent**: A Strands agent introduced by this feature that proposes a `{ title, slug }` pair for a Report.
- **Data_Layer**: The `wireBackend` module that exposes the Report read and generate interface the Portal consumes. In Phase 2 it reads from static assets; its signatures match the future production backend.
- **Sidebar**: The Portal navigation region that lists every Report.
- **Markdown_Renderer**: The Portal subsystem that renders Report Markdown content into safe HTML.
- **Prebuild_Script**: The Node.js script that parses Report front-matter, emits the Report_Index, and copies Report files into `public/reports/` before Vite dev and build.
- **Generation_Run**: A single invocation that asks the Sentiment_Agent and Title_Agent to produce and persist a new Report.
- **Visitor**: A person using the Portal in a web browser.

## Requirements

### Requirement 1: View the latest sentiment report

**User Story:** As a Visitor, I want the newest sentiment report rendered when I open the site, so that I can read today's analysis without navigating further.

#### Acceptance Criteria

1. WHEN a Visitor navigates to the root path `/`, THE Portal SHALL render, in the main view, the Report whose `generatedAt` value is the largest in the Report_Index, displaying that Report's title, its `generatedAt` timestamp, and its complete body.
2. WHEN the Portal renders a Report, THE Markdown_Renderer SHALL render the Report body (the Markdown content that follows the YAML front-matter block) into HTML using the pipeline defined in Requirement 10.
3. IF the Markdown_Renderer fails to render a Report body, THEN THE Portal SHALL display the Report body as unformatted raw Markdown text and SHALL show a user-visible indication that the Report could not be rendered.
4. IF the Report_Index contains zero Report entries, THEN THE Portal SHALL display a user-visible empty-state message in the main view indicating that no reports are available yet, and SHALL NOT attempt to render a Report.
5. IF the selected Report's Markdown file cannot be fetched or read, THEN THE Portal SHALL display a user-visible error message in the main view indicating that the Report could not be loaded, and SHALL keep the Sidebar rendered.

### Requirement 2: Browse the archive of past reports

**User Story:** As a Visitor, I want a sidebar listing every past report with its title and date, so that I can browse the archive at a glance.

#### Acceptance Criteria

1. WHEN a Visitor navigates to the root path `/`, THE Portal SHALL render the Sidebar containing exactly one entry for every Report listed in the Report_Index.
2. THE Sidebar SHALL order entries by `generatedAt` in reverse-chronological order (newest first), comparing `generatedAt` values as ISO-8601 timestamps.
3. IF two or more Reports share the same `generatedAt` value, THEN THE Sidebar SHALL order those Reports by `slug` in case-insensitive ascending lexicographic order as a secondary sort criterion.
4. THE Sidebar SHALL display, for every entry, the Report's title and the Report's `generatedAt` date rendered in `YYYY-MM-DD` format.
5. WHILE the Report_Index contains zero Reports, THE Sidebar SHALL display a placeholder message indicating that no reports are available.
6. IF the Report_Index cannot be loaded or parsed, THEN THE Portal SHALL render the Sidebar with an error indication that the archive is unavailable and offer the Visitor a retry action.

### Requirement 3: Navigate between reports

**User Story:** As a Visitor, I want to click any report in the sidebar and jump straight to it, so that I can compare reports quickly.

#### Acceptance Criteria

1. WHEN a Visitor activates a Sidebar entry with a mouse click or touch tap, THE Portal SHALL navigate to `/reports/{slug}` for the selected Report and render that Report's complete content in the main view without a full page reload, completing the render within 500 milliseconds of activation.
2. WHEN a Visitor focuses a Sidebar entry and presses the Enter key or the Space key, THE Portal SHALL navigate to `/reports/{slug}` for the selected Report and render that Report's complete content in the main view without a full page reload, completing the render within 500 milliseconds of activation.
3. WHEN a Visitor navigates directly to `/reports/{slug}` for a slug that exists in the Report_Index, THE Portal SHALL render the Report's complete content in the main view and SHALL render the Sidebar alongside it.
4. IF a Visitor navigates to `/reports/{slug}` for a slug that is not present in the Report_Index, THEN THE Portal SHALL display a not-found message in the main view, keep the Sidebar rendered, and SHALL NOT render any Report content in the main view.
5. WHILE a Visitor is at the path `/reports/{slug}` for a Report that exists in the Report_Index, THE Sidebar SHALL mark that Report's entry as the active entry so the Visitor can identify which Report is currently displayed.
6. WHEN a Visitor uses the browser's Back or Forward controls to arrive at `/` or at `/reports/{slug}`, THE Portal SHALL render the Report (or landing view) corresponding to the resulting URL without a full page reload.

### Requirement 4: Display a fallback name when the report title is missing

**User Story:** As a Visitor, I want every report to have a readable name, so that the sidebar stays usable even for reports that lack a title.

#### Acceptance Criteria

1. IF a Report's YAML front-matter has no `title` field or has a `title` field whose value is the empty string, THEN THE Portal SHALL display the fallback title `HN Sentiment — {generatedAt}` for that Report in the Sidebar and in the rendered Report view, where `{generatedAt}` is the verbatim ISO-8601 UTC string from the Report's front-matter.
2. THE Portal SHALL derive the fallback title so that, for the same `generatedAt` value (and the same `slug` when disambiguation is required), the displayed fallback title is byte-identical across every render.
3. IF two or more Reports without a `title` share the same `generatedAt` value, THEN THE Portal SHALL append the Report's `slug` as a disambiguator to each fallback title in the form `HN Sentiment — {generatedAt} ({slug})` in the Sidebar and in the rendered Report view.
4. IF a Report has neither a `title` value nor a `generatedAt` value, THEN THE Portal SHALL display the fallback title `HN Sentiment — {slug}` for that Report in the Sidebar and in the rendered Report view.

### Requirement 5: Generate a new report on demand

**User Story:** As a Visitor, I want to click a button to generate a new report, so that I can trigger a fresh analysis without leaving the Portal.

#### Acceptance Criteria

1. THE Portal SHALL render an HTML button control labelled `Generate Report` on the landing path `/` and on every Report view at `/reports/{slug}`.
2. WHEN a Visitor activates the `Generate Report` control by pointer click, touch tap, or by pressing the Enter or Space key while the control has focus, THE Portal SHALL start a Generation_Run through the Data_Layer and disable the `Generate Report` control until the Generation_Run settles with either success or failure.
3. WHILE a Generation_Run is in progress, THE Portal SHALL display a visible progress indicator with an accessible name of "Generating report" within 200 milliseconds of activation until the Generation_Run settles.
4. WHEN a Generation_Run completes successfully, THE Portal SHALL remove the progress indicator, re-enable the `Generate Report` control, navigate to `/reports/{slug}` for the newly produced Report, and render that Report within 1000 milliseconds of completion.
5. WHILE a Generation_Run is pending, in progress, has not yet been attempted, or has failed, THE Portal SHALL continue to render existing Reports from the Report_Index and SHALL keep every Sidebar entry interactive for navigation.
6. IF the Data_Layer fails to start or complete a Generation_Run, THEN THE Portal SHALL display a persistent user-facing error message that includes the failure reason returned by the Data_Layer and SHALL re-enable the `Generate Report` control within 1000 milliseconds of the failure.

### Requirement 6: Reject concurrent generations

**User Story:** As a Visitor, I want the Portal to stop me from launching a second generation while one is in flight, so that I don't waste compute or duplicate reports.

#### Acceptance Criteria

1. IF a Generation_Run is in progress (its status is `running` and it has not yet reached a terminal state of `completed`, `failed`, or `cancelled`) when a new generate request is received by the Data_Layer, THEN THE Data_Layer SHALL reject the new request and return a structured error containing the code `GENERATION_IN_PROGRESS`.
2. IF the Data_Layer rejects a concurrent generate request with `GENERATION_IN_PROGRESS`, THEN THE Data_Layer SHALL preserve the existing Generation_Run and its current status without interruption, cancellation, or state change.
3. WHEN the Data_Layer returns a `GENERATION_IN_PROGRESS` error to the Portal, THE Portal SHALL display a user-facing message indicating that a generation is already running within 500 milliseconds of receiving the error.
4. WHILE the in-progress Generation_Run has not reached a terminal state of `completed`, `failed`, or `cancelled`, THE Portal SHALL keep the `GENERATION_IN_PROGRESS` message visible unless the user explicitly dismisses it.

### Requirement 7: Recover from a failed generation

**User Story:** As a Visitor, I want the Portal to survive a failed generation attempt, so that existing reports remain available and I understand what went wrong.

#### Acceptance Criteria

1. IF a Generation_Run fails at any stage (Sentiment_Agent invocation, Title_Agent invocation, Title_Agent output validation, or Report persistence), THEN THE Data_Layer SHALL log a structured failure record including the Generation_Run identifier, the failing stage name, and the underlying error message.
2. IF a Generation_Run fails, THEN THE Data_Layer SHALL leave every previously persisted Report and the Report_Index unchanged and SHALL NOT write a new Report file or a new Report_Index entry for the failed run.
3. IF a Generation_Run fails, THEN THE Portal SHALL display a user-facing error notification identifying the failing Generation_Run and its failure category within 2 seconds of receiving the failure from the Data_Layer.
4. WHEN the Portal displays the failure notification for a Generation_Run, THE Portal SHALL re-enable the `Generate Report` control.

### Requirement 8: Persist reports in a consistent file format

**User Story:** As a maintainer, I want every report stored in a predictable Markdown-with-front-matter format, so that the Portal and future tooling can parse it reliably.

#### Acceptance Criteria

1. THE Sentiment_Agent SHALL persist every Report as a file with a `.md` extension in the source `reports/` folder, using a filename that is unique across all previously persisted Reports in that folder.
2. THE Sentiment_Agent SHALL include a YAML front-matter block as the first content of every Report, delimited by a line containing exactly `---` immediately above and immediately below the block, and containing non-empty values for each of the fields `id`, `title`, `slug`, `generatedAt`, and `prompt`.
3. THE Sentiment_Agent SHALL format the `generatedAt` field as an ISO-8601 timestamp in UTC with at least second-level precision and a trailing `Z` suffix indicating the UTC offset.
4. THE Sentiment_Agent SHALL populate the `slug` field from the Title_Agent output using only lowercase ASCII letters, digits, and hyphen separators, with a total length between 1 and 80 characters inclusive.
5. THE Sentiment_Agent SHALL assign every Report an `id` value that is unique across all Reports persisted in the source `reports/` folder.
6. IF persisting a Report to the source `reports/` folder fails, THEN THE Sentiment_Agent SHALL surface an error indicating the persistence failure and SHALL NOT leave a partially written Report file in the folder.

### Requirement 9: Maintain the report index

**User Story:** As a developer, I want a single source of truth for the list of reports, so that the Portal does not have to scan the filesystem at runtime.

#### Acceptance Criteria

1. WHEN the Prebuild_Script completes, THE Report_Index SHALL contain exactly one Report_Metadata entry (`id`, `title`, `slug`, `generatedAt`, `prompt`) for every Markdown file present in the source `reports/` folder, with no duplicate `id` or `slug` values.
2. THE Report_Index SHALL order entries primarily by `generatedAt` in reverse-chronological order, and SHALL break ties by ordering alphabetically (case-insensitive, ascending) by `slug`.
3. WHEN the Portal loads, THE Portal SHALL fetch the Report_Index from `/reports/index.json` and SHALL use it as the sole source of truth for the set of available Reports without scanning the filesystem at runtime.
4. IF the Report_Index cannot be fetched or fails to parse as a valid JSON array of Report_Metadata entries, THEN THE Portal SHALL display an error state indicating that the report list is unavailable and SHALL render zero Report entries in the Sidebar.
5. IF a Markdown file in the source `reports/` folder is missing any required Report_Metadata field (`id`, `title`, `slug`, `generatedAt`, `prompt`) or contains a `generatedAt` value that is not a valid ISO-8601 timestamp, THEN THE Prebuild_Script SHALL exclude that file from the Report_Index and SHALL emit an error message identifying the offending file.

### Requirement 10: Render Markdown safely

**User Story:** As a Visitor, I want report content rendered as readable HTML that cannot execute injected scripts, so that I can trust the Portal.

#### Acceptance Criteria

1. THE Markdown_Renderer SHALL render GitHub Flavored Markdown tables, fenced code blocks, and autolinks from Report content into HTML that the Portal inserts into the document.
2. THE Markdown_Renderer SHALL strip the HTML elements `script`, `style`, `iframe`, `object`, `embed`, `link`, `meta`, and `form`, and every attribute whose name begins with `on` (event handlers), from Report content before rendering, and SHALL escape any remaining raw HTML in Report content as visible text so no raw HTML tag is executed or interpreted by the DOM.
3. WHEN a fenced code block in Report content declares a language identifier that the Markdown_Renderer recognizes, THE Markdown_Renderer SHALL render that block with syntax highlighting for the declared language.
4. IF a fenced code block in Report content declares no language identifier or declares a language identifier that the Markdown_Renderer does not recognize, THEN THE Markdown_Renderer SHALL render that block as plain, unhighlighted monospaced text preserving the original line structure.

### Requirement 11: Name reports through the Title Agent

**User Story:** As a Visitor, I want reports to have short human titles and clean URLs, so that the archive is easy to scan and share.

#### Acceptance Criteria

1. WHEN a Generation_Run produces a new Report, THE Title_Agent SHALL return an object containing a non-empty `title` string of length between 1 and 80 characters inclusive and a non-empty `slug` string.
2. WHEN the Title_Agent output is received, THE Data_Layer SHALL validate the output against a Zod schema before persisting the Report.
3. THE Title_Agent SHALL produce a `slug` matching the regular expression `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase ASCII letters, digits, and single hyphen separators, with no leading, trailing, or consecutive hyphens).
4. THE Title_Agent SHALL produce a `slug` whose length is between 1 and 48 characters inclusive.
5. IF the Title_Agent output fails Zod validation, THEN THE Data_Layer SHALL discard the output, SHALL NOT persist the Report, and SHALL treat the Generation_Run as failed per Requirement 7.
6. IF the Title_Agent proposes a `slug` that equals the `slug` of an existing Report in the Report_Index, THEN THE Data_Layer SHALL take the Title_Agent's originally proposed `slug` as the base and append the smallest numeric suffix of the form `-2`, `-3`, …, up to and including `-999`, that produces a `slug` not yet present in the Report_Index, and SHALL persist the new Report under that suffixed `slug`.
7. IF every suffix from `-2` through `-999` inclusive is already present in the Report_Index for the base `slug`, THEN THE Data_Layer SHALL treat the Generation_Run as failed per Requirement 7.

### Requirement 12: Expose a backend-shaped data layer

**User Story:** As a developer, I want the Portal to talk to a module whose interface matches the future production backend, so that swapping the implementation later does not require changes in the UI.

#### Acceptance Criteria

1. THE Data_Layer SHALL be implemented as a module named `wireBackend` inside the Portal project, with its public functions and types exposed as named exports from a single entry module.
2. WHEN a caller invokes the list function exposed by the `wireBackend` module, THE Data_Layer SHALL return a Promise that resolves with an array of Report_Metadata entries sourced from the Report_Index, preserving the order defined by the Report_Index.
3. WHEN a caller invokes the single-report function of the `wireBackend` module with a `slug` value that matches an entry in the Report_Index, THE Data_Layer SHALL return a Promise that resolves with both the full Markdown content and the Report_Metadata of the matching Report.
4. WHEN a caller invokes the start-generation function of the `wireBackend` module and no Generation_Run is currently in progress, THE Data_Layer SHALL return a Promise that resolves, once the Generation_Run completes successfully, with the Report_Metadata of the newly produced Report.
5. THE Data_Layer SHALL define its public interface as exported TypeScript types covering the list, single-report, and start-generation functions, such that a future production backend implementation can satisfy the same exported types and Portal consumers depend only on those types rather than on the local implementation.
6. IF the single-report function is invoked with a `slug` that does not match any entry in the Report_Index, THEN THE Data_Layer SHALL reject the returned Promise with a structured error indicating the requested Report was not found, without returning partial content or metadata.
7. IF the list function or the single-report function cannot read or parse its underlying Report_Index or Report source, THEN THE Data_Layer SHALL reject the returned Promise with a structured error indicating the data source is unavailable, without returning partial or stale data.
8. IF the start-generation function is invoked while a Generation_Run is already in progress, THEN THE Data_Layer SHALL reject the returned Promise with a structured error indicating that a Generation_Run is already active, without starting a second concurrent run.

### Requirement 13: Prepare reports for static hosting during build

**User Story:** As a developer, I want the repository's existing reports served by Vite as static assets, so that the Portal works in dev and production without a separate server.

#### Acceptance Criteria

1. THE Prebuild_Script SHALL parse the YAML front-matter of every file with a `.md` extension located at the top level of the source `reports/` folder.
2. THE Prebuild_Script SHALL write the Report_Index to `public/reports/index.json` as the Report_Metadata array defined in Requirement 9, creating the `public/reports/` directory if it does not already exist.
3. THE Prebuild_Script SHALL copy every valid Report Markdown file from the source `reports/` folder into `public/reports/`, naming each copied file `<slug>.md` using the `slug` value from the Report's YAML front-matter.
4. WHEN the Vite development server is started, THE Prebuild_Script SHALL run to completion before the dev server begins serving requests, without an enforced timeout.
5. WHEN a Vite production build is started, THE Prebuild_Script SHALL run to completion before Vite emits the production bundle, without an enforced timeout.
6. IF the Prebuild_Script encounters a Report file whose front-matter is missing any of `id`, `slug`, or `generatedAt`, THEN THE Prebuild_Script SHALL exit with a non-zero status, log the path of the rejected Report file, and both the Vite development server startup and the Vite production build SHALL fail.
7. IF the Prebuild_Script encounters a Report file whose YAML front-matter cannot be parsed, THEN THE Prebuild_Script SHALL exit with a non-zero status and log the path of the offending Report file.
8. IF two or more Report files in the source `reports/` folder share the same `slug` value, THEN THE Prebuild_Script SHALL exit with a non-zero status, log the paths of the colliding Report files, and SHALL NOT copy any of the colliding files into `public/reports/` nor emit a Report_Index.

### Requirement 14: Scaffold the Portal project

**User Story:** As a developer, I want a dedicated project folder for the Portal, so that the frontend is isolated from the existing agent code.

#### Acceptance Criteria

1. THE Portal project SHALL live in a folder named `hacker-news-portal` at the repository root, alongside the existing `strands-agent-typescript/` and `vanilla-agent-python/` folders.
2. THE Portal SHALL be a React application built with Vite and TypeScript, scaffolded from a standard Vite React-TypeScript template.
3. THE Portal SHALL NOT modify any source file inside the existing `strands-agent-typescript/` project, and SHALL access the existing `strands-agent-typescript/reports/` folder for reading only.
4. THE Portal SHALL maintain its own `package.json` at `hacker-news-portal/package.json` declaring its own dependencies and npm scripts, independent of every other project in the repository.
5. THE Portal SHALL maintain its own `tsconfig.json` (or project references rooted under `hacker-news-portal/`) that do not extend or depend on TypeScript configuration files outside the `hacker-news-portal/` folder.
6. THE Portal SHALL contain its own `node_modules/` and build output folders under `hacker-news-portal/`, with no shared `node_modules/` or shared build output with any other project in the repository.
7. WHEN a developer runs `npm install` followed by `npm run build` inside the `hacker-news-portal/` folder on a clean checkout, THE Portal SHALL complete both commands with a zero exit status and produce a build output folder inside `hacker-news-portal/`.

### Requirement 15: Render quickly on a warm cache

**User Story:** As a Visitor, I want the landing page and report views to feel instant on repeat visits, so that browsing the archive stays pleasant.

#### Acceptance Criteria

1. WHEN a Visitor navigates to the root path `/` on a warm local Vite development cache (dev server running, Portal bundle previously loaded by the browser in the current session, and the HTTP cache for `/reports/index.json` and Markdown assets populated), THE Portal SHALL render the Report with the most recent `generatedAt` value in the Report_Index such that the Report main element is visible in the DOM within 500 milliseconds of the navigation initiation event (click, Enter from the address bar, or in-app route change).
2. WHEN a Visitor navigates to `/reports/{slug}` for a Report already present in the Report_Index on a warm local Vite development cache, THE Portal SHALL render that Report such that the Report main element is visible in the DOM within 500 milliseconds of the navigation initiation event.
3. THE 500-millisecond budgets in criteria 1 and 2 SHALL hold at the median of at least 5 consecutive warm-cache navigations on the same machine and browser session.

### Requirement 16: Meet accessibility expectations

**User Story:** As a Visitor using assistive technology or reduced-motion settings, I want the Portal to respect established accessibility practices, so that I can use it comfortably.

#### Acceptance Criteria

1. THE Sidebar SHALL be rendered inside an HTML `<nav>` element that carries a non-empty `aria-label` attribute identifying the navigation's purpose (for example, "Report archive").
2. THE Sidebar SHALL render every Report entry as an HTML anchor (`<a>`) element whose `href` attribute equals `/reports/{slug}` for that Report.
3. WHILE a Visitor is viewing a Report at the path `/reports/{slug}`, THE Sidebar SHALL set `aria-current="page"` on that Report's Sidebar entry and SHALL NOT set `aria-current` on any other Sidebar entry.
4. THE Portal SHALL render all text and interactive elements in the default theme with a color contrast ratio of at least 4.5:1 for normal text and at least 3:1 for large text (18pt, or 14pt bold, and larger) and user interface components, in accordance with WCAG 2.1 Level AA.
5. WHERE the Visitor's environment reports `prefers-reduced-motion: reduce`, THE Portal SHALL suppress decorative transitions and animations (such as fade and slide effects) while continuing to display functional progress indicators including the Generate Report progress indicator.

### Requirement 17: Enforce TypeScript strictness

**User Story:** As a maintainer, I want the Portal to compile under the strictest TypeScript settings, so that type errors are caught at build time.

#### Acceptance Criteria

1. THE Portal `tsconfig.json` SHALL enable the TypeScript compiler options `strict`, `noImplicitAny`, `noUnusedLocals`, and `noUnusedParameters`, each set to `true`.
2. THE Portal source code inside `hacker-news-portal/src/` SHALL NOT contain the explicit type `any` on any variable declaration, function parameter, function return value, or exported type, and SHALL NOT rely on implicit `any` inference, excluding generated files, `node_modules/`, and build output directories from this constraint.
3. WHEN the Portal is built with `vite build`, THE Portal SHALL run a TypeScript type check (for example, `tsc -b`) prior to bundling and SHALL report zero TypeScript compiler errors and zero TypeScript compiler warnings from application source.
4. IF the TypeScript type check reports any error or warning, THEN THE `vite build` invocation SHALL exit with a non-zero status and SHALL NOT produce a bundled output.
