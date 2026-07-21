import raw from '../data/projects.generated.json';

import type { GalleryProject } from '../../../tools/generate-project-index.js';

export type ProjectFilters = {
  type: string;
  status: string;
};

export function orderProjects(items: readonly GalleryProject[]): GalleryProject[] {
  return [...items].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt) || a.slug.localeCompare(b.slug));
}

export const projects = orderProjects(raw as GalleryProject[]);

export function filterProjects(
  items: readonly GalleryProject[],
  filters: ProjectFilters,
): GalleryProject[] {
  return items.filter((project) =>
    (filters.type === 'all' || project.type === filters.type)
    && (filters.status === 'active'
      ? project.status !== 'archived'
      : filters.status === 'all' || project.status === filters.status));
}
