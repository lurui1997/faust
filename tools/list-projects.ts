import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import stringWidth from 'string-width';

import {
  buildProjectIndex,
  ProjectValidationError,
  type GalleryProject,
} from './generate-project-index.js';

const EMPTY_MESSAGE = 'No projects found. Run pnpm create:project.';
const HEADERS = ['TITLE', 'TYPE', 'STATUS', 'PATH'] as const;

const escapeTerminalText = (value: string): string => value.replace(
  /[\p{Control}\p{Format}]/gu,
  (character) => {
    if (character === '\n') return '\\n';
    if (character === '\r') return '\\r';
    if (character === '\t') return '\\t';
    return `\\u{${character.codePointAt(0)?.toString(16).toUpperCase()}}`;
  },
);
const pad = (value: string, target: number): string =>
  `${value}${' '.repeat(Math.max(0, target - stringWidth(value)))}`;

export function formatProjectList(projects: readonly GalleryProject[]): string {
  if (projects.length === 0) return EMPTY_MESSAGE;

  const ordered = [...projects].sort((a, b) => {
    const dateOrder = b.updatedAt.localeCompare(a.updatedAt);
    if (dateOrder !== 0) return dateOrder;
    return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
  const rows = ordered.map((project) => [
    project.title,
    project.type,
    project.status,
    `projects/${project.slug}`,
  ].map(escapeTerminalText));
  const widths = HEADERS.map((header, column) =>
    Math.max(stringWidth(header), ...rows.map((row) => stringWidth(row[column]))));
  const render = (row: readonly string[]): string => row
    .map((cell, column) => column === row.length - 1 ? cell : pad(cell, widths[column]))
    .join('  ');

  return [render(HEADERS), ...rows.map(render)].join('\n');
}

export async function runListProjectsCli(options: {
  root: string;
  write?: (line: string) => void;
  writeError?: (line: string) => void;
}): Promise<0 | 1> {
  const write = options.write ?? ((line: string) => console.log(line));
  const writeError = options.writeError ?? ((line: string) => console.error(line));
  try {
    const projects = await buildProjectIndex(options.root);
    write(formatProjectList(projects));
    return 0;
  } catch (caught) {
    if (caught instanceof ProjectValidationError) {
      writeError(escapeTerminalText(caught.message));
    } else {
      const message = caught instanceof Error ? caught.message : String(caught);
      writeError(escapeTerminalText(
        `repository: projects — listing could not run: ${message}; fix: ensure projects/ exists and is readable`,
      ));
    }
    return 1;
  }
}

const invokedPath = process.argv[1] === undefined ? undefined : resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  process.exitCode = await runListProjectsCli({
    root,
    write: (line) => console.log(line),
    writeError: (line) => console.error(line),
  });
}
