import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import stringWidth from 'string-width';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GalleryProject } from '../generate-project-index.js';
import { formatProjectList, runListProjectsCli } from '../list-projects.js';
import { cleanupRepositories, makeRepository, validProject } from './fixtures.js';

afterEach(async () => cleanupRepositories());

const galleryProject = (
  slug: string,
  overrides: Partial<GalleryProject> = {},
): GalleryProject => ({
  ...validProject,
  tags: [...validProject.tags],
  slug,
  title: slug,
  excerptHtml: '<p>Example.</p>',
  year: '2026',
  href: `/projects/${slug}/`,
  sourceHref: `https://example.com/${slug}`,
  coverHref: null,
  ...overrides,
});

describe('project maintenance listing', () => {
  it('prints title, type, status, and path in gallery order', () => {
    const older = galleryProject('older', {
      title: 'Older',
      type: 'ai',
      status: 'building',
      updatedAt: '2026-07-20',
    });
    const newer = galleryProject('newer', {
      title: 'Newer',
      type: 'web',
      status: 'shipped',
      updatedAt: '2026-07-21',
    });

    expect(formatProjectList([older, newer])).toBe([
      'TITLE  TYPE  STATUS    PATH',
      'Newer  web   shipped   projects/newer',
      'Older  ai    building  projects/older',
    ].join('\n'));
  });

  it('uses slug ascending to break equal updated-date ties', () => {
    const zulu = galleryProject('zulu', { title: 'Zulu' });
    const alpha = galleryProject('alpha', { title: 'Alpha' });

    expect(formatProjectList([zulu, alpha]).split('\n').slice(1)).toEqual([
      'Alpha  other  building  projects/alpha',
      'Zulu   other  building  projects/zulu',
    ]);
  });

  it('pads columns by terminal display width for Unicode titles', () => {
    const cjk = galleryProject('cjk', { title: '项目', updatedAt: '2026-07-21' });
    const combining = galleryProject('accent', { title: 'e\u0301', updatedAt: '2026-07-20' });

    expect(formatProjectList([combining, cjk]).split('\n')).toEqual([
      'TITLE  TYPE   STATUS    PATH',
      '项目   other  building  projects/cjk',
      'e\u0301      other  building  projects/accent',
    ]);
  });

  it('aligns keycap, ZWJ-family, and flag grapheme clusters', () => {
    const projects = [
      galleryProject('keycap', { title: '1️⃣', updatedAt: '2026-07-23' }),
      galleryProject('family', { title: '👨‍👩‍👧‍👦', updatedAt: '2026-07-22' }),
      galleryProject('flag', { title: '🇨🇳', updatedAt: '2026-07-21' }),
    ];

    const rows = formatProjectList(projects).split('\n').slice(1);
    const typeOffsets = rows.map((row) => stringWidth(row.slice(0, row.indexOf('other'))));

    expect(new Set(typeOffsets).size).toBe(1);
    expect(rows[1]).toContain('👨\\u{200D}👩\\u{200D}👧\\u{200D}👦');
    expect(rows[1]).not.toContain('\u200d');
  });

  it('escapes control and format characters before measuring terminal cells', () => {
    const hostile = galleryProject('hostile', { title: 'safe\n\r\t\u001b\u202eend' });
    const output = formatProjectList([hostile]);
    const row = output.split('\n')[1];

    expect(row).toBe('safe\\n\\r\\t\\u{1B}\\u{202E}end  other  building  projects/hostile');
    expect(row).not.toMatch(/[\p{Control}\p{Format}]/u);
    expect(output).not.toContain('\u001b[');
  });

  it('prints the intentional empty-repository message exactly', () => {
    expect(formatProjectList([])).toBe('No projects found. Run pnpm create:project.');
  });

  it('writes successful output only to stdout', async () => {
    const root = await makeRepository();
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await runListProjectsCli({ root })).toBe(0);
    expect(stdout).toHaveBeenCalledOnce();
    expect(stdout).toHaveBeenCalledWith('No projects found. Run pnpm create:project.');
    expect(stderr).not.toHaveBeenCalled();
  });

  it('validates before printing and writes actionable failures only to stderr', async () => {
    const hostileName = 'broken\n\t\u001b\u202e';
    const root = await makeRepository([{
      dir: hostileName,
      metadata: { ...validProject, slug: 'broken' },
    }]);
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await runListProjectsCli({ root })).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledOnce();
    const message = String(stderr.mock.calls[0][0]);
    expect(message).toContain('broken\\n\\t\\u{1B}\\u{202E}: README.md');
    expect(message).toContain('fix:');
    expect(message).not.toContain('TITLE');
    expect(message).not.toContain('    at ');
    expect(message).not.toMatch(/[\p{Control}\p{Format}]/u);
  });

  it('writes generic repository failures only to stderr without a stack trace', async () => {
    const parent = await makeRepository();
    const root = join(parent, 'generic\n\r\t\u001b\u202e');
    await mkdir(root);
    await writeFile(join(root, 'projects'), 'not a directory');
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await runListProjectsCli({ root })).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledOnce();
    const message = String(stderr.mock.calls[0][0]);
    expect(message).toMatch(/^repository: projects — listing could not run:/);
    expect(message).toContain('fix: ensure projects/ exists and is readable');
    expect(message).not.toContain('    at ');
    expect(message).toContain('generic\\n\\r\\t\\u{1B}\\u{202E}');
    expect(message).not.toMatch(/[\p{Control}\p{Format}]/u);
  });
});
