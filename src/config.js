/** 记忆回查的配置默认值与控制台配置组（纯对象，无需宿主类型）。 */

export const DEFAULTS = {
  // World 激活开关由框架管；这里只放业务配置。
  enabled: false,
  /** 要检索的资料目录：相对 bot 目录，或绝对路径。空=未配置（工具会提示去哪填）。 */
  sourceDir: '',
  /** 只扫这些扩展名（逗号分隔，大小写不敏感）。 */
  fileExts: 'md,txt,jsonl',
  /** 跳过的目录名（任意层级，逗号分隔）。 */
  excludeDirs: 'node_modules,.git,blobs,.obsidian,.vscode',
  /** 最多索引多少个文件（护栏，防把整个盘拖进来）。 */
  maxFiles: 2000,
  /** 单文件超过这个大小就跳过（MB）。 */
  maxFileMB: 8,
  /** recall_search 默认返回几条命中。 */
  maxResults: 8,
  /** 每条命中给命中行前后各几行做上下文。 */
  snippetLines: 2,
  /** recall_read 一次最多读多少行。 */
  maxReadLines: 200,
  /** 索引缓存多久重新扫一次（秒）。 */
  refreshSeconds: 120,
};

export const CONFIG_GROUP = {
  id: 'world:diary-recall',
  owner: 'world:diary-recall',
  schema: {
    type: 'object',
    title: '记忆回查',
    description:
      '在指定的资料目录（通常是 bot 的 workspace：handoffs/、partner/ 日志等）里做本地只读关键词检索。' +
      '所有配置热生效，改完下一次工具调用就按新值走。',
    properties: {
      'worlds.diary-recall.sourceDir': {
        type: 'string',
        title: '检索目录',
        description: '相对 bot 目录（如 workspace、workspace/handoffs），也可以填绝对路径。留空时工具会提示先配置。',
        'x-hot': true,
      },
      'worlds.diary-recall.fileExts': {
        type: 'string',
        title: '文件类型',
        description: '只索引这些扩展名，逗号分隔。默认 md,txt,jsonl。',
        'x-hot': true,
      },
      'worlds.diary-recall.excludeDirs': {
        type: 'string',
        title: '跳过目录',
        description: '任意层级里出现这些目录名就跳过，逗号分隔。默认 node_modules,.git,blobs,.obsidian,.vscode。',
        'x-hot': true,
      },
      'worlds.diary-recall.maxFiles': {
        type: 'integer',
        title: '文件数上限',
        description: '最多索引多少个文件，默认 2000。',
        minimum: 1,
        maximum: 50000,
        'x-hot': true,
      },
      'worlds.diary-recall.maxFileMB': {
        type: 'number',
        title: '单文件大小上限(MB)',
        description: '超过这个大小的文件直接跳过，默认 8。',
        minimum: 0.1,
        maximum: 512,
        'x-hot': true,
      },
      'worlds.diary-recall.maxResults': {
        type: 'integer',
        title: '默认命中条数',
        description: 'recall_search 不传 limit 时返回几条，默认 8（1–20）。',
        minimum: 1,
        maximum: 20,
        'x-hot': true,
      },
      'worlds.diary-recall.snippetLines': {
        type: 'integer',
        title: '上下文行数',
        description: '每条命中给命中行前后各几行，默认 2（0–10）。',
        minimum: 0,
        maximum: 10,
        'x-hot': true,
      },
      'worlds.diary-recall.maxReadLines': {
        type: 'integer',
        title: '单次读取行数上限',
        description: 'recall_read 一次最多读多少行，默认 200。',
        minimum: 1,
        maximum: 2000,
        'x-hot': true,
      },
      'worlds.diary-recall.refreshSeconds': {
        type: 'integer',
        title: '索引刷新间隔(秒)',
        description: '资料目录变化后最多这么久重建一次索引，默认 120；recall_stats 可以手动刷新。',
        minimum: 5,
        maximum: 86400,
        'x-hot': true,
      },
    },
  },
};
