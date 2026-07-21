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

type MetadataSnapshot = {
  parsedJson?: unknown;
  declaredSlug?: string;
  fileError?: true;
  jsonError?: true;
};

const declarationByResult = new WeakMap<ProjectValidationResult, string>();

const readMetadataSnapshot = async (projectPath: string): Promise<MetadataSnapshot> => {
  const metadataPath = join(projectPath, 'project.json');
  try {
    if (!(await isRegularFileWithin(projectPath, metadataPath))) return { fileError: true };
    // One read defines the snapshot used for both schema validation and duplicate detection.
    const rawMetadata = await readFile(metadataPath, 'utf8');
    try {
      const parsedJson = JSON.parse(rawMetadata) as unknown;
      const declaredSlug = (
        typeof parsedJson === 'object'
        && parsedJson !== null
        && !Array.isArray(parsedJson)
        && typeof (parsedJson as Record<string, unknown>).slug === 'string'
      ) ? (parsedJson as Record<string, string>).slug : undefined;
      return { parsedJson, declaredSlug };
    } catch {
      return { jsonError: true };
    }
  } catch {
    return { fileError: true };
  }
};

export async function validateProjectAt(options: {
  projectPath: string;
  expectedDirectoryName: string;
}): Promise<ProjectValidationResult> {
  const { projectPath, expectedDirectoryName } = options;
  const errors: ValidationError[] = [];
  const readmePath = join(projectPath, 'README.md');
  const snapshot = await readMetadataSnapshot(projectPath);

  if (snapshot.fileError) {
    errors.push(error(
      expectedDirectoryName,
      'project.json',
      'required metadata file is missing, unreadable, or outside the project directory',
      'create project.json as a regular file inside this project directory',
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

  if (snapshot.jsonError) {
    errors.push(error(
      expectedDirectoryName,
      'project.json',
      'metadata is malformed JSON',
      'replace project.json with valid JSON',
    ));
  }

  let metadata: ProjectMetadata | undefined;
  if (snapshot.parsedJson !== undefined) {
    const parsed = ProjectMetadataSchema.safeParse(snapshot.parsedJson);
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

  const result: ProjectValidationResult = errors.length === 0 && metadata !== undefined
    ? { ok: true, project: metadata }
    : { ok: false, errors };
  if (snapshot.declaredSlug !== undefined) declarationByResult.set(result, snapshot.declaredSlug);
  return result;
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

  const selectedNames = new Set(directories.map((directory) => directory.name));
  for (const directory of discoveredDirectories) {
    if (!selectedNames.has(directory.name)) {
      const snapshot = await readMetadataSnapshot(directory.path);
      if (snapshot.declaredSlug !== undefined) {
        declarations.set(snapshot.declaredSlug, [
          ...(declarations.get(snapshot.declaredSlug) ?? []),
          directory.name,
        ]);
      }
      continue;
    }

    const validation = await validateProjectAt({
      projectPath: directory.path,
      expectedDirectoryName: directory.name,
    });
    if (validation.ok) projects.push(validation.project);
    else errors.push(...validation.errors);

    const declaredSlug = declarationByResult.get(validation);
    if (declaredSlug !== undefined) {
      declarations.set(declaredSlug, [
        ...(declarations.get(declaredSlug) ?? []),
        directory.name,
      ]);
    }
  }

  for (const [slug, projectNames] of declarations) {
    if (projectNames.length < 2) continue;
    for (const project of projectNames.filter((name) => selectedNames.has(name))) {
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
