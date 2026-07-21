export type FilterState = {
  type: string;
  status: string;
};

const DEFAULT_FILTERS: FilterState = { type: 'all', status: 'active' };
const STATUSES = new Set(['active', 'all', 'idea', 'building', 'shipped', 'archived']);

export function readFilterState(params: URLSearchParams, projectTypes: readonly string[]): FilterState {
  const requestedType = params.get('type');
  const requestedStatus = params.get('status');
  return {
    type: requestedType !== null && projectTypes.includes(requestedType) ? requestedType : DEFAULT_FILTERS.type,
    status: requestedStatus !== null && STATUSES.has(requestedStatus) ? requestedStatus : DEFAULT_FILTERS.status,
  };
}

export function filterUrl(pathname: string, filters: FilterState): string {
  const params = new URLSearchParams();
  if (filters.type !== DEFAULT_FILTERS.type) params.set('type', filters.type);
  if (filters.status !== DEFAULT_FILTERS.status) params.set('status', filters.status);
  const query = params.toString();
  return query === '' ? pathname : `${pathname}?${query}`;
}

export function showNoMatches(visible: number, total: number): boolean {
  return total > 0 && visible === 0;
}

function matches(row: HTMLElement, filters: FilterState): boolean {
  const matchesType = filters.type === 'all' || row.dataset.type === filters.type;
  const matchesStatus = filters.status === 'active'
    ? row.dataset.status !== 'archived'
    : filters.status === 'all' || row.dataset.status === filters.status;
  return matchesType && matchesStatus;
}

export function initializeProjectFilters(root: Document = document): void {
  const indexes = root.querySelectorAll<HTMLElement>('[data-project-index]');
  const initialParams = new URLSearchParams(window.location.search);
  for (const index of indexes) initializeProjectIndex(index, initialParams);
}

function initializeProjectIndex(index: HTMLElement, initialParams: URLSearchParams): void {
  const form = index.querySelector<HTMLFormElement>('[data-project-filters]');
  if (form === null || form.dataset.filterEnhanced === 'true') return;

  const type = form.elements.namedItem('type');
  const status = form.elements.namedItem('status');
  const count = index.querySelector<HTMLElement>('[data-project-count]');
  const empty = index.querySelector<HTMLElement>('[data-filter-empty]');
  const reset = index.querySelector<HTMLButtonElement>('[data-filter-reset]');
  const heading = index.querySelector<HTMLElement>('[data-project-heading]');
  const rows = [...index.querySelectorAll<HTMLElement>('[data-project-row]')];
  if (!(type instanceof HTMLSelectElement) || !(status instanceof HTMLSelectElement)
    || count === null || empty === null || reset === null || heading === null) return;

  form.dataset.filterEnhanced = 'true';
  form.hidden = false;

  const projectTypes = [...type.options].map(({ value }) => value);
  const initial = readFilterState(initialParams, projectTypes);
  type.value = initial.type;
  status.value = initial.status;

  const apply = (): void => {
    const filters = { type: type.value, status: status.value };
    let visible = 0;
    for (const row of rows) {
      const show = matches(row, filters);
      row.hidden = !show;
      if (show) visible += 1;
    }
    count.textContent = `${visible} ${visible === 1 ? 'project' : 'projects'}`;
    empty.hidden = !showNoMatches(visible, rows.length);
    window.history.replaceState(null, '', filterUrl(window.location.pathname, filters));
  };

  form.addEventListener('change', apply);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    apply();
  });
  reset.addEventListener('click', () => {
    type.value = DEFAULT_FILTERS.type;
    status.value = DEFAULT_FILTERS.status;
    apply();
    heading.focus();
  });
  apply();
}
