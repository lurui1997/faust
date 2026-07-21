import { posix } from 'node:path';

import type { Ajv2020 } from 'ajv/dist/2020.js';
import { z } from 'zod';

const kebabCase = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const hasAtMostCodePoints = (value: string, maximum: number) => Array.from(value).length <= maximum;

const isAbsoluteWebUrl = (value: string, protocols: readonly string[]): boolean => {
  try {
    const url = new URL(value);
    return (
      protocols.includes(url.protocol) &&
      url.hostname.length > 0 &&
      url.username.length === 0 &&
      url.password.length === 0
    );
  } catch {
    return false;
  }
};

/** Register every non-standard format and keyword required before compiling project.schema.json. */
export const registerProjectSchemaAjvExtensions = (ajv: Ajv2020): Ajv2020 => {
  ajv.addFormat('absolute-http-url', {
    type: 'string',
    validate: (value: string) => isAbsoluteWebUrl(value, ['http:', 'https:']),
  });
  ajv.addFormat('absolute-https-url', {
    type: 'string',
    validate: (value: string) => isAbsoluteWebUrl(value, ['https:']),
  });
  ajv.addKeyword({
    keyword: 'updatedAtNotBeforeCreatedAt',
    schemaType: 'boolean',
    type: 'object',
    validate: (enabled: boolean, data: { createdAt?: string; updatedAt?: string }) =>
      !enabled || !data.createdAt || !data.updatedAt || data.updatedAt >= data.createdAt,
  });

  return ajv;
};

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(0);
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCFullYear(year, month - 1, day);

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'must be a real ISO calendar date');

const nonBlankString = (maximum: number) =>
  z
    .string()
    .min(1)
    .refine((value) => hasAtMostCodePoints(value, maximum), `must contain at most ${maximum} characters`)
    .refine((value) => /\S/.test(value), 'must contain non-whitespace text');

const webUrl = (protocols: readonly string[]) =>
  z
    .string()
    .refine((value) => hasAtMostCodePoints(value, 2048), 'must contain at most 2048 characters')
    .refine((value) => isAbsoluteWebUrl(value, protocols), `must use ${protocols.join(' or ')} without credentials`);

const slug = z.string().min(1).max(64).regex(kebabCase);
const tag = z.string().min(1).max(32).regex(kebabCase);
const cover = z
  .string()
  .min(1)
  .refine((value) => hasAtMostCodePoints(value, 255), 'must contain at most 255 characters')
  .refine((value) => {
    if (
      value.startsWith('/') ||
      value.includes('\\') ||
      value.includes(':') ||
      value.includes('?') ||
      value.includes('#')
      || /[\u0000-\u001F\u007F-\u009F]/u.test(value)
      || /%2e/i.test(value)
    ) {
      return false;
    }

    const segments = value.split('/');
    return (
      segments.every((segment) => segment !== '' && segment !== '.' && segment !== '..') &&
      posix.normalize(value) === value
    );
  }, 'must be a normalized, safe project-relative path');

export const ProjectMetadataSchema = z
  .object({
    title: nonBlankString(100),
    slug,
    summary: nonBlankString(300),
    status: z.enum(['idea', 'building', 'shipped', 'archived']),
    type: z.enum(['web', 'service', 'cli', 'ai', 'script', 'other']),
    tags: z
      .array(tag)
      .max(10)
      .superRefine((tags, context) => {
        if (new Set(tags).size !== tags.length) {
          context.addIssue({ code: 'custom', message: 'tags must not contain duplicates' });
        }
      }),
    createdAt: isoDate,
    updatedAt: isoDate,
    featured: z.boolean(),
    demo: webUrl(['http:', 'https:']).nullable(),
    repository: z.union([z.literal('./'), webUrl(['https:'])]),
    cover: cover.nullable(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.updatedAt < data.createdAt) {
      context.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'must not precede createdAt',
      });
    }
  });

export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
