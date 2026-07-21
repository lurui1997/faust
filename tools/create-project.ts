import { confirm, input, select } from '@inquirer/prompts';
import { lstat, mkdir, mkdtemp, open, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProjectMetadataSchema, type ProjectMetadata } from './project-schema.js';
import { validateProjectAt } from './validate-projects.js';
import { copyRenderedTemplate, type TemplateName } from './lib/templates.js';

export type CreateProjectInput = {
  root: string;
  title: string;
  slug?: string;
  type: ProjectMetadata['type'];
  summary: string;
  template: TemplateName;
  today?: string;
  templateRoot?: string;
};

export type CreateProjectDependencies = {
  /** Test/observability seam invoked while this creator exclusively owns the slug lock. */
  afterPublicationLock?: () => Promise<void>;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function deriveSlug(title: string): string {
  return title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 64).replace(/-+$/g, '');
}

const conflict = (slug: string): Error => new Error(`Project slug "${slug}" already exists or is being created`);

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true; } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export async function renameNoReplace(
  staging: string,
  final: string,
  hooks: { afterLock?: () => Promise<void> } = {},
): Promise<void> {
  const slug = final.slice(final.lastIndexOf('/') + 1);
  const lockPath = join(dirname(final), `.create-${slug}.lock`);
  let lock: Awaited<ReturnType<typeof open>> | undefined;
  try {
    try { lock = await open(lockPath, 'wx', 0o600); } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw conflict(slug);
      throw error;
    }
    await hooks.afterLock?.();
    if (await exists(final)) throw conflict(slug);
    await rename(staging, final);
  } finally {
    if (lock !== undefined) {
      const ownedLock = await lock.stat();
      await lock.close();
      try {
        const currentLock = await lstat(lockPath);
        if (currentLock.dev === ownedLock.dev && currentLock.ino === ownedLock.ino) await unlink(lockPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
}

export async function createProject(
  input: CreateProjectInput,
  dependencies: CreateProjectDependencies = {},
): Promise<{ path: string; metadata: ProjectMetadata }> {
  const root = resolve(input.root);
  const projectsDirectory = join(root, 'projects');
  await mkdir(projectsDirectory, { recursive: true });
  const slug = input.slug === undefined ? deriveSlug(input.title) : input.slug;
  if (!slugPattern.test(slug) || slug.length > 64) throw new Error('Slug must be lowercase ASCII kebab-case');
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const parsed = ProjectMetadataSchema.safeParse({
    title: input.title, slug, summary: input.summary, status: 'idea', type: input.type,
    tags: [], createdAt: today, updatedAt: today, featured: false, demo: null,
    repository: './', cover: null,
  });
  if (!parsed.success) throw new Error(`Invalid project details: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`);
  const metadata = parsed.data;
  const final = join(projectsDirectory, slug);
  if (await exists(final)) throw conflict(slug);
  const staging = await mkdtemp(join(projectsDirectory, `.${slug}.stage-`));
  try {
    const templateRoot = resolve(input.templateRoot ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'templates'));
    const development = {
      blank: 'Document the chosen stack and local development commands here.',
      web: 'Open `index.html` in a browser.',
      script: 'Run `node src/index.mjs`.',
    }[input.template];
    await copyRenderedTemplate({
      templateRoot, template: input.template, destination: staging,
      values: {
        TITLE: input.title,
        TITLE_JSON: JSON.stringify(input.title),
        TITLE_HTML: input.title.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'),
        SUMMARY: input.summary,
        DEVELOPMENT: development,
        CREATED_AT: today,
      },
    });
    await writeFile(join(staging, 'project.json'), `${JSON.stringify(metadata, null, 2)}\n`, { mode: 0o644, flag: 'wx' });
    const validation = await validateProjectAt({ projectPath: staging, expectedDirectoryName: slug });
    if (!validation.ok) throw new Error(`Created project failed validation: ${validation.errors.map((error) => error.message).join('; ')}`);
    await renameNoReplace(staging, final, { afterLock: dependencies.afterPublicationLock });
    return { path: final, metadata };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export async function runInteractiveCreator(root = resolve(dirname(fileURLToPath(import.meta.url)), '..')): Promise<void> {
  const title = await input({ message: 'Project title:' });
  const type = await select<ProjectMetadata['type']>({ message: 'Project type:', choices: ['web', 'service', 'cli', 'ai', 'script', 'other'].map((value) => ({ name: value, value: value as ProjectMetadata['type'] })) });
  const template = await select<TemplateName>({ message: 'Template:', choices: ['blank', 'web', 'script'].map((value) => ({ name: value, value: value as TemplateName })) });
  const summary = await input({ message: 'Summary:' });
  let suggestedSlug = deriveSlug(title);
  for (;;) {
    const useSuggested = await confirm({ message: `Use slug "${suggestedSlug}"?`, default: true });
    const slug = useSuggested ? suggestedSlug : await input({ message: 'Slug:', default: suggestedSlug });
    try {
      const result = await createProject({ root, title, type, template, summary, slug });
      const relativePath = `projects/${result.metadata.slug}`;
      console.log(`Created ${relativePath}`);
      console.log(`Next: cd ${relativePath}`);
      return;
    } catch (error) {
      if (!(error instanceof Error) || !/already exists|being created|slug/i.test(error.message)) throw error;
      console.error(error.message);
      suggestedSlug = await input({ message: 'Choose another slug:', default: suggestedSlug });
    }
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runInteractiveCreator();
}
