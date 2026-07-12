# 日迹 · 手机息屏推送（Web Push）部署指南

本 App 是纯前端 PWA，数据存在你浏览器里。**息屏/切后台后还想收到提醒**，必须由一台常驻的服务器在正确时刻向手机发推送——这就是下面的 Cloudflare Worker。

> 隐私说明：后端只存「提醒的时间+标题」和推送订阅信息，**不含任何记账金额、日记内容**。部署者是你自己，数据可控。

---

## 一、准备（约 10 分钟，免费）

1. 注册 Cloudflare 账号（免费）：https://dash.cloudflare.com/sign-up
2. 安装 Node 与 Wrangler（Cloudflare 官方部署工具）：
   ```bash
   npm install -g wrangler
   wrangler login        # 浏览器里授权
   ```
3. 生成 VAPID 密钥对（推送服务的身份标识）：
   ```bash
   npx web-push generate-vapid-keys
   ```
   记下输出的 **Public Key** 和 **Private Key**。

---

## 二、部署 Worker

在 `push-worker/` 目录操作：

1. 建一个 KV 命名空间（用来存订阅和提醒）：
   ```bash
   cd push-worker
   wrangler kv namespace create PUSH_KV
   ```
   终端会返回一段 JSON，里面有 `"id": "xxxx"`。把这段 id 填进 `wrangler.toml` 的 `id = "YOUR_KV_NAMESPACE_ID"`。

2. 把 VAPID 密钥设为保密变量（比写在文件里安全）：
   ```bash
   wrangler secret put VAPID_PUBLIC   # 粘贴刚才的 Public Key
   wrangler secret put VAPID_PRIVATE  # 粘贴 Private Key
   ```
   （`wrangler.toml` 里那两行占位 `REPLACE_WITH_...` 可删掉，secret 优先级更高。）

3. 部署：
   ```bash
   wrangler deploy
   ```
   成功后终端会给出你的 Worker 地址，形如：
   `https://rikou-push.<你的子域>.workers.dev`

   **这个地址就是「推送服务地址」**，复制备用。

---

## 三、开启 GitHub Actions 定时触发

Worker 自己不会主动跑，需要每分钟被叫一次去扫描并推送。Cloudflare 自带 Cron 触发器要付费，我们用 GitHub Actions 免费替代：

1. 在本仓库 **Settings → Secrets and variables → Actions → New repository secret**，新增：
   - 名称：`PUSH_WORKER_URL`
   - 值：上面拿到的 Worker 地址（如 `https://rikou-push.xxx.workers.dev`）
2. 仓库里已包含 `.github/workflows/push-cron.yml`（每分钟 curl 一次 `/api/cron`）。
3. 到 **Actions** 页，启用 `push-cron` 工作流（首次需在 Actions 标签里点 "I understand..." 启用）。
4. 可手动 **Run workflow** 测一次，看是否返回 `{"ok":true,...}`。

---

## 四、在手机/电脑上开启推送

1. 打开日迹（建议用 **https 地址**，本地 `127.0.0.1` 或 GitHub Pages 都行）。
2. 进 **设置 → 🔔 推送通知**：
   - 「推送服务地址」填第三步的 Worker 地址
   - 「VAPID 公钥」填第一步生成的 **Public Key**
   - 点 **保存配置**
3. 点 **开启推送** → 浏览器请求通知权限 → 允许。
4. 之后你新增/修改「提醒」或带提醒的「待办」，数据会自动同步到 Worker；到点就会收到系统推送（包括锁屏）。

### 手机特别注意
- **iOS**：需 **iOS 16.4 以上**，且把日迹 **「添加到主屏幕」**（Safari 分享 → 添加到主屏幕），从主屏图标打开后才能收推送。
- **Android**：用 Chrome 把日迹「安装/添加到主屏幕」，从图标打开即可。
- 未添加到主屏的纯网页，关闭后和普通网页一样收不到系统推送（这是平台限制，非 Bug）。

---

## 五、排查

| 现象 | 原因 / 处理 |
|---|---|
| 「开启推送」点完报错 | 地址或公钥填错；或 Worker 未部署/未部署成功（先访问 `Worker地址/api/health` 看是否返回 ok） |
| 收不到推送 | ①没添加到主屏且关了页面 ②iOS<16.4 ③未授权通知权限 ④Actions 工作流没启用 ⑤KV id 没填对 |
| 推送重复/不响 | Worker 每分钟扫一次，已用 `lastFired/lastReminded` 去重，同一天只响一次 |
| 想换设备 | 旧设备取消订阅即可（清除数据或换浏览器）；新设备重新「开启推送」 |

---

## 架构一览

```
手机/电脑日迹  --(保存提醒时)-->  Worker /api/sync  --> KV 存储
GitHub Actions (每分钟) --ping-->  Worker /api/cron
                                       │ 扫描到点项
                                       ▼
                                 Push Service  -->  手机系统通知
```
