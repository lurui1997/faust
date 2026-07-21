import { describe, expect, it } from 'vitest';

import type { GalleryProject } from '../../../tools/generate-project-index.js';
import { filterProjects, orderProjects } from '../lib/projects.js';

const project = (slug: string, overrides: Partial<GalleryProject> = {}): GalleryProject => ({
  title: slug,
  slug,
  summary: `${slug} summary`,
  status: 'building',
  type: 'web',
  tags: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-07-20',
  featured: false,
  demo: null,
  repository: './',
  cover: null,
  excerptHtml: `<p>${slug}</p>`,
  year: '2026',
  href: `/faust/projects/${slug}/`,
  sourceHref: `https://github.com/lurui1997/faust/tree/main/projects/${slug}`,
  coverHref: null,
  ...overrides,
});

const projects = [
  project('archive', { status: 'archived', updatedAt: '2026-07-22' }),
  project('older', { status: 'shipped', type: 'cli', updatedAt: '2026-07-19' }),
  project('newest', { status: 'idea', updatedAt: '2026-07-21' }),
];

describe('project ordering', () => {
  it('orders by updated date descending and slug ascending for ties', () => {
    const items = [
      project('zulu', { updatedAt: '2026-07-21' }),
      project('old', { updatedAt: '2026-07-20' }),
      project('alpha', { updatedAt: '2026-07-21' }),
    ];

    expect(orderProjects(items).map(({ slug }) => slug)).toEqual(['alpha', 'zulu', 'old']);
    expect(items.map(({ slug }) => slug)).toEqual(['zulu', 'old', 'alpha']);
  });
});

describe('project filtering', () => {
  it('defaults to all non-archived projects', () => {
    expect(filterProjects(projects, { type: 'all', status: 'active' }).map(({ slug }) => slug))
      .toEqual(['older', 'newest']);
  });

  it('allows an explicit archived filter', () => {
    expect(filterProjects(projects, { type: 'all', status: 'archived' }).map(({ slug }) => slug))
      .toEqual(['archive']);
  });

  it('matches type and concrete status values exactly', () => {
    expect(filterProjects(projects, { type: 'cli', status: 'shipped' }).map(({ slug }) => slug))
      .toEqual(['older']);
    expect(filterProjects(projects, { type: 'c', status: 'ship' })).toEqual([]);
  });

  it('supports explicit all filters without changing input order', () => {
    expect(filterProjects(projects, { type: 'all', status: 'all' }).map(({ slug }) => slug))
      .toEqual(['archive', 'older', 'newest']);
  });
});
