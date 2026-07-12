// 日迹 Web Push 后端 —— Cloudflare Worker
// 职责：接收前端上报的订阅与提醒数据，按用户本地时间每分钟扫描并推送
// 注意：纯前端无法做息屏推送，必须由本 Worker 在正确时刻向 Push Service 发消息
import webpush from 'web-push';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      webpush.setVapidDetails('mailto:rikou-push@example.com', env.VAPID_PUBLIC, env.VAPID_PRIVATE);
    } catch (e) { /* 首次可能缺密钥，cron 时才真正需要 */ }

    if (request.method === 'POST' && path === '/api/sub') {
      const b = await request.json().catch(() => ({}));
      if (!b.clientId || !b.subscription) return json({ error: 'missing clientId/subscription' }, 400);
      const cur = await read(env, b.clientId);
      cur.subscription = b.subscription;
      if (!cur.reminders) cur.reminders = [];
      if (!cur.todos) cur.todos = [];
      await write(env, b.clientId, cur);
      return json({ ok: true });
    }

    if (request.method === 'POST' && path === '/api/sync') {
      const b = await request.json().catch(() => ({}));
      if (!b.clientId || !b.subscription) return json({ error: 'missing clientId/subscription' }, 400);
      const cur = await read(env, b.clientId);
      cur.subscription = b.subscription;
      cur.tz = b.tz || 0;
      cur.reminders = b.reminders || [];
      cur.todos = b.todos || [];
      cur.updatedAt = Date.now();
      await write(env, b.clientId, cur);
      return json({ ok: true });
    }

    if (path === '/api/cron') {
      return handleCron(env);
    }

    if (path === '/api/health') return json({ ok: true, t: Date.now() });
    return json({ ok: true, msg: 'rikou push worker' });
  }
};

async function handleCron(env) {
  const { keys } = await env.PUSH_KV.list();
  let pushed = 0, dropped = 0;
  for (const k of keys) {
    const raw = await env.PUSH_KV.get(k.name);
    if (!raw) continue;
    let rec; try { rec = JSON.parse(raw); } catch (e) { continue; }
    if (!rec.subscription) continue;
    const tz = rec.tz || 0;
    const localNow = new Date(Date.now() + tz * 60000);
    const todayLocal = ymd(localNow);
    const nowHM = hhmm(localNow);
    let changed = false;

    for (const r of (rec.reminders || [])) {
      if (!r.todayMatch) continue;
      if (nowHM >= r.time && r.lastFired !== todayLocal) {
        const ok = await send(env, rec.subscription, { title: '⏰ ' + r.name, body: r.note || '该做这件事啦', tag: 'rem-' + r.id, url: '/' });
        if (ok) { r.lastFired = todayLocal; changed = true; pushed++; }
        else dropped++;
      }
    }
    for (const t of (rec.todos || [])) {
      const due = !t.due || t.due <= todayLocal;
      const recur = t.repeat && t.repeat !== 'none';
      const fire = due && (recur ? t.lastReminded !== todayLocal : (!t.due || (t.due === todayLocal && t.lastReminded !== todayLocal)));
      if (fire) {
        const ok = await send(env, rec.subscription, { title: '✅ 待办', body: t.title + (recur ? '（' + t.repeat + '）' : ''), tag: 'todo-' + t.id, url: '/' });
        if (ok) { t.lastReminded = todayLocal; changed = true; pushed++; }
        else dropped++;
      }
    }
    if (changed) await write(env, k.name.replace('sub:', ''), rec);
  }
  return json({ ok: true, pushed, dropped });
}

async function send(env, sub, payload) {
  try {
    await webpush.sendNotification(sub, JSON.stringify(payload), { TTL: 60 });
    return true;
  } catch (e) {
    // 410/404 = 订阅已失效，应删除；这里仅在 cron 计数，删除由调用方按需处理
    return false;
  }
}

async function read(env, clientId) {
  const raw = await env.PUSH_KV.get('sub:' + clientId);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (e) { return {}; }
}
async function write(env, clientId, obj) {
  obj.updatedAt = obj.updatedAt || Date.now();
  await env.PUSH_KV.put('sub:' + clientId, JSON.stringify(obj));
}

function json(o, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
}
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
