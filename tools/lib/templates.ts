import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

export type TemplateName = 'blank' | 'web' | 'script';

const placeholder = /{{([A-Z][A-Z0-9_]*)}}/g;

const isWithin = (parent: string, child: string): boolean => {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith(`..${sep}`) && path !== '..' && !isAbsolute(path));
};

export function renderTemplate(source: string, values: Readonly<Record<string, string>>): string {
  const syntaxCheck = source.replace(placeholder, (_match, name: string) => {
    if (!Object.hasOwn(values, name)) throw new Error(`Unknown template placeholder {{${name}}}`);
    return '';
  });
  if (syntaxCheck.includes('{{') || syntaxCheck.includes('}}')) {
    throw new Error('Template contains a malformed or leftover placeholder');
  }
  return source.replace(placeholder, (_match, name: string) => values[name]!);
}

export async function copyRenderedTemplate(options: {
  /** Canonical, owner-controlled tree. Callers must not mutate it while copying. */
  templateRoot: string;
  template: TemplateName;
  destination: string;
  values: Readonly<Record<string, string>>;
  beforeOpenFile?: (source: string) => Promise<void>;
}): Promise<void> {
  const requestedTemplateRoot = resolve(options.templateRoot);
  const requestedRootStat = await lstat(requestedTemplateRoot);
  if (requestedRootStat.isSymbolicLink()) throw new Error('Template root must not be a symlink');
  const templateRoot = await realpath(requestedTemplateRoot);
  const sourceRoot = resolve(templateRoot, options.template);
  const destinationRoot = resolve(options.destination);
  if (!isWithin(templateRoot, sourceRoot)) throw new Error('Template path escapes template root');

  const assertTrustedDirectory = async (directory: string): Promise<void> => {
    const directoryStat = await lstat(directory);
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
      throw new Error('Template directories must be real directories, not symlinks');
    }
    if (await realpath(directory) !== directory) throw new Error('Template directories must not be symlinks');
    if (typeof process.getuid === 'function' && directoryStat.uid !== process.getuid()) {
      throw new Error('Template directories must be owned by the current user');
    }
    if ((directoryStat.mode & 0o022) !== 0) {
      throw new Error('Template directories must not be writable by group or other users');
    }
  };
  await assertTrustedDirectory(templateRoot);
  await assertTrustedDirectory(sourceRoot);

  const copyDirectory = async (sourceDirectory: string): Promise<void> => {
    await assertTrustedDirectory(sourceDirectory);
    const entries = await readdir(sourceDirectory, { withFileTypes: true });
    for (const entry of entries) {
      const source = resolve(sourceDirectory, entry.name);
      if (!isWithin(sourceRoot, source)) throw new Error('Template path traversal rejected');
      const stat = await lstat(source);
      if (stat.isSymbolicLink()) throw new Error(`Template symlink rejected: ${entry.name}`);
      if (stat.isDirectory()) {
        await copyDirectory(source);
        continue;
      }
      if (!stat.isFile()) throw new Error(`Template entry is not a regular file: ${entry.name}`);
      if (!entry.name.endsWith('.tpl')) throw new Error(`Template file must end in .tpl: ${entry.name}`);
      const relativeSource = relative(sourceRoot, source);
      const destination = resolve(destinationRoot, relativeSource.slice(0, -4));
      if (!isWithin(destinationRoot, destination)) throw new Error('Template destination traversal rejected');
      await mkdir(dirname(destination), { recursive: true });
      await options.beforeOpenFile?.(source);
      const handle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
      let templateSource: string;
      try {
        const opened = await handle.stat();
        if (!opened.isFile()) throw new Error(`Template entry is not a regular file: ${entry.name}`);
        if (typeof process.getuid === 'function' && opened.uid !== process.getuid()) {
          throw new Error(`Template file must be owned by the current user: ${entry.name}`);
        }
        if ((opened.mode & 0o022) !== 0) {
          throw new Error(`Template file must not be writable by group or other users: ${entry.name}`);
        }
        templateSource = await handle.readFile('utf8');
      } finally {
        await handle.close();
      }
      const rendered = renderTemplate(templateSource, options.values);
      await writeFile(destination, rendered, { mode: 0o644, flag: 'wx' });
    }
  };

  await copyDirectory(sourceRoot);
}
