# Faust Personal Gallery Design

**Date:** 2026-07-21  
**Status:** Approved for specification review

## 1. Purpose

Faust will become a personal gallery for turning ideas into code without managing a separate repository for every experiment. It must serve two audiences equally well:

- The owner needs a fast, predictable workflow for creating, running, and archiving ideas.
- Visitors need a coherent public site for browsing, understanding, and trying selected work.

Projects may use unrelated technology stacks, including web applications, services, scripts, command-line tools, and AI experiments. The gallery therefore provides a common index and presentation layer without imposing a common runtime on project implementations.

## 2. Product Principles

1. **Independent projects, unified presentation.** Each idea is self-contained; the gallery reads only its declared metadata.
2. **Low-friction creation.** A guided command creates a valid project from a small set of templates.
3. **Progress is worth showing.** Ideas may be marked as ideas, works in progress, shipped work, or archived work.
4. **Graceful differences.** Projects with a hosted demo expose it; other projects remain useful through their description, README, and source.
5. **Quiet authorship.** The public site should feel like a considered digital archive, not a developer dashboard or generic card grid.

## 3. Repository Architecture

```text
faust/
├── gallery/                  # Astro static site published to GitHub Pages
├── projects/
│   └── <project-slug>/
│       ├── project.json      # Stable gallery contract
│       ├── README.md         # Project-specific usage and implementation notes
│       └── ...               # Any language, toolchain, and internal structure
├── templates/                # blank, web, and script project starters
├── tools/                    # create, validate, and list commands
├── notes/                    # Existing prose moved from the repository root
├── docs/                     # Repository design and maintenance documentation
├── package.json              # Root gallery-management commands
└── README.md                 # Contributor and owner guide
```

The root Node toolchain manages the gallery and repository workflows only. Projects are not automatically made members of a shared JavaScript workspace and are not built by the root build. A project may define its own package manager, language environment, tests, and CI as needed.

The existing `allinone.md`, `读书笔记.md`, `随笔.md`, `项目.md`, `DONE.md`, and `code/` content will move under `notes/` without rewriting its contents. These documents remain in the repository but do not appear in the first version of the public gallery.

## 4. Project Metadata Contract

Every direct child of `projects/` must contain `project.json` and `README.md`. The first-version metadata shape is:

```json
{
  "title": "Semantic Search Playground",
  "slug": "semantic-search",
  "summary": "用不同向量模型比较中文语义搜索效果。",
  "status": "building",
  "type": "ai",
  "tags": ["embeddings", "search"],
  "createdAt": "2026-07-21",
  "updatedAt": "2026-07-21",
  "featured": false,
  "demo": null,
  "repository": "./",
  "cover": null
}
```

### 4.1 Required Fields

- `title`: Human-readable project title.
- `slug`: Unique lowercase kebab-case identifier matching the project directory name.
- `summary`: Concise public description.
- `status`: One of `idea`, `building`, `shipped`, or `archived`.
- `type`: One of `web`, `service`, `cli`, `ai`, `script`, or `other`.
- `tags`: Array of lowercase display tags; duplicates are rejected.
- `createdAt` and `updatedAt`: ISO calendar dates. `updatedAt` must not precede `createdAt`.
- `featured`: Boolean used for editorial emphasis, not a separate page section.
- `demo`: Absolute HTTP(S) URL or `null`.
- `repository`: `./` for a project in this repository, or an absolute HTTPS URL for externally hosted source. HTTP and non-web URL schemes are rejected.
- `cover`: Project-relative image path or `null`. The resolved path must remain inside the project directory; absolute paths and traversal segments such as `../` are rejected.

Unknown fields are rejected so mistakes do not silently disappear from the gallery. A local JSON Schema and runtime validator define the contract. The schema is the source of truth for tooling and documentation examples.

### 4.2 Validation Rules

Validation fails when a project has missing files, invalid enum values, malformed dates or URLs, duplicate slugs, a slug-directory mismatch, an absent referenced cover, or an absent README. Errors identify the project, field, and corrective action. External URLs are checked for syntax only; network availability does not block local work or deployment.

## 5. Project Creation Workflow

Running `pnpm create:project` starts an interactive prompt for title, type, template, and summary. The tool then:

1. Derives a safe, unique slug and asks for another value if it conflicts.
2. Copies one of three initial templates: `blank`, `web`, or `script`.
3. Writes `project.json` with dates and safe defaults.
4. Creates a project README containing purpose, development, and status sections.
5. Runs validation for the new project.
6. Prints the created path and template-specific next steps.

The command must leave no partially created project when validation fails. Template files use explicit placeholders rather than executing arbitrary code during creation.

Publishing the validated staging directory must never replace an existing project, including one created between a preflight check and publication. Because Node.js does not expose directory-level no-replace rename semantics, the creator uses a small audited native helper: `renameat2(RENAME_NOREPLACE)` on Linux and `renamex_np(RENAME_EXCL)` on macOS. The helper is compiled on first use into a private temporary cache and invoked without a shell. Project creation therefore supports Linux and macOS and requires `/usr/bin/cc` (a C compiler toolchain) for the first helper build; unsupported platforms or a missing compiler fail with an actionable message. No native binary is committed. Templates remain non-executable and project code is never run during scaffolding.

The `blank` template supports every unmodelled technology stack. The initial release will not provide dedicated Java, Python service, CLI, or AI templates; those can be added after repeated project patterns justify them.

## 6. Gallery Experience

### 6.1 Visual Direction

The gallery is a quiet digital archive: low-saturation cool neutrals, strong editorial typography, fine rules, generous space, and restrained motion. It should avoid a conventional equal-sized card wall, bright developer-dashboard styling, glass effects, and decorative gradients.

The interface uses a distinctive serif display face paired with a readable sans-serif body face. Fonts must be self-hosted or loaded with an explicit resilient fallback strategy. Color contrast must meet WCAG AA for body text and controls.

### 6.2 Home Page

The home page contains:

- A concise statement of purpose.
- A project count and filters for type and status.
- A typographic project index ordered by `updatedAt` descending, with deterministic slug ordering for ties.
- Each row's title, summary, type, status, and year.
- Subtle editorial emphasis for `featured` projects without splitting them into a redundant section.
- An intentional empty state explaining how to create the first project.

Filters update the visible index without navigation and are reflected in URL query parameters so views are shareable. The default view includes all projects except archived projects; archived projects remain available through the status filter.

### 6.3 Project Page

Each project receives a statically generated page at `/projects/<slug>/` with:

- Title, summary, status, type, tags, and dates.
- A short rendered excerpt from the project's README: the first non-empty paragraph after an optional leading H1, limited to 240 characters at the nearest word boundary. If no paragraph exists, the metadata summary is used.
- The declared technology or context represented through tags.
- A primary Demo action when `demo` exists.
- A source action resolved from `repository`; `./` links to the project's directory on the configured GitHub repository.
- A cover when supplied, or a consistent typographic fallback cover.

README rendering supports standard Markdown content but strips unsafe raw HTML. The gallery does not execute code from projects.

### 6.4 Responsive and Accessible Behaviour

The project index becomes a single-column record list on narrow screens while retaining filters and all actions. All interactions support keyboard navigation, visible focus states, semantic landmarks, and descriptive labels. Motion is limited to state communication and is disabled or reduced under `prefers-reduced-motion`.

## 7. Data Flow and Failure Handling

```text
projects/*/project.json
        ↓ schema and repository validation
typed gallery content collection
        ↓ Astro static generation
GitHub Pages artifact
```

Gallery development and production builds run the same validation first. Invalid metadata stops the build with actionable errors. Missing optional data has defined behaviour:

- No cover: render a typographic fallback.
- No demo: omit the Demo action without leaving an empty placeholder.
- Empty result after filtering: explain that no projects match and provide a reset action.
- No projects at all: render the repository-owner-oriented creation guidance.

The gallery consumes a generated, typed project index rather than repeatedly reading files in UI components. Generation is deterministic so local and CI output agree.

## 8. Commands

The root exposes these stable commands:

- `pnpm dev`: validate and start the gallery development server.
- `pnpm build`: validate and produce the static gallery build.
- `pnpm check`: run metadata validation, automated tests, and the production build.
- `pnpm create:project`: interactively scaffold and validate a new project.
- `pnpm list:projects`: print project title, type, status, and path for owner maintenance.

Project-specific commands are documented inside each project and are not proxied from the root.

## 9. GitHub Pages Delivery

A GitHub Actions workflow runs on pull requests and pushes to the default branch. Pull requests run `pnpm check`; pushes that pass additionally deploy the generated static artifact with GitHub's official Pages actions.

Astro's site and base configuration must support project Pages at `/<repository-name>/`. Repository identity used for source links and Pages configuration is defined once in gallery configuration, not copied into every component. The workflow uses a pinned Node major version, enables pnpm caching, and grants only the permissions required by GitHub Pages.

## 10. Testing and Verification

Automated tests cover:

- Valid and invalid metadata parsing.
- Duplicate slug and directory mismatch detection.
- Date, URL, cover, and README validation.
- Deterministic ordering and type/status filtering.
- Project creation from each template, including conflict and cleanup behaviour.
- Source-link resolution for local and external repositories.

The production build verifies static route generation and the GitHub Pages base path. A final manual pass checks desktop and mobile layouts, keyboard navigation, focus visibility, empty states, missing optional metadata, Demo/source links, and reduced-motion behaviour.

Existing prose migration is verified by comparing the pre-move and post-move file contents, not just file counts.

## 11. Documentation

The repository README will explain:

- What Faust is and how the repository is organized.
- Prerequisites and root commands.
- How to create, develop, and update a project.
- The metadata fields and lifecycle statuses.
- How the gallery is built and published.
- How projects remain isolated from the root toolchain.

Each template README will clearly separate project purpose, local development, and current status so generated projects are useful from their first commit.

## 12. Out of Scope for the First Version

- Building, testing, or deploying every project from the root workflow.
- Dedicated templates for every language or framework.
- Full-text search, analytics, comments, authentication, or a content-management UI.
- Publishing notes and essays in the gallery.
- Automatically probing external Demo availability.
- Deploying individual projects; projects may add this independently.

## 13. Acceptance Criteria

The design is implemented when:

1. A fresh checkout can install dependencies and run the gallery using documented commands.
2. `pnpm create:project` creates valid projects from all three templates without manual metadata repair.
3. Mixed-technology project directories coexist without being coupled to the root build.
4. The gallery automatically indexes valid metadata and generates accessible home and project pages.
5. Projects can be filtered by type and status; the default excludes archived work.
6. Projects with and without covers or demos render intentionally.
7. Invalid projects fail locally and in CI with actionable diagnostics.
8. GitHub Actions validates pull requests and deploys the correct subpath build to GitHub Pages.
9. Existing prose is preserved under `notes/` and excluded from the public gallery.
10. The repository documentation is sufficient to add and maintain a project without reading tool source code.
