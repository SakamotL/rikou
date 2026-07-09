# 日课 · 个人生活中枢

完全本地、无服务器的个人生活管理 PWA：把时间感知（今天）、财务（账）、记录（笔记）、设置收进一个应用。所有数据只存在你自己的浏览器（localStorage），不上传任何服务器。

## 功能

- **今天**：下一个任务 / 临近提醒 / 速记账 / 临期待办 / 今日日课
- **账**：资产 · 负债 · 净资产（富爸爸视角）+ 钱迹式记账；支出/收入流水；周/月/年维度；概览 / 日历（含阴历）/ 统计（环形图+排行）/ 资产 四个子视图；手机端四个子视图可左右滑动切换
- **笔记**：日记 / 旅游 / 菜谱 / 随手记 / 媒体 / 待办 / 提醒，可搜索筛选
- **设置**：外观、桌面通知、数据导出/导入备份、导出日记到 Obsidian

## 本地运行

直接双击 `index.html` 即可用；或起一个静态服务：

```bash
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

## 线上地址（已部署）

**https://sakamotl.github.io/rikou/**

可"添加到主屏幕"当 App 用（PWA）。

## 部署（GitHub Pages）

1. 把本仓库推到 GitHub（`master` 分支）
2. 仓库 Settings → Pages → Source 选 `master` 分支 `/ (root)`
3. 访问 `https://<你的用户名>.github.io/<仓库名>/`

> 已加 `.nojekyll`，不会被 Jekyll 处理。
> 已注册 Service Worker，可"添加到主屏幕"离线使用；改代码后 `git push` 即生效（fetch 走网络优先，不用清缓存）。
> 仓库根目录已含一键脚本 `deploy.sh`（需 `gh` 登录或 `GITHUB_TOKEN` 环境变量）。

## 文件

| 文件 | 作用 |
|---|---|
| `index.html` | 外壳：顶栏 / 视图 / 底部 tab / 弹层 / 确认框 / toast |
| `app.js` | 全部逻辑：数据层 / 工具(含自包含农历) / 视图 / 动作查表 ACTIONS |
| `styles.css` | 视觉样式（浅/深色 + 钱迹风蓝） |
| `sw.js` | Service Worker（离线缓存） |
| `manifest.webmanifest` / `icon.svg` | PWA 元信息 |
