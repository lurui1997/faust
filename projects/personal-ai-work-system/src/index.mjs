import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const DEFAULT_SINCE = '14.days';

function parseArgs(argv) {
  const options = { repo: process.cwd(), since: DEFAULT_SINCE, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') {
      options.json = true;
    } else if (arg === '--repo') {
      options.repo = argv[++index];
    } else if (arg === '--since') {
      options.since = argv[++index];
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (typeof options.repo !== 'string' || options.repo.trim() === '') throw new Error('--repo requires a path');
  if (typeof options.since !== 'string' || options.since.trim() === '') throw new Error('--since requires a value');
  return { ...options, repo: resolve(options.repo) };
}

function printHelp() {
  console.log(`Personal AI Work System

Usage:
  node src/index.mjs [--repo PATH] [--since 14.days] [--json]

Examples:
  node src/index.mjs
  node src/index.mjs --repo ../faust --since 2.weeks
  node src/index.mjs --json
`);
}

function runGit(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function ensureGitRepo(repo) {
  if (!existsSync(repo)) throw new Error(`Repository path does not exist: ${repo}`);
  try {
    runGit(repo, ['rev-parse', '--is-inside-work-tree']);
  } catch {
    throw new Error(`Not a Git work tree: ${repo}`);
  }
}

function normalizeSince(value) {
  const match = value.match(/^(\d+)\.(day|days|week|weeks|month|months)$/);
  if (!match) throw new Error('--since must look like 7.days, 2.weeks, or 1.month');
  const [, amount, unit] = match;
  const normalizedUnit = unit.startsWith('day') ? 'days' : unit.startsWith('week') ? 'weeks' : 'months';
  return `${amount} ${normalizedUnit} ago`;
}

function readCommits(repo, since) {
  const format = '%H%x1f%ad%x1f%s';
  const output = runGit(repo, [
    'log',
    `--since=${normalizeSince(since)}`,
    '--date=short',
    `--pretty=format:${format}`,
    '--numstat',
  ]);
  if (output === '') return [];

  const commits = [];
  let current = null;
  for (const line of output.split('\n')) {
    if (line.includes('\x1f')) {
      const [hash, date, subject] = line.split('\x1f');
      current = { hash, date, subject, files: [], insertions: 0, deletions: 0 };
      commits.push(current);
      continue;
    }
    if (current === null || line.trim() === '') continue;
    const [added, deleted, file] = line.split('\t');
    if (file === undefined) continue;
    const insertions = added === '-' ? 0 : Number.parseInt(added, 10);
    const deletions = deleted === '-' ? 0 : Number.parseInt(deleted, 10);
    current.files.push(file);
    current.insertions += Number.isFinite(insertions) ? insertions : 0;
    current.deletions += Number.isFinite(deletions) ? deletions : 0;
  }
  return commits;
}

function bucketByDay(commits) {
  const days = new Map();
  for (const commit of commits) {
    const day = days.get(commit.date) ?? {
      date: commit.date,
      commits: 0,
      insertions: 0,
      deletions: 0,
      files: new Map(),
      subjects: [],
    };
    day.commits += 1;
    day.insertions += commit.insertions;
    day.deletions += commit.deletions;
    day.subjects.push(commit.subject);
    for (const file of commit.files) day.files.set(file, (day.files.get(file) ?? 0) + 1);
    days.set(commit.date, day);
  }
  return [...days.values()].sort((a, b) => b.date.localeCompare(a.date));
}

function summarizeDay(day) {
  const topFiles = [...day.files.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([file, touches]) => ({ file, touches }));

  return {
    date: day.date,
    commits: day.commits,
    churn: { insertions: day.insertions, deletions: day.deletions },
    topFiles,
    evidence: day.subjects.slice(0, 5),
  };
}

function inferOpportunities(commits) {
  const fileTouches = new Map();
  const subjectTokens = new Map();

  for (const commit of commits) {
    for (const file of new Set(commit.files)) fileTouches.set(file, (fileTouches.get(file) ?? 0) + 1);
    for (const token of commit.subject.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? []) {
      if (['the', 'and', 'for', 'with', 'from', 'into', 'this', 'that'].includes(token)) continue;
      subjectTokens.set(token, (subjectTokens.get(token) ?? 0) + 1);
    }
  }

  const repeatedFiles = [...fileTouches.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const repeatedTerms = [...subjectTokens.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);

  const opportunities = [];
  for (const [file, touches] of repeatedFiles) {
    opportunities.push({
      title: `Review repeated edits around ${file}`,
      confidence: Math.min(0.95, 0.45 + touches * 0.1),
      evidence: `${touches} commits touched this file in the selected window.`,
      suggestedNextStep: 'Inspect whether validation, formatting, or release notes around this file can be automated.',
    });
  }
  for (const [term, count] of repeatedTerms) {
    opportunities.push({
      title: `Investigate recurring "${term}" work`,
      confidence: Math.min(0.9, 0.4 + count * 0.08),
      evidence: `${count} commit subjects mention this term in the selected window.`,
      suggestedNextStep: 'Group matching commits and label whether this is a reusable workflow.',
    });
  }
  return opportunities
    .sort((a, b) => b.confidence - a.confidence || a.title.localeCompare(b.title))
    .slice(0, 3);
}

function buildReview(repo, since) {
  ensureGitRepo(repo);
  const commits = readCommits(repo, since);
  const days = bucketByDay(commits).map(summarizeDay);
  return {
    generatedAt: new Date().toISOString(),
    repo,
    since,
    totals: {
      commits: commits.length,
      files: new Set(commits.flatMap((commit) => commit.files)).size,
      insertions: commits.reduce((sum, commit) => sum + commit.insertions, 0),
      deletions: commits.reduce((sum, commit) => sum + commit.deletions, 0),
    },
    days,
    opportunities: inferOpportunities(commits),
    collectionGaps: commits.length === 0 ? ['No Git commits found in the selected window.'] : [],
  };
}

function renderReport(review) {
  const lines = [
    'Personal AI Work System',
    `Repository: ${review.repo}`,
    `Window: ${review.since}`,
    '',
    `Observed ${review.totals.commits} commits across ${review.totals.files} files.`,
    `Churn: +${review.totals.insertions} -${review.totals.deletions}`,
    '',
    'Daily review',
  ];

  if (review.days.length === 0) {
    lines.push('- No activity found.');
  } else {
    for (const day of review.days.slice(0, 5)) {
      lines.push(`- ${day.date}: ${day.commits} commits, +${day.churn.insertions} -${day.churn.deletions}`);
      for (const file of day.topFiles.slice(0, 3)) lines.push(`  evidence: ${file.file} (${file.touches} touches)`);
    }
  }

  lines.push('', 'Automation opportunities');
  if (review.opportunities.length === 0) {
    lines.push('- None above the conservative threshold yet.');
  } else {
    for (const opportunity of review.opportunities) {
      lines.push(`- ${opportunity.title}`);
      lines.push(`  confidence: ${opportunity.confidence.toFixed(2)}`);
      lines.push(`  evidence: ${opportunity.evidence}`);
      lines.push(`  next: ${opportunity.suggestedNextStep}`);
    }
  }

  if (review.collectionGaps.length > 0) {
    lines.push('', 'Collection gaps');
    for (const gap of review.collectionGaps) lines.push(`- ${gap}`);
  }

  return `${lines.join('\n')}\n`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
  } else {
    const review = buildReview(options.repo, options.since);
    process.stdout.write(options.json ? `${JSON.stringify(review, null, 2)}\n` : renderReport(review));
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
