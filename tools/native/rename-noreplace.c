#if defined(__linux__)
#define _GNU_SOURCE
#endif

#include <errno.h>
#include <stdio.h>

#if defined(__linux__)
#include <fcntl.h>
#include <sys/syscall.h>
#include <unistd.h>
#elif defined(__APPLE__)
#include <stdio.h>
#else
#error "rename-noreplace supports only Linux and macOS"
#endif

int main(int argc, char **argv) {
  if (argc != 3) {
    fprintf(stderr, "usage: rename-noreplace SOURCE DESTINATION\n");
    return 2;
  }

#if defined(__linux__)
  int result = (int)syscall(SYS_renameat2, AT_FDCWD, argv[1], AT_FDCWD, argv[2], RENAME_NOREPLACE);
#elif defined(__APPLE__)
  int result = renamex_np(argv[1], argv[2], RENAME_EXCL);
#endif

  if (result == 0) return 0;
  if (errno == EEXIST || errno == ENOTEMPTY) return 3;
  if (errno == ENOSYS || errno == ENOTSUP) return 4;
  perror("atomic no-replace rename");
  return 1;
}
