import { afterEach, describe, expect, it } from 'vitest';

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

  it('prints the intentional empty-repository message exactly', () => {
    expect(formatProjectList([])).toBe('No projects found. Run pnpm create:project.');
  });

  it('validates before printing and reports an actionable failure without a stack trace', async () => {
    const root = await makeRepository([{
      dir: 'broken',
      metadata: { ...validProject, slug: 'broken' },
    }]);
    const lines: string[] = [];

    expect(await runListProjectsCli({ root, write: (line) => lines.push(line) })).toBe(1);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('broken: README.md');
    expect(lines[0]).toContain('fix:');
    expect(lines[0]).not.toContain('TITLE');
    expect(lines[0]).not.toContain('    at ');
  });
});
