import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
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
  templateRoot: string;
  template: TemplateName;
  destination: string;
  values: Readonly<Record<string, string>>;
}): Promise<void> {
  const templateRoot = resolve(options.templateRoot);
  const sourceRoot = resolve(templateRoot, options.template);
  const destinationRoot = resolve(options.destination);
  if (!isWithin(templateRoot, sourceRoot)) throw new Error('Template path escapes template root');
  const sourceRootStat = await lstat(sourceRoot);
  if (sourceRootStat.isSymbolicLink() || !sourceRootStat.isDirectory()) {
    throw new Error('Selected template must be a real directory, not a symlink');
  }

  const copyDirectory = async (sourceDirectory: string): Promise<void> => {
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
      const rendered = renderTemplate(await readFile(source, 'utf8'), options.values);
      await writeFile(destination, rendered, { mode: 0o644, flag: 'wx' });
    }
  };

  await copyDirectory(sourceRoot);
}
