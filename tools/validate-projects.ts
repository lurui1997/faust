import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { ZodIssue } from 'zod';

import { ProjectMetadataSchema, type ProjectMetadata } from './project-schema.js';
import { discoverProjectDirectories, isRegularFileWithin } from './lib/files.js';

export type ValidationError = {
  project: string;
  field: string;
  message: string;
  fix: string;
};

export type ProjectValidationResult =
  | { ok: true; project: ProjectMetadata }
  | { ok: false; errors: ValidationError[] };

export type RepositoryValidationResult =
  | { ok: true; projects: ProjectMetadata[] }
  | { ok: false; errors: ValidationError[] };

const error = (
  project: string,
  field: string,
  message: string,
  fix: string,
): ValidationError => ({ project, field, message, fix });

const fieldForIssue = (issue: ZodIssue): string =>
  issue.path.length > 0 ? issue.path.map(String).join('.') : 'project.json';

async function validateProject(
  projectPath: string,
  expectedDirectoryName: string,
): Promise<{ result: ProjectValidationResult; metadata?: ProjectMetadata }> {
  const errors: ValidationError[] = [];
  const metadataPath = join(projectPath, 'project.json');
  const readmePath = join(projectPath, 'README.md');
  let rawMetadata: string | undefined;

  try {
    rawMetadata = await readFile(metadataPath, 'utf8');
  } catch {
    errors.push(error(
      expectedDirectoryName,
      'project.json',
      'required metadata file is missing or unreadable',
      'create project.json with every required metadata field',
    ));
  }

  try {
    if (!(await isRegularFileWithin(projectPath, readmePath))) throw new Error('not a contained file');
  } catch {
    errors.push(error(
      expectedDirectoryName,
      'README.md',
      'required project README is missing, unreadable, or outside the project directory',
      'create a regular README.md file inside this project directory',
    ));
  }

  let parsedJson: unknown;
  if (rawMetadata !== undefined) {
    try {
      parsedJson = JSON.parse(rawMetadata) as unknown;
    } catch {
      errors.push(error(
        expectedDirectoryName,
        'project.json',
        'metadata is malformed JSON',
        'replace project.json with valid JSON',
      ));
    }
  }

  let metadata: ProjectMetadata | undefined;
  if (parsedJson !== undefined) {
    const parsed = ProjectMetadataSchema.safeParse(parsedJson);
    if (parsed.success) {
      metadata = parsed.data;
    } else {
      for (const issue of parsed.error.issues) {
        const field = fieldForIssue(issue);
        errors.push(error(
          expectedDirectoryName,
          field,
          issue.message,
          `correct the ${field} field in project.json`,
        ));
      }
    }
  }

  if (metadata !== undefined) {
    if (metadata.slug !== expectedDirectoryName) {
      errors.push(error(
        expectedDirectoryName,
        'slug',
        `slug "${metadata.slug}" does not match directory "${expectedDirectoryName}"`,
        'rename the directory or change slug so they match',
      ));
    }

    if (metadata.cover !== null) {
      const coverPath = join(projectPath, metadata.cover);
      try {
        if (!(await isRegularFileWithin(projectPath, coverPath))) {
          errors.push(error(
            expectedDirectoryName,
            'cover',
            `cover "${metadata.cover}" is not a regular file inside the project directory`,
            'store a regular cover file inside the project directory and update cover',
          ));
        }
      } catch {
        errors.push(error(
          expectedDirectoryName,
          'cover',
          `cover "${metadata.cover}" is missing or unreadable`,
          'add the referenced cover inside the project directory or set cover to null',
        ));
      }
    }
  }

  return errors.length === 0 && metadata !== undefined
    ? { result: { ok: true, project: metadata }, metadata }
    : { result: { ok: false, errors }, metadata };
}

export async function validateProjectAt(options: {
  projectPath: string;
  expectedDirectoryName: string;
}): Promise<ProjectValidationResult> {
  return (await validateProject(options.projectPath, options.expectedDirectoryName)).result;
}

export async function validateProjects(options: {
  root: string;
  only?: string;
}): Promise<RepositoryValidationResult> {
  const projectsPath = join(options.root, 'projects');
  const discoveredDirectories = await discoverProjectDirectories(projectsPath);
  const directories = options.only === undefined
    ? discoveredDirectories
    : discoveredDirectories.filter((directory) => directory.name === options.only);
  const errors: ValidationError[] = [];
  const projects: ProjectMetadata[] = [];
  const declarations = new Map<string, string[]>();

  if (options.only !== undefined && directories.length === 0) {
    return {
      ok: false,
      errors: [error(
        options.only,
        'directory',
        'selected project is not a direct child directory of projects',
        'choose the exact name of a directory directly inside projects',
      )],
    };
  }

  for (const directory of directories) {
    const validation = await validateProject(directory.path, directory.name);
    if (validation.result.ok) projects.push(validation.result.project);
    else errors.push(...validation.result.errors);
    if (validation.metadata !== undefined) {
      declarations.set(validation.metadata.slug, [
        ...(declarations.get(validation.metadata.slug) ?? []),
        directory.name,
      ]);
    }
  }

  for (const [slug, projectNames] of declarations) {
    if (projectNames.length < 2) continue;
    for (const project of projectNames) {
      errors.push(error(
        project,
        'slug',
        `duplicate slug "${slug}" is declared by ${projectNames.join(', ')}`,
        'change slug and its directory name so every project slug is unique',
      ));
    }
  }

  return errors.length === 0 ? { ok: true, projects } : { ok: false, errors };
}

export const formatErrors = (errors: ValidationError[]): string =>
  errors
    .map(({ project, field, message, fix }) => `${project}: ${field} — ${message}; fix: ${fix}`)
    .join('\n');

export async function runValidationCli(options: {
  root: string;
  write?: (line: string) => void;
}): Promise<0 | 1> {
  const write = options.write ?? ((line: string) => console.log(line));
  try {
    const result = await validateProjects({ root: options.root });
    if (result.ok) {
      write(`Validated ${result.projects.length} projects`);
      return 0;
    } else {
      write(formatErrors(result.errors));
      return 1;
    }
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    write(`repository: projects — validation could not run: ${message}; fix: ensure projects/ exists and is readable`);
    return 1;
  }
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  process.exitCode = await runValidationCli({ root, write: (line) => console.error(line) });
}
