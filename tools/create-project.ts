import { confirm, input, select } from '@inquirer/prompts';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ProjectMetadataSchema, type ProjectMetadata } from './project-schema.js';
import { validateProjectAt } from './validate-projects.js';
import { copyRenderedTemplate, type TemplateName } from './lib/templates.js';
import { atomicRenameNoReplace } from './lib/rename-noreplace.js';

export type CreateProjectInput = {
  root: string;
  title: string;
  slug?: string;
  type: ProjectMetadata['type'];
  summary: string;
  template: TemplateName;
  today?: string;
  /** Canonical, owner-controlled template tree that remains immutable during this call. */
  templateRoot?: string;
};

export type CreateProjectDependencies = {
  /** Test/observability seam invoked immediately before the atomic publication syscall. */
  beforeAtomicPublication?: () => Promise<void>;
};

export type InteractiveCreatorDependencies = {
  promptTitle: () => Promise<string>;
  promptType: () => Promise<ProjectMetadata['type']>;
  promptTemplate: () => Promise<TemplateName>;
  promptSummary: () => Promise<string>;
  confirmSlug: (slug: string) => Promise<boolean>;
  promptSlug: (message: string, suggested: string) => Promise<string>;
  write: (line: string) => void;
  writeError: (line: string) => void;
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
  hooks: { beforeRename?: () => Promise<void> } = {},
): Promise<void> {
  const slug = basename(final);
  await hooks.beforeRename?.();
  try { await atomicRenameNoReplace(staging, final); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw conflict(slug);
    throw error;
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
    await renameNoReplace(staging, final, { beforeRename: dependencies.beforeAtomicPublication });
    return { path: final, metadata };
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

const nextStep = (template: TemplateName, relativePath: string): string => ({
  blank: `Next: cd ${relativePath} and document your development setup.`,
  web: `Next: cd ${relativePath} and open index.html in a browser.`,
  script: `Next: cd ${relativePath} && node src/index.mjs`,
})[template];

const defaultInteractiveDependencies = (): InteractiveCreatorDependencies => ({
  promptTitle: () => input({ message: 'Project title:' }),
  promptType: () => select<ProjectMetadata['type']>({ message: 'Project type:', choices: ['web', 'service', 'cli', 'ai', 'script', 'other'].map((value) => ({ name: value, value: value as ProjectMetadata['type'] })) }),
  promptTemplate: () => select<TemplateName>({ message: 'Template:', choices: ['blank', 'web', 'script'].map((value) => ({ name: value, value: value as TemplateName })) }),
  promptSummary: () => input({ message: 'Summary:' }),
  confirmSlug: (slug) => confirm({ message: `Use slug "${slug}"?`, default: true }),
  promptSlug: (message, suggested) => input({ message, default: suggested }),
  write: (line) => console.log(line),
  writeError: (line) => console.error(line),
});

export async function runInteractiveCreator(
  root = resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  dependencies: InteractiveCreatorDependencies = defaultInteractiveDependencies(),
): Promise<void> {
  const title = await dependencies.promptTitle();
  const type = await dependencies.promptType();
  const template = await dependencies.promptTemplate();
  const summary = await dependencies.promptSummary();
  let suggestedSlug = deriveSlug(title);
  for (;;) {
    const useSuggested = await dependencies.confirmSlug(suggestedSlug);
    const slug = useSuggested ? suggestedSlug : await dependencies.promptSlug('Slug:', suggestedSlug);
    try {
      const result = await createProject({ root, title, type, template, summary, slug });
      const relativePath = `projects/${result.metadata.slug}`;
      dependencies.write(`Created ${relativePath}`);
      dependencies.write(nextStep(template, relativePath));
      return;
    } catch (error) {
      if (!(error instanceof Error) || !/already exists|being created|slug/i.test(error.message)) throw error;
      dependencies.writeError(error.message);
      suggestedSlug = await dependencies.promptSlug('Choose another slug:', suggestedSlug);
    }
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runInteractiveCreator();
}
