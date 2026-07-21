import { chmod, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const validationMock = vi.hoisted(() => ({ validateProjectAt: vi.fn() }));

vi.mock('../validate-projects.js', async () => {
  const actual = await vi.importActual<typeof import('../validate-projects.js')>('../validate-projects.js');
  validationMock.validateProjectAt.mockImplementation(actual.validateProjectAt);
  return { ...actual, validateProjectAt: validationMock.validateProjectAt };
});

import { createProject, deriveSlug, renameNoReplace, runInteractiveCreator } from '../create-project.js';
import { validateProjects } from '../validate-projects.js';
import { copyRenderedTemplate } from '../lib/templates.js';
import { cleanupRepositories, makeRepository } from './fixtures.js';

afterEach(async () => {
  validationMock.validateProjectAt.mockClear();
  await cleanupRepositories();
});

const input = (root: string, template: 'blank' | 'web' | 'script' = 'blank') => ({
  root,
  title: 'My Idea',
  slug: 'my-idea',
  type: 'other' as const,
  summary: 'Try it.',
  template,
  today: '2026-07-21',
});

describe.each(['blank', 'web', 'script'] as const)('%s template', (template) => {
  it('creates a valid, fully rendered project without executable files or dependencies', async () => {
    const root = await makeRepository();
    const result = await createProject(input(root, template));

    expect(result.path).toBe(join(root, 'projects', 'my-idea'));
    await expect(validateProjects({ root, only: 'my-idea' })).resolves.toMatchObject({ ok: true });
    const readme = await readFile(join(result.path, 'README.md'), 'utf8');
    expect(readme).toBe('# My Idea\n\n## Purpose\n\nTry it.\n\n## Development\n\n' + ({
      blank: 'Document the chosen stack and local development commands here.',
      web: 'Open `index.html` in a browser.',
      script: 'Run `node src/index.mjs`.',
    })[template] + '\n\n## Status\n\nIdea created on 2026-07-21.\n');
    expect(readme).not.toContain('{{');

    for (const entry of await readdir(result.path, { recursive: true, withFileTypes: true })) {
      if (entry.isFile()) expect((await stat(join(entry.parentPath, entry.name))).mode & 0o111).toBe(0);
    }
    if (template !== 'blank') {
      const packageJson = JSON.parse(await readFile(join(result.path, 'package.json'), 'utf8'));
      expect(packageJson.dependencies ?? {}).toEqual({});
      expect(packageJson.devDependencies ?? {}).toEqual({});
    }
  });
});

it('derives an ASCII kebab slug and rejects invalid explicit slugs', async () => {
  expect(deriveSlug('Crème & Search')).toBe('creme-search');
  const root = await makeRepository();
  const created = await createProject({ ...input(root), slug: undefined, title: 'Crème & Search' });
  expect(created.metadata.slug).toBe('creme-search');
  await expect(createProject({ ...input(root), slug: '../escape' })).rejects.toThrow(/slug/i);
});

it('validates the physical staging path against the intended slug', async () => {
  const root = await makeRepository();
  await createProject(input(root));

  expect(validationMock.validateProjectAt).toHaveBeenCalledWith({
    projectPath: expect.stringMatching(/\/projects\/\.my-idea\.stage-[^/]+$/),
    expectedDirectoryName: 'my-idea',
  });
});

it('leaves no project or staging directory when validation fails', async () => {
  const root = await makeRepository();
  validationMock.validateProjectAt.mockResolvedValueOnce({
    ok: false,
    errors: [{ project: 'my-idea', field: 'README.md', message: 'broken', fix: 'fix it' }],
  });

  await expect(createProject(input(root))).rejects.toThrow(/failed validation/i);
  await expect(readdir(join(root, 'projects'))).resolves.toEqual([]);
});

it('does not overwrite an existing destination', async () => {
  const root = await makeRepository([{ dir: 'my-idea', readme: 'sentinel' }]);
  await expect(createProject(input(root))).rejects.toThrow(/exists|conflict/i);
  await expect(readFile(join(root, 'projects/my-idea/README.md'), 'utf8')).resolves.toBe('sentinel');
});

it('rejects symlinks and unknown or leftover placeholders and cleans staging', async () => {
  for (const kind of ['symlink', 'unknown', 'leftover'] as const) {
    const root = await makeRepository();
    const templateRoot = join(root, 'bad-templates');
    await mkdir(join(templateRoot, 'blank'), { recursive: true });
    await writeFile(join(templateRoot, 'blank/README.md.tpl'), '# {{TITLE}}\n{{SUMMARY}}\n{{DEVELOPMENT}}\n{{CREATED_AT}}');
    if (kind === 'symlink') await symlink('/etc/passwd', join(templateRoot, 'blank/escape.tpl'));
    else await writeFile(join(templateRoot, 'blank/bad.tpl'), kind === 'unknown' ? '{{EVIL}}' : '{{broken');

    await expect(createProject({ ...input(root), templateRoot })).rejects.toThrow();
    await expect(readdir(join(root, 'projects'))).resolves.toEqual([]);
  }
});

it('rejects a symlink used as the selected template directory', async () => {
  const root = await makeRepository();
  const templateRoot = join(root, 'bad-templates');
  const outside = join(root, 'outside');
  await mkdir(templateRoot);
  await mkdir(outside);
  await writeFile(join(outside, 'README.md.tpl'), '# {{TITLE}}');
  await symlink(outside, join(templateRoot, 'blank'));

  await expect(createProject({ ...input(root), templateRoot })).rejects.toThrow(/symlink/i);
  await expect(readdir(join(root, 'projects'))).resolves.toEqual([]);
});

it('refuses a template file swapped to a symlink before descriptor open', async () => {
  const root = await makeRepository();
  const templateRoot = join(root, 'templates');
  const source = join(templateRoot, 'blank/README.md.tpl');
  await mkdir(join(templateRoot, 'blank'), { recursive: true });
  await writeFile(source, '# {{TITLE}}');
  await expect(copyRenderedTemplate({
    templateRoot,
    template: 'blank',
    destination: join(root, 'destination'),
    values: { TITLE: 'Safe' },
    beforeOpenFile: async (path) => {
      await rm(path);
      await symlink('/etc/passwd', path);
    },
  })).rejects.toThrow();
});

it('rejects a template root writable by untrusted users', async () => {
  const root = await makeRepository();
  const templateRoot = join(root, 'templates');
  await mkdir(join(templateRoot, 'blank'), { recursive: true });
  await writeFile(join(templateRoot, 'blank/README.md.tpl'), '# {{TITLE}}');
  await chmod(templateRoot, 0o777);
  await expect(createProject({ ...input(root), templateRoot })).rejects.toThrow(/writable by group or other/i);
});

it('escapes titles for generated JavaScript and HTML contexts', async () => {
  const title = `Bob's </title><script>alert(1)</script>\nidea`;
  for (const template of ['web', 'script'] as const) {
    const root = await makeRepository();
    const result = await createProject({ ...input(root, template), title });
    const scriptPath = join(result.path, template === 'web' ? 'src/main.js' : 'src/index.mjs');
    const script = await readFile(scriptPath, 'utf8');
    expect(script).toContain(JSON.stringify(title));
    expect(script).not.toContain(`'${title}'`);
    if (template === 'web') {
      const html = await readFile(join(result.path, 'index.html'), 'utf8');
      expect(html).toContain("Bob's &lt;/title&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).not.toContain('</title><script>');
    }
  }
});

it('preserves literal braces supplied by the user', async () => {
  const root = await makeRepository();
  const result = await createProject({
    ...input(root),
    title: 'Explore {{ syntax }}',
    summary: 'Compare {{ and }} literally.',
  });
  const readme = await readFile(join(result.path, 'README.md'), 'utf8');
  expect(readme).toContain('# Explore {{ syntax }}');
  expect(readme).toContain('Compare {{ and }} literally.');
});

it('allows only one concurrent creator to publish and never replaces the winner', async () => {
  const root = await makeRepository();
  const results = await Promise.allSettled([
    createProject({ ...input(root), summary: 'first' }),
    createProject({ ...input(root), summary: 'second' }),
  ]);
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  const metadata = JSON.parse(await readFile(join(root, 'projects/my-idea/project.json'), 'utf8'));
  expect(['first', 'second']).toContain(metadata.summary);
  expect((await readdir(join(root, 'projects'))).filter((name) => name.includes('.stage-') || name.includes('.lock'))).toEqual([]);
});

it('atomically rejects a destination created immediately before publication and preserves it', async () => {
  const root = await makeRepository();
  const staging = join(root, 'projects/.my-idea.stage-test');
  const final = join(root, 'projects/my-idea');
  await mkdir(staging);
  await writeFile(join(staging, 'winner'), 'staged');

  await expect(renameNoReplace(staging, final, {
    beforeRename: async () => {
      await mkdir(final);
      await writeFile(join(final, 'sentinel'), 'do not replace');
    },
  })).rejects.toThrow(/exists/i);
  await expect(readFile(join(final, 'sentinel'), 'utf8')).resolves.toBe('do not replace');
  expect((await readdir(join(root, 'projects'))).filter((name) => name.includes('.lock'))).toEqual([]);
});

it('ignores legacy stale creator locks because publication no longer relies on locks', async () => {
  const root = await makeRepository();
  await writeFile(join(root, 'projects/.create-my-idea.lock'), 'stale owner');
  await expect(createProject(input(root))).resolves.toMatchObject({ metadata: { slug: 'my-idea' } });
});

it('allows exactly one full creator to win atomic publication without replacement', async () => {
  const root = await makeRepository();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let locked!: () => void;
  const hasLocked = new Promise<void>((resolve) => { locked = resolve; });
  const delayed = createProject(
    { ...input(root), summary: 'delayed loser' },
    { beforeAtomicPublication: async () => { locked(); await gate; } },
  );
  await hasLocked;
  await createProject({ ...input(root), summary: 'atomic winner' });
  release();
  await expect(delayed).rejects.toThrow(/already exists/i);

  const final = join(root, 'projects/my-idea');
  const metadata = JSON.parse(await readFile(join(final, 'project.json'), 'utf8'));
  expect(metadata.summary).toBe('atomic winner');
  expect((await readdir(join(root, 'projects'))).filter((name) => name.includes('.stage-') || name.includes('.lock'))).toEqual([]);
});

it.each([
  ['blank', 'Next: cd projects/my-idea and document your development setup.'],
  ['web', 'Next: cd projects/my-idea and open index.html in a browser.'],
  ['script', 'Next: cd projects/my-idea && node src/index.mjs'],
] as const)('prints the %s template next step through the injected writer', async (template, expected) => {
  const root = await makeRepository();
  const lines: string[] = [];
  await runInteractiveCreator(root, {
    promptTitle: async () => 'My Idea',
    promptType: async () => 'other',
    promptTemplate: async () => template,
    promptSummary: async () => 'Try it.',
    confirmSlug: async () => true,
    promptSlug: async () => { throw new Error('unexpected slug prompt'); },
    write: (line) => lines.push(line),
    writeError: (line) => lines.push(`ERROR: ${line}`),
  });
  expect(lines).toEqual(['Created projects/my-idea', expected]);
});
