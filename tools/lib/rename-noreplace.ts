import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmod, link, lstat, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export type NativeCommandResult = { code: number; stderr: string };
export type NativeCommandRunner = (command: string, args: string[]) => Promise<NativeCommandResult>;

export type NativeRenameAdapterOptions = {
  platform?: NodeJS.Platform | string;
  architecture?: string;
  uid?: number | 'user';
  sourcePath?: string;
  cacheRoot?: string;
  compilerPath?: string;
  run?: NativeCommandRunner;
};

const bundledSource = join(dirname(fileURLToPath(import.meta.url)), '..', 'native', 'rename-noreplace.c');

const spawnCommand: NativeCommandRunner = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stderr }));
  });

export function createAtomicRenameNoReplaceAdapter(options: NativeRenameAdapterOptions = {}) {
  const platform = options.platform ?? process.platform;
  const architecture = options.architecture ?? process.arch;
  const uid = options.uid ?? (typeof process.getuid === 'function' ? process.getuid() : 'user');
  const sourcePath = options.sourcePath ?? bundledSource;
  const cache = options.cacheRoot ?? join(tmpdir(), `faust-native-${uid}`);
  const compiler = options.compilerPath ?? '/usr/bin/cc';
  const run = options.run ?? spawnCommand;
  let helperPromise: Promise<string> | undefined;

  const validateCache = async (): Promise<void> => {
    const cacheStat = await lstat(cache);
    if (!cacheStat.isDirectory() || (cacheStat.mode & 0o077) !== 0 || (typeof uid === 'number' && cacheStat.uid !== uid)) {
      throw new Error(`Native helper cache is not private and trusted: ${cache}`);
    }
  };

  const validateExecutable = async (executable: string): Promise<void> => {
    const existing = await lstat(executable);
    if (
      !existing.isFile()
      || (typeof uid === 'number' && existing.uid !== uid)
      || (existing.mode & 0o077) !== 0
      || (existing.mode & 0o100) === 0
    ) {
      throw new Error(`Cached native helper is not a trusted restrictive regular file: ${executable}`);
    }
  };

  const compiledHelper = async (): Promise<string> => {
    if (platform !== 'linux' && platform !== 'darwin') {
      throw new Error(`Atomic project publication is unsupported on ${platform}; use Linux or macOS`);
    }
    const source = await readFile(sourcePath);
    const key = createHash('sha256').update(source).update(platform).update(architecture).digest('hex').slice(0, 20);
    await mkdir(cache, { recursive: true, mode: 0o700 });
    await validateCache();
    const executable = join(cache, `rename-noreplace-${key}`);
    try {
      await validateExecutable(executable);
      return executable;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }

    const build = await mkdtemp(join(cache, '.build-'));
    const candidate = join(build, 'rename-noreplace');
    try {
      let result: NativeCommandResult;
      try {
        result = await run(compiler, ['-std=c11', '-O2', sourcePath, '-o', candidate]);
      } catch (error) {
        throw new Error(`Atomic publication helper compiler is unavailable at ${compiler}; install a C compiler`, { cause: error });
      }
      if (result.code !== 0) {
        throw new Error(`Atomic publication helper could not be compiled with ${compiler}; install a C compiler. ${result.stderr.trim()}`);
      }
      await chmod(candidate, 0o700);
      try { await link(candidate, executable); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      }
      await validateExecutable(executable);
      return executable;
    } finally {
      await rm(build, { recursive: true, force: true });
    }
  };

  return async (source: string, destination: string): Promise<void> => {
    helperPromise ??= compiledHelper();
    const helper = await helperPromise;
    await validateCache();
    await validateExecutable(helper);
    const result = await run(helper, [source, destination]);
    if (result.code === 0) return;
    if (result.code === 3) {
      const error = new Error(`Destination already exists: ${destination}`) as NodeJS.ErrnoException;
      error.code = 'EEXIST';
      throw error;
    }
    if (result.code === 4) throw new Error(`This ${platform} kernel does not support atomic no-replace rename`);
    throw new Error(`Atomic project publication failed: ${result.stderr.trim() || `helper exited ${result.code}`}`);
  };
}

export const atomicRenameNoReplace = createAtomicRenameNoReplaceAdapter();
