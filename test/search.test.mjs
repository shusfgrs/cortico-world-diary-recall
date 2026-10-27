import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { buildIndex, findHits, isInside, loadDoc, readSlice, resolveRoot, tokenize } from '../src/search.js';

const root = mkdtempSync(join(tmpdir(), 'diary-recall-'));
mkdirSync(join(root, 'handoffs'));
writeFileSync(
  join(root, 'handoffs', '2026-10-25T03-04-22Z.md'),
  ['# 交接', '今天和主人聊了大肥鱼的语音条。', '主人说语音听起来不错，就是有点小声。', '另外约了周五晚上一起看电影。'].join('\n'),
  'utf8',
);
writeFileSync(join(root, 'MEMORY.md'), '主人喜欢薄荷味的茶。\nTea is preferred at 3pm.\n', 'utf8');
writeFileSync(join(root, 'ignore.bin'), 'binary', 'utf8');

after(() => rmSync(root, { recursive: true, force: true }));

describe('tokenize', () => {
  it('中文取双字词并保留整段短词', () => {
    const tokens = tokenize('大肥鱼语音');
    assert.ok(tokens.includes('大肥'));
    assert.ok(tokens.includes('肥鱼'));
    assert.ok(tokens.includes('鱼语'));
    assert.ok(tokens.includes('语音'));
    assert.ok(tokens.includes('大肥鱼语音'));
  });

  it('英文按单词，忽略单字符', () => {
    const tokens = tokenize('Tea time a');
    assert.deepEqual(tokens.sort(), ['tea', 'time']);
  });
});

describe('buildIndex', () => {
  it('只收配置的扩展名，路径用 /', () => {
    const index = buildIndex(root, { fileExts: 'md,txt,jsonl' });
    const rels = index.files.map((f) => f.rel).sort();
    assert.deepEqual(rels, ['MEMORY.md', 'handoffs/2026-10-25T03-04-22Z.md']);
    assert.ok(index.bytes > 0);
  });
});

describe('findHits', () => {
  it('按中文双字词找到命中行，带片段与行号', () => {
    const index = buildIndex(root, {});
    const docs = new Map(index.files.map((f) => [f.abs, loadDoc(f)]));
    const { hits, total } = findHits(index, docs, tokenize('语音'), { limit: 5, snippetLines: 1 });
    assert.ok(total >= 1);
    const hit = hits.find((h) => h.rel.includes('handoffs'));
    assert.ok(hit, 'handoffs 里应该命中「语音」');
    assert.ok(hit.matched.includes('语音'));
    assert.ok(hit.snippet.items.some((item) => item.hit && item.text.includes('语音')));
  });

  it('英文命中', () => {
    const index = buildIndex(root, {});
    const docs = new Map(index.files.map((f) => [f.abs, loadDoc(f)]));
    const { hits } = findHits(index, docs, tokenize('tea'), { limit: 5 });
    assert.ok(hits.some((h) => h.rel === 'MEMORY.md'));
  });

  it('path 前缀过滤', () => {
    const index = buildIndex(root, {});
    const docs = new Map(index.files.map((f) => [f.abs, loadDoc(f)]));
    const { hits } = findHits(index, docs, tokenize('主人'), { limit: 10, pathPrefix: 'handoffs/' });
    assert.ok(hits.every((h) => h.rel.startsWith('handoffs/')));
  });

  it('每文件最多 2 条，按分数排序', () => {
    writeFileSync(join(root, 'many.md'), Array.from({ length: 8 }, (_, i) => `重复词 第${i}行`).join('\n'), 'utf8');
    const index = buildIndex(root, {});
    const docs = new Map(index.files.map((f) => [f.abs, loadDoc(f)]));
    const { hits } = findHits(index, docs, tokenize('重复词'), { limit: 10, perFile: 2 });
    assert.ok(hits.filter((h) => h.rel === 'many.md').length <= 2);
    assert.ok(hits.every((h, i) => i === 0 || hits[i - 1].score >= h.score));
    rmSync(join(root, 'many.md'));
  });
});

describe('readSlice', () => {
  it('读指定范围并带行号信息', () => {
    const slice = readSlice(root, 'handoffs/2026-10-25T03-04-22Z.md', 2, 3, 100);
    assert.equal(slice.start, 2);
    assert.equal(slice.end, 3);
    assert.equal(slice.lines.length, 2);
    assert.ok(slice.lines[0].includes('语音'));
  });

  it('路径穿越被拒', () => {
    const outside = readSlice(root, '../outside.md', 1, 5, 100);
    assert.ok(outside.error);
    assert.ok(!isInside(root, join(root, '..', 'outside.md')));
  });

  it('不存在的文件返回错误而不是抛错', () => {
    const slice = readSlice(root, 'nope/missing.md', 1, 5, 100);
    assert.ok(slice.error);
  });
});

describe('resolveRoot', () => {
  it('相对路径基于 botDir', () => {
    assert.equal(resolveRoot('workspace', 'D:\\bot'), 'D:\\bot\\workspace'.replace(/\//g, '\\'));
  });

  it('空值返回 null', () => {
    assert.equal(resolveRoot('  ', 'D:\\bot'), null);
  });
});
