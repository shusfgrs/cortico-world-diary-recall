/** 从 src/tools.js 生成 describe.json（市场详情页与 check:extension 都读这个文件）。 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_DECLS } from '../src/tools.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const describe = {
  tools: TOOL_DECLS.map(({ summary, ...decl }) => ({ ...decl, summary })),
  events: [],
};
writeFileSync(join(root, 'describe.json'), `${JSON.stringify(describe, null, 2)}\n`, 'utf8');
console.log(`describe.json 已更新：${describe.tools.map((t) => t.name).join(', ')}`);
