# 记忆回查 · cortico-world-diary-recall

给 Coopanion（Cortico）的 Coo 一个**只读的「翻旧日记」工具**：在配置好的记忆目录（通常是 bot 的 `workspace`：`handoffs/` 交接、`partner/日志.md` 等）里按关键词找原话，**只返回命中行和上下文（带 `路径:行号`）**，不把整篇文件塞进上下文。

- 纯本地、零依赖、不联网、不写任何记忆文件；
- 中文按双字词、英文/数字按单词做词面检索（不是语义检索）；
- 命中后可以 `recall_read` 定向读那一小段核对，或继续换关键词；
- 适合：上下文快满时回忆旧事、找约定/偏好/某天发生的事、避免整篇读 30–50 KB 的 handoff。
- **0.1.1 起自带一段环境提示词**：启动/上下文交接后自动进系统前缀，提醒 Coo「回忆旧事优先 `recall_search`、`recall_read` 只读片段、别整篇读 handoffs」，并在控制台「提示词」页可查看与覆盖。

## 为什么需要它

Coopanion 的长期记忆是 `data/home/companion/workspace` 这个 git 工作区。单篇 `handoffs/*.md` 常有 30–50 KB（约 1.5–2.5 万 token），几篇就能把上下文顶满。有了本插件，Coo 可以先搜一句话/一个词，只把命中的几行拿回来，再决定要不要深读。

## 安装

**从扩展市场/ npm**（发布后）：Coopanion → 高级模式 →「扩展」→ 搜 `cortico-world-diary-recall` → 安装 → 重启进程 → 「World 总览」里启用。

**从本地目录**：扩展页「安装本地扩展」选中本目录（或 `.tgz`），重启进程后启用。

## 配置

在控制台「记忆回查」页（或 `config.json` 的 `worlds.diary-recall` 段）：

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `sourceDir` | 空 | **必填**。要检索的目录：相对 bot 目录（如 `workspace`、`workspace/handoffs`）或绝对路径。留空时工具会提示。 |
| `fileExts` | `md,txt,jsonl` | 只索引这些扩展名 |
| `excludeDirs` | `node_modules,.git,blobs,.obsidian,.vscode` | 任意层级出现这些目录名就跳过 |
| `maxFiles` | `2000` | 文件数上限 |
| `maxFileMB` | `8` | 单文件超过就跳过 |
| `maxResults` | `8` | `recall_search` 默认条数 |
| `snippetLines` | `2` | 命中行前后各几行上下文 |
| `maxReadLines` | `200` | `recall_read` 单次最多读多少行 |
| `refreshSeconds` | `120` | 索引缓存多久过期重扫 |

所有配置热生效，改完下一次工具调用就按新值走。

## 工具

| 工具 | 作用 |
| --- | --- |
| `recall_search({query, limit?, path?})` | 关键词检索，返回命中行 + `路径:行号-行号` + 前后几行；每文件最多 2 条，跨文件相同内容去重 |
| `recall_read({path, startLine?, endLine?})` | 只读一小段原文核对（有行数上限，路径穿越被拒） |
| `recall_stats({refresh?})` | 看索引：目录、文件数、大小、最近扫描、各子目录分布；`refresh=true` 强制重扫 |

典型对话：

> 主人：还记得上周五我们约了什么吗？
> Coo：`recall_search({query:"周五 电影"})` → 命中 `partner/日志.md:210` → `recall_read({path:"partner/日志.md", startLine:205, endLine:225})` → 回答。

## 检索怎么做

1. 按配置列文件（跳过软链接、排除目录、限制数量与单文件大小）；
2. 查询分词：中文取双字词（单字查询保留单字），英文/数字按词，并保留 ≤8 字的中文短句做短语加权；
3. 逐行算分：命中词数 ×2 + 出现次数（上限 10）+ 文件路径命中加成，再乘以**行质量系数**（工具日志 `[调用] …`、JSON 转义串、超长行会被降权，正文口语会被略升权）；
4. 排序后每文件最多 2 条、跨文件相同内容去重，输出带上下文与行号。

## 隐私与安全

- **只读**：只调用 `readFileSync/readdirSync`，不写记忆、不改文件；
- **不联网**：没有依赖、没有遥测、没有外部 API；
- **路径限制**：`recall_read` 解析后必须在 `sourceDir` 内，`..` 穿越会被拒绝；软链接跳过；
- 索引只存在进程内存里，`stop()` 即清空，不落盘。

## 图标与示例图

- `assets/icon.png`：512×512 图标（笔记本 + 放大镜）；
- `assets/screenshot-1.png`：一次真实 `recall_search` 回执的示例图；
- `assets/screenshot-2.png`：检索流程示意图。

两张截图是**示例输出/示意图，不是 UI 截图**——本扩展没有自己的面板，只有配置页。等以后有真实控制台截图可以替换。

## 开发

```bash
node --test          # 单元测试（Node 22+）
node scripts/build-describe.mjs   # 改完 src/tools.js 后重新生成 describe.json
```

发布前检查（在 Cortico 仓库里可用 `pnpm check:extension`）：`keywords` 含 `cortico-world`、`cortico.describe` 指向存在的 describe.json、`CHANGELOG.md` 有 `## 0.1.0` 段、`os` 已写、`files` 白名单正确。

发布：`npm publish`（公开包）。发布后到 [Pal-AI-Lab/cortico-extensions](https://github.com/Pal-AI-Lab/cortico-extensions) 开一个 `[sync] cortico-world-diary-recall` issue 可以让市场立刻收录（否则等索引 Action 的定时同步）。首次发布的完整步骤见仓库里的 `PUBLISH.md`，或直接双击 `publish.cmd`。

作者：飓风号 &lt;2679689679@qq.com&gt; · 源码：<https://github.com/shusfgrs/cortico-world-diary-recall>。本包由 DSH 协助生成。

## English

Cortico/Coopanion World extension: a **read-only keyword recall tool** over a configured memory folder. `recall_search` returns matching lines with `path:line` plus a little context instead of whole files; `recall_read` reads a bounded slice to verify a hit; `recall_stats` shows index status. Local only, no network, writes nothing.

## 许可

MIT
