import { mkdir, readFile, readlink, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildProjectIndex, generateProjectIndex } from '../generate-project-index.js';
import { extractExcerptHtml, visibleText } from '../lib/readme.js';
import { cleanupRepositories, makeRepository, validProject } from './fixtures.js';

afterEach(async () => cleanupRepositories());

describe('README excerpts', () => {
  it('keeps safe inline formatting and strips active content and images', () => {
    const markdown = '# Title\n\nFirst *small* **useful** `code` [good](/docs) [bad](javascript:alert(1)) ![secret](x) <script>alert(1)</script>';
    const html = extractExcerptHtml(markdown, 'Fallback', 240);

    expect(html).toContain('<em>small</em>');
    expect(html).toContain('<strong>useful</strong>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<a href="/docs">good</a>');
    expect(html).not.toMatch(/javascript:|script|<img|secret/i);
  });

  it('adds noreferrer only to external HTTP links and rejects data links', () => {
    const html = extractExcerptHtml('[external](https://example.com) [local](../readme) [bad](data:text/html,x)', 'Fallback');
    expect(html).toContain('<a href="https://example.com" rel="noreferrer">external</a>');
    expect(html).toContain('<a href="../readme">local</a>');
    expect(html).not.toContain('data:');
  });

  it('uses the first nonempty paragraph after an optional H1', () => {
    expect(visibleText(extractExcerptHtml('# Heading\n\n\nFirst paragraph.\n\nSecond paragraph.', 'Fallback')))
      .toBe('First paragraph.');
  });

  it('continues past a paragraph that is empty after images are removed', () => {
    expect(visibleText(extractExcerptHtml('![x](a)\n\nReal paragraph.', 'Fallback')))
      .toBe('Real paragraph.');
  });

  it('falls back to an escaped summary when there is no paragraph', () => {
    expect(extractExcerptHtml('# Heading\n\n- only a list', '<b>fallback</b>')).toBe('<p>&lt;b&gt;fallback&lt;/b&gt;</p>');
  });

  it('honors exact code-point bounds and truncates at a word boundary', () => {
    expect(Array.from(visibleText(extractExcerptHtml('a'.repeat(240), 'x')))).toHaveLength(240);
    const excerpt = visibleText(extractExcerptHtml(`${'word '.repeat(60)}tail`, 'x'));
    expect(Array.from(excerpt).length).toBeLessThanOrEqual(240);
    expect(excerpt.endsWith('…')).toBe(true);
    expect(excerpt.at(-2)).not.toBe(' ');
  });

  it('counts Unicode code points and truncates a single long word', () => {
    const excerpt = visibleText(extractExcerptHtml('😀'.repeat(241), 'x'));
    expect(Array.from(excerpt)).toHaveLength(240);
    expect(excerpt).toBe(`${'😀'.repeat(239)}…`);
  });

  it('reports decoded visible text rather than HTML entity source', () => {
    expect(visibleText('<p>&amp; &lt; &#128512;</p>')).toBe('& < 😀');
  });

  it('preserves HTML-looking inline code and escaped entity text literally', () => {
    const html = extractExcerptHtml('Use `<strong>literal</strong>` and &lt;em&gt;text&lt;/em&gt; safely.', 'Fallback');
    expect(html).toContain('<code>&lt;strong&gt;literal&lt;/strong&gt;</code>');
    expect(html).toContain('&lt;em&gt;text&lt;/em&gt;');
    expect(html).not.toContain('<code><strong>');
  });

  it('uses the summary fallback when README content is only a raw HTML block', () => {
    const html = extractExcerptHtml('<script>\nalert(1)\n</script>', 'Safe fallback');
    expect(html).toBe('<p>Safe fallback</p>');
    expect(visibleText(html)).not.toMatch(/script|alert/i);
  });
});

describe('project index generation', () => {
  it('sorts by updatedAt descending and slug ascending for ties', async () => {
    const root = await makeRepository([
      { dir: 'zulu', metadata: { ...validProject, slug: 'zulu' }, readme: '# Z\n\nZulu.' },
      { dir: 'alpha', metadata: { ...validProject, slug: 'alpha' }, readme: '# A\n\nAlpha.' },
      { dir: 'a-a', metadata: { ...validProject, slug: 'a-a' }, readme: 'Dash.' },
      { dir: 'a1', metadata: { ...validProject, slug: 'a1' }, readme: 'Digit.' },
      { dir: 'aa', metadata: { ...validProject, slug: 'aa' }, readme: 'Letters.' },
      { dir: 'old', metadata: { ...validProject, slug: 'old', updatedAt: '2026-07-20' }, readme: 'Old.' },
    ]);
    expect((await buildProjectIndex(root)).map(({ slug }) => slug)).toEqual(['a-a', 'a1', 'aa', 'alpha', 'zulu', 'old']);
  });

  it('writes deterministic JSON with one newline and reports an empty repository', async () => {
    const root = await makeRepository();
    const lines: string[] = [];
    await generateProjectIndex({ root, write: (line) => lines.push(line) });

    expect(await readFile(join(root, 'gallery/src/data/projects.generated.json'), 'utf8')).toBe('[]\n');
    expect(lines).toEqual(['Generated 0 projects']);
  });

  it('removes stale immutable cover versions after a successful swap', async () => {
    const root = await makeRepository([{ dir: 'first', metadata: { ...validProject, slug: 'first', cover: 'cover.png' }, readme: 'One.', cover: 'cover.png' }]);
    await generateProjectIndex({ root });
    const publicPath = join(root, 'gallery/public');
    const firstTarget = await readlink(join(publicPath, 'project-assets'));

    await writeFile(join(root, 'projects/first/cover.png'), 'changed');
    await generateProjectIndex({ root });
    const secondTarget = await readlink(join(publicPath, 'project-assets'));

    expect(secondTarget).not.toBe(firstTarget);
    await expect(stat(join(publicPath, firstTarget))).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(join(publicPath, secondTarget, 'first/cover.png'), 'utf8')).resolves.toBe('changed');
  });

  it('preserves the active version when copying a new cover fails', async () => {
    const root = await makeRepository([{ dir: 'first', metadata: { ...validProject, slug: 'first', cover: 'cover.png' }, readme: 'One.', cover: 'cover.png' }]);
    await generateProjectIndex({ root });
    const publicPath = join(root, 'gallery/public');
    const firstTarget = await readlink(join(publicPath, 'project-assets'));
    await mkdir(join(root, 'projects/second'), { recursive: true });
    await writeFile(join(root, 'projects/second/project.json'), JSON.stringify({ ...validProject, slug: 'second', cover: 'cover.png' }));
    await writeFile(join(root, 'projects/second/README.md'), 'Two.');
    await writeFile(join(root, 'projects/second/cover.png'), 'two');

    await expect(generateProjectIndex({ root, copyCover: async () => { throw new Error('copy failed'); } })).rejects.toThrow('copy failed');
    expect(await readlink(join(publicPath, 'project-assets'))).toBe(firstTarget);
    await expect(readFile(join(publicPath, firstTarget, 'first/cover.png'), 'utf8')).resolves.toBe('image');
  });

  it('restores the prior pointer when writing the generated index fails after the swap', async () => {
    const root = await makeRepository([{ dir: 'first', metadata: { ...validProject, slug: 'first', cover: 'cover.png' }, readme: 'One.', cover: 'cover.png' }]);
    await generateProjectIndex({ root });
    const publicPath = join(root, 'gallery/public');
    const firstTarget = await readlink(join(publicPath, 'project-assets'));
    await writeFile(join(root, 'projects/first/cover.png'), 'changed');

    await expect(generateProjectIndex({ root, writeIndex: async () => { throw new Error('index failed'); } })).rejects.toThrow('index failed');
    expect(await readlink(join(publicPath, 'project-assets'))).toBe(firstTarget);
    await expect(readFile(join(publicPath, firstTarget, 'first/cover.png'), 'utf8')).resolves.toBe('image');
  });

  it('reports unsupported symlinks actionably', async () => {
    const root = await makeRepository();
    await expect(generateProjectIndex({ root, createSymlink: async () => {
      throw Object.assign(new Error('denied'), { code: 'EPERM' });
    } })).rejects.toThrow(/symbolic link.*enable/i);
  });
});
