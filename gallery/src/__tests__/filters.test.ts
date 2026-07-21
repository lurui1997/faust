// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest';

import { initializeProjectFilters } from '../scripts/filters.js';

function indexMarkup(rows: string, suffix = ''): string {
  return `
    <section data-project-index>
      <h2 id="projects-heading${suffix}" data-project-heading tabindex="-1">Projects</h2>
      <p data-project-count aria-live="polite">2 projects</p>
      <form method="get" data-project-filters hidden>
        <label for="type${suffix}">Type</label>
        <select id="type${suffix}" name="type">
          <option value="all">All types</option><option value="cli">cli</option><option value="web">web</option>
        </select>
        <label for="status${suffix}">Status</label>
        <select id="status${suffix}" name="status">
          <option value="active">Active</option><option value="all">All statuses</option>
          <option value="idea">Idea</option><option value="building">Building</option>
          <option value="shipped">Shipped</option><option value="archived">Archived</option>
        </select>
        <button type="submit" data-filter-apply>Apply filters</button>
      </form>
      <ol>${rows}</ol>
      <div data-filter-empty hidden><p>No matches.</p><button type="button" data-filter-reset>Reset filters</button></div>
    </section>`;
}

const rows = `
  <li data-project-row data-type="web" data-status="shipped">Web</li>
  <li data-project-row data-type="cli" data-status="building">CLI</li>
  <li data-project-row data-type="web" data-status="archived" hidden>Archive</li>`;

function select(name: string): HTMLSelectElement {
  return document.querySelector<HTMLSelectElement>(`select[name="${name}"]`)!;
}

beforeEach(() => {
  document.body.innerHTML = indexMarkup(rows);
  window.history.replaceState(null, '', '/faust/');
});

describe('project filter enhancement', () => {
  it('hydrates a valid shared query and filters rows with a live singular count', () => {
    window.history.replaceState(null, '', '/faust/?type=web&status=shipped');
    initializeProjectFilters();

    expect(select('type').value).toBe('web');
    expect(select('status').value).toBe('shipped');
    expect([...document.querySelectorAll<HTMLElement>('[data-project-row]')].map((row) => row.hidden))
      .toEqual([false, true, true]);
    expect(document.querySelector('[data-project-count]')?.textContent).toBe('1 project');
    expect(window.location.pathname + window.location.search).toBe('/faust/?type=web&status=shipped');
    expect((document.querySelector('[data-project-filters]') as HTMLFormElement).hidden).toBe(false);
  });

  it('drops each invalid parameter independently while preserving the valid filter and pathname', () => {
    window.history.replaceState(null, '', '/faust/?type=bogus&status=building');
    initializeProjectFilters();
    expect(window.location.pathname + window.location.search).toBe('/faust/?status=building');

    document.body.innerHTML = indexMarkup(rows);
    window.history.replaceState(null, '', '/faust/?type=cli&status=deleted');
    initializeProjectFilters();
    expect(window.location.pathname + window.location.search).toBe('/faust/?type=cli');
  });

  it('applies changes and form submission, then exposes the no-match state', () => {
    initializeProjectFilters();
    select('type').value = 'cli';
    select('type').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.location.pathname + window.location.search).toBe('/faust/?type=cli');

    select('status').value = 'shipped';
    document.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(document.querySelector('[data-project-count]')?.textContent).toBe('0 projects');
    expect((document.querySelector('[data-filter-empty]') as HTMLElement).hidden).toBe(false);
  });

  it('resets defaults, restores active rows, cleans the URL, and focuses its heading', () => {
    window.history.replaceState(null, '', '/faust/?type=web&status=archived');
    initializeProjectFilters();
    (document.querySelector('[data-filter-reset]') as HTMLButtonElement).click();

    expect(select('type').value).toBe('all');
    expect(select('status').value).toBe('active');
    expect(window.location.pathname + window.location.search).toBe('/faust/');
    expect(document.activeElement).toBe(document.querySelector('[data-project-heading]'));
    expect(document.querySelector('[data-project-count]')?.textContent).toBe('2 projects');
  });

  it('preserves the URL fragment and existing history state through changes and reset', () => {
    const state = { navigation: 'kept' };
    window.history.replaceState(state, '', '/faust/?type=web#projects');
    initializeProjectFilters();
    expect(window.location.pathname + window.location.search + window.location.hash)
      .toBe('/faust/?type=web#projects');
    expect(window.history.state).toEqual(state);

    select('status').value = 'shipped';
    select('status').dispatchEvent(new Event('change', { bubbles: true }));
    expect(window.location.pathname + window.location.search + window.location.hash)
      .toBe('/faust/?type=web&status=shipped#projects');
    expect(window.history.state).toEqual(state);

    (document.querySelector('[data-filter-reset]') as HTMLButtonElement).click();
    expect(window.location.pathname + window.location.search + window.location.hash).toBe('/faust/#projects');
    expect(window.history.state).toEqual(state);
  });

  it('keeps the no-match state hidden for an empty gallery', () => {
    document.body.innerHTML = indexMarkup('');
    initializeProjectFilters();
    expect((document.querySelector('[data-filter-empty]') as HTMLElement).hidden).toBe(true);
    expect(document.querySelector('[data-project-count]')?.textContent).toBe('0 projects');
  });

  it('scopes controls, rows, and focus to each project index instance', () => {
    document.body.innerHTML = indexMarkup(rows, '-one') + indexMarkup(rows, '-two');
    initializeProjectFilters();
    const indexes = document.querySelectorAll<HTMLElement>('[data-project-index]');
    const secondType = indexes[1].querySelector<HTMLSelectElement>('[name="type"]')!;
    secondType.value = 'cli';
    secondType.dispatchEvent(new Event('change', { bubbles: true }));

    expect(indexes[0].querySelectorAll('[data-project-row][hidden]')).toHaveLength(1);
    expect(indexes[1].querySelectorAll('[data-project-row][hidden]')).toHaveLength(2);
  });

  it('hydrates every instance from the original shared query before URL normalization', () => {
    const first = indexMarkup(rows, '-one').replace('<option value="cli">cli</option>', '');
    document.body.innerHTML = first + indexMarkup(rows, '-two');
    window.history.replaceState(null, '', '/faust/?type=cli');
    initializeProjectFilters();

    const indexes = document.querySelectorAll<HTMLElement>('[data-project-index]');
    expect(indexes[1].querySelector<HTMLSelectElement>('[name="type"]')?.value).toBe('cli');
  });
});
