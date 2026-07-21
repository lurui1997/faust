# 画廊维护 / Gallery maintenance

本文面向仓库 owner 和贡献者。根工具只读取项目元数据、README 和元数据显式引用的封面普通文件；它不会执行 `projects/*` 中的代码、安装项目依赖或运行项目自己的构建与测试。

## 日常开发与空画廊

```sh
pnpm dev
```

该命令先执行 `validate`、再生成索引与封面、最后启动 Astro。没有 `projects/` 或目录为空是合法状态：`pnpm validate` 输出 `Validated 0 projects`，`pnpm list:projects` 输出 `No projects found. Run pnpm create:project.`，站点显示如何创建首个项目。不要为消除空状态而提交占位项目。

校验失败会停止生成、开发和构建。诊断格式为：

```text
demo-project: cover — cover "missing.webp" is missing or unreadable; fix: add the referenced cover inside the project directory or set cover to null
```

按 `project`、`field` 和 `fix` 修复；常见原因包括缺少/非普通文件的 `project.json` 或 `README.md`、畸形 JSON、Schema 字段错误、slug 与目录不符、重复 slug、封面缺失或越界。只校验单个目录是内部 API 能力，不是稳定 CLI；维护者应运行完整的 `pnpm validate`。

## 索引和封面的生成与恢复

`pnpm generate` 先校验全部项目，按 `updatedAt` 降序、同日按 slug 升序写入 `gallery/src/data/projects.generated.json`。索引以临时文件加 rename 原子替换。

封面被复制到内容哈希命名的不可变目录 `gallery/public/.project-assets-<hash>/`，公开路径 `gallery/public/project-assets` 是指向当前版本的符号链接。生成器先完整校验 staging，再原子切换链接与索引；失败时恢复旧链接并清理本次版本，因此不要把普通目录或自己的文件放在这些保留路径中。

进程中断后直接重新运行 `pnpm generate`。它会清除自己遗留的 `.project-assets-stage-XXXXXX` 和锁名，复用完整的哈希版本，并在成功发布后尽力删除旧版本。若报活动版本不完整，不要手改索引：先确认项目封面可读，再删除**诊断点名且位于 `gallery/public/` 的损坏生成版本和 `project-assets` 链接**，重新生成。所有这些路径均在 `.gitignore` 中，不应提交。

## GitHub Pages 配置

默认发布身份来自 `tools/config.ts`：owner `lurui1997`、仓库 `faust`、分支 `main`，站点 `https://lurui1997.github.io`，base `/faust`。未设置 `FAUST_BASE` 时，工具与 Astro 都从 `FAUST_GITHUB_REPOSITORY` 派生 `/<仓库名>`，确保生成链接与构建路径一致。分叉、重命名或预览构建时可设置：

| 环境变量 | 作用 |
| --- | --- |
| `FAUST_GITHUB_OWNER` | `repository: "./"` 的 GitHub owner |
| `FAUST_GITHUB_REPOSITORY` | GitHub 仓库名及默认 Pages base |
| `FAUST_GITHUB_BRANCH` | 本仓库源码链接使用的分支 |
| `FAUST_SITE` | Astro 的绝对站点 origin |
| `FAUST_BASE` | 部署子路径，如 `/preview`；根部署可用 `/` |

例如：

```sh
FAUST_GITHUB_OWNER=acme FAUST_GITHUB_REPOSITORY=lab \
FAUST_GITHUB_BRANCH=main FAUST_SITE=https://acme.github.io FAUST_BASE=/lab \
pnpm build
```

环境变量必须同时提供给 `generate` 与 Astro 构建；使用 `pnpm build` 可保证二者处于同一进程环境，避免详情、封面和源码链接不一致。产物位于 `gallery/dist/`。

## 发布前人工可访问性检查

在 `pnpm check` 通过后，至少覆盖下表。使用真实浏览器测试宽屏和窄屏，并分别检查有/无项目、有/无封面与 demo。

| 场景 | 检查点 |
| --- | --- |
| 仅键盘 | Tab 顺序自然；skip link、筛选器、重置和项目链接可达；焦点清晰；重置后焦点回到索引标题 |
| 屏幕阅读器 | landmarks/标题层级合理；筛选标签明确；数量更新由 live region 宣告；封面 fallback 与链接有可理解名称 |
| 200%/窄屏 | 无横向溢出；长标题、标签和 URL 换行；控件和操作保持可用 |
| 对比度/焦点 | 正文、弱化文字、边框和焦点指示在实际背景上可辨 |
| 动效 | `prefers-reduced-motion: reduce` 下无非必要动画 |
| 无 JavaScript | 默认 active 项目仍可读，`noscript` 说明存在；归档项目可由直接详情链接访问 |
| 筛选状态 | type/status 查询参数可分享；无匹配与真正空库提示不同；Reset 恢复默认 active |
| 链接与资源 | Pages base 下首页、详情、封面、Demo 和 source 均正确；外链不产生脚本执行 |

## 扩展项目模板

新增模板只为减少重复起步工作，不得把项目接入根 workspace 或根构建：

1. 在 `templates/<name>/` 添加普通目录和以 `.tpl` 结尾的模板文件；禁止符号链接。目录和文件须归当前用户所有，且不可被 group/other 写入。
2. 仅使用创建器已提供的显式占位符；未知、畸形或残留的 `{{...}}` 会失败。模板不执行代码。
3. 每个模板生成 `README.md`，清楚写 Purpose、Development、Status；项目依赖和命令留在项目内。
4. 在 `TemplateName`、交互选项、开发提示和下一步提示中显式登记模板，并补充创建/安全测试。
5. 运行 `pnpm test` 和 `pnpm check`。不要把新项目设为 pnpm workspace 成员，也不要从根脚本代理其构建。

## 原生发布助手排障

创建器在最终发布前调用 `tools/native/rename-noreplace.c` 编译出的助手，保证并发创建不会覆盖已有目录。缓存为系统临时目录下当前用户专属的 `faust-native-<uid>/rename-noreplace-<hash>`，目录与文件必须归当前用户所有、不可被其他用户访问；源码/平台/架构变化会产生新 hash。仓库只提交 C 源码，不提交缓存二进制。

- `compiler is unavailable at /usr/bin/cc`：安装 Xcode CLT 或 Linux C 工具链，并确认该固定路径存在。
- `unsupported on <platform>`：改在 Linux/macOS 执行 `pnpm create:project`。
- `cache is not private and trusted` / `not a trusted restrictive regular file`：检查临时目录归属与权限；确认精确路径后删除该用户的 `faust-native-<uid>` 缓存，让下次创建以 `0700` 重建。不要删除整个系统临时目录。
- `kernel does not support atomic no-replace rename`：换用支持相应原子 rename 的 Linux/macOS 内核或环境；不要用普通 `mv` 绕过保护。
- `already exists or is being created`：这是安全冲突，不是缓存故障；选择新的 slug。

若编译诊断仍不清楚，保留完整终端输出、`node --version`、`pnpm --version`、操作系统/架构及 `/usr/bin/cc --version`，再报告工具问题。
