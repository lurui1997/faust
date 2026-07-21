import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const validProject = {
  title: 'My Idea',
  slug: 'my-idea',
  summary: 'A small but useful experiment.',
  status: 'building',
  type: 'other',
  tags: ['experiment'],
  createdAt: '2026-07-20',
  updatedAt: '2026-07-21',
  featured: false,
  demo: null,
  repository: './',
  cover: null,
} as const;

export type FixtureProject = {
  dir: string;
  metadata?: unknown;
  projectJson?: string;
  readme?: string;
  cover?: string;
};

export async function makeRepository(projects: FixtureProject[] = []): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'faust-test-'));
  await mkdir(join(root, 'projects'));

  for (const project of projects) {
    const projectPath = join(root, 'projects', project.dir);
    await mkdir(projectPath, { recursive: true });
    if (project.projectJson !== undefined) {
      await writeFile(join(projectPath, 'project.json'), project.projectJson);
    } else if (project.metadata !== undefined) {
      await writeFile(join(projectPath, 'project.json'), JSON.stringify(project.metadata));
    }
    if (project.readme !== undefined) {
      await writeFile(join(projectPath, 'README.md'), project.readme);
    }
    if (project.cover !== undefined) {
      const coverPath = join(projectPath, project.cover);
      await mkdir(dirname(coverPath), { recursive: true });
      await writeFile(coverPath, 'image');
    }
  }

  return root;
}

export async function writeValidProject(
  projectPath: string,
  metadata: Record<string, unknown> = validProject,
): Promise<void> {
  await mkdir(projectPath, { recursive: true });
  await writeFile(join(projectPath, 'project.json'), JSON.stringify(metadata));
  await writeFile(join(projectPath, 'README.md'), '# My Idea\n');
  if (typeof metadata.cover === 'string') {
    const coverPath = join(projectPath, metadata.cover);
    await mkdir(dirname(coverPath), { recursive: true });
    await writeFile(coverPath, 'image');
  }
}
