# Faust Personal Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Faust into a mixed-technology project archive with validated metadata, guided scaffolding, an accessible Astro gallery, and GitHub Pages delivery.

**Architecture:** A root pnpm toolchain owns repository management only: Zod plus JSON Schema validate `projects/*`, CLI tools scaffold and list projects, and a deterministic generator writes one typed JSON index for Astro to consume. The gallery statically renders an editorial index and project routes under the configured GitHub Pages base path; individual projects remain isolated and are never installed or built by root commands.

**Tech Stack:** Node.js 22, pnpm 10, TypeScript, Zod, Vitest, Astro 5, vanilla CSS and browser JavaScript, GitHub Actions/Pages

---

## File Map

### Existing content moved without rewriting

- Move `allinone.md` to `notes/allinone.md`.
- Move `读书笔记.md` to `notes/读书笔记.md`.
- Move `随笔.md` to `notes/随笔.md`.
- Move `项目.md` to `notes/项目.md`.
- Move `DONE.md` to `notes/DONE.md`.
- Move `code/bricks.md` to `notes/code/bricks.md`; remove the empty `code/` directory.

### Root toolchain and contract

- Create `.gitignore` for dependencies, generated indexes, test artifacts, and Astro output.
- Create `.npmrc` to pin root-only pnpm behavior; gallery build dependencies are installed at the root and child projects are never enrolled.
- Create `package.json` with stable owner commands and root-only dependencies.
- Create `pnpm-lock.yaml` through `pnpm install`.
- Create `tsconfig.json` for Node tools and tests.
- Create `vitest.config.ts` for repository-wide unit tests.
- Create `project.schema.json` as the published metadata contract and documentation source of truth.
- Create `tools/config.ts` as the single repository identity, Pages URL, and path configuration module.
- Create `tools/project-schema.ts` as the typed Zod runtime mirror of `project.schema.json`, guarded by a comprehensive JSON-Schema/Zod parity corpus.
- Create `tools/validate-projects.ts` for repository invariants, actionable diagnostics, and CLI exit behavior.
- Create `tools/generate-project-index.ts` for deterministic typed gallery input and README excerpts.
- Create `tools/project-links.ts` for base-aware gallery, source, demo, and cover URLs.
- Create `tools/list-projects.ts` for the maintenance table command.
- Create `tools/create-project.ts` for prompt orchestration, safe staging, template rendering, validation, and atomic rename.
- Create `tools/lib/files.ts` for project discovery, safe paths, and atomic directory helpers.
- Create `tools/lib/readme.ts` for safe first-paragraph extraction.
- Create `tools/lib/templates.ts` for explicit placeholder replacement.
- Create `tools/__tests__/fixtures.ts` for isolated temporary repository fixtures.
- Create `tools/__tests__/project-schema.test.ts` for field-level contract tests.
- Create `tools/__tests__/validate-projects.test.ts` for cross-file and repository invariant tests.
- Create `tools/__tests__/generate-project-index.test.ts` for ordering, excerpts, and generated output.
- Create `tools/__tests__/project-links.test.ts` for local/external source and base-path URLs.
- Create `tools/__tests__/create-project.test.ts` for all templates, conflicts, and cleanup behavior.
- Create `tools/__tests__/list-projects.test.ts` for deterministic maintenance output.
- Create `tools/__tests__/notes-migration.test.ts` to compare moved prose against immutable pre-move hashes.

### Templates

- Create `templates/blank/README.md.tpl` as the universal project README template.
- Create `templates/web/README.md.tpl`, `templates/web/package.json.tpl`, `templates/web/index.html.tpl`, and `templates/web/src/main.js.tpl` as a dependency-light web starter.
- Create `templates/script/README.md.tpl`, `templates/script/package.json.tpl`, and `templates/script/src/index.mjs.tpl` as a Node script starter.

### Astro gallery

- Create `gallery/package.json` as metadata only; all executable gallery dependencies live in the root installation.
- Create `gallery/astro.config.mjs` using the shared site/base environment contract.
- Create `gallery/tsconfig.json` extending Astro strict settings.
- Create `gallery/src/env.d.ts` for Astro types.
- Create `gallery/src/data/projects.generated.json` as ignored generated input.
- Create `gallery/src/lib/projects.ts` for typed reads, filtering, and stable ordering.
- Create `gallery/src/layouts/BaseLayout.astro` for document metadata, landmarks, fonts, and global assets.
- Create `gallery/src/components/FilterBar.astro` for accessible type/status controls and URL state.
- Create `gallery/src/components/ProjectIndex.astro` for editorial records and empty states.
- Create `gallery/src/components/ProjectCover.astro` for real and typographic fallback covers.
- Create `gallery/src/pages/index.astro` for the gallery home page.
- Create `gallery/src/pages/projects/[slug].astro` for statically generated detail pages.
- Create `gallery/src/scripts/filters.ts` for progressive-enhancement filtering and query synchronization.
- Create `gallery/src/styles/global.css` for editorial styling, responsive behavior, focus, contrast, and reduced motion.
- Create `gallery/src/__tests__/projects.test.ts` for ordering and filtering behavior.
- Create `gallery/src/__tests__/rendering.test.ts` to build the site in a temporary output directory and inspect concrete generated HTML.

### Delivery and documentation

- Modify `README.md` into the owner/contributor guide.
- Create `docs/project-metadata.md` for schema-derived field guidance and lifecycle examples.
- Create `docs/gallery-maintenance.md` for validation, troubleshooting, and publishing.
- Create `.github/workflows/pages.yml` for PR checks and default-branch deployment.

## Conventions for Every Task

- Run all commands from the repository root unless the step says otherwise.
- Keep root scripts project-agnostic: never recurse into a project's dependency manifest or execute project code.
- Use `pnpm exec vitest run <file>` for a narrow red/green loop and `pnpm check` for the final gate.
- Treat generated `gallery/src/data/projects.generated.json` as build output: tests may inspect it, but it is not committed.
- Use Conventional Commit messages shown below. Each commit should contain only the files listed in its task.

### Task 1: Preserve and migrate the existing prose

**Files:**
- Create: `tools/__tests__/notes-migration.test.ts`
- Create: `notes/allinone.md`
- Create: `notes/读书笔记.md`
- Create: `notes/随笔.md`
- Create: `notes/项目.md`
- Create: `notes/DONE.md`
- Create: `notes/code/bricks.md`
- Delete: `allinone.md`, `读书笔记.md`, `随笔.md`, `项目.md`, `DONE.md`, `code/bricks.md`

- [ ] **Step 1: Record the source content hashes before moving anything**

Run:

```bash
shasum -a 256 allinone.md 读书笔记.md 随笔.md 项目.md DONE.md code/bricks.md
```

Expected: six SHA-256 lines. Copy the exact hash values into the test in Step 3; do not normalize line endings or edit content.

- [ ] **Step 2: Create the destination directories and use Git-aware moves**

Run:

```bash
mkdir -p notes/code tools/__tests__
git mv allinone.md notes/allinone.md
git mv 读书笔记.md notes/读书笔记.md
git mv 随笔.md notes/随笔.md
git mv 项目.md notes/项目.md
git mv DONE.md notes/DONE.md
git mv code/bricks.md notes/code/bricks.md
rmdir code
```

Expected: all six files appear under `notes/`; `git status --short` reports renames and no `code/` directory remains.

- [ ] **Step 3: Write the preservation test with the recorded hashes**

```ts
// tools/__tests__/notes-migration.test.ts
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const preserved = {
  'notes/allinone.md': '<paste-recorded-hash>',
  'notes/读书笔记.md': '<paste-recorded-hash>',
  'notes/随笔.md': '<paste-recorded-hash>',
  'notes/项目.md': '<paste-recorded-hash>',
  'notes/DONE.md': '<paste-recorded-hash>',
  'notes/code/bricks.md': '<paste-recorded-hash>',
} as const;

describe('notes migration', () => {
  for (const [path, expected] of Object.entries(preserved)) {
    it(`preserves ${path} byte-for-byte`, async () => {
      const bytes = await readFile(path);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected);
    });
  }
});
```

- [ ] **Step 4: Defer execution until the test runner exists, but manually re-check hashes now**

Run: `shasum -a 256 notes/allinone.md notes/读书笔记.md notes/随笔.md notes/项目.md notes/DONE.md notes/code/bricks.md`

Expected: each destination hash exactly matches its recorded source hash.

- [ ] **Step 5: Commit the content-only migration**

```bash
git add notes tools/__tests__/notes-migration.test.ts
git commit -m "chore: preserve prose under notes"
```

### Task 2: Establish the root management toolchain

**Files:**
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `package.json`
- Create: `pnpm-lock.yaml`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `gallery/package.json`
- Create: `gallery/tsconfig.json`
- Create: `gallery/src/env.d.ts`

- [ ] **Step 1: Add the root manifest with the stable public commands**

```json
{
  "name": "faust-gallery-manager",
  "private": true,
  "packageManager": "pnpm@10.13.1",
  "engines": { "node": ">=22 <23" },
  "scripts": {
    "validate": "tsx tools/validate-projects.ts",
    "generate": "tsx tools/generate-project-index.ts",
    "dev": "pnpm validate && pnpm generate && astro dev --root gallery",
    "build": "pnpm validate && pnpm generate && astro check --root gallery && astro build --root gallery",
    "test": "vitest run",
    "check": "pnpm validate && pnpm test && pnpm build",
    "create:project": "tsx tools/create-project.ts",
    "list:projects": "tsx tools/list-projects.ts"
  },
  "dependencies": {
    "@inquirer/prompts": "^7.8.0",
    "markdown-it": "^14.1.0",
    "sanitize-html": "^2.17.0",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "@types/markdown-it": "^14.1.2",
    "@types/node": "^22.16.5",
    "@types/sanitize-html": "^2.16.0",
    "ajv": "^8.17.1",
    "ajv-formats": "^3.0.1",
    "astro": "^5.12.3",
    "tsx": "^4.20.3",
    "typescript": "^5.8.3",
    "vitest": "^3.2.4"
  }
}
```

- [ ] **Step 2: Add root configuration without a pnpm workspace**

```ini
# .npmrc
save-exact=true
strict-peer-dependencies=true
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "resolveJsonModule": true,
    "noEmit": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["tools/**/*.ts", "vitest.config.ts"]
}
```

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['tools/**/*.test.ts', 'gallery/src/**/*.test.ts'] } });
```

Expected design constraint: do not add `pnpm-workspace.yaml`; all gallery executables resolve from root `node_modules`, while arbitrary `projects/*/package.json` files remain invisible to installation.

- [ ] **Step 3: Add the gallery package and strict Astro TypeScript config**

```json
// gallery/package.json
{
  "name": "@faust/gallery",
  "private": true,
  "type": "module"
}
```

```json
// gallery/tsconfig.json
{ "extends": "astro/tsconfigs/strict", "include": [".astro/types.d.ts", "**/*"] }
```

```ts
/// <reference types="astro/client" />
```

- [ ] **Step 4: Ignore only generated and local artifacts**

```gitignore
node_modules/
gallery/node_modules/
gallery/.astro/
gallery/dist/
gallery/src/data/projects.generated.json
gallery/public/.project-assets-*
gallery/public/project-assets
coverage/
.DS_Store
```

Both project-asset patterns are regenerated output: `pnpm generate` creates immutable `.project-assets-*` versions and atomically updates the `project-assets` symlink. Neither the versions nor the symlink is committed.

- [ ] **Step 5: Install exact dependency resolution and run the migration test**

Run: `corepack enable && pnpm install && pnpm exec astro --version && pnpm exec vitest run tools/__tests__/notes-migration.test.ts`

Expected: lockfile is created, the root-installed Astro executable prints its version, and the six migration tests pass. Confirm `find projects -name node_modules` prints nothing.

- [ ] **Step 6: Commit the root toolchain**

```bash
git add .gitignore .npmrc package.json pnpm-lock.yaml tsconfig.json vitest.config.ts gallery/package.json gallery/tsconfig.json gallery/src/env.d.ts
git commit -m "build: establish gallery management toolchain"
```

### Task 3: Define and test the metadata schema

**Files:**
- Create: `project.schema.json`
- Create: `tools/project-schema.ts`
- Create: `tools/__tests__/project-schema.test.ts`

- [ ] **Step 1: Write a shared contract corpus and failing parity tests for every constrained field**

```ts
import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import jsonSchema from '../../project.schema.json';
import { ProjectMetadataSchema } from '../project-schema.js';

const valid = {
  title: 'Semantic Search Playground', slug: 'semantic-search',
  summary: 'Compare Chinese semantic search models.', status: 'building', type: 'ai',
  tags: ['embeddings', 'search'], createdAt: '2026-07-20', updatedAt: '2026-07-21',
  featured: false, demo: null, repository: './', cover: null,
};

describe('ProjectMetadataSchema', () => {
  const invalid: Array<[string, unknown]> = [
    ['unknown key', { ...valid, surprise: true }],
    ['bad slug', { ...valid, slug: 'Not Safe' }],
    ['duplicate tag', { ...valid, tags: ['search', 'search'] }],
    ['bad date', { ...valid, createdAt: '2026-02-30' }],
    ['date reversal', { ...valid, updatedAt: '2026-07-19' }],
    ['http repository', { ...valid, repository: 'http://example.com/x' }],
    ['traversing cover', { ...valid, cover: '../secret.png' }],
  ];
  const cases: Array<[string, unknown, boolean]> = [
    ['valid contract', valid, true],
    ...invalid.map(([label, value]) => [label, value, false] as [string, unknown, boolean]),
  ];
  const ajv = new Ajv2020({ allErrors: true });
  addFormats(ajv);
  ajv.addKeyword({
    keyword: 'updatedAtNotBeforeCreatedAt',
    schemaType: 'boolean',
    type: 'object',
    validate: (enabled: boolean, data: { createdAt?: string; updatedAt?: string }) =>
      !enabled || !data.createdAt || !data.updatedAt || data.updatedAt >= data.createdAt,
  });
  const validateJson = ajv.compile(jsonSchema);
  it.each(cases)('%s has identical JSON Schema and Zod results', (_label, value, expected) => {
    expect(Boolean(validateJson(value))).toBe(expected);
    expect(ProjectMetadataSchema.safeParse(value).success).toBe(expected);
  });
});
```

Expand the corpus beyond the representative snippet: include every required field missing in turn, every enum member plus invalid values, boundary title/summary/tag values, leap/non-leap dates, both nullable branches, HTTP(S) demo rules, repository `./`/HTTPS/HTTP/non-web schemes, absolute/traversing/backslash/normalized covers, duplicate tags, unknown fields, and reversed/equal dates. Each case carries its expected result and both validators must agree.

- [ ] **Step 2: Run the schema test and verify red**

Run: `pnpm exec vitest run tools/__tests__/project-schema.test.ts`

Expected: FAIL because `tools/project-schema.ts` does not exist.

- [ ] **Step 3: Add the strict JSON Schema source of truth**

Create `project.schema.json` using draft 2020-12, `additionalProperties: false`, all 12 required fields, exact status/type enums, kebab-case and lowercase-tag patterns, `format: date`, `uniqueItems`, and `anyOf` branches for nullable URLs/cover. Put the cross-field rule in the schema as a documented custom keyword, for example `"updatedAtNotBeforeCreatedAt": true`, and register that keyword with AJV before compilation; its implementation compares the already format-validated ISO date strings. The JSON Schema is authoritative for the complete contract because CI compiles it directly and runs the exhaustive shared corpus—including equal, ordered, and reversed dates—against both implementations; a schema or Zod edit that changes acceptance cannot pass without updating the source and parity corpus together.

Representative definitions:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://faust.local/project.schema.json",
  "type": "object",
  "updatedAtNotBeforeCreatedAt": true,
  "additionalProperties": false,
  "required": ["title", "slug", "summary", "status", "type", "tags", "createdAt", "updatedAt", "featured", "demo", "repository", "cover"],
  "properties": {
    "slug": { "type": "string", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$" },
    "status": { "enum": ["idea", "building", "shipped", "archived"] },
    "type": { "enum": ["web", "service", "cli", "ai", "script", "other"] },
    "tags": { "type": "array", "uniqueItems": true, "items": { "type": "string", "pattern": "^[a-z0-9]+(?:-[a-z0-9]+)*$" } },
    "repository": { "anyOf": [{ "const": "./" }, { "type": "string", "pattern": "^https://" }] }
  }
}
```

- [ ] **Step 4: Implement the typed runtime mirror and cross-field refinements**

```ts
import { posix } from 'node:path';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}, 'must be a real ISO calendar date');
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const cover = z.string().refine((value) => !value.startsWith('/') && !value.split(/[\\/]/).includes('..') && posix.normalize(value) === value);

export const ProjectMetadataSchema = z.object({
  title: z.string().trim().min(1), slug, summary: z.string().trim().min(1),
  status: z.enum(['idea', 'building', 'shipped', 'archived']),
  type: z.enum(['web', 'service', 'cli', 'ai', 'script', 'other']),
  tags: z.array(slug).superRefine((tags, ctx) => {
    if (new Set(tags).size !== tags.length) ctx.addIssue({ code: 'custom', message: 'tags must not contain duplicates' });
  }),
  createdAt: isoDate, updatedAt: isoDate, featured: z.boolean(),
  demo: z.string().url().refine((url) => /^https?:\/\//.test(url)).nullable(),
  repository: z.union([z.literal('./'), z.string().url().refine((url) => url.startsWith('https://'))]),
  cover: cover.nullable(),
}).strict().superRefine((data, ctx) => {
  if (data.updatedAt < data.createdAt) ctx.addIssue({ code: 'custom', path: ['updatedAt'], message: 'must not precede createdAt' });
});
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
```

- [ ] **Step 5: Run schema compilation/parity tests and type-check**

Run: `pnpm exec vitest run tools/__tests__/project-schema.test.ts && pnpm exec tsc -p tsconfig.json`

Expected: AJV compiles `project.schema.json` with the registered date-order keyword, every corpus case produces the same result from AJV and Zod, and TypeScript exits 0.

- [ ] **Step 6: Commit the contract**

```bash
git add project.schema.json tools/project-schema.ts tools/__tests__/project-schema.test.ts
git commit -m "feat: define strict project metadata contract"
```

### Task 4: Validate repository-level project invariants

**Files:**
- Create: `tools/config.ts`
- Create: `tools/lib/files.ts`
- Create: `tools/validate-projects.ts`
- Create: `tools/__tests__/fixtures.ts`
- Create: `tools/__tests__/validate-projects.test.ts`

- [ ] **Step 1: Write temporary-repository fixture helpers**

```ts
export async function makeRepository(projects: Array<{ dir: string; metadata?: unknown; readme?: string; cover?: string }>) {
  const root = await mkdtemp(join(tmpdir(), 'faust-test-'));
  await mkdir(join(root, 'projects'));
  for (const project of projects) {
    const dir = join(root, 'projects', project.dir); await mkdir(dir);
    if (project.metadata) await writeFile(join(dir, 'project.json'), JSON.stringify(project.metadata));
    if (project.readme !== undefined) await writeFile(join(dir, 'README.md'), project.readme);
    if (project.cover) await writeFile(join(dir, project.cover), 'image');
  }
  return root;
}
```

- [ ] **Step 2: Write failing tests for missing files, directory mismatch, duplicate slug, cover existence, and actionable messages**

```ts
it('reports project, field, and corrective action', async () => {
  const root = await makeRepository([{ dir: 'wrong-dir', metadata: valid, readme: '# Readme' }]);
  const result = await validateProjects({ root });
  expect(result.ok).toBe(false);
  expect(result.errors).toContainEqual(expect.objectContaining({ project: 'wrong-dir', field: 'slug' }));
  expect(formatErrors(result.errors)).toContain('rename the directory or change slug');
});
```

Add separate cases for absent `project.json`, absent `README.md`, malformed JSON, two directories declaring the same slug, absent cover, and a cover resolving outside the project. Assert that an empty `projects/` directory is valid.

In this same Task 4 suite, directly test the single-project primitive with a staging directory whose physical basename is random:

```ts
it('validates a staging path against its intended final directory name', async () => {
  const projectPath = join(root, 'projects', '.my-idea.stage-abc123');
  await writeValidProject(projectPath, { ...valid, slug: 'my-idea' });
  await expect(validateProjectAt({ projectPath, expectedDirectoryName: 'my-idea' }))
    .resolves.toMatchObject({ ok: true, project: { slug: 'my-idea' } });
  await expect(validateProjectAt({ projectPath, expectedDirectoryName: 'different-name' }))
    .resolves.toMatchObject({ ok: false, errors: [expect.objectContaining({ field: 'slug' })] });
});
```

Also prove README and cover resolution use `projectPath`, not a synthesized `projects/<expectedDirectoryName>` path.

- [ ] **Step 3: Run the focused suite and verify red**

Run: `pnpm exec vitest run tools/__tests__/validate-projects.test.ts`

Expected: FAIL because validator modules do not exist.

- [ ] **Step 4: Add single-source repository configuration**

```ts
export const repository = {
  owner: process.env.FAUST_GITHUB_OWNER ?? 'drulu',
  name: process.env.FAUST_GITHUB_REPOSITORY ?? 'faust',
  branch: process.env.FAUST_GITHUB_BRANCH ?? 'main',
};
export const pages = {
  site: process.env.FAUST_SITE ?? `https://${repository.owner}.github.io`,
  base: process.env.FAUST_BASE ?? `/${repository.name}`,
};
```

Before committing, replace fallback owner/branch if `git remote -v` or `git symbolic-ref refs/remotes/origin/HEAD` proves different. Components must import resolved links, never copy these strings.

- [ ] **Step 5: Implement discovery and validation as an importable function plus a thin CLI**

Expose:

```ts
export type ValidationError = { project: string; field: string; message: string; fix: string };
export type ProjectValidationResult =
  | { ok: true; project: ProjectMetadata }
  | { ok: false; errors: ValidationError[] };
export async function validateProjectAt(options: {
  projectPath: string;
  expectedDirectoryName: string;
}): Promise<ProjectValidationResult>;
export async function validateProjects(options: { root: string; only?: string }): Promise<
  | { ok: true; projects: ProjectMetadata[] }
  | { ok: false; errors: ValidationError[] }
>;
```

Implement all per-project parsing, README checks, cover resolution, and slug comparison inside `validateProjectAt`. It reads files from `projectPath` but compares `metadata.slug` to `expectedDirectoryName`; it never derives the expected name from `basename(projectPath)`. `validateProjects` sorts direct child directories, calls `validateProjectAt({ projectPath, expectedDirectoryName: entry.name })` for each, and then adds repository-wide duplicate-slug errors. Parse JSON without executing project code. Resolve cover with `realpath`/`relative` against `projectPath` and reject paths outside it. The CLI prints one line per error as `project: field — message; fix: ...` and sets `process.exitCode = 1` without throwing a stack trace.

- [ ] **Step 6: Run validation tests and the empty real repository**

Run: `pnpm exec vitest run tools/__tests__/validate-projects.test.ts && pnpm validate`

Expected: focused tests pass; the repository validator reports `Validated 0 projects` and exits 0.

- [ ] **Step 7: Commit repository validation**

```bash
git add tools/config.ts tools/lib/files.ts tools/validate-projects.ts tools/__tests__/fixtures.ts tools/__tests__/validate-projects.test.ts
git commit -m "feat: validate project repository invariants"
```

### Task 5: Generate deterministic, safe gallery data and links

**Files:**
- Create: `tools/lib/readme.ts`
- Create: `tools/generate-project-index.ts`
- Create: `tools/project-links.ts`
- Create: `tools/__tests__/generate-project-index.test.ts`
- Create: `tools/__tests__/project-links.test.ts`

- [ ] **Step 1: Write failing excerpt, ordering, and source-link tests**

```ts
it('renders Markdown but removes unsafe HTML and truncates visible text', () => {
  const input = '# Title\n\nFirst **useful** [paragraph](javascript:alert(1)) with enough words to truncate safely. <script>alert(1)</script>';
  const excerpt = extractExcerptHtml(input, 'Fallback', 48);
  expect(excerpt).toContain('<strong>useful</strong>');
  expect(excerpt).not.toMatch(/script|javascript:/i);
  expect(visibleText(excerpt).length).toBeLessThanOrEqual(48);
  expect(visibleText(excerpt).endsWith('…')).toBe(true);
});

it('resolves local source once from repository config', () => {
  expect(sourceUrl({ slug: 'search', repository: './' }, { owner: 'a', name: 'faust', branch: 'main' }))
    .toBe('https://github.com/a/faust/tree/main/projects/search');
});
```

Also assert fallback to an escaped summary when no paragraph exists, exact 240-character behavior, a single overlong word, Unicode text, inline code/emphasis/links, images removed, raw HTML removed, `javascript:`/`data:` links removed, descending `updatedAt`, slug tie-breaks, HTTPS external source passthrough, and base-prefixed project/cover paths.

- [ ] **Step 2: Run the focused tests and verify red**

Run: `pnpm exec vitest run tools/__tests__/generate-project-index.test.ts tools/__tests__/project-links.test.ts`

Expected: FAIL due to missing modules.

- [ ] **Step 3: Implement the Markdown-to-sanitized-HTML excerpt pipeline**

Use `markdown-it` with `html: false`, `linkify: false`, and a custom renderer that drops images. Parse tokens, skip an optional leading H1, then select the first non-empty paragraph token range; never use a regex to sanitize Markdown. Convert that paragraph's inline tokens to visible Unicode text, collapse whitespace, and truncate **visible text** to at most 240 Unicode code points: if over limit, reserve one code point for `…`, cut at the last whitespace at or before 239 when one exists, otherwise cut the single long word at 239, trim, and append `…`. Re-render only the retained inline token content with allowed Markdown formatting, then run `sanitize-html` as defense in depth with tags `p`, `em`, `strong`, `code`, `a` and attributes `{ a: ['href'] }`; allow only `https`, `http`, and relative link schemes and add `rel="noreferrer"` to external links. If no paragraph exists, HTML-escape the metadata summary and wrap it in `<p>`. Export `extractExcerptHtml`, `visibleText`, and focused helpers so safety/truncation are directly testable.

- [ ] **Step 4: Implement a complete generated-record interface and deterministic writer**

```ts
export type GalleryProject = ProjectMetadata & {
  excerptHtml: string;
  year: string;
  href: string;
  sourceHref: string;
  coverHref: string | null;
};

export async function buildProjectIndex(root: string): Promise<GalleryProject[]> {
  const result = await validateProjects({ root });
  if (!result.ok) throw new ProjectValidationError(result.errors);
  return result.projects.map(toGalleryProject).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug));
}
```

Write formatted JSON plus one trailing newline to `gallery/src/data/projects.generated.json` only after successful validation. Build covers in a new immutable version directory such as `gallery/public/.project-assets-<content-hash>`, copying only validated cover files to `<slug>/...`. Make `gallery/public/project-assets` a relative symlink to the active version: create a sibling temporary symlink, then `rename` that symlink over the old symlink as one atomic pointer replacement. Only after the swap succeeds, remove obsolete version directories; on failure remove only the new version and temporary symlink. Add tests that a failed copy leaves the old target and files intact and that a successful second generation removes stale covers. If the target platform cannot create symlinks, fail with an actionable message rather than falling back to a partial in-place copy. This prevents stale covers and prevents readers from observing a partial asset tree. Astro follows the public symlink but never reads arbitrary project code.

- [ ] **Step 5: Run focused tests and generate the empty index**

Run: `pnpm exec vitest run tools/__tests__/generate-project-index.test.ts tools/__tests__/project-links.test.ts && pnpm generate`

Expected: tests pass; generation prints `Generated 0 projects` and writes `[]` to the ignored data file.

- [ ] **Step 6: Commit deterministic data generation**

```bash
git add tools/lib/readme.ts tools/generate-project-index.ts tools/project-links.ts tools/__tests__/generate-project-index.test.ts tools/__tests__/project-links.test.ts
git commit -m "feat: generate deterministic gallery project data"
```

### Task 6: Build safe templates and the atomic project creator

**Files:**
- Create: `templates/blank/README.md.tpl`
- Create: `templates/web/README.md.tpl`
- Create: `templates/web/package.json.tpl`
- Create: `templates/web/index.html.tpl`
- Create: `templates/web/src/main.js.tpl`
- Create: `templates/script/README.md.tpl`
- Create: `templates/script/package.json.tpl`
- Create: `templates/script/src/index.mjs.tpl`
- Create: `tools/lib/templates.ts`
- Create: `tools/create-project.ts`
- Create: `tools/__tests__/create-project.test.ts`

- [ ] **Step 1: Write failing API-level tests for all templates and cleanup**

```ts
describe.each(['blank', 'web', 'script'] as const)('%s template', (template) => {
  it('creates a valid, fully rendered project', async () => {
    const root = await makeRepository([]);
    const result = await createProject({ root, title: 'My Idea', slug: 'my-idea', type: 'other', summary: 'Try it.', template, today: '2026-07-21' });
    expect(result.path).toBe(join(root, 'projects/my-idea'));
    expect(await validateProjects({ root, only: 'my-idea' })).toMatchObject({ ok: true });
    expect(await readFile(join(result.path, 'README.md'), 'utf8')).not.toContain('{{');
  });
});

it('leaves no project or staging directory when validation fails', async () => {
  await expect(createProject({ ...input, templateRoot: brokenTemplates })).rejects.toThrow();
  expect(await readdir(join(root, 'projects'))).toEqual([]);
});
```

Add cases for slug derivation (`Crème & Search` -> `creme-search`), explicit invalid slug, existing-directory conflict, and template traversal/unknown placeholders.
Add a creator integration case where the random staging basename differs from the intended slug and spy on the Task 4 API to verify `createProject` calls `validateProjectAt({ projectPath: <actual staging path>, expectedDirectoryName: 'my-idea' })`. Add a race test that creates the final destination immediately before publication and asserts the creator fails without overwriting it.

- [ ] **Step 2: Run the creator suite and verify red**

Run: `pnpm exec vitest run tools/__tests__/create-project.test.ts`

Expected: FAIL because creator and templates do not exist.

- [ ] **Step 3: Add explicit non-executable templates**

Every README template must render:

```md
# {{TITLE}}

## Purpose

{{SUMMARY}}

## Development

{{DEVELOPMENT}}

## Status

Idea created on {{CREATED_AT}}.
```

The blank template's development text says to document the chosen stack. The web starter uses plain `index.html` and `src/main.js`; the script starter uses `node src/index.mjs`. Keep dependencies empty so scaffolding never installs or executes anything.

- [ ] **Step 4: Implement strict placeholder rendering and a two-phase creator**

```ts
export type CreateProjectInput = {
  root: string; title: string; slug?: string; type: ProjectMetadata['type'];
  summary: string; template: 'blank' | 'web' | 'script'; today?: string; templateRoot?: string;
};
export async function createProject(input: CreateProjectInput): Promise<{ path: string; metadata: ProjectMetadata }>;
```

Import the already committed `validateProjectAt` from `tools/validate-projects.ts`; Task 6 must not alter `tools/validate-projects.ts`, `tools/lib/files.ts`, or their Task 4 tests. Copy only regular files beneath the selected template, reject symlinks and destination traversal, replace only known `{{UPPER_SNAKE_CASE}}` placeholders, and fail if any placeholder remains. Create a sibling staging directory using `mkdtemp(join(projectsDir, `.${slug}.stage-`))`, write `project.json`, then call `validateProjectAt({ projectPath: staging, expectedDirectoryName: slug })`; slug-directory validation therefore uses the intended final basename, while cover/README checks use the physical staging path. Implement and test one `renameNoReplace(staging, final)` helper as the publication boundary: acquire `projects/.create-<slug>.lock` with exclusive `open(..., 'wx')`, reject if `final` exists, perform the same-filesystem directory `rename`, and release only this invocation's lock in `finally`. All creator calls must honor the lock, so publication is a single atomic rename and concurrent creators cannot reach an overwriting rename; `EEXIST` from either lock or destination is a conflict. Do not use copy-then-delete and do not remove/recreate the destination. In the race test, pause the first creator after locking, start a second creator, and assert exactly one final directory is published and its contents are never replaced. In `finally`, remove only the resolved staging directory and owned lock; never delete or replace an existing destination.

- [ ] **Step 5: Add the interactive adapter without coupling prompts to core logic**

The `isMain` path prompts for title, type, template, summary, then derived slug confirmation/edit. If the slug conflicts, re-prompt; on success print the created path and exact next command. Keep `createProject()` prompt-free for tests.

- [ ] **Step 6: Run creator and validation suites**

Run: `pnpm exec vitest run tools/__tests__/create-project.test.ts tools/__tests__/validate-projects.test.ts`

Expected: all template, conflict, and cleanup tests pass.

- [ ] **Step 7: Manually smoke-test interaction, then remove only the smoke project**

Run: `pnpm create:project`

Expected: prompts appear; choose `Smoke Test`, `other`, `blank`, and a short summary. Validation succeeds and prints `projects/smoke-test`. Inspect it, then run `rm -r projects/smoke-test` only after confirming the resolved path is exactly `$PWD/projects/smoke-test`.

- [ ] **Step 8: Commit scaffolding**

```bash
git add templates tools/lib/templates.ts tools/create-project.ts tools/__tests__/create-project.test.ts
git commit -m "feat: scaffold projects from safe templates"
```

### Task 7: Add the project maintenance listing

**Files:**
- Create: `tools/list-projects.ts`
- Create: `tools/__tests__/list-projects.test.ts`

- [ ] **Step 1: Write a failing deterministic output test**

```ts
it('prints title, type, status, and path in gallery order', () => {
  expect(formatProjectList([older, newer])).toBe([
    'TITLE  TYPE  STATUS   PATH',
    'Newer  web   shipped  projects/newer',
    'Older  ai    building projects/older',
  ].join('\n'));
});
```

- [ ] **Step 2: Run the test and verify red**

Run: `pnpm exec vitest run tools/__tests__/list-projects.test.ts`

Expected: FAIL because `formatProjectList` does not exist.

- [ ] **Step 3: Implement formatting over the generated domain model**

Export `formatProjectList(projects)` for testing, validate before printing, pad columns without ANSI escapes, and print `No projects found. Run pnpm create:project.` for an empty repository.

- [ ] **Step 4: Run test and real command**

Run: `pnpm exec vitest run tools/__tests__/list-projects.test.ts && pnpm list:projects`

Expected: test passes and the real command prints the intentional empty message.

- [ ] **Step 5: Commit maintenance tooling**

```bash
git add tools/list-projects.ts tools/__tests__/list-projects.test.ts
git commit -m "feat: list gallery projects for maintenance"
```

### Task 8: Build the gallery domain layer and static routes

**Files:**
- Create: `gallery/astro.config.mjs`
- Create: `gallery/src/data/projects.generated.json` (generated, ignored)
- Create: `gallery/src/lib/projects.ts`
- Create: `gallery/src/__tests__/projects.test.ts`
- Create: `gallery/src/layouts/BaseLayout.astro`
- Create: `gallery/src/components/ProjectCover.astro`
- Create: `gallery/src/components/ProjectIndex.astro`
- Create: `gallery/src/pages/index.astro`
- Create: `gallery/src/pages/projects/[slug].astro`
- Create: `gallery/src/__tests__/rendering.test.ts`

- [ ] **Step 1: Write failing gallery-domain tests**

```ts
it('defaults to all non-archived projects', () => {
  expect(filterProjects(projects, { type: 'all', status: 'active' }).map(p => p.slug))
    .toEqual(['newest', 'older']);
});
it('allows an explicit archived filter', () => {
  expect(filterProjects(projects, { type: 'all', status: 'archived' }).map(p => p.slug))
    .toEqual(['archive']);
});
```

Also test stable tie ordering and exact type/status matching.

- [ ] **Step 2: Run the domain suite and verify red**

Run: `pnpm exec vitest run gallery/src/__tests__/projects.test.ts`

Expected: FAIL because the gallery domain module does not exist.

- [ ] **Step 3: Implement typed JSON reading, ordering, and pure filtering**

```ts
import raw from '../data/projects.generated.json';
import type { GalleryProject } from '../../../tools/generate-project-index.js';
export const projects = (raw as GalleryProject[]).toSorted((a, b) =>
  b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug));
export function filterProjects(items: GalleryProject[], filters: { type: string; status: string }) {
  return items.filter((p) => (filters.type === 'all' || p.type === filters.type)
    && (filters.status === 'active' ? p.status !== 'archived' : filters.status === 'all' || p.status === filters.status));
}
```

- [ ] **Step 4: Configure Astro from the shared environment contract**

```js
import { defineConfig } from 'astro/config';
export default defineConfig({
  site: process.env.FAUST_SITE ?? 'https://drulu.github.io',
  base: process.env.FAUST_BASE ?? '/faust',
  output: 'static',
  trailingSlash: 'always',
});
```

Keep the defaults synchronized with `tools/config.ts`; tests must override environment values to prove custom repositories work.

- [ ] **Step 5: Create semantic home and project routes**

The home page uses `<header>`, `<main id="content">`, a skip link, project count, filters, and `<ol>` records. When zero projects exist, render `No projects yet. Create one with pnpm create:project.` On project pages, use `getStaticPaths()` from generated data and render metadata, the already sanitized `excerptHtml` with Astro's `set:html`, conditional Demo link, source link, and cover/fallback. No component may render project README source directly; `excerptHtml` is the only reviewed HTML boundary.

Representative static paths:

```astro
---
import { projects } from '../../lib/projects';
export function getStaticPaths() {
  return projects.map((project) => ({ params: { slug: project.slug }, props: { project } }));
}
const { project } = Astro.props;
---
```

- [ ] **Step 6: Add concrete build-output tests for routes, optional actions, and Pages base**

In `rendering.test.ts`, create an isolated fixture repository containing projects with/without Demo and cover plus malicious/Markdown README content. Run the real generator and `astro build --root gallery --outDir <temporary-dist>` with `FAUST_BASE=/test-base`, then read the emitted `index.html` and `projects/<slug>/index.html`. Assert: routes exist; internal links start `/test-base/`; no empty Demo placeholder; local/external source URLs are exact; fallback cover text appears; safe `<strong>` markup survives; and `script`, `javascript:`, raw event attributes, and untrusted README HTML do not appear. Parse only relevant fragments or use targeted assertions—do not snapshot whole pages. Ensure temporary generated data/assets/output are restored or removed in `afterEach`.

- [ ] **Step 7: Run gallery tests and the first static build**

Run: `pnpm exec vitest run gallery/src/__tests__/projects.test.ts gallery/src/__tests__/rendering.test.ts && pnpm build`

Expected: the test itself completes a real temporary Astro build and passes all generated-HTML assertions; Astro check reports no errors; `gallery/dist/index.html` exists and empty-project build succeeds under `/faust/`.

- [ ] **Step 8: Commit the static gallery structure**

```bash
git add gallery/astro.config.mjs gallery/src/lib gallery/src/layouts gallery/src/components/ProjectCover.astro gallery/src/components/ProjectIndex.astro gallery/src/pages gallery/src/__tests__
git commit -m "feat: render static gallery and project routes"
```

### Task 9: Add shareable accessible filters

**Files:**
- Create: `gallery/src/components/FilterBar.astro`
- Create: `gallery/src/scripts/filters.ts`
- Modify: `gallery/src/pages/index.astro`
- Modify: `gallery/src/components/ProjectIndex.astro`
- Modify: `gallery/src/__tests__/rendering.test.ts`

- [ ] **Step 1: Write failing tests for filter markup and state semantics**

Assert that controls have explicit labels, active/default options exist, each record exposes `data-type`/`data-status`, the count uses `aria-live="polite"`, empty results contain a reset button, and the default active state excludes archived records.

- [ ] **Step 2: Run the rendering suite and verify red**

Run: `pnpm exec vitest run gallery/src/__tests__/rendering.test.ts`

Expected: FAIL on missing filter semantics.

- [ ] **Step 3: Implement progressively enhanced form controls**

Use real `<select name="type">` and `<select name="status">` controls inside a GET form. The server-rendered default list shows non-archived work; JavaScript enhances it in place, reads valid `type`/`status` values from `URLSearchParams`, ignores invalid values, toggles `hidden`, updates count/empty state, and calls `history.replaceState` with only non-default filters.

```ts
function apply() {
  let visible = 0;
  for (const row of rows) {
    const show = matches(row, type.value, status.value);
    row.hidden = !show;
    if (show) visible += 1;
  }
  count.textContent = `${visible} ${visible === 1 ? 'project' : 'projects'}`;
  empty.hidden = visible !== 0;
  syncQuery(type.value, status.value);
}
```

- [ ] **Step 4: Add keyboard-safe reset behavior**

The reset button returns both fields to defaults, reapplies filters, and moves focus to the project index heading. Do not trap focus or intercept normal select keyboard behavior.

- [ ] **Step 5: Run tests and inspect the query behavior locally**

Run: `pnpm exec vitest run gallery/src/__tests__/rendering.test.ts && pnpm dev`

Expected: tests pass; browser checks at `/faust/?type=web&status=shipped` retain filters on reload, invalid query values fall back safely, and Reset restores the active/non-archived view. Stop the server after checking.

- [ ] **Step 6: Commit filtering**

```bash
git add gallery/src/components/FilterBar.astro gallery/src/scripts/filters.ts gallery/src/pages/index.astro gallery/src/components/ProjectIndex.astro gallery/src/__tests__/rendering.test.ts
git commit -m "feat: add shareable accessible project filters"
```

### Task 10: Apply responsive editorial styling and accessibility safeguards

**Files:**
- Create: `gallery/src/styles/global.css`
- Modify: `gallery/src/layouts/BaseLayout.astro`
- Modify: `gallery/src/components/FilterBar.astro`
- Modify: `gallery/src/components/ProjectIndex.astro`
- Modify: `gallery/src/components/ProjectCover.astro`
- Modify: `gallery/src/pages/projects/[slug].astro`

- [ ] **Step 1: Establish tokens and resilient typography**

Use a self-hosted font only if licensed font files are added; otherwise use an explicit resilient stack such as `Iowan Old Style, Palatino Linotype, Book Antiqua, Georgia, serif` for display and `Inter, ui-sans-serif, system-ui, sans-serif` for body. Define cool-neutral background/text/rule/accent tokens with verified WCAG AA pairs.

- [ ] **Step 2: Style the index as editorial records, not equal cards**

Use fine top rules, asymmetric title/metadata columns at wide widths, varied but restrained featured emphasis (for example a thicker leading rule and small `Featured` label), generous vertical rhythm, and no gradients/glass/shadows. Preserve source order regardless of visual layout.

- [ ] **Step 3: Add narrow-screen single-column behavior**

At `max-width: 48rem`, stack filters and record metadata, keep actions at least 44 CSS pixels tall, prevent long URLs/titles from overflowing, and keep the count and reset controls visible.

- [ ] **Step 4: Add focus, motion, and semantic state rules**

```css
:focus-visible { outline: 3px solid var(--focus); outline-offset: 3px; }
[hidden] { display: none !important; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
}
```

Do not remove outlines. Underline text links; do not rely on color alone for status/featured meaning.

- [ ] **Step 5: Run build and perform the manual accessibility matrix**

Run: `pnpm build && pnpm dev`

Expected automated outcome: Astro check and build pass. Manual checks at 1440px, 768px, and 320px confirm no horizontal scroll and intentional fallback covers. Keyboard-only check confirms skip link, controls, reset, project links, Demo/source links, and visible focus. OS/browser reduced-motion emulation confirms transitions are suppressed. Use browser accessibility tooling to confirm landmarks, labels, heading order, and AA contrast. Stop the server.

- [ ] **Step 6: Commit presentation and accessibility**

```bash
git add gallery/src/styles/global.css gallery/src/layouts/BaseLayout.astro gallery/src/components gallery/src/pages/projects/'[slug].astro'
git commit -m "feat: style an accessible responsive project archive"
```

### Task 11: Document ownership, metadata, and maintenance

**Files:**
- Modify: `README.md`
- Create: `docs/project-metadata.md`
- Create: `docs/gallery-maintenance.md`

- [ ] **Step 1: Rewrite the root README as a fresh-checkout guide**

Include purpose, exact tree, Node 22/corepack prerequisites, `pnpm install`, all six stable commands, project isolation, creation/update workflow, statuses, generated-file note, and links to both detailed documents. Explicitly state that root commands never install/build project implementations.

- [ ] **Step 2: Document every schema field from `project.schema.json`**

Include the canonical JSON example from the spec, enum tables, `./` source resolution, cover safety, date ordering, unknown-field rejection, tag rules, and actionable invalid examples. State that `project.schema.json` is authoritative if prose drifts.

- [ ] **Step 3: Document gallery operations and failure recovery**

Cover local development, empty repository behavior, validator messages, generated index/covers, Pages site/base overrides, manual accessibility matrix, and how to add future templates without coupling project runtimes.

- [ ] **Step 4: Verify every documented command exists**

Run:

```bash
node -e "const p=require('./package.json'); for (const s of ['dev','build','check','create:project','list:projects']) if (!p.scripts[s]) process.exit(1)"
pnpm validate
pnpm list:projects
```

Expected: script check exits 0; validation and listing produce their documented empty-repository messages.

- [ ] **Step 5: Commit documentation**

```bash
git add README.md docs/project-metadata.md docs/gallery-maintenance.md
git commit -m "docs: explain project and gallery maintenance"
```

### Task 12: Validate and deploy with GitHub Pages CI

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `gallery/astro.config.mjs` only if verified repository defaults differ
- Modify: `tools/config.ts` only if verified repository defaults differ

- [ ] **Step 1: Write the least-privilege pull-request check job**

```yaml
name: Gallery
on:
  pull_request:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: pages-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10.13.1
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm check
        env:
          FAUST_GITHUB_OWNER: ${{ github.repository_owner }}
          FAUST_GITHUB_REPOSITORY: ${{ github.event.repository.name }}
          FAUST_GITHUB_BRANCH: ${{ github.event.repository.default_branch }}
          FAUST_SITE: https://${{ github.repository_owner }}.github.io
          FAUST_BASE: /${{ github.event.repository.name }}
```

- [ ] **Step 2: Add push-only artifact upload and deployment jobs**

Add `configure-pages` and `upload-pages-artifact` after `pnpm check` only for a push to the default branch. Add a separate `deploy` job with `needs: check`, `if: github.event_name == 'push'`, environment `github-pages`, and job-level permissions `pages: write`, `id-token: write`, `contents: read`; use `actions/deploy-pages@v4`. Upload `gallery/dist` exactly once.

- [ ] **Step 3: Validate workflow syntax and local frozen install**

Run: `pnpm install --frozen-lockfile && pnpm check`

Expected: install makes no lockfile changes; metadata tests, all unit/rendering tests, Astro check, and production build pass.

- [ ] **Step 4: Verify artifact paths and Pages base explicitly**

Run:

```bash
test -f gallery/dist/index.html
grep -R 'href="/faust/' gallery/dist/index.html
test ! -e gallery/dist/faust/index.html
```

Expected: artifact root is `gallery/dist`, generated links include `/faust/`, and Astro has not incorrectly nested output beneath another `faust/` directory. For a differently named repository, rerun with `FAUST_BASE=/test-repo pnpm build` and expect `/test-repo/` links.

- [ ] **Step 5: Commit CI delivery**

```bash
git add .github/workflows/pages.yml gallery/astro.config.mjs tools/config.ts
git commit -m "ci: validate and deploy gallery to GitHub Pages"
```

### Task 13: Run end-to-end acceptance verification

**Files:**
- Test only: all files above
- Modify only if a failing acceptance check reveals a defect; commit fixes separately by concern

- [ ] **Step 1: Verify a completely clean dependency install**

Run: `pnpm install --frozen-lockfile`

Expected: exits 0 with no `pnpm-lock.yaml` diff.

- [ ] **Step 2: Run the full automated gate**

Run: `pnpm check`

Expected: metadata validation passes; all Vitest suites pass; Astro check reports 0 errors; static build exits 0.

- [ ] **Step 3: Exercise all three templates in an isolated temporary clone**

Create a temporary clone with `mktemp -d`, run the exported noninteractive `createProject()` for blank/web/script fixtures, then run `pnpm validate`, `pnpm list:projects`, and `pnpm build` there. Do not add acceptance fixtures to the real `projects/` directory.

Expected: three valid mixed templates coexist, list order is deterministic, and all three project detail routes are generated without installing either child `package.json`.

- [ ] **Step 4: Re-verify prose preservation**

Run: `pnpm exec vitest run tools/__tests__/notes-migration.test.ts`

Expected: all six byte-for-byte hash tests pass.

- [ ] **Step 5: Run the final manual experience matrix**

Serve the production build using `pnpm exec astro preview --root gallery`. Check desktop/mobile, keyboard order and focus visibility, default/archive/type filters and shareable queries, no-match Reset, no-project guidance (using an isolated generated empty index), real/fallback cover, Demo present/absent, local/external source links, unsafe README HTML omission, and reduced-motion mode.

Expected: every acceptance criterion in the approved design has observable evidence and no console errors or broken internal links.

- [ ] **Step 6: Inspect repository boundaries and final status**

Run:

```bash
git status --short
git diff --check
find projects -mindepth 2 -name node_modules -o -name dist
git log --oneline --decorate -13
```

Expected: only intentional uncommitted verification artifacts (ideally none), no whitespace errors, no root-created project build/dependency directories, and the planned focused commits are visible.

- [ ] **Step 7: Push the implementation branch and open a pull request**

Run: `git push -u origin HEAD`

Expected: branch uploads successfully. Open a pull request summarizing schema/tooling/gallery/CI changes and paste `pnpm check` plus manual matrix results. The PR `check` job must pass and must not deploy.

- [ ] **Step 8: Merge through the repository's normal review process and observe deployment**

Expected: the default-branch push runs `check`, uploads `gallery/dist`, and the `deploy` job reports the Pages URL. Visit `https://<owner>.github.io/<repository>/`, one project route, and one filter query; confirm assets, source links, and trailing-slash routes work at the repository subpath.

- [ ] **Step 9: Record deployment-only fixes as focused commits**

If observation reveals a defect, add a regression test first, reproduce it locally with the exact `FAUST_SITE`/`FAUST_BASE`, implement the smallest fix, rerun `pnpm check`, and commit with a narrow `fix:` message. Do not bypass validation or edit generated output directly.
