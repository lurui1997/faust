# Faust

Faust 是一个“一个仓库、多种技术栈”的个人项目陈列馆。每个项目独立生活在 `projects/`，Astro 画廊只读取其元数据和 README；根工具不会构建、测试或运行项目代码。

## 仓库结构

```text
faust/
├── gallery/                 # Astro 静态站点
│   ├── public/              # 生成的封面版本与 project-assets 符号链接（不提交）
│   └── src/data/
│       └── projects.generated.json  # 生成的画廊索引（不提交）
├── projects/                # 项目；首次创建前可以不存在
│   └── <slug>/
│       ├── project.json     # 画廊元数据
│       ├── README.md        # 项目说明与独立开发命令
│       └── ...              # 项目自己的源码、依赖和工具链
├── templates/               # blank、web、script 创建模板
├── tools/                   # 创建、校验、索引和列表工具
├── notes/                   # 笔记；不进入画廊
├── docs/                    # 元数据与维护文档
├── project.schema.json      # 元数据契约的唯一权威来源
├── package.json             # 根管理命令
└── pnpm-lock.yaml
```

## 从全新检出开始

要求：Linux 或 macOS、Node.js 22、Corepack，以及 pnpm 10.13.1（由 `packageManager` 固定）。

```sh
corepack enable
corepack prepare pnpm@10.13.1 --activate
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm create:project` 第一次成功创建项目时会从已提交的 C 源码编译一个私有的原子发布助手，因此 `/usr/bin/cc` 必须存在：

- macOS：运行 `xcode-select --install` 安装 Xcode Command Line Tools。
- Linux：用系统包管理器安装 C 编译器，并确认 `/usr/bin/cc` 可执行（例如 Debian/Ubuntu 的 `build-essential`）。

Windows 等其他平台会明确报 `unsupported`；请在 Linux/macOS（本机、容器或 CI）中执行创建命令。仓库不提交任何原生二进制；助手按源码、平台和架构缓存在系统临时目录。

## 稳定命令

| 命令 | 作用 |
| --- | --- |
| `pnpm validate` | 校验全部项目目录、元数据、README 和封面 |
| `pnpm generate` | 校验后生成画廊索引和封面资源 |
| `pnpm dev` | 校验、生成并启动 Astro 开发服务器 |
| `pnpm build` | 校验、生成、类型检查并构建 `gallery/dist/` |
| `pnpm test` | 运行自动化测试 |
| `pnpm check` | 依次运行校验、测试和生产构建 |
| `pnpm create:project` | 交互式创建并原子发布一个项目 |
| `pnpm list:projects` | 按更新时间列出项目；空库会提示创建命令 |

所有根命令都应从仓库根目录运行。项目自己的安装、开发和测试命令写在该项目的 README 中，并在 `projects/<slug>` 内运行；项目不是 pnpm workspace 成员，也不会被根 `build` 或 `check` 隐式执行。

## 项目生命周期

1. 运行 `pnpm create:project`，填写标题、类型、模板与摘要并确认 slug。创建器写入安全默认值：`idea`、空标签、`featured: false`、无 demo/封面、本仓库源码链接。
2. 进入输出的 `projects/<slug>` 路径，按项目 README 独立开发。
3. 有实质变化时编辑 `project.json`：同步更新 `updatedAt`，按进度使用 `idea` → `building` → `shipped`；不再默认展示时设为 `archived`。状态可以按实际情况回退或恢复。
4. 若添加封面，把普通文件放在项目目录内并设置安全的相对 `cover` 路径；若部署演示，设置绝对 HTTP(S) `demo`。
5. 运行 `pnpm validate` 和 `pnpm list:projects`，提交前运行 `pnpm check`。不要手改或提交 `projects.generated.json`、`gallery/public/project-assets`、`.project-assets-*` 或 `gallery/dist/`。

完整字段与合法 JSON 示例见 [项目元数据](docs/project-metadata.md)，开发、发布、恢复与模板维护见 [画廊维护](docs/gallery-maintenance.md)。
