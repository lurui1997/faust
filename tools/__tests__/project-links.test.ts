import { describe, expect, it } from 'vitest';

import { coverUrl, projectUrl, sourceUrl } from '../project-links.js';

describe('project links', () => {
  const repo = { owner: 'a', name: 'faust', branch: 'feature/one' };

  it('resolves local source from repository config', () => {
    expect(sourceUrl({ slug: 'search', repository: './' }, repo))
      .toBe('https://github.com/a/faust/tree/feature%2Fone/projects/search');
  });

  it('passes through an external HTTPS source', () => {
    expect(sourceUrl({ slug: 'search', repository: 'https://example.com/repo' }, repo))
      .toBe('https://example.com/repo');
  });

  it('prefixes project and cover paths with a normalized base', () => {
    expect(projectUrl('hello', '/faust/')).toBe('/faust/projects/hello/');
    expect(coverUrl('hello', 'images/cover one.png', '/faust')).toBe('/faust/project-assets/hello/images/cover%20one.png');
    expect(projectUrl('hello', '/')).toBe('/projects/hello/');
    expect(coverUrl('hello', null, '/faust')).toBeNull();
  });
});
