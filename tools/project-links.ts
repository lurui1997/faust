import { posix } from 'node:path';

type RepositoryConfig = { owner: string; name: string; branch: string };
type SourceProject = { slug: string; repository: './' | string };

const encodePath = (...parts: string[]): string => parts
  .flatMap((part) => part.split('/'))
  .filter(Boolean)
  .map(encodeURIComponent)
  .join('/');

const basePath = (base: string): string => {
  const normalized = posix.normalize(`/${base}/`);
  return normalized === '//' ? '/' : normalized;
};

export const projectUrl = (slug: string, base: string): string =>
  `${basePath(base)}projects/${encodeURIComponent(slug)}/`;

export const coverUrl = (slug: string, cover: string | null, base: string): string | null =>
  cover === null ? null : `${basePath(base)}project-assets/${encodePath(slug, cover)}`;

export const sourceUrl = (project: SourceProject, repository: RepositoryConfig): string =>
  project.repository === './'
    ? `https://github.com/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/tree/${encodeURIComponent(repository.branch)}/projects/${encodeURIComponent(project.slug)}`
    : project.repository;
