import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repositoryRoot = fileURLToPath(new URL("../../", import.meta.url));

const expectedHashes = {
  "notes/allinone.md": "71d6e5abc20270e0bf14cc6271bddaca47b6241f390108d7bd6b0c0f14b6eec7",
  "notes/读书笔记.md": "9ffa1ea8a4e97ef8fc7b7098c5c1bc6cbd857012cda33e8c3d36033b85565538",
  "notes/随笔.md": "0614c813d9159b284ca86a9400783058058ea6d6ef00df033441bf66b1af014f",
  "notes/项目.md": "ef5da0f6ad97d24e571d1f3d6e70b0f14d4e7bbd308ca7a08cc3dee20632632c",
  "notes/DONE.md": "df46263d940594ba5c06d8ebdeb7c881f67166c939aa7dd9920a2eed1577918e",
  "notes/code/bricks.md": "b204f9e57fe16a0797cccaa7a4ce2235eefd346717db30e1c7d8b11453cc9bd2",
} as const;

describe("notes migration", () => {
  for (const [relativePath, expectedHash] of Object.entries(expectedHashes)) {
    it(`preserves the bytes of ${relativePath}`, async () => {
      const contents = await readFile(`${repositoryRoot}${relativePath}`);
      const actualHash = createHash("sha256").update(contents).digest("hex");

      expect(actualHash).toBe(expectedHash);
    });
  }
});
