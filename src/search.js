/**
 * 记忆回查（cortico-world-diary-recall）的只读检索核心。
 *
 * 这一层不依赖 Coopanion 宿主，纯 Node 文件系统，方便单测：
 * - buildIndex：把配置目录里的文本文件列出来（跳过软链接、隐藏不需要的目录、按大小/数量设上限）
 * - loadDoc / findHits：按关键词（中文双字词 + 英文单词）给行打分，返回命中行与上下文片段
 * - readSlice：只读一小段原文，路径必须落在资料目录内
 */
import { lstatSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, isAbsolute, join, resolve, sep } from 'node:path';

/** 递归深度上限：记忆目录通常很浅，防异常目录树。 */
export const MAX_DEPTH = 32;

const HAN = /[\u3400-\u9fff]/;

export function clampInt(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function csv(value, fallback) {
  const raw = String(value ?? '').trim();
  if (!raw) return [...fallback];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** 相对路径以 botDir 为基准，绝对路径原样使用；空值表示未配置。 */
export function resolveRoot(sourceDir, botDir) {
  const raw = String(sourceDir ?? '').trim();
  if (!raw) return null;
  return isAbsolute(raw) ? resolve(raw) : resolve(botDir, raw);
}

/** abs 是否在 root 内（含 root 本身），用于阻止路径穿越。 */
export function isInside(root, abs) {
  const r = resolve(root);
  const a = resolve(abs);
  return a === r || a.startsWith(r.endsWith(sep) ? r : r + sep);
}

/**
 * 列文件：按扩展名过滤、跳过软链接与排除目录、限制文件数与单文件大小。
 * 返回的 rel 统一用 `/`，便于在回执里显示和跨平台。
 */
export function buildIndex(root, cfg = {}) {
  const exts = new Set(
    csv(cfg.fileExts, ['md', 'txt', 'jsonl']).map((e) => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`)),
  );
  const excluded = new Set(csv(cfg.excludeDirs, ['node_modules', '.git', 'blobs']).map((s) => s.toLowerCase()));
  const maxFiles = clampInt(cfg.maxFiles, 2000, 1, 50000);
  const maxBytesPerFile = clampNumber(cfg.maxFileMB, 8, 0.1, 512) * 1024 * 1024;

  const files = [];
  let bytes = 0;
  const stack = [{ rel: '', depth: 0 }];
  while (stack.length) {
    const task = stack.pop();
    const absDir = task.rel ? join(root, task.rel) : root;
    let entries;
    try {
      entries = readdirSync(absDir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const childRel = task.rel ? `${task.rel}/${ent.name}` : ent.name;
      const abs = join(absDir, ent.name);
      let st;
      try {
        st = lstatSync(abs);
      } catch {
        continue;
      }
      if (st.isSymbolicLink()) continue;
      if (st.isDirectory()) {
        if (excluded.has(ent.name.toLowerCase())) continue;
        if (task.depth + 1 < MAX_DEPTH) stack.push({ rel: childRel, depth: task.depth + 1 });
        continue;
      }
      if (!st.isFile()) continue;
      if (!exts.has(extname(ent.name).toLowerCase())) continue;
      if (st.size > maxBytesPerFile) continue;
      if (files.length >= maxFiles) break;
      files.push({ rel: childRel, abs, size: st.size, mtimeMs: st.mtimeMs });
      bytes += st.size;
    }
  }
  // 新的文件优先：同分命中时给近期的记录一点优先。
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { root, files, bytes, scannedAt: Date.now() };
}

/** 读一个文件并缓存成行 + 小写行（搜索时只比小写）。 */
export function loadDoc(file) {
  const text = readFileSync(file.abs, 'utf8');
  const lines = text.split(/\r?\n/);
  return { lines, lower: lines.map((l) => l.toLowerCase()), size: file.size, mtimeMs: file.mtimeMs };
}

function countOccurrences(haystack, needle) {
  if (!needle) return 0;
  let count = 0;
  let at = 0;
  for (;;) {
    const i = haystack.indexOf(needle, at);
    if (i < 0) break;
    count += 1;
    if (count >= 20) break;
    at = i + needle.length;
  }
  return count;
}

/**
 * 查询分词：中文取双字词（单字查询保留单字），英文/数字按词；再加整段中文（≤8 字）做短语加权。
 * 这是词面检索，不是语义检索；查不到时让模型换更短的关键词。
 */
export function tokenize(query) {
  const text = String(query ?? '').toLowerCase().trim();
  if (!text) return [];
  const tokens = new Set();
  for (const part of text.split(/[^\p{L}\p{N}_]+/u)) {
    if (!part) continue;
    if (HAN.test(part)) {
      const chars = [...part];
      if (chars.length === 1) {
        tokens.add(chars[0]);
      } else {
        for (let i = 0; i + 1 < chars.length; i += 1) tokens.add(chars[i] + chars[i + 1]);
        if (chars.length <= 8) tokens.add(part);
      }
    } else if (part.length >= 2) {
      tokens.add(part);
    }
  }
  return [...tokens];
}

function snippet(lines, hitIndex, context) {
  const from = Math.max(0, hitIndex - context);
  const to = Math.min(lines.length - 1, hitIndex + context);
  const items = [];
  for (let i = from; i <= to; i += 1) items.push({ no: i + 1, text: lines[i], hit: i === hitIndex });
  return { from: from + 1, to: to + 1, items };
}

/**
 * 行质量系数：日记里除了人话，还有大量「[调用] write_file {…}」这种工具日志和 JSON 转义串。
 * 同样命中时优先给人看的正文，避免把整段 JSON 塞进上下文。
 */
function lineQuality(text) {
  const t = String(text).trim();
  if (!t) return 0.2;
  if (/^\[(调用|回执|工具|事件|状态|系统)\]/.test(t)) return 0.3;
  let q = 1;
  const jsonish = (t.match(/[{}"[\]]/g) ?? []).length / Math.max(20, t.length);
  if (jsonish > 0.06) q *= 0.45;
  if (t.includes('\\n')) q *= 0.5;
  if (t.length > 600) q *= 0.7;
  if ((t.match(/[。！？；，、]/g) ?? []).length >= 2) q *= 1.15;
  return Math.max(0.15, Math.min(1.3, q));
}

/**
 * 在已建好的索引上找命中行。每个文件最多保留 perFile 条，输出 limit 条。
 * 返回 { hits, total }；total 是命中行总数（未截断）。
 */
export function findHits(index, docs, tokens, opts = {}) {
  const limit = clampInt(opts.limit, 8, 1, 50);
  const perFile = clampInt(opts.perFile, 2, 1, 10);
  const context = clampInt(opts.snippetLines, 2, 0, 10);
  const prefix = String(opts.pathPrefix ?? '').trim().toLowerCase();
  const lowerTokens = tokens.map((t) => String(t).toLowerCase()).filter(Boolean);
  if (!lowerTokens.length) return { hits: [], total: 0 };

  const hits = [];
  for (const file of index.files) {
    if (prefix && !file.rel.toLowerCase().startsWith(prefix)) continue;
    const doc = docs.get(file.abs);
    if (!doc) continue;
    const relLower = file.rel.toLowerCase();
    let fileBonus = 0;
    for (const token of lowerTokens) if (relLower.includes(token)) fileBonus += 4;

    for (let i = 0; i < doc.lines.length; i += 1) {
      const line = doc.lower[i];
      let occurrences = 0;
      let matched = 0;
      const matchedTokens = [];
      for (const token of lowerTokens) {
        const n = countOccurrences(line, token);
        if (!n) continue;
        occurrences += n;
        matched += 1;
        matchedTokens.push(token);
      }
      if (!matched) continue;
      const text = doc.lines[i];
      const quality = lineQuality(text);
      hits.push({
        rel: file.rel,
        mtimeMs: file.mtimeMs,
        line: i + 1,
        text,
        quality,
        score: (matched * 2 + Math.min(occurrences, 10) + fileBonus) * quality,
        matched: matchedTokens,
        snippet: snippet(doc.lines, i, context),
      });
    }
  }

  hits.sort(
    (a, b) => b.score - a.score || b.mtimeMs - a.mtimeMs || a.rel.localeCompare(b.rel) || a.line - b.line,
  );

  const picked = [];
  const per = new Map();
  const seen = new Set();
  for (const hit of hits) {
    // 同一句话常被复制进多篇交接：内容一样就只留最靠前的一条，避免刷屏。
    const dedupeKey = hit.text.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (dedupeKey.length >= 8 && seen.has(dedupeKey)) continue;
    const used = per.get(hit.rel) ?? 0;
    if (used >= perFile) continue;
    seen.add(dedupeKey);
    per.set(hit.rel, used + 1);
    picked.push(hit);
    if (picked.length >= limit) break;
  }
  return { hits: picked, total: hits.length };
}

/** 只读一小段原文；路径必须在 root 内，最多 maxLines 行。 */
export function readSlice(root, relPath, startLine, endLine, maxLines = 200) {
  const rel = String(relPath ?? '').trim();
  if (!rel) return { error: 'path 不能为空；用 recall_search 结果里给出的相对路径。' };
  const abs = resolve(root, rel);
  if (!isInside(root, abs)) return { error: '路径超出检索目录，已拒绝。' };
  let st;
  try {
    st = statSync(abs);
  } catch {
    return { error: `文件不存在：${rel}` };
  }
  if (!st.isFile()) return { error: `不是普通文件：${rel}` };
  const lines = readFileSync(abs, 'utf8').split(/\r?\n/);
  const start = clampInt(startLine, 1, 1, Math.max(1, lines.length));
  const wantedEnd = clampInt(endLine, start + 39, start, lines.length);
  const end = Math.min(wantedEnd, start + clampInt(maxLines, 200, 1, 2000) - 1, lines.length);
  return {
    rel: rel.replace(/\\/g, '/'),
    total: lines.length,
    start,
    end,
    lines: lines.slice(start - 1, end),
  };
}
