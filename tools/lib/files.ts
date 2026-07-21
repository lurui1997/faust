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
  // Threat model: repository tools run against a trusted, serialized local worktree. The
  // realpath/stat pair prevents accidental and pre-existing symlink escapes, but does not
  // claim safety against a hostile process swapping paths concurrently between these calls.
  // Consumers must preserve that assumption rather than treating this as an openat-style
  // race-proof sandbox boundary.
  return (await realPathIsWithin(parentPath, candidatePath)) && (await stat(candidatePath)).isFile();
}
