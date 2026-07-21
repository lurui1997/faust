import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildProjectIndex,
  ProjectValidationError,
  type GalleryProject,
} from './generate-project-index.js';

const EMPTY_MESSAGE = 'No projects found. Run pnpm create:project.';
const HEADERS = ['TITLE', 'TYPE', 'STATUS', 'PATH'] as const;

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const isWideCodePoint = (codePoint: number, character: string): boolean =>
  /\p{Extended_Pictographic}/u.test(character)
  || (codePoint >= 0x1100 && codePoint <= 0x115f)
  || codePoint === 0x2329
  || codePoint === 0x232a
  || (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f)
  || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
  || (codePoint >= 0xf900 && codePoint <= 0xfaff)
  || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
  || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
  || (codePoint >= 0xff00 && codePoint <= 0xff60)
  || (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  || (codePoint >= 0x1f1e6 && codePoint <= 0x1f1ff)
  || (codePoint >= 0x1f200 && codePoint <= 0x1f251)
  || (codePoint >= 0x20000 && codePoint <= 0x3fffd);
const width = (value: string): number => [...graphemes.segment(value)]
  .reduce((total, { segment }) => {
    const characters = Array.from(segment);
    if (characters.some((character) => isWideCodePoint(character.codePointAt(0) ?? 0, character))) {
      return total + 2;
    }
    return total + characters.filter((character) => !/[\p{Mark}\p{Control}]/u.test(character)).length;
  }, 0);
const pad = (value: string, target: number): string =>
  `${value}${' '.repeat(Math.max(0, target - width(value)))}`;

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
  ]);
  const widths = HEADERS.map((header, column) =>
    Math.max(width(header), ...rows.map((row) => width(row[column]))));
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
  const writeError = options.writeError ?? write;
  try {
    const projects = await buildProjectIndex(options.root);
    write(formatProjectList(projects));
    return 0;
  } catch (caught) {
    if (caught instanceof ProjectValidationError) {
      writeError(caught.message);
    } else {
      const message = caught instanceof Error ? caught.message : String(caught);
      writeError(`repository: projects — listing could not run: ${message}; fix: ensure projects/ exists and is readable`);
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
