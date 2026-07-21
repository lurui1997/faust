import { readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, sep } from 'node:path';

export type ProjectDirectory = { name: string; path: string };

export async function discoverProjectDirectories(projectsPath: string): Promise<ProjectDirectory[]> {
  let entries;
  try {
    entries = await readdir(projectsPath, { withFileTypes: true });
  } catch (caught) {
    if ((caught as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw caught;
  }
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, path: join(projectsPath, entry.name) }))
    .sort((left, right) => left.name.localeCompare(right.name, 'en'));
}

export async function realPathIsWithin(parentPath: string, candidatePath: string): Promise<boolean> {
  const [parent, candidate] = await Promise.all([realpath(parentPath), realpath(candidatePath)]);
  const pathFromParent = relative(parent, candidate);
  return pathFromParent === '' || (
    pathFromParent !== '..'
    && !pathFromParent.startsWith(`..${sep}`)
    && !isAbsolute(pathFromParent)
  );
}

export async function isRegularFileWithin(parentPath: string, candidatePath: string): Promise<boolean> {
  return (await realPathIsWithin(parentPath, candidatePath)) && (await stat(candidatePath)).isFile();
}
