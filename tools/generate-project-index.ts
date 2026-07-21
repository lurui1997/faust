import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, mkdtemp, readFile, readdir, readlink, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { pages, repository } from './config.js';
import { extractExcerptHtml } from './lib/readme.js';
import { coverUrl, projectUrl, sourceUrl } from './project-links.js';
import type { ProjectMetadata } from './project-schema.js';
import { formatErrors, validateProjects } from './validate-projects.js';

export type GalleryProject = ProjectMetadata & {
  excerptHtml: string;
  year: string;
  href: string;
  sourceHref: string;
  coverHref: string | null;
};

export class ProjectValidationError extends Error {
  constructor(public readonly errors: Parameters<typeof formatErrors>[0]) {
    super(formatErrors(errors));
    this.name = 'ProjectValidationError';
  }
}

export async function buildProjectIndex(root: string): Promise<GalleryProject[]> {
  const result = await validateProjects({ root });
  if (!result.ok) throw new ProjectValidationError(result.errors);
  const records = await Promise.all(result.projects.map(async (project) => {
    const readme = await readFile(join(root, 'projects', project.slug, 'README.md'), 'utf8');
    return {
      ...project,
      excerptHtml: extractExcerptHtml(readme, project.summary),
      year: project.createdAt.slice(0, 4),
      href: projectUrl(project.slug, pages.base),
      sourceHref: sourceUrl(project, repository),
      coverHref: coverUrl(project.slug, project.cover, pages.base),
    };
  }));
  return records.sort((a, b) => {
    const dateOrder = b.updatedAt.localeCompare(a.updatedAt);
    if (dateOrder !== 0) return dateOrder;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
}

type GenerateOptions = {
  root: string;
  write?: (line: string) => void;
  copyCover?: typeof copyFile;
  createSymlink?: typeof symlink;
  writeIndex?: (path: string, contents: string) => Promise<void>;
};

type ExpectedCover = { source: string; destination: string; contents: Buffer };

const expectedDirectories = (covers: ExpectedCover[]): Set<string> => {
  const directories = new Set(['']);
  for (const cover of covers) {
    let directory = dirname(cover.destination);
    while (directory !== '.') {
      directories.add(directory);
      const parent = dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  return directories;
};

const versionIsComplete = async (versionPath: string, covers: ExpectedCover[]): Promise<boolean> => {
  const expectedFiles = new Map(covers.map((cover) => [cover.destination, cover.contents]));
  const expectedDirs = expectedDirectories(covers);
  const seenFiles = new Set<string>();
  const seenDirs = new Set<string>(['']);
  const visit = async (directory: string): Promise<boolean> => {
    const entries = await readdir(join(versionPath, directory), { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!expectedDirs.has(relativePath)) return false;
        seenDirs.add(relativePath);
        if (!(await visit(relativePath))) return false;
      } else if (entry.isFile()) {
        const expected = expectedFiles.get(relativePath);
        if (expected === undefined || !(await readFile(join(versionPath, relativePath))).equals(expected)) return false;
        seenFiles.add(relativePath);
      } else {
        return false;
      }
    }
    return true;
  };
  try {
    if (!(await lstat(versionPath)).isDirectory()) return false;
    return await visit('')
      && seenFiles.size === expectedFiles.size
      && seenDirs.size === expectedDirs.size;
  } catch {
    return false;
  }
};

const atomicWrite = async (path: string, contents: string): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, contents);
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

export async function generateProjectIndex(options: GenerateOptions): Promise<GalleryProject[]> {
  const records = await buildProjectIndex(options.root);
  const publicPath = join(options.root, 'gallery', 'public');
  await mkdir(publicPath, { recursive: true });
  // Generation is intentionally serialized by the caller. Recover artifacts left by an
  // interrupted prior run, but match only names owned by this generator.
  const startupEntries = await readdir(publicPath, { withFileTypes: true });
  await Promise.all(startupEntries
    .filter((entry) => (
      entry.name === '.project-assets-generate.lock'
      || (entry.isDirectory() && /^\.project-assets-stage-[A-Za-z0-9]{6}$/u.test(entry.name))
    ))
    .map((entry) => rm(join(publicPath, entry.name), { recursive: true, force: true })));
  const hash = createHash('sha256');
  const covers: ExpectedCover[] = [];
  for (const project of records) {
    if (project.cover === null) continue;
    const source = join(options.root, 'projects', project.slug, project.cover);
    const contents = await readFile(source);
    hash.update(project.slug).update('\0').update(project.cover).update('\0').update(contents);
    covers.push({ source, destination: join(project.slug, project.cover), contents });
  }
  if (covers.length === 0) hash.update('empty');
  const versionName = `.project-assets-${hash.digest('hex').slice(0, 16)}`;
  const versionPath = join(publicPath, versionName);
  const stagingPath = await mkdtemp(join(publicPath, '.project-assets-stage-'));
  const pointerPath = join(publicPath, 'project-assets');
  const temporaryPointer = join(publicPath, `.project-assets-link-${process.pid}-${Date.now()}`);
  const copy = options.copyCover ?? copyFile;
  const makeSymlink = options.createSymlink ?? symlink;
  const writeIndex = options.writeIndex ?? atomicWrite;
  let createdVersion = false;
  let swapped = false;
  let oldTarget: string | undefined;
  try {
    try {
      oldTarget = await readlink(pointerPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    for (const cover of covers) {
      const destination = join(stagingPath, cover.destination);
      await mkdir(dirname(destination), { recursive: true });
      await copy(cover.source, destination);
    }
    if (!(await versionIsComplete(stagingPath, covers))) {
      throw new Error('Staged project covers failed completeness verification; the active asset version was preserved.');
    }

    let finalExists = false;
    try {
      finalExists = (await lstat(versionPath)).isDirectory();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (finalExists && await versionIsComplete(versionPath, covers)) {
      await rm(stagingPath, { recursive: true, force: true });
    } else {
      if (finalExists) {
        if (oldTarget !== undefined && resolve(publicPath, oldTarget) === versionPath) {
          throw new Error(`Active asset version ${versionName} is incomplete; refusing to replace it non-atomically.`);
        }
        await rm(versionPath, { recursive: true, force: true });
      }
      try {
        await rename(stagingPath, versionPath);
        createdVersion = true;
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (!['EEXIST', 'ENOTEMPTY'].includes(code ?? '') || !(await versionIsComplete(versionPath, covers))) {
          throw error;
        }
        await rm(stagingPath, { recursive: true, force: true });
      }
    }
    try {
      await makeSymlink(relative(publicPath, versionPath), temporaryPointer);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === 'EPERM' || code === 'EACCES' || code === 'ENOTSUP') {
        throw new Error('Unable to create the project-assets symbolic link; enable symbolic-link support or run in an environment that permits symlinks.', { cause: error });
      }
      throw error;
    }
    await rename(temporaryPointer, pointerPath);
    swapped = true;
    await writeIndex(join(options.root, 'gallery/src/data/projects.generated.json'), `${JSON.stringify(records, null, 2)}\n`);

    // Cleanup occurs only after both published pointers are committed. It is deliberately
    // best-effort: inability to remove an obsolete immutable directory must not roll back or
    // corrupt the newly consistent index/asset pair.
    try {
      const entries = await readdir(publicPath, { withFileTypes: true });
      await Promise.allSettled(entries
        .filter((entry) => entry.isDirectory() && /^\.project-assets-[0-9a-f]{16}$/u.test(entry.name) && entry.name !== versionName)
        .map((entry) => rm(join(publicPath, entry.name), { recursive: true, force: true })));
    } catch {
      // A later generation retries obsolete-version cleanup.
    }
  } catch (error) {
    await rm(temporaryPointer, { force: true });
    await rm(stagingPath, { recursive: true, force: true });
    if (swapped) {
      if (oldTarget === undefined) {
        await rm(pointerPath, { force: true });
      } else {
        const rollbackPointer = `${temporaryPointer}-rollback`;
        await rm(rollbackPointer, { force: true });
        await makeSymlink(oldTarget, rollbackPointer);
        await rename(rollbackPointer, pointerPath);
      }
    }
    if (createdVersion) await rm(versionPath, { recursive: true, force: true });
    throw error;
  }
  (options.write ?? console.log)(`Generated ${records.length} projects`);
  return records;
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await generateProjectIndex({ root });
}
