import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsImport from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import jsonSchema from '../../project.schema.json' with { type: 'json' };
import {
  ProjectMetadataSchema,
  registerProjectSchemaAjvExtensions,
} from '../project-schema.js';

const valid = {
  title: 'Semantic Search Playground',
  slug: 'semantic-search',
  summary: 'Compare Chinese semantic search models.',
  status: 'building',
  type: 'ai',
  tags: ['embeddings', 'search'],
  createdAt: '2026-07-20',
  updatedAt: '2026-07-21',
  featured: false,
  demo: null,
  repository: './',
  cover: null,
};

type Case = readonly [label: string, value: unknown, expected: boolean];
const addFormats = addFormatsImport as unknown as typeof import('ajv-formats').default;

const urlWithCodePointLength = (length: number): string => {
  const prefix = 'https://example.com/';
  return `${prefix}${'😀'.repeat(length - Array.from(prefix).length)}`;
};

const withField = (field: keyof typeof valid, value: unknown): unknown => ({
  ...valid,
  [field]: value,
});

const withoutField = (field: keyof typeof valid): unknown => {
  const value: Record<string, unknown> = { ...valid };
  delete value[field];
  return value;
};

const requiredCases: Case[] = Object.keys(valid).map((field) => [
  `requires ${field}`,
  withoutField(field as keyof typeof valid),
  false,
]);

const cases: Case[] = [
  ['accepts the representative contract', valid, true],
  ...requiredCases,

  ['accepts a one-character title', withField('title', 'x'), true],
  ['accepts a 100-character title', withField('title', 'x'.repeat(100)), true],
  ['rejects an empty title', withField('title', ''), false],
  ['rejects a whitespace-only title', withField('title', '   '), false],
  ['rejects a 101-character title', withField('title', 'x'.repeat(101)), false],
  ['counts Unicode title limits by code point', withField('title', '😀'.repeat(100)), true],
  ['rejects a title over the Unicode code-point limit', withField('title', '😀'.repeat(101)), false],

  ['accepts a one-character slug', withField('slug', 'x'), true],
  ['accepts a 64-character slug', withField('slug', 'x'.repeat(64)), true],
  ['rejects an empty slug', withField('slug', ''), false],
  ['rejects a 65-character slug', withField('slug', 'x'.repeat(65)), false],
  ['rejects uppercase slugs', withField('slug', 'Not-Safe'), false],
  ['rejects slugs with spaces', withField('slug', 'not safe'), false],
  ['rejects leading hyphens', withField('slug', '-not-safe'), false],
  ['rejects trailing hyphens', withField('slug', 'not-safe-'), false],
  ['rejects repeated hyphens', withField('slug', 'not--safe'), false],

  ['accepts a one-character summary', withField('summary', 'x'), true],
  ['accepts a 300-character summary', withField('summary', 'x'.repeat(300)), true],
  ['rejects an empty summary', withField('summary', ''), false],
  ['rejects a whitespace-only summary', withField('summary', '   '), false],
  ['rejects a 301-character summary', withField('summary', 'x'.repeat(301)), false],

  ...(['idea', 'building', 'shipped', 'archived'] as const).map(
    (status): Case => [`accepts status ${status}`, withField('status', status), true],
  ),
  ['rejects an unknown status', withField('status', 'paused'), false],
  ['rejects status with different casing', withField('status', 'Building'), false],

  ...(['web', 'service', 'cli', 'ai', 'script', 'other'] as const).map(
    (type): Case => [`accepts type ${type}`, withField('type', type), true],
  ),
  ['rejects an unknown type', withField('type', 'mobile'), false],
  ['rejects type with different casing', withField('type', 'Web'), false],

  ['accepts no tags', withField('tags', []), true],
  ['accepts ten tags', withField('tags', Array.from({ length: 10 }, (_, i) => `tag-${i}`)), true],
  ['rejects eleven tags', withField('tags', Array.from({ length: 11 }, (_, i) => `tag-${i}`)), false],
  ['accepts a 32-character tag', withField('tags', ['x'.repeat(32)]), true],
  ['rejects a 33-character tag', withField('tags', ['x'.repeat(33)]), false],
  ['rejects duplicate tags', withField('tags', ['search', 'search']), false],
  ['rejects uppercase tags', withField('tags', ['Semantic-search']), false],
  ['rejects malformed tags', withField('tags', ['semantic_search']), false],

  ['accepts a leap-day date', withField('createdAt', '2024-02-29'), true],
  ['accepts a four-digit early ISO year', { ...valid, createdAt: '0001-01-01' }, true],
  ['rejects a non-leap-day date', withField('createdAt', '2025-02-29'), false],
  ['rejects an impossible calendar date', withField('createdAt', '2026-02-30'), false],
  ['rejects a non-padded date', withField('createdAt', '2026-7-20'), false],
  ['rejects a datetime', withField('createdAt', '2026-07-20T00:00:00Z'), false],
  ['accepts ordered dates', valid, true],
  ['accepts equal dates', withField('updatedAt', valid.createdAt), true],
  ['rejects reversed dates', withField('updatedAt', '2026-07-19'), false],

  ['accepts featured true', withField('featured', true), true],
  ['accepts featured false', withField('featured', false), true],
  ['rejects a truthy featured value', withField('featured', 1), false],

  ['accepts a null demo', withField('demo', null), true],
  ['accepts an HTTP demo', withField('demo', 'http://example.com/demo'), true],
  ['accepts an HTTPS demo', withField('demo', 'https://example.com/demo?q=1'), true],
  ['accepts an IDN demo host', withField('demo', 'https://例え.テスト/a'), true],
  ['accepts an IPv6 demo host', withField('demo', 'http://[2001:db8::1]/demo'), true],
  ['rejects user information in a demo URL', withField('demo', 'http://user:pass@example.com/demo'), false],
  ['accepts a high valid demo port', withField('demo', 'http://example.com:65535/demo'), true],
  ['accepts a 2048-code-point demo', withField('demo', urlWithCodePointLength(2048)), true],
  ['rejects a 2049-code-point demo', withField('demo', urlWithCodePointLength(2049)), false],
  ['rejects a relative demo', withField('demo', '/demo'), false],
  ['rejects a protocol-relative demo', withField('demo', '//example.com/demo'), false],
  ['rejects a non-web demo scheme', withField('demo', 'ftp://example.com/demo'), false],
  ['rejects a malformed HTTP demo', withField('demo', 'https://'), false],
  ['accepts a WHATWG-normalized demo backslash', withField('demo', String.raw`https://example.com\evil`), true],
  ['rejects an out-of-range demo port', withField('demo', 'http://example.com:99999/'), false],
  ['rejects a non-string demo', withField('demo', 42), false],

  ['accepts the local repository marker', withField('repository', './'), true],
  ['accepts an HTTPS repository', withField('repository', 'https://github.com/example/project'), true],
  ['accepts an IDN repository host', withField('repository', 'https://例え.テスト/a'), true],
  ['accepts an IPv6 repository host', withField('repository', 'https://[2001:db8::1]/project'), true],
  ['rejects user information in a repository URL', withField('repository', 'https://user:pass@example.com/project'), false],
  ['accepts a high valid repository port', withField('repository', 'https://example.com:65535/project'), true],
  ['accepts a 2048-code-point repository', withField('repository', urlWithCodePointLength(2048)), true],
  ['rejects a 2049-code-point repository', withField('repository', urlWithCodePointLength(2049)), false],
  ['rejects an HTTP repository', withField('repository', 'http://github.com/example/project'), false],
  ['rejects a non-web repository scheme', withField('repository', 'git://github.com/example/project'), false],
  ['rejects a malformed HTTPS repository', withField('repository', 'https://'), false],
  ['accepts a WHATWG-normalized repository backslash', withField('repository', String.raw`https://example.com\evil`), true],
  ['rejects a relative repository path', withField('repository', '../project'), false],
  ['rejects a null repository', withField('repository', null), false],

  ['accepts a null cover', withField('cover', null), true],
  ['accepts a safe relative cover', withField('cover', 'images/cover.webp'), true],
  ['accepts a simple cover filename', withField('cover', 'cover.png'), true],
  ['accepts a 255-code-point Unicode cover', withField('cover', `${'😀'.repeat(251)}.png`), true],
  ['rejects a 256-code-point Unicode cover', withField('cover', `${'😀'.repeat(252)}.png`), false],
  ['rejects an empty cover', withField('cover', ''), false],
  ['rejects an absolute POSIX cover', withField('cover', '/images/cover.png'), false],
  ['rejects a traversing cover', withField('cover', '../secret.png'), false],
  ['rejects nested cover traversal', withField('cover', 'images/../secret.png'), false],
  ['rejects backslashes in a cover', withField('cover', String.raw`images\cover.png`), false],
  ['rejects a Windows absolute cover', withField('cover', String.raw`C:\images\cover.png`), false],
  ['rejects a dot-segment cover', withField('cover', 'images/./cover.png'), false],
  ['rejects repeated separators in a cover', withField('cover', 'images//cover.png'), false],
  ['rejects a trailing separator in a cover', withField('cover', 'images/'), false],
  ['rejects a URL used as a cover', withField('cover', 'https://example.com/cover.png'), false],
  ['rejects a NUL byte in a cover', withField('cover', 'images/\u0000cover.png'), false],
  ['rejects a newline in a cover', withField('cover', 'images/\ncover.png'), false],
  ['rejects encoded traversal in a cover', withField('cover', 'images/%2e%2e/secret.png'), false],
  ['rejects a non-string cover', withField('cover', 42), false],

  ['rejects unknown fields', { ...valid, surprise: true }, false],
  ['rejects arrays', [], false],
  ['rejects null objects', null, false],
];

describe('project metadata contract', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  registerProjectSchemaAjvExtensions(ajv);
  const validateJson = ajv.compile(jsonSchema);

  it.each(cases)('%s', (_label, value, expected) => {
    const jsonResult = Boolean(validateJson(value));
    const zodResult = ProjectMetadataSchema.safeParse(value).success;

    expect(jsonResult, JSON.stringify(validateJson.errors)).toBe(expected);
    expect(zodResult).toBe(expected);
    expect(zodResult).toBe(jsonResult);
  });
});
