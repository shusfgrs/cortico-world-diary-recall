/**
 * 记忆回查（cortico-world-diary-recall）—— World 入口。
 *
 * 给 Coo 一个只读的「翻旧日记」能力：在配置好的记忆目录（workspace / handoffs / 日志）里按关键词找原话，
 * 只把命中行和上下文交给模型，避免为了回忆一件事把整篇 handoff 读进上下文。
 *
 * 纯 ESM JS、零依赖、不联网；不写任何记忆文件。
 */
import { statSync } from 'node:fs';
import { CONFIG_GROUP, DEFAULTS } from './config.js';
import { buildIndex, clampInt, findHits, loadDoc, readSlice, resolveRoot, tokenize } from './search.js';
import { TOOL_DECLS } from './tools.js';

const WORLD_ID = 'diary-recall';
const LABEL = '记忆回查';
/** 单次回执的字数上限：工具结果是模型上下文，宁少勿多。 */
const MAX_OUTPUT_CHARS = 11000;

const fail = (text) => ({ text, failed: true });
const toMB = (bytes) => (bytes / 1048576).toFixed(2);

function cap(text) {
  if (text.length <= MAX_OUTPUT_CHARS) return text;
  const cut = text.slice(0, MAX_OUTPUT_CHARS);
  const at = cut.lastIndexOf('\n');
  return `${cut.slice(0, at > 0 ? at : cut.length)}\n…（输出过长已截断；换更具体的关键词，或用 limit 减小条数）`;
}

export class DiaryRecallWorld {
  constructor({ cfg, botDir }) {
    this.id = WORLD_ID;
    this.cfg = cfg;
    this.botDir = botDir;
    this.host = null;
    this.index = null;
    /** abs -> { lines, lower, size, mtimeMs } */
    this.docs = new Map();
  }

  async start(host) {
    this.host = host ?? null;
  }

  async stop() {
    this.index = null;
    this.docs.clear();
  }

  /** 不需要注入环境提示词：工具描述里已经写清了使用时机。 */
  envPromptVars() {
    return null;
  }

  webUi() {
    return { label: LABEL, config: [CONFIG_GROUP] };
  }

  tools() {
    return TOOL_DECLS.map(({ summary, ...decl }) => ({
      ...decl,
      handler: (args) => this.handle(decl.name, args ?? {}),
    }));
  }

  async handle(name, args) {
    if (name === 'recall_search') return this.search(args);
    if (name === 'recall_read') return this.read(args);
    if (name === 'recall_stats') return this.stats(args);
    return fail(`未知工具：${name}`);
  }

  /** 解析后的资料目录；未配置或不是目录时返回 null。 */
  root() {
    const root = resolveRoot(this.cfg.sourceDir, this.botDir);
    if (!root) return null;
    try {
      if (!statSync(root).isDirectory()) return null;
    } catch {
      return null;
    }
    return root;
  }

  notConfiguredText() {
    const shown = String(this.cfg.sourceDir ?? '').trim();
    return (
      '还没有配置检索目录：打开控制台「记忆回查」→「配置」，把「检索目录」填成 workspace（相对 bot 目录）' +
      '或绝对路径（例如 D:\\DeepSeek Harness Plug\\Coopanion-Portable\\data\\home\\companion\\workspace）。' +
      (shown ? `\n当前填的是「${shown}」，但它不存在或不是目录。` : '\n当前是空的。') +
      '\n保存后立即生效，不用重启。'
    );
  }

  /** 按 TTL 复用索引；force=true 立即重建。 */
  ensureIndex(force = false) {
    const root = this.root();
    if (!root) return { error: this.notConfiguredText() };
    const ttlMs = clampInt(this.cfg.refreshSeconds, 120, 5, 86400) * 1000;
    if (!force && this.index && this.index.root === root && Date.now() - this.index.scannedAt < ttlMs) {
      return { index: this.index };
    }
    const index = buildIndex(root, this.cfg);
    const keep = new Set(index.files.map((f) => f.abs));
    for (const key of [...this.docs.keys()]) if (!keep.has(key)) this.docs.delete(key);
    this.index = index;
    return { index };
  }

  /** 按 mtime+size 懒加载文件内容，命中时只读一次。 */
  docsFor(index) {
    for (const file of index.files) {
      const cached = this.docs.get(file.abs);
      if (cached && cached.mtimeMs === file.mtimeMs && cached.size === file.size) continue;
      try {
        this.docs.set(file.abs, loadDoc(file));
      } catch {
        this.docs.delete(file.abs);
      }
    }
    return this.docs;
  }

  formatHits(query, index, hits, total) {
    const out = [
      `在 ${index.files.length} 个文件（${toMB(index.bytes)} MB）里搜「${query}」：命中 ${total} 行，显示 ${hits.length} 条。`,
    ];
    hits.forEach((hit, i) => {
      out.push('');
      out.push(`[${i + 1}] ${hit.rel}:${hit.snippet.from}-${hit.snippet.to}  分 ${hit.score.toFixed(1)}  命中词：${hit.matched.join('、')}`);
      for (const item of hit.snippet.items) {
        const text = item.text.length > 240 ? `${item.text.slice(0, 240)}…` : item.text;
        out.push(`${item.hit ? '→' : ' '} ${String(item.no).padStart(5, ' ')}| ${text}`);
      }
    });
    if (total > hits.length) {
      out.push(`\n（还有 ${total - hits.length} 处没显示：加 path 只搜某个目录，或用更具体的关键词重搜。）`);
    }
    out.push('\n需要更多上下文就用 recall_read{path, startLine, endLine} 定向读那一段，不要整篇读文件。');
    return cap(out.join('\n'));
  }

  search(args) {
    const query = String(args.query ?? '').trim();
    if (!query) return fail('query 不能为空：给一个短关键词，比如「语音」或「大肥鱼」。');
    const state = this.ensureIndex(false);
    if (state.error) return fail(state.error);
    const tokens = tokenize(query);
    if (!tokens.length) return fail('query 里没有可检索的词。');
    const docs = this.docsFor(state.index);
    const limit = clampInt(args.limit, clampInt(this.cfg.maxResults, 8, 1, 20), 1, 20);
    const { hits, total } = findHits(state.index, docs, tokens, {
      limit,
      perFile: 2,
      snippetLines: clampInt(this.cfg.snippetLines, 2, 0, 10),
      pathPrefix: String(args.path ?? ''),
    });
    if (!hits.length) {
      return (
        `在 ${state.index.files.length} 个文件（${toMB(state.index.bytes)} MB）里没找到「${query}」。\n` +
        '这是词面检索（不懂同义词/指代）：换更短的关键词、或换一个说法再试一次；也可以先用 recall_stats 看索引范围。'
      );
    }
    return this.formatHits(query, state.index, hits, total);
  }

  read(args) {
    const root = this.root();
    if (!root) return fail(this.notConfiguredText());
    const slice = readSlice(
      root,
      args.path,
      args.startLine,
      args.endLine,
      clampInt(this.cfg.maxReadLines, 200, 1, 2000),
    );
    if (slice.error) return fail(slice.error);
    const out = [`文件：${slice.rel}（共 ${slice.total} 行，显示 ${slice.start}–${slice.end}）`];
    for (let i = 0; i < slice.lines.length; i += 1) {
      out.push(`${String(slice.start + i).padStart(5, ' ')}| ${slice.lines[i]}`);
    }
    if (slice.start > 1 || slice.end < slice.total) {
      out.push('\n（只读片段。要看别处再用 recall_read 指定 startLine/endLine，不要整篇读。）');
    }
    return cap(out.join('\n'));
  }

  stats(args) {
    const root = this.root();
    if (!root) return fail(this.notConfiguredText());
    const state = this.ensureIndex(Boolean(args.refresh));
    if (state.error) return fail(state.error);
    const index = state.index;
    const ageSec = Math.max(0, Math.round((Date.now() - index.scannedAt) / 1000));
    const byTop = new Map();
    for (const file of index.files) {
      const key = file.rel.includes('/') ? `${file.rel.split('/')[0]}/` : '(根目录)';
      byTop.set(key, (byTop.get(key) ?? 0) + 1);
    }
    const topLines = [...byTop.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([key, count]) => `  ${key} ${count} 个文件`);
    const out = [
      `检索目录：${index.root}`,
      `索引：${index.files.length} 个文件 / ${toMB(index.bytes)} MB（${ageSec} 秒前扫描；刷新间隔 ${clampInt(this.cfg.refreshSeconds, 120, 5, 86400)} 秒）`,
      `文件类型：${this.cfg.fileExts}；跳过目录：${this.cfg.excludeDirs}`,
      topLines.length ? '按目录：' : '按目录：（空）',
      ...topLines,
      '',
      '用法：recall_search{query:"关键词"} 找原话 → recall_read{path,startLine,endLine} 核对片段。',
    ];
    return cap(out.join('\n'));
  }
}

export const DIARY_RECALL = {
  id: WORLD_ID,
  label: LABEL,
  defaults: () => ({ ...DEFAULTS }),
  create: (ctx) => new DiaryRecallWorld({ cfg: ctx.cfg, botDir: ctx.botDir }),
  describe: {
    tools: TOOL_DECLS.map(({ summary, ...decl }) => ({ ...decl, summary })),
    events: [],
  },
};

export default DIARY_RECALL;
