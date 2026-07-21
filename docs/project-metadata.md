# 项目元数据 / Project metadata

每个 `projects/` 的直接子目录都必须含普通文件 `project.json` 和 `README.md`。`project.schema.json` 是字段、必填性与约束的唯一权威来源；本文是便于维护者阅读的说明。如二者不一致，以 Schema 为准并同步修正文档。

## 完整合法示例

目录名须为 `semantic-search`：

```json
{
  "title": "Semantic Search Playground",
  "slug": "semantic-search",
  "summary": "用不同向量模型比较中文语义搜索效果。",
  "status": "building",
  "type": "ai",
  "tags": ["embeddings", "search"],
  "createdAt": "2026-07-21",
  "updatedAt": "2026-07-21",
  "featured": false,
  "demo": null,
  "repository": "./",
  "cover": null
}
```

这 12 个字段全部必填，即使可空字段也必须写为 `null`。对象拒绝未知字段，拼错的键不会被静默忽略。

## 字段规则

| 字段 | 类型与规则 |
| --- | --- |
| `title` | 非空白字符串，1–100 字符 |
| `slug` | 1–64 字符；小写 ASCII kebab-case：`^[a-z0-9]+(?:-[a-z0-9]+)*$`；必须与目录名一致且在仓库内唯一 |
| `summary` | 非空白字符串，1–300 字符；公开展示的简述 |
| `status` | 下表中的一个状态 |
| `type` | 下表中的一个类型 |
| `tags` | 数组，最多 10 项且不可重复；每项 1–32 字符并遵循与 slug 相同的小写 kebab-case 形式；可为空数组 |
| `createdAt` | 真实 ISO 日历日期 `YYYY-MM-DD` |
| `updatedAt` | 真实 ISO 日历日期，且不得早于 `createdAt` |
| `featured` | 布尔值；用于视觉强调，不改变路由或分区 |
| `demo` | 无用户名/密码的绝对 `http://` 或 `https://` URL（最长 2048 字符），或 `null` |
| `repository` | 精确的 `"./"`，或无用户名/密码的绝对 HTTPS URL（最长 2048 字符） |
| `cover` | 安全、规范化的项目内相对路径（1–255 字符），或 `null`；还必须指向项目目录内存在的普通文件 |

`repository: "./"` 表示源码就在当前 Faust 仓库，画廊会按配置的 GitHub owner、仓库名、分支和 `projects/<slug>` 生成链接；它不是文件系统路径，也不要改成 `"."`。

安全封面路径不能以 `/` 开头，不能含反斜杠、冒号、查询串、片段、控制字符、空路径段、`.`/`..` 段或编码后的 `%2e`，不能以 `/` 结尾。例如 `assets/cover.webp` 合法，`../cover.png`、`assets//cover.png`、`C:\\cover.png`、`cover.png?raw=1` 均非法。符号链接或逃出项目目录的目标也不会通过仓库校验。

## 枚举

| `status` | 含义 |
| --- | --- |
| `idea` | 已记录，尚处于构想或起步阶段 |
| `building` | 正在实现或迭代 |
| `shipped` | 已形成可用成果 |
| `archived` | 已归档；默认画廊筛选不显示，但仍可查看 |

| `type` | 适用项目 |
| --- | --- |
| `web` | Web 页面或应用 |
| `service` | 服务或 API |
| `cli` | 命令行工具 |
| `ai` | AI/机器学习实验 |
| `script` | 脚本或自动化 |
| `other` | 以上均不适用 |

## 常见无效写法

以下片段都不是可提交的完整元数据：

```json
{ "slug": "Semantic_Search" }
```

含大写字母和下划线，也不会与 kebab-case 目录匹配。

```json
{ "createdAt": "2026-07-22", "updatedAt": "2026-07-21" }
```

更新时间早于创建日期。`2026-02-30` 这类不存在的日历日期也非法。

```json
{ "tags": ["ai", "ai", "中文"] }
```

标签重复，且 `中文` 不符合小写 ASCII kebab-case 规则。

```json
{ "repository": "http://example.com/source", "cover": "../outside.png", "extra": true }
```

外部源码只允许 HTTPS，封面发生目录穿越，`extra` 是未知字段。

运行 `pnpm validate` 可得到 `项目: 字段 — 原因; fix: 修复建议` 形式的诊断。外部 URL 只检查语法，不请求网络。
