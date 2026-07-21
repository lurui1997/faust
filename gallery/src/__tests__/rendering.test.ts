import { cp, mkdtemp, mkdir, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const execFileAsync = promisify(execFile);
const repositoryRoot = resolve(import.meta.dirname, '../../..');
const galleryRoot = join(repositoryRoot, 'gallery');

let fixtureRoot = '';
let outputRoot = '';

async function writeProject(
  slug: string,
  overrides: Record<string, unknown>,
  readme: string,
  cover?: string,
): Promise<void> {
  const projectRoot = join(fixtureRoot, 'projects', slug);
  await mkdir(projectRoot, { recursive: true });
  await writeFile(join(projectRoot, 'project.json'), JSON.stringify({
    title: slug === 'covered' ? 'Covered Work' : 'Plain Work',
    slug,
    summary: `Summary for ${slug}.`,
    status: 'building',
    type: 'web',
    tags: ['typescript', 'archive'],
    createdAt: '2026-07-01',
    updatedAt: slug === 'covered' ? '2026-07-21' : '2026-07-20',
    featured: slug === 'covered',
    demo: null,
    repository: './',
    cover: cover ?? null,
    ...overrides,
  }));
  await writeFile(join(projectRoot, 'README.md'), readme);
  if (cover !== undefined) await writeFile(join(projectRoot, cover), 'fixture image');
}

beforeEach(async () => {
  process.env.FAUST_GITHUB_OWNER = 'lurui1997';
  process.env.FAUST_GITHUB_BRANCH = 'main';
  const temporaryRoot = await realpath(tmpdir());
  fixtureRoot = await mkdtemp(join(temporaryRoot, 'faust-gallery-fixture-'));
  outputRoot = await mkdtemp(join(temporaryRoot, 'faust-gallery-output-'));
  await mkdir(join(fixtureRoot, 'projects'));
  await cp(galleryRoot, join(fixtureRoot, 'gallery'), {
    recursive: true,
    verbatimSymlinks: true,
    filter: (source) => !['.astro', 'dist', 'node_modules'].includes(basename(source)),
  });
  await symlink(join(repositoryRoot, 'node_modules'), join(fixtureRoot, 'node_modules'));
});

afterEach(async () => {
  await Promise.all([fixtureRoot, outputRoot].map((path) => rm(path, { recursive: true, force: true })));
  delete process.env.FAUST_BASE;
  delete process.env.FAUST_SITE;
  delete process.env.FAUST_GITHUB_OWNER;
  delete process.env.FAUST_GITHUB_REPOSITORY;
  delete process.env.FAUST_GITHUB_BRANCH;
  vi.resetModules();
});

describe('static gallery rendering', () => {
  it('builds safe project routes with base-aware links and optional actions', async () => {
    await writeProject(
      'covered',
      { demo: 'https://demo.example/covered', repository: 'https://code.example/covered', cover: 'cover.png' },
      '# Covered\n\nA **safe** excerpt <script>alert(1)</script> [bad](javascript:alert(1)) <img src=x onerror=alert(1)>.',
      'cover.png',
    );
    await writeProject(
      'plain',
      {},
      '# Plain\n\nA plain excerpt.',
    );
    await writeProject(
      'archived-cli',
      { title: 'Archived CLI', status: 'archived', type: 'cli' },
      '# Archived\n\nAn archived excerpt.',
    );

    delete process.env.FAUST_BASE;
    process.env.FAUST_SITE = 'https://example.test';
    process.env.FAUST_GITHUB_REPOSITORY = 'lab';
    vi.resetModules();
    const { generateProjectIndex } = await import('../../../tools/generate-project-index.js');
    await generateProjectIndex({ root: fixtureRoot, write: () => undefined });
    await execFileAsync('pnpm', [
      'exec', 'astro', 'build', '--root', join(fixtureRoot, 'gallery'), '--outDir', outputRoot,
    ], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        FAUST_SITE: 'https://example.test',
        FAUST_GITHUB_REPOSITORY: 'lab',
      },
    });

    const home = await readFile(join(outputRoot, 'index.html'), 'utf8');
    const covered = await readFile(join(outputRoot, 'projects/covered/index.html'), 'utf8');
    const plain = await readFile(join(outputRoot, 'projects/plain/index.html'), 'utf8');

    expect(home).toContain('2 projects');
    expect(home).toContain('href="/lab/projects/covered/"');
    expect(home).toContain('href="/lab/projects/plain/"');
    expect(home).toMatch(/<form[^>]*method="get"[^>]*data-project-filters/);
    expect(home).toMatch(/<noscript[^>]*>Interactive filtering requires JavaScript\. The default active projects remain readable\.<\/noscript>/);
    expect(home).toMatch(/<button type="submit"[^>]*data-filter-apply[^>]*hidden/);
    expect(home).toMatch(/<label for="home-projects-type"[^>]*>Type<\/label>/);
    expect(home).toMatch(/<select id="home-projects-type" name="type"/);
    expect(home).toMatch(/<option value="all" selected[^>]*>All types<\/option>/);
    expect(home).toMatch(/<label for="home-projects-status"[^>]*>Status<\/label>/);
    expect(home).toMatch(/<option value="active" selected[^>]*>Active<\/option>/);
    expect(home).toMatch(/data-type="web" data-status="building"/);
    expect(home).toMatch(/data-type="cli" data-status="archived" hidden/);
    expect(home).toMatch(/aria-live="polite" aria-atomic="true"[^>]*>2 projects/);
    expect(home).toMatch(/data-filter-empty hidden/);
    expect(home).toMatch(/<button type="button" data-filter-reset[^>]*>Reset filters<\/button>/);
    expect(covered).toContain('href="https://demo.example/covered"');
    expect(covered).toContain('href="https://code.example/covered"');
    expect(covered).toContain('src="/lab/project-assets/covered/cover.png"');
    expect(await readFile(join(outputRoot, 'project-assets/covered/cover.png'), 'utf8')).toBe('fixture image');
    expect(covered).toContain('<strong>safe</strong>');
    expect(plain).toContain('No cover for Plain Work');
    expect(plain).toContain('href="https://github.com/lurui1997/lab/tree/main/projects/plain"');
    expect(plain).not.toMatch(/>\s*Demo\s*</);
    for (const html of [covered, plain]) {
      expect(html).not.toMatch(/<script|javascript:|\son[a-z]+\s*=|<img src=x/i);
    }
  });

  it('lets an explicit Pages base override the configured repository', async () => {
    process.env.FAUST_BASE = '/explicit-base';
    process.env.FAUST_GITHUB_REPOSITORY = 'lab';
    const configModule = await import(new URL('../../astro.config.mjs?explicit-base', import.meta.url).href);
    expect(configModule.default.base).toBe('/explicit-base');
  });

});

describe('filter URL state', () => {
  it('accepts valid query values and safely falls back from invalid values', async () => {
    const { readFilterState } = await import('../scripts/filters.js');
    const valid = readFilterState(new URLSearchParams('type=web&status=shipped'), ['cli', 'web']);
    const invalid = readFilterState(new URLSearchParams('type=bogus&status=deleted'), ['cli', 'web']);

    expect(valid).toEqual({ type: 'web', status: 'shipped' });
    expect(invalid).toEqual({ type: 'all', status: 'active' });
  });

  it('serializes only non-default filters beneath the current base path', async () => {
    const { filterUrl } = await import('../scripts/filters.js');

    expect(filterUrl('/nested/gallery/', { type: 'all', status: 'active' })).toBe('/nested/gallery/');
    expect(filterUrl('/nested/gallery/', { type: 'web', status: 'all' }))
      .toBe('/nested/gallery/?type=web&status=all');
  });

  it('distinguishes an empty gallery from a filter with no matches', async () => {
    const { showNoMatches } = await import('../scripts/filters.js');

    expect(showNoMatches(0, 0)).toBe(false);
    expect(showNoMatches(0, 3)).toBe(true);
    expect(showNoMatches(1, 3)).toBe(false);
  });
});
