import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, link, lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const sourcePath = join(dirname(fileURLToPath(import.meta.url)), '..', 'native', 'rename-noreplace.c');
let helperPromise: Promise<string> | undefined;

const run = (command: string, args: string[]): Promise<{ code: number; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });

async function compiledHelper(): Promise<string> {
  if (process.platform !== 'linux' && process.platform !== 'darwin') {
    throw new Error(`Atomic project publication is unsupported on ${process.platform}; use Linux or macOS`);
  }
  const source = await readFile(sourcePath);
  const key = createHash('sha256').update(source).update(process.platform).update(process.arch).digest('hex').slice(0, 20);
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'user';
  const cache = join(tmpdir(), `faust-native-${uid}`);
  await mkdir(cache, { recursive: true, mode: 0o700 });
  const cacheStat = await lstat(cache);
  if (!cacheStat.isDirectory() || (cacheStat.mode & 0o077) !== 0 || (typeof uid === 'number' && cacheStat.uid !== uid)) {
    throw new Error(`Native helper cache is not private and trusted: ${cache}`);
  }
  const executable = join(cache, `rename-noreplace-${key}`);
  try {
    const existing = await lstat(executable);
    if (!existing.isFile() || existing.uid !== cacheStat.uid) throw new Error('Cached native helper is not a trusted regular file');
    return executable;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  const build = await mkdtemp(join(cache, '.build-'));
  const candidate = join(build, 'rename-noreplace');
  try {
    const compiler = '/usr/bin/cc';
    const result = await run(compiler, ['-std=c11', '-O2', sourcePath, '-o', candidate]);
    if (result.code !== 0) {
      throw new Error(`Atomic publication helper could not be compiled with ${compiler}; install a C compiler. ${result.stderr.trim()}`);
    }
    await chmod(candidate, 0o700);
    try { await link(candidate, executable); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    return executable;
  } finally {
    await rm(build, { recursive: true, force: true });
  }
}

export async function atomicRenameNoReplace(source: string, destination: string): Promise<void> {
  helperPromise ??= compiledHelper();
  const helper = await helperPromise;
  const result = await run(helper, [source, destination]);
  if (result.code === 0) return;
  if (result.code === 3) {
    const error = new Error(`Destination already exists: ${destination}`) as NodeJS.ErrnoException;
    error.code = 'EEXIST';
    throw error;
  }
  if (result.code === 4) throw new Error(`This ${process.platform} kernel does not support atomic no-replace rename`);
  throw new Error(`Atomic project publication failed: ${result.stderr.trim() || `helper exited ${result.code}`}`);
}
