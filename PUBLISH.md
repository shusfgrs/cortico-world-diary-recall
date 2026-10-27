# 发布清单（首次发布 0.1.0）

> 这份文件只给仓库用，不会发布到 npm（`files` 白名单里没有它）。

## 0. 前置

- npm 账号：还没有就去 <https://www.npmjs.com/signup> 注册并**验证邮箱**；建议顺手开 2FA（`npm publish` 会要一次性验证码）。
- Git / GitHub 账号（可选但推荐，用于源码仓库和让市场收录）。

## 1. 登录并发布 npm 包

在源码目录打开终端（PowerShell 或 cmd）：

```powershell
cd "D:\DeepSeek Harness Plug\Plugins\cortico-world-diary-recall"
npm login
npm publish
npm view cortico-world-diary-recall version   # 能看到 0.1.0 就算上架
```

也可以**双击本目录的 `publish.cmd`**：它会依次执行 `npm login` 和 `npm publish`，结束后停在窗口里，方便看报错。

发布前确认：

- 包名 `cortico-world-diary-recall` 在 npm 上没被占（当前可用）；
- `package.json` 的 `author` / `repository` 已填（现在是「飓风号 <2679689679@qq.com>」和 `shusfgrs` 的 GitHub 地址）；
- 版本号是 `0.1.0`，`CHANGELOG.md` 顶部有 `## 0.1.0` 段。

## 2. 让扩展市场立刻收录

市场按 npm 上的 `cortico-world` 关键字抓包；定时任务可能延迟。要立刻收录就去官方索引仓开一个 issue：

```bash
gh issue create -R Pal-AI-Lab/cortico-extensions --title "[sync] cortico-world-diary-recall" --body ""
```

不装 `gh` 也行：浏览器打开 <https://github.com/Pal-AI-Lab/cortico-extensions/issues/new/choose>，选 **sync** 表单，标题 `[sync] cortico-world-diary-recall`，正文留空提交。Action 会同步并回复该包当前标签。

## 3. 建源码仓库（推荐）

GitHub 新建 public 仓库 `cortico-world-diary-recall`（账号 `shusfgrs`），然后：

```powershell
cd "D:\DeepSeek Harness Plug\Plugins\cortico-world-diary-recall"
git init
git add .
git commit -m "feat: initial release 0.1.0"
git branch -M main
git remote add origin https://github.com/shusfgrs/cortico-world-diary-recall.git
git push -u origin main
```

## 4. 以后发新版本

1. 改代码、跑 `node --test`；
2. `package.json` 版本 +0.0.1；
3. `CHANGELOG.md` 顶部加 `## x.y.z` 段；
4. `npm publish`；
5. 市场没及时更新就再开一个 `[sync]` issue。

## 5. 可选：认证 / 标签

- 想申请官方认证：索引仓开 `[certify] cortico-world-diary-recall` issue（要求见索引仓 `DESIGN.md#扩展申请`）。
- 想加/改标签：先改 `package.json` 的 `cortico.tags` 再发版；想去掉维护者加的标签就开 `[tags]` issue。
- 已声明 `memory`、`local`；如果社区认为读私人记忆应打 `sensitive-data` 警示，可以自己加（注意这个警示标签会粘住，之后要开 issue 才能去掉）。
