# Personal AI Work System

## Purpose

This is the first runnable slice of the local-first AI work system: a small work review CLI that reads Git history and turns recent repository activity into evidence-backed daily summaries and automation opportunities.

It deliberately starts with Git metadata rather than broad activity tracking. That keeps the privacy boundary clear while still making repeated development work visible.

## Development

Run a review against the current repository:

```sh
npm run review
```

Review another repository:

```sh
node src/index.mjs --repo /path/to/repo --since 14.days
```

Useful options:

- `--repo <path>`: Git repository to inspect. Defaults to the current directory.
- `--since <window>`: Relative history window. Supports values such as `7.days`, `2.weeks`, or `1.month`.
- `--json`: Print structured JSON instead of a readable report.

## Status

Building, created on 2026-07-21.

## Privacy Notes

The prototype only reads local Git metadata: commit dates, subjects, changed file paths, insertions, and deletions. It does not read file contents, shell history, clipboard data, chat messages, screenshots, credentials, or remote services.
