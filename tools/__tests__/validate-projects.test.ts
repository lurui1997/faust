import { mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  formatErrors,
  runValidationCli,
  validateProjectAt,
  validateProjects,
} from '../validate-projects.js';
import { makeRepository, validProject, writeValidProject } from './fixtures.js';

describe('repository project validation', () => {
  it('accepts an empty projects directory', async () => {
    const root = await makeRepository();

    await expect(validateProjects({ root })).resolves.toEqual({ ok: true, projects: [] });
  });

  it('accepts a repository before its first projects directory is created', async () => {
    const root = await makeRepository();
    await rm(join(root, 'projects'), { recursive: true });

    await expect(validateProjects({ root })).resolves.toEqual({ ok: true, projects: [] });
  });

  it('reports a missing project.json with an actionable fix', async () => {
    const root = await makeRepository([{ dir: 'my-idea', readme: '# My Idea' }]);

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'my-idea', field: 'project.json' })],
    });
    if (!result.ok) expect(formatErrors(result.errors)).toContain('fix: create project.json');
  });

  it('reports a missing README with an actionable fix', async () => {
    const root = await makeRepository([{ dir: 'my-idea', metadata: validProject }]);

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'my-idea', field: 'README.md' })],
    });
  });

  it('reports malformed JSON without executing it', async () => {
    const root = await makeRepository([
      { dir: 'my-idea', projectJson: '{ "slug": "my-idea",', readme: '# My Idea' },
    ]);

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'my-idea', field: 'project.json' })],
    });
    if (!result.ok) expect(formatErrors(result.errors)).toContain('valid JSON');
  });

  it('reports schema fields and how to correct them', async () => {
    const root = await makeRepository([
      { dir: 'my-idea', metadata: { ...validProject, status: 'paused' }, readme: '# My Idea' },
    ]);

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'my-idea', field: 'status', fix: expect.any(String) })],
    });
  });

  it('reports slug-directory mismatches with the corrective choices', async () => {
    const root = await makeRepository([
      { dir: 'wrong-dir', metadata: validProject, readme: '# My Idea' },
    ]);

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'wrong-dir', field: 'slug' })],
    });
    if (!result.ok) expect(formatErrors(result.errors)).toContain('rename the directory or change slug');
  });

  it('reports every project that declares a duplicate slug', async () => {
    const root = await makeRepository([
      { dir: 'alpha', metadata: { ...validProject, slug: 'shared' }, readme: '# Alpha' },
      { dir: 'beta', metadata: { ...validProject, slug: 'shared' }, readme: '# Beta' },
    ]);

    const result = await validateProjects({ root });

    expect(result).toMatchObject({ ok: false });
    if (!result.ok) {
      expect(result.errors.filter((error) => error.field === 'slug' && error.message.includes('duplicate')))
        .toEqual([
          expect.objectContaining({ project: 'alpha' }),
          expect.objectContaining({ project: 'beta' }),
        ]);
    }
  });

  it('reports a referenced cover that does not exist', async () => {
    const root = await makeRepository([
      {
        dir: 'my-idea',
        metadata: { ...validProject, cover: 'images/missing.png' },
        readme: '# My Idea',
      },
    ]);

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'my-idea', field: 'cover' })],
    });
  });

  it('rejects a cover symlink that escapes the real project directory', async () => {
    const root = await makeRepository([
      { dir: 'my-idea', metadata: { ...validProject, cover: 'images/cover.png' }, readme: '# My Idea' },
    ]);
    const projectPath = join(root, 'projects', 'my-idea');
    const outside = join(root, 'outside');
    await mkdir(outside);
    await writeFile(join(outside, 'cover.png'), 'private');
    await symlink(outside, join(projectPath, 'images'));

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'my-idea', field: 'cover' })],
    });
    if (!result.ok) expect(formatErrors(result.errors)).toContain('inside the project directory');
  });

  it('accepts an in-project cover whose directory name begins with two dots', async () => {
    const root = await makeRepository([
      {
        dir: 'my-idea',
        metadata: { ...validProject, cover: '..covers/cover.png' },
        readme: '# My Idea',
        cover: '..covers/cover.png',
      },
    ]);

    await expect(validateProjects({ root })).resolves.toMatchObject({ ok: true });
  });

  it('rejects a directory used as a cover', async () => {
    const root = await makeRepository([
      { dir: 'my-idea', metadata: { ...validProject, cover: 'images' }, readme: '# My Idea' },
    ]);
    await mkdir(join(root, 'projects', 'my-idea', 'images'));

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'my-idea', field: 'cover' })],
    });
  });

  it('rejects a README symlink that escapes the real project directory', async () => {
    const root = await makeRepository([{ dir: 'my-idea', metadata: validProject }]);
    await writeFile(join(root, 'outside.md'), '# Not this project');
    await symlink(join(root, 'outside.md'), join(root, 'projects', 'my-idea', 'README.md'));

    const result = await validateProjects({ root });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: 'my-idea', field: 'README.md' })],
    });
  });

  it('does not allow only to select a directory outside projects', async () => {
    const root = await makeRepository();
    await writeValidProject(join(root, 'outside'), { ...validProject, slug: 'outside' });

    const result = await validateProjects({ root, only: '../outside' });

    expect(result).toMatchObject({
      ok: false,
      errors: [expect.objectContaining({ project: '../outside', field: 'directory' })],
    });
  });

  it('discovers only sorted direct child directories', async () => {
    const root = await makeRepository([
      { dir: 'zulu', metadata: { ...validProject, slug: 'zulu' }, readme: '# Zulu' },
      { dir: 'alpha', metadata: { ...validProject, slug: 'alpha' }, readme: '# Alpha' },
    ]);
    await writeFile(join(root, 'projects', 'ignored.txt'), 'not a project');

    const result = await validateProjects({ root });

    expect(result).toMatchObject({ ok: true });
    if (result.ok) expect(result.projects.map((project) => project.slug)).toEqual(['alpha', 'zulu']);
  });
});

describe('validateProjectAt', () => {
  it('validates a random staging path against its intended final directory name', async () => {
    const root = await makeRepository();
    const projectPath = join(root, 'projects', '.my-idea.stage-abc123');
    await writeValidProject(projectPath);

    await expect(validateProjectAt({ projectPath, expectedDirectoryName: 'my-idea' }))
      .resolves.toMatchObject({ ok: true, project: { slug: 'my-idea' } });
    await expect(validateProjectAt({ projectPath, expectedDirectoryName: 'different-name' }))
      .resolves.toMatchObject({ ok: false, errors: [expect.objectContaining({ field: 'slug' })] });
  });

  it('reads README and cover from the physical staging path', async () => {
    const root = await makeRepository();
    const projectPath = join(root, 'projects', '.random-stage-name');
    await writeValidProject(projectPath, { ...validProject, cover: 'assets/cover.png' });

    await expect(validateProjectAt({ projectPath, expectedDirectoryName: 'my-idea' }))
      .resolves.toMatchObject({ ok: true, project: { slug: 'my-idea' } });
  });
});

describe('validation CLI', () => {
  it('prints actionable errors and returns status 1 without a stack trace', async () => {
    const root = await makeRepository([{ dir: 'broken', readme: '# Broken' }]);
    const output: string[] = [];

    const exitCode = await runValidationCli({ root, write: (line) => output.push(line) });

    expect(exitCode).toBe(1);
    expect(output).toHaveLength(1);
    expect(output[0]).toMatch(/^broken: project\.json — .+; fix: create project\.json/m);
    expect(output[0]).not.toContain('\n    at ');
  });
});
