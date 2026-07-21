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

    process.env.FAUST_BASE = '/test-base';
    process.env.FAUST_SITE = 'https://example.test';
    vi.resetModules();
    const { generateProjectIndex } = await import('../../../tools/generate-project-index.js');
    await generateProjectIndex({ root: fixtureRoot, write: () => undefined });
    await execFileAsync('pnpm', [
      'exec', 'astro', 'build', '--root', join(fixtureRoot, 'gallery'), '--outDir', outputRoot,
    ], {
      cwd: repositoryRoot,
      env: { ...process.env, FAUST_BASE: '/test-base', FAUST_SITE: 'https://example.test' },
    });

    const home = await readFile(join(outputRoot, 'index.html'), 'utf8');
    const covered = await readFile(join(outputRoot, 'projects/covered/index.html'), 'utf8');
    const plain = await readFile(join(outputRoot, 'projects/plain/index.html'), 'utf8');

    expect(home).toContain('2 projects');
    expect(home).toContain('href="/test-base/projects/covered/"');
    expect(home).toContain('href="/test-base/projects/plain/"');
    expect(covered).toContain('href="https://demo.example/covered"');
    expect(covered).toContain('href="https://code.example/covered"');
    expect(covered).toContain('src="/test-base/project-assets/covered/cover.png"');
    expect(await readFile(join(outputRoot, 'project-assets/covered/cover.png'), 'utf8')).toBe('fixture image');
    expect(covered).toContain('<strong>safe</strong>');
    expect(plain).toContain('No cover for Plain Work');
    expect(plain).toContain('href="https://github.com/lurui1997/faust/tree/main/projects/plain"');
    expect(plain).not.toMatch(/>\s*Demo\s*</);
    for (const html of [covered, plain]) {
      expect(html).not.toMatch(/<script|javascript:|\son[a-z]+\s*=|<img src=x/i);
    }
  });
});
