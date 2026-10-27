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

也可以**双击本目录的 `publish-window.cmd`**：它会单独开一个常驻窗口跑 `npm login` + `npm publish`，出错也不会闪退；结果和完整日志在窗口里，同时写进 `publish.log`。直接双击 `publish.cmd` 也行（失败会打印日志并停住）。

发布前确认：

- 包名 `cortico-world-diary-recall` 在 npm 上没被占（当前可用）；
- `package.json` 的 `author` / `repository` 已填（现在是「飓风号 <2679689679@qq.com>」和 `shusfgrs` 的 GitHub 地址）；
- 版本号是 `0.1.0`，`CHANGELOG.md` 顶部有 `## 0.1.0` 段。

### 浏览器打不开 / `npm login` 卡住时

**办法 A：手动打开登录链接（最常用）**——`npm login` 会在终端/`publish.log` 里打印形如
`https://www.npmjs.com/login?next=/login/cli/<uuid>` 的链接（一次有效、几分钟过期）。**把这段链接复制到浏览器**打开，用刚注册的账号登录/授权；窗口里会自动跳出 `Logged in as ...` 并继续发布。链接过期就重新跑一次脚本拿新链接。

如果连链接都没有，试 `npm login --auth-type=legacy`（用户名 + 密码 + 2FA 验证码）。

> 注意：npm 正在收紧「绕过 2FA 的 token 用于直接发布」，如果你的账号开了 2FA，优先用上面的网页登录方式；下面的 token 方式作为备选。

**办法 B：用 Access Token（推荐，完全绕开浏览器交互）**

1. 浏览器打开 <https://www.npmjs.com/> → 右上角头像 → **Access Tokens** → **Generate New Token**；
2. 选 **Classic Token → Automation**（自动化 token，发布时不问 OTP）；
   如果只能建 Granular Token，就选 **All packages** + **Read and write**；
3. 生成后复制 token（只显示一次）；
4. 在本目录新建 `.npmrc`（可以直接复制 `npmrc.example` 改名），写入一行：
   ```
   //registry.npmjs.org/:_authToken=你的token
   ```
5. 双击 **`publish-token.cmd`**（只跑 `npm publish`，不用登录）；
6. 发布完可以把 token 在 npm 设置里撤销；`.npmrc` 已写进 `.gitignore`，不会被提交。

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
