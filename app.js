/* ============================================================
   日课 · 个人生活中枢  (完全本地 / 无服务器 / 数据存浏览器)
   四表层：今天(时间感知仪表盘) · 账(财务中枢) · 记(记录库) · 我的(设置)
   - 今天：常驻「下一个任务」，仅显示 2 小时内临近提醒；待办逾期加深颜色。
   - 账：资产 / 负债 / 净资产 + 占比（富爸爸视角）；钱迹记账；价格目录。
   - 记：日记/旅游/菜谱/随手记/媒体/待办/提醒 可搜索筛选。
   ============================================================ */

const STORE_KEY = 'rikou_v2';
const CATS = {
  out: [['餐饮', '🍜'], ['交通', '🚌'], ['购物', '🛍️'], ['居住', '🏠'], ['娱乐', '🎮'], ['医疗', '💊'], ['学习', '📚'], ['人情', '🎁'], ['其他', '📦']],
  in: [['工资', '💰'], ['副业', '💡'], ['理财', '📈'], ['红包', '🧧'], ['其他', '📦']]
};
const REPEAT_LABEL = { daily: '每天', weekday: '工作日', weekend: '周末', custom: '自定义', none: '不重复', monthly: '每月', weekly: '每周' };
const NOTE_TYPES = [
  { id: 'diary', name: '日记', icon: '📔' },
  { id: 'travel', name: '旅游日记', icon: '🧳' },
  { id: 'recipe', name: '菜谱', icon: '🍲' },
  { id: 'note', name: '随手记', icon: '📝' }
];
const NOTE_TYPE_IDS = NOTE_TYPES.map(t => t.id);
const MEDIA_KINDS = { book: { name: '书', icon: '📚' }, movie: { name: '电影', icon: '🎬' }, tv: { name: '剧', icon: '📺' } };
const CONTENT_TYPES = [
  { id: 'diary', name: '日记', icon: '📔' },
  { id: 'travel', name: '旅游', icon: '🧳' },
  { id: 'recipe', name: '菜谱', icon: '🍲' },
  { id: 'note', name: '随手记', icon: '📝' },
  { id: 'media', name: '媒体', icon: '🎬' },
  { id: 'todo', name: '待办', icon: '✅' },
  { id: 'reminder', name: '提醒', icon: '⏰' }
];
const CHANNELS = ['天猫', '淘宝', '京东', '拼多多', '抖音', '美团', '唯品会', '线下', '其他'];

/* ---------- 数据层 ---------- */
function defaults() {
  return {
    reminders: [
      { id: uid(), name: '晨跑', time: '07:00', repeat: 'daily', days: [], note: '换上跑鞋，出门 20 分钟', enabled: true, lastFired: '' },
      { id: uid(), name: '午饭', time: '12:00', repeat: 'daily', days: [], note: '别点外卖，好好吃饭', enabled: true, lastFired: '' }
    ],
    habits: [{ id: uid(), name: '长期主义', emoji: '🌱', note: '每天为未来做一件小事', records: {} }],
    notes: [],
    prices: [],
    todos: [],
    media: [],
    accounts: [
      { id: uid(), name: '微信', icon: '💚', balance: 0, kind: 'asset' },
      { id: uid(), name: '支付宝', icon: '🔵', balance: 0, kind: 'asset' },
      { id: uid(), name: '现金', icon: '💵', balance: 0, kind: 'asset' },
      { id: uid(), name: '银行卡', icon: '🏦', balance: 0, kind: 'asset' }
    ],
    ledger: [],
    netHistory: [],
    settings: { notif: false, budget: 0, theme: 'light', moneySub: 'overview', moneyRange: 'month', moneyAnchor: todayStr(), lastLed: { out: { cat: '', acct: '' }, in: { cat: '', acct: '' } } }
  };
}
let state = load();
if (state.netHistory && !state.netHistory.length) recordNet();

function load() {
  let raw = null, oldKey = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) {}
  if (!raw) {
    for (const k of ['rikou_v1', 'rikou']) {
      try { const o = localStorage.getItem(k); if (o) { raw = o; oldKey = k; break; } } catch (e) {}
    }
  }
  if (!raw) return defaults();
  try {
    const d = JSON.parse(raw);
    const base = defaults();
    const merged = Object.assign(base, d, { settings: Object.assign(base.settings, d.settings || {}) });
    if (merged.diary && Object.keys(merged.diary).length && (!merged.notes || !merged.notes.length)) {
      merged.notes = Object.keys(merged.diary).map(dd => { const e = merged.diary[dd]; return { id: uid(), type: 'diary', date: dd, title: e.title || '', body: e.body || '', mood: e.mood || '', updated: dd }; });
    }
    delete merged.diary;
    if (!Array.isArray(merged.prices)) merged.prices = [];
    if (!Array.isArray(merged.netHistory)) merged.netHistory = [];
    if (!Array.isArray(merged.accounts) || !merged.accounts.length) merged.accounts = base.accounts;
    merged.accounts.forEach(a => { if (!a.kind) a.kind = 'asset'; });
    merged.ledger.forEach(x => { if (!x.account && merged.accounts[0]) x.account = merged.accounts[0].id; });
    ['notes', 'todos', 'media', 'reminders', 'habits'].forEach(k => { if (!Array.isArray(merged[k])) merged[k] = []; });
    if (oldKey) { try { localStorage.setItem(STORE_KEY, JSON.stringify(merged)); localStorage.removeItem(oldKey); } catch (e) {} }
    return merged;
  } catch (e) { return defaults(); }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { toast('存储失败', '浏览器本地空间不可用'); } }

/* ---------- 工具 ---------- */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function todayStr(d) { d = d || new Date(); const z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
function curMin(hm) { const [h, m] = hm.split(':').map(Number); return h * 60 + m; }
function curMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function nowHM() { const z = n => String(n).padStart(2, '0'); const d = new Date(); return `${z(d.getHours())}:${z(d.getMinutes())}`; }
function addMin(hm, m) { const [h, min] = hm.split(':').map(Number); let t = h * 60 + min + m; return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; }
function fmtMoney(n) { const neg = n < 0; n = Math.abs(n); return (neg ? '-' : '') + '¥' + n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
/* ====== 农历（1900–2049，自包含，无依赖） ====== */
const LUNAR_INFO = [0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x055c0,0x0ab60,0x096d5,0x092e0,
0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
0x0a2e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a2d0,0x0d150,0x0f252,
0x0d520];
function lYearDays(y) { let s = 348; for (let i = 0x8000; i > 0x8; i >>= 1) s += (LUNAR_INFO[y - 1900] & i) ? 1 : 0; return s + leapDays(y); }
function leapDays(y) { return leapMonth(y) ? ((LUNAR_INFO[y - 1900] & 0x10000) ? 30 : 29) : 0; }
function leapMonth(y) { return LUNAR_INFO[y - 1900] & 0xf; }
function monthDays(y, m) { return (LUNAR_INFO[y - 1900] & (0x10000 >> m)) ? 30 : 29; }
function solar2lunar(y, m, d) {
  if (y < 1900 || y > 2100) return null;
  const base = Date.UTC(1900, 0, 31), obj = Date.UTC(y, m - 1, d);
  let offset = Math.round((obj - base) / 86400000), i, temp = 0;
  for (i = 1900; i < 2101 && offset > 0; i++) { temp = lYearDays(i); offset -= temp; }
  if (offset < 0) { offset += temp; i--; }
  const lYear = i; const leap = leapMonth(i); let isLeap = false, j = 1;
  for (; j < 13 && offset > 0; j++) {
    if (leap > 0 && j === leap + 1 && !isLeap) { j--; isLeap = true; temp = leapDays(lYear); }
    else temp = monthDays(lYear, j);
    if (isLeap && j === leap + 1) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && j === leap + 1) { if (isLeap) isLeap = false; else { isLeap = true; j--; } }
  if (offset < 0) { offset += temp; j--; }
  return { lYear, lMonth: j, lDay: offset + 1, isLeap };
}
const LUNAR_DAY = ['','初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
const LUNAR_MONTH = ['','正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
function lunarLabel(dateStr) {
  const p = dateStr.split('-'); if (p.length < 3) return '';
  const L = solar2lunar(+p[0], +p[1], +p[2]);
  if (!L) return '';
  return L.lDay === 1 ? (L.isLeap ? '闰' : '') + LUNAR_MONTH[L.lMonth] : (LUNAR_DAY[L.lDay] || '');
}
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function monthStr(d) { d = d || new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function emptyHTML(msg) { return `<div class="empty">${msg}</div>`; }
function shouldFireToday(r) {
  const dw = new Date().getDay();
  if (r.repeat === 'daily') return true;
  if (r.repeat === 'weekday') return dw >= 1 && dw <= 5;
  if (r.repeat === 'weekend') return dw === 0 || dw === 6;
  if (r.repeat === 'custom') return (r.days || []).includes(dw);
  return false;
}
function calcStreak(hb) {
  let n = 0; let d = new Date();
  while (hb.records[todayStr(d)]) { n++; d.setDate(d.getDate() - 1); }
  if (n === 0 && hb.records[todayStr(new Date(Date.now() - 864e5))]) {
    d.setDate(d.getDate() - 1);
    while (hb.records[todayStr(d)]) { n++; d.setDate(d.getDate() - 1); }
  }
  return n;
}
function acct(id) { return state.accounts.find(a => a.id === id); }
function netWorth() {
  const assets = state.accounts.filter(x => x.kind !== 'liability').reduce((s, x) => s + x.balance, 0);
  const liabs = state.accounts.filter(x => x.kind === 'liability').reduce((s, x) => s + x.balance, 0);
  return { assets, liabs, net: assets - liabs };
}
/* 穷爸爸视角：看本月现金流——钱进兜(收入) vs 钱出兜(支出)。
   用真实流水算，而不是账户余额，才匹配"钱进兜/钱出兜"的本意。 */
function richSplit() {
  const month = monthStr();
  const led = state.ledger.filter(x => x.date.startsWith(month));
  const inFlow = led.filter(x => x.type === 'in').reduce((s, x) => s + x.amount, 0);
  const outFlow = led.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
  return { inFlow, outFlow };
}
/* 记录净资产快照，用于资产曲线 */
function recordNet() {
  const net = netWorth().net, td = todayStr();
  const arr = state.netHistory;
  const last = arr[arr.length - 1];
  if (last && last.date === td) last.net = net;
  else arr.push({ date: td, net });
  if (arr.length > 365) arr.splice(0, arr.length - 365);
}

/* ---------- 时间感知：下一个任务 / 临近提醒 ---------- */
function nextTaskInfo() {
  const td = todayStr(); const now = curMinutes();
  let best = null;
  state.reminders.forEach(r => {
    if (!r.enabled || !shouldFireToday(r) || r.lastFired === td) return;
    const m = curMin(r.time);
    if (m >= now && (!best || m < best.eff)) best = { eff: m, label: '提醒 · ' + r.name, time: r.time, kind: 'rem' };
  });
  state.todos.forEach(t => {
    if (t.done) return;
    let eff;
    if (!t.due) eff = now + 1;
    else { const d = Math.round((Date.now() - new Date(t.due + 'T00:00').getTime()) / 864e5); eff = d > 0 ? -1 : d === 0 ? curMin('23:59') : now + 2; }
    if (!best || eff < best.eff) best = { eff, label: '待办 · ' + t.title, time: t.due || '', kind: 'todo' };
  });
  if (!best) return null;
  let when;
  if (best.eff < 0) when = '已逾期，尽快处理';
  else if (best.kind === 'rem') { const diff = best.eff - now; when = diff <= 0 ? '就是现在' : `还有 ${diff} 分钟`; }
  else when = best.time ? ('截止 ' + best.time) : '无截止时间';
  return { label: best.label, when };
}
function nearReminders() {
  const td = todayStr(); const now = curMinutes();
  return state.reminders
    .filter(r => r.enabled && shouldFireToday(r) && r.lastFired !== td)
    .map(r => ({ r, m: curMin(r.time) }))
    .filter(o => o.m >= now && o.m <= now + 120)
    .sort((a, b) => a.m - b.m).map(o => o.r);
}
function todoAge(t) {
  if (!t.due) return { cls: 'todo-future', badge: '', badgeCls: '' };
  const d = Math.round((Date.now() - new Date(t.due + 'T00:00').getTime()) / 864e5);
  if (d < 0) return { cls: 'todo-future', badge: t.due, badgeCls: '' };
  if (d === 0) return { cls: 'todo-today', badge: '今天到期', badgeCls: 'age-today' };
  if (d === 1) return { cls: 'todo-over1', badge: '逾期1天', badgeCls: 'age-over1' };
  return { cls: 'todo-overx', badge: '逾期' + d + '天', badgeCls: 'age-overx' };
}

/* ---------- 全局状态 ---------- */
let view = 'today';
let prevView = 'today';
let libType = 'all';
let libSearch = '';
let sheetCtx = null;
let ledType = 'out', ledCat = CATS.out[0][0], ledAcct = null, ledExpr = '0', ledChannel = '';
let ledFocus = null; // 'acct' | 'date' | 'channel' | null
let qType = 'out';
if (state.accounts[0]) ledAcct = state.accounts[0].id;
let mediaKind = 'book';

/* ---------- 视图路由 ---------- */
const viewEl = document.getElementById('view');
function navTo(v) {
  if (v !== 'me') prevView = v;
  view = v;
  document.querySelectorAll('.tab').forEach(t => {
    const isActive = t.dataset.view === v;
    t.classList.toggle('active', isActive);
    t.classList.toggle('center', isActive);
  });
  const meBtn = document.getElementById('meBtn');
  if (meBtn) meBtn.classList.toggle('active', v === 'me');
  render();
  window.scrollTo(0, 0);
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => navTo(t.dataset.view)));

/* 各栏的小标题（桌面三栏用）；右栏带一个「＋ 记一笔」入口 */
const PANE_HEADS = {
  money: '',
  home: '<div class="pane-head"><span>🏠 主页</span></div>',
  notes: '<div class="pane-head"><span>📁 记录</span><button class="btn ghost sm" data-act="lib-choose">＋ 记一笔</button></div>'
};
/* 只刷新某一栏（桌面下避免整页重绘，保留滚动与焦点） */
function renderPane(which) {
  const el = document.getElementById('pane-' + which);
  if (!el) return false;
  el.innerHTML = PANE_HEADS[which] + ({ money: moneyHTML, home: homeHTML, notes: notesHTML }[which])();
  return true;
}
/* 主页「速记账」：直接落一笔 */
function quickLed() {
  const amtEl = document.getElementById('q-amt');
  const amt = parseFloat(amtEl && amtEl.value);
  if (!(amt > 0)) return toast('请输入正确金额');
  const catEl = document.querySelector('#q-cat-row .chip.on');
  const acEl = document.querySelector('#q-acct-row .chip.on');
  const cat = catEl ? catEl.dataset.cat : '';
  const acId = acEl ? acEl.dataset.id : '';
  if (!cat) return toast('请选择分类');
  if (!acId) return toast('请先去「账」里加一个账户');
  const data = { type: qType, amount: Math.round(amt * 100) / 100, category: cat, account: acId, date: todayStr(), note: '' };
  state.ledger.push(Object.assign({ id: uid() }, data));
  const a = acct(acId); if (a) a.balance += (qType === 'in' ? amt : -amt);
  state.settings.lastLed = state.settings.lastLed || { out: { cat: '', acct: '' }, in: { cat: '', acct: '' } };
  state.settings.lastLed[qType] = { cat, acct: acId };
  recordNet(); save();
  toast('已记录', (qType === 'in' ? '收入 ' : '支出 ') + fmtMoney(amt));
  render();
}
function render() {
  applyTheme();
  document.getElementById('todayLabel').textContent = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  const brandEl = document.getElementById('brandEl');
  if (brandEl) {
    const L = { today: '主页', money: '账', notes: '记录', me: '设置' };
    brandEl.textContent = (window.innerWidth >= 760 || view === 'today') ? '日课' : (L[view] || '日课');
  }
  const ttEl = document.getElementById('themeToggle');
  if (ttEl) ttEl.textContent = effTheme() === 'dark' ? '🌙' : '☀️';
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.view === view;
    t.classList.toggle('active', on); t.classList.toggle('center', on);
  });

  if (view === 'me') { viewEl.innerHTML = renderMe(); return; }

  const wide = window.innerWidth >= 760;
  if (wide) {
    viewEl.innerHTML = `<div class="panes">
      <section class="pane pane-left" id="pane-money">${PANE_HEADS.money}${moneyHTML()}</section>
      <section class="pane pane-center" id="pane-home">${PANE_HEADS.home}${homeHTML()}</section>
      <section class="pane pane-right" id="pane-notes">${PANE_HEADS.notes}${notesHTML()}</section>
    </div>`;
    return;
  }

  /* 窄屏：按底部 tab 渲染单视图 */
  if (view === 'money') viewEl.innerHTML = moneyHTML();
  else if (view === 'notes') viewEl.innerHTML = notesHTML();
  else viewEl.innerHTML = homeHTML();
}

/* ================= 主页（三栏中心：速记账 + 写几句话 + 提醒/待办/日课） ================= */
function homeHTML() {
  const t = new Date(), h = t.getHours();
  const greet = h < 6 ? '夜深了' : h < 11 ? '早安' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
  const td = todayStr();
  const nt = nextTaskInfo();
  const dueTodo = state.todos.filter(x => !x.done && (!x.due || x.due <= td));
  const net = netWorth();

  const nextCard = nt
    ? `<div class="next-task"><div class="nt-label">你的下一个任务</div><div class="nt-main">▶️ ${esc(nt.label)}</div><div class="nt-when">${esc(nt.when)}</div></div>`
    : `<div class="next-task idle"><div class="nt-label">${greet}</div><div class="nt-main">✅ 暂时没有待办任务</div><div class="nt-when">享受当下，或记录点什么</div></div>`;

  const d0 = qDefault(qType);
  const qLed = `<div class="card"><h3>⚡ 速记账</h3>
    <input id="q-amt" type="number" inputmode="decimal" placeholder="金额（回车即记）" />
    <div class="chips" style="margin-top:8px"><span class="chip ${qType === 'out' ? 'on' : ''}" data-act="q-type" data-t="out">支出</span><span class="chip ${qType === 'in' ? 'on' : ''}" data-act="q-type" data-t="in">收入</span></div>
    <label class="f" style="margin-top:6px">分类</label>
    <div class="chips q-cat-row" id="q-cat-row">${qCatChips(qType, d0.cat)}</div>
    <label class="f" style="margin-top:6px">账户</label>
    <div class="chips q-acct-row" id="q-acct-row">${qAcctChips(d0.acct)}</div>
    <button class="btn primary block" data-act="q-led" style="margin-top:8px">记一笔</button>
    <div class="muted small" style="margin-top:6px">💰 净资产 ${fmtMoney(net.net)} · 自动记住上次分类/账户</div>
  </div>`;

  const todoHTML = dueTodo.length ? dueTodo.slice(0, 6).map(x => {
    const age = todoAge(x);
    return `<div class="item ${age.cls}"><label class="switch"><input type="checkbox" data-act="toggle-todo" data-id="${x.id}" ${x.done ? 'checked' : ''}><span class="track"></span></label><div style="flex:1"><div class="title" style="${x.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(x.title)}</div><div class="sub">${x.repeat && x.repeat !== 'none' ? REPEAT_LABEL[x.repeat] : ''}</div></div>${age.badge ? `<span class="age-badge ${age.badgeCls}">${age.badge}</span>` : ''}</div>`;
  }).join('') : emptyHTML('没有临期待办');
  const todoCard = `<div class="card"><h3>✅ 临期待办</h3>${todoHTML}</div>`;

  const habHTML = state.habits.length ? state.habits.map(hb => {
    const done = !!hb.records[td];
    return `<div class="item"><div style="font-size:20px">${esc(hb.emoji || '🌿')}</div><div style="flex:1;min-width:0"><div class="title">${esc(hb.name)}</div><div class="sub">连续 ${calcStreak(hb)} 天</div></div><button class="btn ${done ? '' : 'primary'}" data-act="hc" data-id="${hb.id}">${done ? '已打卡' : '打卡'}</button><button class="icon-btn" data-act="hab-edit" data-id="${hb.id}">✏️</button><button class="icon-btn del" data-act="hab-del" data-id="${hb.id}">✕</button></div>`;
  }).join('') : emptyHTML('还没有日课（点右上角 ＋ 或去「设置」添加）');
  const habCard = `<div class="card"><div class="row between"><h3>🌱 今日日课</h3><button class="btn ghost" data-act="open-habit">＋ 日课</button></div>${habHTML}</div>`;

  return `
    ${nextCard}
    <div class="sec-label">记</div>
    ${qLed}
    <div class="sec-label">看</div>
    ${todoCard}
    ${habCard}
    <button class="fab" data-act="lib-choose">＋</button>`;
}



/* ================= 账（财务中枢） ================= */
function priceProducts() {
  const map = {};
  state.prices.forEach(p => { if (!map[p.name]) map[p.name] = { name: p.name, items: [] }; map[p.name].items.push(p); });
  return Object.values(map).map(g => {
    g.items.sort((a, b) => a.date.localeCompare(b.date));
    g.latest = g.items[g.items.length - 1]; g.first = g.items[0];
    g.delta = g.latest.price - g.first.price; return g;
  }).sort((a, b) => b.latest.date.localeCompare(a.latest.date));
}
/* ====== 账：时间维度与子视图 ====== */
function periodAnchor() { return state.settings.moneyAnchor || todayStr(); }
function shiftAnchor(dir) {
  const r = state.settings.moneyRange || 'month';
  const d = new Date(periodAnchor() + 'T00:00:00');
  if (r === 'week') d.setDate(d.getDate() + dir * 7);
  else if (r === 'year') d.setFullYear(d.getFullYear() + dir);
  else d.setMonth(d.getMonth() + dir);
  return todayStr(d);
}
function periodLabel() {
  const r = state.settings.moneyRange || 'month';
  const a = periodAnchor(), d = new Date(a + 'T00:00:00');
  if (r === 'year') return String(d.getFullYear());
  if (r === 'week') {
    const st = new Date(d); st.setDate(st.getDate() - ((st.getDay() + 6) % 7));
    const en = new Date(st); en.setDate(en.getDate() + 6);
    const f = n => String(n).padStart(2, '0');
    return `${st.getMonth() + 1}.${f(st.getDate())}–${en.getMonth() + 1}.${f(en.getDate())}`;
  }
  return a.slice(0, 7);
}
function periodDays() {
  const r = state.settings.moneyRange || 'month';
  const a = periodAnchor(), d = new Date(a + 'T00:00:00');
  let start, end;
  if (r === 'year') { start = new Date(d.getFullYear(), 0, 1); end = new Date(d.getFullYear(), 11, 31); }
  else if (r === 'week') { start = new Date(d); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); end = new Date(start); end.setDate(end.getDate() + 6); }
  else { start = new Date(d.getFullYear(), d.getMonth(), 1); end = new Date(d.getFullYear(), d.getMonth() + 1, 0); }
  const out = [];
  for (let cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) out.push(todayStr(new Date(cur)));
  return out;
}
function periodLedger() {
  const set = new Set(periodDays());
  return state.ledger.filter(x => set.has(x.date)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}
function dayLabel(date) {
  const t = todayStr();
  if (date === t) return '今天';
  const y = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (date === y) return '昨天';
  const d = new Date(date + 'T00:00:00');
  const wd = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')} 周${wd}`;
}
function groupByDate(list) {
  const map = {};
  list.forEach(x => { (map[x.date] = map[x.date] || []).push(x); });
  return Object.keys(map).sort().reverse().map(date => {
    const items = map[date];
    const inSum = items.filter(i => i.type === 'in').reduce((s, i) => s + i.amount, 0);
    const outSum = items.filter(i => i.type === 'out').reduce((s, i) => s + i.amount, 0);
    return { date, items: items.slice().sort((a, b) => b.id.localeCompare(a.id)), inSum, outSum, net: inSum - outSum };
  });
}
function catBreakdown(list) {
  const PALETTE = ['#3a8ee6', '#21b573', '#ffab2e', '#ff5b6a', '#7c5cff', '#2bc4d4', '#ff8a3d', '#5aa8ec', '#e0559b'];
  const map = {};
  list.filter(x => x.type === 'out').forEach(x => { map[x.category] = (map[x.category] || 0) + x.amount; });
  const total = Object.values(map).reduce((s, v) => s + v, 0);
  return Object.keys(map).map((k, i) => ({ label: k, value: map[k], pct: total ? map[k] / total : 0, color: PALETTE[i % PALETTE.length] })).sort((a, b) => b.value - a.value);
}
function trendSeries(led, range) {
  if (range === 'year') {
    const y = +periodAnchor().slice(0, 4);
    return Array.from({ length: 12 }, (_, i) => {
      const mm = String(i + 1).padStart(2, '0');
      const v = led.filter(x => x.date.startsWith(y + '-' + mm) && x.type === 'out').reduce((s, x) => s + x.amount, 0);
      return { label: (i + 1) + '月', value: v, neg: true };
    });
  }
  const dm = {};
  led.forEach(x => { if (x.type === 'out') dm[x.date] = (dm[x.date] || 0) + x.amount; });
  return periodDays().map(d => ({ label: String(new Date(d + 'T00:00:00').getDate()), value: dm[d] || 0, neg: true }));
}
function barChartSVG(series, h) {
  h = h || 120;
  if (!series.length) return '<div class="muted small">暂无数据</div>';
  const w = 320, pad = 6, bw = (w - pad * 2) / series.length;
  const max = Math.max(...series.map(s => Math.abs(s.value)), 1);
  const topPad = 15, botPad = 14, bh = h - topPad - botPad;
  const fs = bw < 13 ? 6.5 : 8; // 月视图(约30根)字小一点，避免太挤
  const bars = series.map((s, i) => {
    const vh = Math.max(2, Math.abs(s.value) / max * bh);
    const x = pad + i * bw + bw * 0.30, bw2 = bw * 0.40, y = (h - botPad) - vh;
    const col = s.neg ? 'var(--red)' : 'var(--green)';
    const cx = x + bw2 / 2;
    const val = Math.abs(s.value) > 0 ? fmtMoney(Math.abs(s.value)) : '';
    const valText = val ? `<text x="${cx.toFixed(1)}" y="${(y - 3).toFixed(1)}" font-size="${fs}" text-anchor="middle" fill="var(--muted)">${esc(val)}</text>` : '';
    const t = s.label ? `<text x="${cx.toFixed(1)}" y="${h - 3}" font-size="8" text-anchor="middle" fill="var(--muted)">${esc(s.label)}</text>` : '';
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw2.toFixed(1)}" height="${vh.toFixed(1)}" rx="3" fill="${col}" opacity=".85"/>${valText}${t}`;
  }).join('');
  return `<svg class="barchart" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:${h}px">${bars}</svg>`;
}

/* ====== 账：顶部导航（月份/范围切换 + 概览/日历/统计/资产 四入口） ====== */
function moneyNav(showRange) {
  const sub = state.settings.moneySub || 'overview';
  const range = state.settings.moneyRange || 'month';
  const subs = [['overview', '🏠', '概览'], ['calendar', '📅', '日历'], ['stats', '📊', '统计'], ['networth', '💰', '资产']];
  const subBtns = subs.map(([v, ic, lb]) => `<button class="mnav-ic ${sub === v ? 'on' : ''}" data-act="money-sub" data-v="${v}" title="${lb}">${ic}</button>`).join('');
  const ranges = [['week', '周'], ['month', '月'], ['year', '年']];
  const rangeBtns = ranges.map(([v, lb]) => `<button class="chip ${range === v ? 'on' : ''}" data-act="money-range" data-v="${v}">${lb}</button>`).join('');
  return `<div class="mnav">
    <div class="mnav-row">
      <div class="mnav-period"><button class="icon-btn" data-act="money-prev">‹</button><span class="mnav-label">${periodLabel()}</span><button class="icon-btn" data-act="money-next">›</button></div>
      <div class="mnav-subs">${subBtns}</div>
    </div>
    ${showRange ? `<div class="mnav-ranges">${rangeBtns}</div>` : ''}
  </div>`;
}

/* ====== 可复用卡片 ====== */
function acctCardHTML() {
  const accts = state.accounts.filter(a => !a.isDebt);
  const acctHTML = accts.length ? accts.map(a => `<div class="item" data-act="open-acct-edit" data-id="${a.id}"><div style="flex:1"><div class="title">${a.icon} ${esc(a.name)}<span class="kind-badge ${a.kind === 'liability' ? 'kind-liab' : 'kind-asset'}">${a.kind === 'liability' ? '负债' : '资产'}</span></div><div class="sub">${a.kind === 'liability' ? '欠款' : '余额'} ${fmtMoney(a.balance)}</div></div><button class="icon-btn del" data-act="del-acct" data-id="${a.id}">✕</button></div>`).join('') : emptyHTML('还没有账户');
  return `<div class="card"><div class="row between"><h3>🏦 账户</h3><button class="btn ghost" data-act="open-acct">＋ 账户</button></div>${acctHTML}</div>`;
}
function debtCardHTML() {
  const debts = state.accounts.filter(a => a.isDebt);
  const debtHTML = debts.length ? debts.map(d => {
    let st = '无期限', stCls = '';
    if (d.due) {
      const od = Math.round((new Date(d.due + 'T00:00').getTime() - Date.now()) / 864e5);
      if (od < 0) { st = '已逾期 ' + Math.abs(od) + '天'; stCls = 'age-overx'; }
      else if (od <= 30) { st = od + '天后到期'; stCls = 'age-over1'; }
      else { st = od + '天后到期'; stCls = 'age-today'; }
    }
    const dirLabel = d.dir === 'lend' ? '借出' : '借入';
    return `<div class="item lib-item" data-act="open-debt-edit" data-id="${d.id}"><div style="flex:1;min-width:0"><div class="title">${d.icon} ${esc(d.name)} <span class="kind-badge ${d.dir === 'lend' ? 'kind-asset' : 'kind-liab'}">${dirLabel}</span></div><div class="sub">${fmtMoney(d.balance)}${d.due ? ' · 到期 ' + d.due : ''}</div></div><span class="age-badge ${stCls}">${st}</span><button class="icon-btn del" data-act="del-debt" data-id="${d.id}">✕</button></div>`;
  }).join('') : emptyHTML('没有借贷记录，点「＋ 债务」添加');
  return `<div class="card"><div class="row between"><h3>🤝 债务</h3><button class="btn ghost" data-act="open-debt">＋ 债务</button></div>${debtHTML}<div class="muted small" style="margin-top:8px">借出 = 别人欠你（资产）；借入 = 你欠别人（负债）。到期日用于提醒。</div></div>`;
}
function priceCardHTML() {
  const prods = priceProducts();
  const priceHTML = prods.length ? prods.map(g => {
    const up = g.delta > 0, flat = g.delta === 0;
    const cls = up ? 'trend-up' : flat ? 'trend-flat' : 'trend-down';
    const arr = up ? '↑' : flat ? '→' : '↓';
    return `<div class="item lib-item" data-act="lib-open" data-type="price" data-id="${g.latest.id}"><div style="flex:1;min-width:0"><div class="title" style="display:flex;gap:6px;align-items:center"><span>🏷️</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(g.name)}</span></div><div class="sub">${fmtMoney(g.latest.price)} · ${g.latest.date}${g.items.length > 1 ? ` · ${g.items.length}次` : ''}</div></div><span class="${cls}">${arr} ${g.items.length > 1 ? ((up ? '+' : '') + fmtMoney(g.delta)) : ''}</span></div>`;
  }).join('') : emptyHTML('还没有价格记录，点右下「记价格」');
  return `<div class="card"><div class="row between"><h3>🏷️ 价格目录</h3><button class="btn ghost" data-act="lib-add" data-t="price">＋ 记价格</button></div>${priceHTML}<div class="muted small" style="margin-top:8px">同名商品多次记录，点开看历史涨跌。</div></div>`;
}
function platCardHTML() {
  const chSpend = {};
  state.ledger.forEach(x => { if (x.channel && x.type === 'out') chSpend[x.channel] = (chSpend[x.channel] || 0) + x.amount; });
  const chArr = Object.keys(chSpend).map(k => ({ k, v: chSpend[k] })).sort((a, b) => b.v - a.v);
  const platHTML = chArr.length ? chArr.slice(0, 8).map(c => `<div class="item" style="border:none;padding:7px 0"><div style="flex:1"><div class="title">${esc(c.k)}</div><div class="sub">花费</div></div><span class="neg" style="font-weight:700">${fmtMoney(c.v)}</span></div>`).join('') : emptyHTML('记账时选了「购物平台」才会统计');
  return `<div class="card"><div class="row between"><h3>🛒 各平台花费</h3><span class="muted small">来自记账</span></div>${platHTML}<div class="muted small" style="margin-top:8px">在「记账」里选购物平台，价格目录就能统计各平台花了多少。</div></div>`;
}

/* ====== 四个子视图 ====== */
function moneyOverviewHTML() {
  const led = periodLedger();
  const inc = led.filter(x => x.type === 'in').reduce((s, x) => s + x.amount, 0);
  const out = led.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
  const net0 = netWorth();
  const lbl = { week: '本周', month: '本月', year: '本年' }[state.settings.moneyRange || 'month'];
  const hero = `<div class="card hero-card">
    <div class="hero-period">${lbl}概览</div>
    <div class="hero-grid">
      <div><div class="hero-num pos">${fmtMoney(inc)}</div><div class="muted small">收入</div></div>
      <div><div class="hero-num neg">${fmtMoney(out)}</div><div class="muted small">支出</div></div>
      <div><div class="hero-num ${inc - out >= 0 ? 'pos' : 'neg'}">${fmtMoney(inc - out)}</div><div class="muted small">结余</div></div>
    </div>
    <div class="muted small" style="margin-top:8px">💰 净资产 ${fmtMoney(net0.net)}</div>
  </div>`;
  const trend = `<div class="card"><h3>📈 ${lbl}每日支出</h3>${barChartSVG(trendSeries(led, state.settings.moneyRange || 'month'), 120)}</div>`;
  const groups = groupByDate(led);
  const ledList = groups.length ? groups.map(g => {
    const parts = [];
    if (g.outSum) parts.push('支:' + fmtMoney(g.outSum));
    if (g.inSum) parts.push('收:' + fmtMoney(g.inSum));
    const head = `${dayLabel(g.date)}　${parts.join('　')}`;
    const items = g.items.map(x => `<div class="item" data-act="open-led" data-id="${x.id}"><div style="flex:1"><div class="title">${esc(x.category)} <span class="muted small">· ${esc((acct(x.account) || {}).name || '')}</span>${x.note ? `<span class="muted small"> · ${esc(x.note)}</span>` : ''}</div><div class="sub">${x.date}</div></div><div class="${x.type === 'in' ? 'pos' : 'neg'}" style="font-weight:700">${x.type === 'in' ? '+' : '-'}${fmtMoney(x.amount)}</div><button class="icon-btn del" data-act="del-led" data-id="${x.id}">✕</button></div>`).join('');
    return `<div class="day-group"><div class="day-head">${head}</div>${items}</div>`;
  }).join('') : emptyHTML('这段期间还没有账单');
  const ledCard = `<div class="card"><div class="row between"><h3>🧾 记账</h3><button class="btn ghost" data-act="lib-add" data-t="ledger">＋ 记一笔</button></div>${ledList}</div>`;
  return hero + trend + ledCard + buildBudgetCard(out);
}
function moneyCalendarHTML() {
  const a = periodAnchor(), y = +a.slice(0, 4), m = +a.slice(5, 7) - 1;
  const first = new Date(y, m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const map = {};
  state.ledger.filter(x => x.date.startsWith(a.slice(0, 7))).forEach(x => { map[x.date] = (map[x.date] || 0) + (x.type === 'in' ? x.amount : -x.amount); });
  const cells = [];
  const wd = ['一', '二', '三', '四', '五', '六', '日'];
  for (let i = 0; i < startPad; i++) cells.push(`<div class="cal-cell empty"></div>`);
  const today = todayStr();
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${a.slice(0, 7)}-${String(d).padStart(2, '0')}`;
    const v = map[ds];
    const cls = ds === today ? 'cal-cell today' : 'cal-cell';
    const lunar = lunarLabel(ds);
    const amt = v ? `<div class="cal-amt ${v < 0 ? 'neg' : 'pos'}">${fmtMoney(Math.abs(v)).replace('¥', '')}</div>` : '';
    cells.push(`<div class="${cls}"><div class="cal-day">${d}</div>${lunar ? `<div class="cal-lunar">${lunar}</div>` : ''}${amt}</div>`);
  }
  const monthLed = state.ledger.filter(x => x.date.startsWith(a.slice(0, 7)));
  const mInc = monthLed.filter(x => x.type === 'in').reduce((s, x) => s + x.amount, 0);
  const mOut = monthLed.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
  const summary = `<div class="cal-sum"><span>月收入 <b class="pos">${fmtMoney(mInc)}</b></span><span>月支出 <b class="neg">${fmtMoney(mOut)}</b></span><span>月结余 <b class="${mInc - mOut >= 0 ? 'pos' : 'neg'}">${fmtMoney(mInc - mOut)}</b></span></div>`;
  return `<div class="card"><div class="cal-grid-head">${wd.map(w => `<div>${w}</div>`).join('')}</div><div class="cal-grid">${cells.join('')}</div></div>${summary}`;
}
function moneyStatsHTML() {
  const led = periodLedger();
  const inc = led.filter(x => x.type === 'in').reduce((s, x) => s + x.amount, 0);
  const out = led.filter(x => x.type === 'out').reduce((s, x) => s + x.amount, 0);
  const days = periodDays().length || 1;
  const avg = out / days;
  const lbl = { week: '本周', month: '本月', year: '本年' }[state.settings.moneyRange || 'month'];
  const overview = `<div class="card"><h3>收支总览</h3>
    <div class="stat-grid">
      <div><div class="num neg">${fmtMoney(out)}</div><div class="muted small">支出</div></div>
      <div><div class="num pos">${fmtMoney(inc)}</div><div class="muted small">收入</div></div>
      <div><div class="num">${fmtMoney(inc - out)}</div><div class="muted small">结余</div></div>
      <div><div class="num">${fmtMoney(avg)}</div><div class="muted small">日均支出</div></div>
    </div></div>`;
  const daily = `<div class="card"><h3>每日统计（${lbl}支出）</h3>${barChartSVG(trendSeries(led, state.settings.moneyRange || 'month'), 130)}</div>`;
  const cats = catBreakdown(led);
  const donut = buildDonut(cats.map(c => ({ label: c.label, value: c.value, color: c.color })));
  const rank = cats.length ? cats.map((c, i) => `<div class="rank-item"><span class="rank-no">${i + 1}</span><span class="rank-name">${esc(c.label)}</span><span class="rank-pct">${Math.round(c.pct * 100)}%</span><span class="neg" style="font-weight:700">${fmtMoney(c.value)}</span></div>`).join('') : emptyHTML('这段期间还没有支出');
  const catCard = `<div class="card"><h3>分类报表</h3>${donut}${rank}</div>`;
  const groups = groupByDate(led);
  const table = groups.length ? `<div class="day-table">${groups.map(g => `<div class="dt-row"><span>${dayLabel(g.date)}</span><span class="pos">${fmtMoney(g.inSum)}</span><span class="neg">${fmtMoney(g.outSum)}</span><span class="${g.net >= 0 ? 'pos' : 'neg'}">${fmtMoney(g.net)}</span></div>`).join('')}</div>` : emptyHTML('暂无数据');
  const dailyTable = `<div class="card"><h3>日报表</h3><div class="dt-head"><span>日期</span><span>收入</span><span>支出</span><span>结余</span></div>${table}</div>`;
  return overview + daily + catCard + dailyTable + platCardHTML() + priceCardHTML();
}
function moneyNetworthHTML() {
  const nw = netWorth();
  const debts = state.accounts.filter(a => a.isDebt);
  const lend = debts.filter(a => a.dir === 'lend').reduce((s, a) => s + a.balance, 0);
  const borrow = debts.filter(a => a.dir !== 'lend').reduce((s, a) => s + a.balance, 0);
  const hero = `<div class="card networ-card">
    <div class="nw-label">净资产</div>
    <div class="nw-num ${nw.net >= 0 ? 'pos' : 'neg'}">${fmtMoney(nw.net)}</div>
    <div class="nw-row"><div><div class="num">${fmtMoney(nw.assets)}</div><div class="muted small">总资产</div></div><div><div class="num">${fmtMoney(nw.liabs)}</div><div class="muted small">总负债</div></div></div>
    <div class="nw-row"><div><div class="num">${fmtMoney(borrow)}</div><div class="muted small">总借入</div></div><div><div class="num">${fmtMoney(lend)}</div><div class="muted small">总借出</div></div></div>
  </div>`;
  return hero + acctCardHTML() + debtCardHTML();
}
function moneyHTML() {
  const sub = state.settings.moneySub || 'overview';
  const fns = { overview: [moneyOverviewHTML, true], calendar: [moneyCalendarHTML, false], stats: [moneyStatsHTML, true], networth: [moneyNetworthHTML, false] };
  const fn = (fns[sub] || fns.overview);
  return moneyNav(fn[1]) + fn[0]() + '<button class="fab" data-act="open-led">＋</button>';
}

/* ================= 记（记录库） ================= */
function contentItems() {
  const out = [];
  state.notes.forEach(n => {
    const t = NOTE_TYPES.find(x => x.id === n.type) || { name: n.type, icon: '📝' };
    const sub = n.type === 'travel' ? ((n.place ? '📍' + n.place + ' · ' : '') + (n.date || '')) : (n.type === 'recipe' ? (n.tags || '菜谱') : (n.date || ''));
    out.push({ type: n.type, id: n.id, icon: t.icon, title: n.title || '（无标题）', sub, date: n.date || n.updated || '' });
  });
  state.media.forEach(m => out.push({ type: 'media', id: m.id, icon: MEDIA_KINDS[m.kind].icon, title: m.title, sub: `${m.current}/${m.total} · ${{ wish: '想看', doing: '在追', done: '看完' }[m.status]}`, date: '' }));
  state.todos.forEach(t => { const age = todoAge(t); out.push({ type: 'todo', id: t.id, icon: '✅', title: t.title, sub: [t.repeat && t.repeat !== 'none' ? REPEAT_LABEL[t.repeat] : '', t.due || '', age.badge].filter(Boolean).join(' · '), date: t.due || '' }); });
  state.reminders.forEach(r => out.push({ type: 'reminder', id: r.id, icon: '⏰', title: r.name, sub: `${r.time} · ${REPEAT_LABEL[r.repeat]}`, date: '' }));
  return out;
}
function notesHTML() {
  const items = contentItems();
  const q = libSearch.trim().toLowerCase();
  const filtered = items.filter(it =>
    (libType === 'all' || it.type === libType) &&
    (!q || (it.title + ' ' + it.sub).toLowerCase().includes(q))
  );
  filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const chips = [{ id: 'all', name: '全部', icon: '📚' }].concat(CONTENT_TYPES).map(tp => `<span class="chip ${libType === tp.id ? 'on' : ''}" data-act="lib-filter" data-t="${tp.id}">${tp.icon} ${tp.name}</span>`).join('');

  let listHTML;
  if (libType === 'all') {
    const groups = [
      { title: '记录', types: ['diary', 'travel', 'recipe', 'note', 'media'] },
      { title: '任务', types: ['todo', 'reminder'] }
    ];
    listHTML = groups.map(g => {
      const gi = filtered.filter(it => g.types.includes(it.type));
      if (!gi.length) return '';
      return `<div class="lib-sec"><div class="lib-sec-title">${g.title}</div>${gi.map(it => `<div class="item lib-item" data-act="lib-open" data-type="${it.type}" data-id="${it.id}"><div style="flex:1;min-width:0"><div class="title" style="display:flex;gap:6px;align-items:center"><span>${it.icon}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.title)}</span></div><div class="sub">${esc(it.sub)}</div></div><button class="icon-btn del" data-act="lib-del" data-type="${it.type}" data-id="${it.id}">✕</button></div>`).join('')}</div>`;
    }).join('');
    if (!listHTML) listHTML = emptyHTML('记录库还是空的，点右下角 ＋ 记一笔');
  } else {
    listHTML = filtered.length ? filtered.map(it => `<div class="item lib-item" data-act="lib-open" data-type="${it.type}" data-id="${it.id}"><div style="flex:1;min-width:0"><div class="title" style="display:flex;gap:6px;align-items:center"><span>${it.icon}</span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(it.title)}</span></div><div class="sub">${esc(it.sub)}</div></div><button class="icon-btn del" data-act="lib-del" data-type="${it.type}" data-id="${it.id}">✕</button></div>`).join('') : emptyHTML('该分类暂无记录');
  }

  return `
    <div class="search-row"><input class="search" id="lib-search" placeholder="🔍 搜索标题 / 内容" value="${esc(libSearch)}" /></div>
    <div class="lib-chips">${chips}</div>
    <div class="card" style="padding:6px 12px">${listHTML}</div>
    <button class="fab" data-act="lib-choose">＋</button>`;
}

/* ================= 我的（设置 + 日课） ================= */
function renderMe() {
  const notifState = ('Notification' in window) ? Notification.permission : 'unsupported';
  const notifTxt = { granted: '已开启 ✓', denied: '被浏览器拒绝', default: '未开启', unsupported: '当前环境不支持' }[notifState];
  const theme = state.settings.theme || 'light';
  const budget = state.settings.budget || 0;
  const themeSeg = `<div class="seg">${[['light', '☀️ 白天'], ['dark', '🌙 黑夜'], ['auto', '🔄 自动']].map(([v, l]) => `<button data-act="set-theme" data-t="${v}" class="${theme === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const diaCount = state.notes.filter(n => n.type === 'diary').length;

  const habList = state.habits.length ? state.habits.map(hb => {
    return `<div class="item"><div style="font-size:20px">${esc(hb.emoji || '🌿')}</div><div style="flex:1"><div class="title">${esc(hb.name)}</div><div class="sub">连续 ${calcStreak(hb)} 天${hb.note ? ' · ' + esc(hb.note) : ''}</div></div><button class="icon-btn" data-act="hab-edit" data-id="${hb.id}">✏️</button><button class="icon-btn del" data-act="del-hab" data-id="${hb.id}">✕</button></div>`;
  }).join('') : emptyHTML('还没有日课');

  return `
    <div class="set-head"><button class="btn ghost" data-act="back" style="padding:6px 12px;font-size:13px">‹ 返回</button><span class="set-head-title">设置</span><span class="set-head-hint">左边缘右滑也可返回</span></div>
    <div class="card">
      <h3>⚙️ 设置</h3>
      <div class="theme-row"><div><div class="title">外观</div><div class="sub muted small">白天 / 黑夜 / 跟随系统</div></div>${themeSeg}</div>
      <div class="item" style="border:none;padding:12px 0"><div style="flex:1"><div class="title">桌面通知</div><div class="sub muted small">${notifTxt} · 用于提醒弹窗</div></div><button class="btn ${notifState === 'granted' ? '' : 'primary'}" data-act="enable-notif">${notifState === 'granted' ? '已开启' : '开启'}</button></div>
      <label class="f">每月预算（0 = 不设置）</label><input id="set-budget" type="number" value="${budget}" data-act="set-budget" />
    </div>
    <div class="card">
      <div class="row between"><h3>🌱 日课（长期主义）</h3><button class="btn ghost" data-act="open-habit">＋ 添加</button></div>
      ${habList}
    </div>
    <div class="card">
      <h3>💾 数据（完全在你设备上）</h3>
      <p class="muted small">所有数据仅存于本浏览器。导出可备份，换设备时再导入。</p>
      <button class="btn block" data-act="export" style="margin-bottom:8px">⬇️ 导出全部备份 (JSON)</button>
      <label class="btn block ghost" style="margin-bottom:8px">⬆️ 导入备份<input id="importFile" type="file" accept="application/json" style="display:none" data-act="import" /></label>
      <button class="btn block" data-act="export-ob" style="margin-bottom:8px">⬇️ 导出日记到 Obsidian (${diaCount})</button>
      <button class="btn danger block" data-act="clear">✕ 清空全部数据</button>
      <p class="muted small" style="margin-top:10px">📍 本机存储位置：<b>${esc(location.origin + location.pathname)}</b><br/>请固定用这个地址打开，数据才会连续保存。</p>
    </div>
    <div class="card">
      <h3>📜 关于「日课」</h3>
      <p class="muted small" style="line-height:1.7">日课，是把你散在日历、待办、记录里的事，收进一个完全属于你的生活中枢。今天感知时间、账看财富结构、记录存一切、我管设置。长期主义不是坚持做大事，而是把小事，做很久。</p>
    </div>`;
}

/* ================= 弹层 sheet ================= */
function openSheet(title, bodyHTML) {
  document.getElementById('sheet-title').textContent = title;
  document.getElementById('sheet-body').innerHTML = bodyHTML;
  document.getElementById('sheet').hidden = false;
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  document.getElementById('sheet').hidden = true;
  sheetCtx = null;
  document.body.style.overflow = '';
}

/* ---------- 自定义确认弹窗（替代原生 confirm，兼容预览/iframe 环境） ---------- */
let confirmCb = null;
function askConfirm(title, msg, onYes, yesLabel) {
  const box = document.getElementById('confirm');
  if (!box) { // 兜底：极端情况下仍尝试原生
    if (window.confirm && window.confirm(msg)) onYes();
    return;
  }
  document.getElementById('confirm-title').textContent = title || '请确认';
  document.getElementById('confirm-msg').textContent = msg || '';
  document.getElementById('confirm-yes').textContent = yesLabel || '删除';
  confirmCb = onYes;
  box.hidden = false;
}
function closeConfirm() {
  const box = document.getElementById('confirm');
  if (box) box.hidden = true;
  confirmCb = null;
}

/* ---------- 各类型表单 ---------- */
function noteForm(type, editing) {
  let fields;
  if (type === 'diary') fields = `<label class="f">心情</label><div class="chips mood-row" id="note-mood">${['😀', '😌', '😐', '😟', '😴', '🔥'].map(m => `<span class="chip moodchip" data-m="${m}">${m}</span>`).join('')}</div><label class="f">标题</label><input id="n-title" placeholder="今天的关键词" /><label class="f">正文</label><textarea id="n-body" placeholder="发生了什么？感受如何？"></textarea>`;
  else if (type === 'travel') fields = `<label class="f">地点</label><input id="n-place" placeholder="如：京都" /><label class="f">日期</label><input id="n-date" type="date" value="${todayStr()}" /><label class="f">标题</label><input id="n-title" placeholder="这趟旅行的名字" /><label class="f">正文</label><textarea id="n-body" placeholder="见闻、花费、心情…"></textarea>`;
  else if (type === 'recipe') fields = `<label class="f">菜名</label><input id="n-title" placeholder="如：番茄炒蛋" /><label class="f">食材（每行一个）</label><textarea id="n-ingredients" placeholder="鸡蛋 2 个\n番茄 1 个"></textarea><label class="f">步骤</label><textarea id="n-steps" placeholder="1. …\n2. …"></textarea><label class="f">标签</label><input id="n-tags" placeholder="家常 / 川菜" />`;
  else fields = `<label class="f">标题</label><input id="n-title" placeholder="标题" /><label class="f">正文</label><textarea id="n-body" placeholder="记点什么…"></textarea>`;
  return `<div id="note-fields">${fields}</div><div class="sheet-foot">${editing ? `<button class="btn danger" data-act="del-note" data-id="${editing.id}">删除</button>` : ''}<button class="btn ghost" data-act="sheet-close">取消</button><button class="btn primary" data-act="save-note">${editing ? '保存修改' : '保存'}</button></div>`;
}
function priceForm(edit) {
  return `<label class="f">商品名（同名自动聚合对比）</label><input id="p-name" placeholder="如：羊毛裤" />
    <label class="f">价格</label><input id="p-price" type="number" inputmode="decimal" placeholder="如 9.9" />
    <label class="f">日期</label><input id="p-date" type="date" value="${todayStr()}" />
    <label class="f">购买平台</label><div class="chips ch-row" id="p-ch-row">${channelChips(edit ? edit.store : '')}</div>
    <label class="f">备注</label><input id="p-note" placeholder="规格 / 优惠情况" />
    <div class="sheet-foot"><button class="btn ghost" data-act="sheet-close">取消</button><button class="btn primary" data-act="save-price">${edit ? '保存修改' : '保存'}</button></div>`;
}
function ledgerForm() {
  const grid = CATS[ledType].map(([n, em]) => `<div class="cat ${ledCat === n ? 'on' : ''}" data-act="led-cat" data-cat="${n}"><span class="emo">${em}</span><span>${n}</span></div>`).join('');
  const editing = sheetCtx && sheetCtx.id;
  const edRec = editing ? state.ledger.find(x => x.id === sheetCtx.id) : null;
  const dateVal = editing ? edRec.date : todayStr();
  const noteVal = editing ? (edRec.note || '') : '';
  const catIcon = (CATS[ledType].find(([n]) => n === ledCat) || ['', '📦'])[1];
  const showChannel = ledCat === '购物' || ledChannel;
  const acctObj = ledAcct ? state.accounts.find(a => a.id === ledAcct) : null;
  const acctName = acctObj ? acctObj.name : '账户';
  const acctIcon = acctObj ? acctObj.icon : '💳';
  const dateText = dateVal === todayStr() ? '今天' : dateVal.slice(5);
  const channelText = ledChannel || '平台';
  return `<div class="led-tabs">
      <span class="${ledType === 'out' ? 'on' : ''}" data-act="led-type" data-t="out">支出</span>
      <span class="${ledType === 'in' ? 'on' : ''}" data-act="led-type" data-t="in">收入</span>
    </div>
    <div class="cat-grid">${grid}</div>
    <div class="led-amt-row">
      <input id="l-note" class="led-note" placeholder="点此输入备注..." value="${esc(noteVal)}" />
      <div class="led-amt" id="l-amt">${showAmt(ledExpr)}</div>
    </div>
    <div class="led-quick">
      <span class="quick-chip ${ledFocus === 'acct' ? 'on' : ''}" data-act="led-focus-acct">${acctIcon} ${esc(acctName)}</span>
      <span class="quick-chip ${ledFocus === 'date' ? 'on' : ''}" data-act="led-focus-date">${dateText}</span>
      <span class="quick-chip ${ledFocus === 'cat' ? 'on' : ''}" data-act="led-focus-cat">${catIcon} ${ledCat}</span>
      ${showChannel ? `<span class="quick-chip ${ledFocus === 'channel' ? 'on' : ''}" data-act="led-focus-channel">${channelText}</span>` : ''}
    </div>
    ${editing ? `<div class="led-edit-bar"><button type="button" class="led-del" data-act="del-led-form" data-id="${sheetCtx.id}">删除这笔</button></div>` : ''}
    ${ledPanelHTML()}
    ${kpadHTML()}`;
}
function ledPanelHTML() {
  if (!ledFocus) return '';
  const editing = sheetCtx && sheetCtx.id;
  const edRec = editing ? state.ledger.find(x => x.id === sheetCtx.id) : null;
  if (ledFocus === 'acct') {
    const acctPick = state.accounts.map(a => `<span class="chip ${ledAcct === a.id ? 'on' : ''}" data-act="led-acct" data-id="${a.id}">${a.icon} ${esc(a.name)}</span>`).join('');
    return `<div class="led-panel" data-panel="acct"><div class="chips acct-pick">${acctPick}</div></div>`;
  }
  if (ledFocus === 'date') {
    const dateVal = editing ? edRec.date : todayStr();
    return `<div class="led-panel" data-panel="date"><input id="l-date" type="date" value="${dateVal}" /></div>`;
  }
  if (ledFocus === 'channel') {
    return `<div class="led-panel" data-panel="channel"><div class="chips ch-row">${channelChips(ledChannel)}</div></div>`;
  }
  return '';
}
function kpadHTML() {
  return `<div class="kpad-4">
    <button type="button" class="num" data-act="kpad" data-k="1">1</button>
    <button type="button" class="num" data-act="kpad" data-k="2">2</button>
    <button type="button" class="num" data-act="kpad" data-k="3">3</button>
    <button type="button" class="del" data-act="kpad" data-k="del">⌫</button>
    <button type="button" class="num" data-act="kpad" data-k="4">4</button>
    <button type="button" class="num" data-act="kpad" data-k="5">5</button>
    <button type="button" class="num" data-act="kpad" data-k="6">6</button>
    <button type="button" class="op" data-act="kpad" data-k="-">－</button>
    <button type="button" class="num" data-act="kpad" data-k="7">7</button>
    <button type="button" class="num" data-act="kpad" data-k="8">8</button>
    <button type="button" class="num" data-act="kpad" data-k="9">9</button>
    <button type="button" class="op" data-act="kpad" data-k="+">＋</button>
    <button type="button" class="more" data-act="kpad" data-k="more">再记</button>
    <button type="button" class="num" data-act="kpad" data-k="0">0</button>
    <button type="button" class="num" data-act="kpad" data-k=".">.</button>
    <button type="button" class="save" data-act="kpad" data-k="save">保存</button>
  </div>`;
}
function rerenderLedgerForm() {
  const date = (document.getElementById('l-date') || {}).value || '';
  const note = (document.getElementById('l-note') || {}).value || '';
  const sb = document.getElementById('sheet-body');
  if (sb) {
    sb.innerHTML = ledgerForm();
    setTimeout(() => {
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      if (ledFocus === 'date') set('l-date', date || todayStr());
      set('l-note', note);
    }, 0);
  }
}
function mediaForm() {
  const kindChips = Object.keys(MEDIA_KINDS).map(k => `<span class="chip ${mediaKind === k ? 'on' : ''}" data-act="media-kind" data-k="${k}">${MEDIA_KINDS[k].icon} ${MEDIA_KINDS[k].name}</span>`).join('');
  return `<div class="chips">${kindChips}</div>
    <label class="f">名称</label><input id="m-title" placeholder="如：三体 / 奥本海默" />
    <label class="f">总集数 / 总页数</label><input id="m-total" type="number" placeholder="如 30" />
    <label class="f">已看到</label><input id="m-current" type="number" placeholder="0" />
    <label class="f">状态</label><select id="m-status"><option value="wish">想看</option><option value="doing">在追</option><option value="done">看完</option></select>
    <div class="sheet-foot"><button class="btn ghost" data-act="sheet-close">取消</button><button class="btn primary" data-act="save-media">${sheetCtx && sheetCtx.id ? '保存修改' : '保存'}</button></div>`;
}
function todoForm() {
  return `<label class="f">事项</label><input id="t-title" placeholder="想做的事" />
    <label class="f">备注</label><input id="t-note" placeholder="可选" />
    <div class="row" style="gap:10px"><div style="flex:1"><label class="f">截止日期</label><input id="t-due" type="date" /></div><div style="flex:1"><label class="f">重复提醒</label><select id="t-repeat"><option value="none">不重复</option><option value="daily">每天</option><option value="weekly">每周</option><option value="monthly">每月</option></select></div></div>
    <label class="f">开启提醒</label><label class="switch"><input type="checkbox" id="t-remind" checked><span class="track"></span></label>
    <div class="sheet-foot"><button class="btn ghost" data-act="sheet-close">取消</button><button class="btn primary" data-act="save-todo">${sheetCtx && sheetCtx.id ? '保存修改' : '保存'}</button></div>`;
}
function reminderForm() {
  const dayChips = [0, 1, 2, 3, 4, 5, 6].map(d => `<span class="chip daychip" data-d="${d}">${'日一二三四五六'[d]}</span>`).join('');
  return `<label class="f">名称</label><input id="r-name" placeholder="如：喝水 / 吃药" />
    <label class="f">时间</label><input id="r-time" type="time" value="07:00" />
    <label class="f">重复</label><select id="r-repeat"><option value="daily">每天</option><option value="weekday">工作日</option><option value="weekend">周末</option><option value="custom">自定义</option></select>
    <div id="r-days" class="chips" style="margin-top:8px;display:none">${dayChips}</div>
    <label class="f">备注</label><input id="r-note" placeholder="给未来的自己一句话" />
    <div class="sheet-foot"><button class="btn ghost" data-act="sheet-close">取消</button><button class="btn primary" data-act="save-rem">${sheetCtx && sheetCtx.id ? '保存修改' : '保存'}</button></div>`;
}
function habitForm(editing) {
  const e = editing || {};
  return `<label class="f">名称</label><input id="h-name" placeholder="如：读书30分 / 存10元" value="${esc(e.name || '')}" />
    <label class="f">图标 emoji</label><input id="h-emoji" placeholder="🌱 📚 💪" maxlength="4" value="${esc(e.emoji || '')}" />
    <label class="f">一句话意义</label><input id="h-note" placeholder="为什么值得长期坚持" value="${esc(e.note || '')}" />
    <div class="sheet-foot">${editing ? `<button class="btn danger" data-act="hab-del" data-id="${editing.id}">删除</button>` : ''}<button class="btn ghost" data-act="sheet-close">取消</button><button class="btn primary" data-act="save-hab">${editing ? '保存修改' : '保存'}</button></div>`;
}
function openHabitForm(id) {
  const editing = id ? state.habits.find(h => h.id === id) : null;
  sheetCtx = { kind: 'habit', id };
  openSheet('日课' + (id ? ' · 编辑' : ' · 新增'), habitForm(editing));
  if (editing) setTimeout(() => { const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; }; set('h-name', editing.name); set('h-emoji', editing.emoji); set('h-note', editing.note); }, 0);
}
function accountForm(editing) {
  return `<label class="f">名称</label><input id="a-name" placeholder="如：花呗 / 招商银行" />
    <label class="f">图标 emoji</label><input id="a-icon" placeholder="💳" maxlength="4" />
    <label class="f">当前${editing && editing.kind === 'liability' ? '欠款' : '余额'}</label><input id="a-bal" type="number" inputmode="decimal" placeholder="0" />
    <label class="f">类型</label><select id="a-kind"><option value="asset">资产（你拥有的钱）</option><option value="liability">负债（你欠的钱）</option></select>
    <div class="sheet-foot"><button class="btn ghost" data-act="sheet-close">取消</button><button class="btn primary" data-act="save-acct">${editing ? '保存修改' : '保存'}</button></div>`;
}
function debtForm(editing) {
  return `<label class="f">名称（谁 / 什么事）</label><input id="d-name" placeholder="如：小王 / 房贷 / 信用卡分期" />
    <label class="f">方向</label><select id="d-dir"><option value="lend">借出（别人欠我）</option><option value="borrow">借入（我欠别人）</option></select>
    <label class="f">金额</label><input id="d-amt" type="number" inputmode="decimal" placeholder="0" />
    <label class="f">到期日（可选，用于提醒）</label><input id="d-due" type="date" />
    <label class="f">备注</label><input id="d-note" placeholder="利率 / 用途 / 约定" />
    <div class="sheet-foot"><button class="btn ghost" data-act="sheet-close">取消</button><button class="btn primary" data-act="save-debt">${editing ? '保存修改' : '保存'}</button></div>`;
}
function openDebtForm(id) {
  const editing = id ? state.accounts.find(a => a.id === id) : null;
  sheetCtx = { kind: 'debt', id };
  openSheet('债务' + (id ? ' · 编辑' : ' · 新增'), debtForm(editing));
  if (editing) setTimeout(() => {
    const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; };
    set('d-name', editing.name); set('d-amt', editing.balance); set('d-due', editing.due); set('d-note', editing.note);
    const dir = document.getElementById('d-dir'); if (dir) dir.value = editing.dir || 'lend';
  }, 0);
}
function saveDebt() {
  const name = document.getElementById('d-name').value.trim(); if (!name) return toast('请填写名称');
  const dir = document.getElementById('d-dir').value;
  const amt = parseFloat(document.getElementById('d-amt').value); if (!(amt > 0)) return toast('请输入金额');
  const due = document.getElementById('d-due').value || '';
  const note = document.getElementById('d-note').value.trim();
  const data = { name, icon: '🤝', balance: amt, kind: dir === 'lend' ? 'asset' : 'liability', isDebt: true, dir, due, note };
  if (sheetCtx.id) { const a = state.accounts.find(x => x.id === sheetCtx.id); if (a) Object.assign(a, data); toast('已保存修改'); }
  else { state.accounts.push(Object.assign({ id: uid() }, data)); toast('已记录债务', name); }
  recordNet(); save(); closeSheet(); render();
}

/* ---------- 打开（新增 / 编辑） ---------- */
function openAdd(t) {
  if (NOTE_TYPE_IDS.includes(t)) return openNoteForm(t, null);
  if (t === 'price') return openPriceForm(null);
  if (t === 'ledger') return openLedgerForm(null);
  if (t === 'media') return openMediaForm(null);
  if (t === 'todo') return openTodoForm(null);
  if (t === 'reminder') return openReminderForm(null);
}
function openNoteForm(type, id) {
  const editing = id ? state.notes.find(n => n.id === id) : null;
  sheetCtx = { kind: 'note', type, id };
  const typeName = (NOTE_TYPES.find(t => t.id === type) || {}).name || '记录';
  openSheet(typeName + (id ? ' · 编辑' : ' · 新增'), noteForm(type, editing));
  if (editing) setTimeout(() => {
    const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; };
    set('n-title', editing.title); set('n-body', editing.body); set('n-place', editing.place); set('n-date', editing.date);
    set('n-ingredients', (editing.ingredients || []).join('\n')); set('n-steps', (editing.steps || []).join('\n')); set('n-tags', (editing.tags || []).join('/'));
    if (editing.mood) document.querySelectorAll('#sheet-body .moodchip').forEach(c => { const on = c.dataset.m === editing.mood; c.classList.toggle('on', on); c.style.background = on ? 'var(--accent)' : ''; c.style.color = on ? '#fff' : ''; });
  }, 0);
}
function openPriceForm(id, presetName) {
  const editing = id ? state.prices.find(p => p.id === id) : null;
  sheetCtx = { kind: 'price', id };
  openSheet('价格' + (id ? ' · 编辑' : ' · 新增'), priceForm(editing));
  if (editing) setTimeout(() => { const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; }; set('p-name', editing.name); set('p-price', editing.price); set('p-date', editing.date); set('p-note', editing.note); const cr = document.getElementById('p-ch-row'); if (cr && editing.store) cr.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c.dataset.ch === editing.store)); }, 0);
  else if (presetName) setTimeout(() => { const el = document.getElementById('p-name'); if (el) el.value = presetName; }, 0);
}
function openLedgerForm(id) {
  const editing = id ? state.ledger.find(l => l.id === id) : null;
  ledFocus = null;
  if (editing) { ledType = editing.type; ledCat = editing.category; ledAcct = editing.account; ledExpr = String(editing.amount); ledChannel = editing.channel || ''; }
  else { ledType = 'out'; ledCat = CATS.out[0][0]; ledAcct = state.accounts[0] && state.accounts[0].id; ledExpr = '0'; ledChannel = ''; }
  sheetCtx = { kind: 'ledger', id };
  openSheet('记账' + (id ? ' · 编辑' : ' · 新增'), ledgerForm());
  if (editing) setTimeout(() => { const d = document.getElementById('l-date'); if (d) d.value = editing.date; const n = document.getElementById('l-note'); if (n) n.value = editing.note || ''; }, 0);
}
function openMediaForm(id) {
  const editing = id ? state.media.find(m => m.id === id) : null;
  if (editing) mediaKind = editing.kind; else mediaKind = 'book';
  sheetCtx = { kind: 'media', id };
  openSheet('媒体' + (id ? ' · 编辑' : ' · 新增'), mediaForm());
  if (editing) setTimeout(() => { const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v; }; set('m-title', editing.title); set('m-total', editing.total || ''); set('m-current', editing.current || ''); const s = document.getElementById('m-status'); if (s) s.value = editing.status; }, 0);
}
function openTodoForm(id) {
  const editing = id ? state.todos.find(x => x.id === id) : null;
  sheetCtx = { kind: 'todo', id };
  openSheet('待办' + (id ? ' · 编辑' : ' · 新增'), todoForm());
  if (editing) setTimeout(() => { const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; }; set('t-title', editing.title); set('t-note', editing.note); set('t-due', editing.due); const r = document.getElementById('t-repeat'); if (r) r.value = editing.repeat; const rm = document.getElementById('t-remind'); if (rm) rm.checked = !!editing.remind; }, 0);
}
function openReminderForm(id) {
  const editing = id ? state.reminders.find(r => r.id === id) : null;
  sheetCtx = { kind: 'reminder', id };
  openSheet('提醒' + (id ? ' · 编辑' : ' · 新增'), reminderForm());
  if (editing) setTimeout(() => {
    const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; };
    set('r-name', editing.name); set('r-time', editing.time); set('r-note', editing.note);
    const rp = document.getElementById('r-repeat'); if (rp) rp.value = editing.repeat;
    if (editing.repeat === 'custom') { const d = document.getElementById('r-days'); if (d) { d.style.display = 'flex'; document.querySelectorAll('#sheet-body .daychip').forEach(c => c.classList.toggle('on', (editing.days || []).includes(+c.dataset.d))); } }
  }, 0);
}
function openAccountForm(id) {
  const editing = id ? state.accounts.find(a => a.id === id) : null;
  sheetCtx = { kind: 'account', id };
  openSheet('账户' + (id ? ' · 编辑' : ' · 新增'), accountForm(editing));
  if (editing) setTimeout(() => { const set = (i, v) => { const el = document.getElementById(i); if (el) el.value = v || ''; }; set('a-name', editing.name); set('a-icon', editing.icon); set('a-bal', editing.balance); const k = document.getElementById('a-kind'); if (k) k.value = editing.kind; }, 0);
}
function openPriceHistory(id) {
  const p = state.prices.find(x => x.id === id); if (!p) return;
  const group = state.prices.filter(x => x.name === p.name).sort((a, b) => a.date.localeCompare(b.date));
  const vals = group.map(x => x.price);
  const first = group[0], last = group[group.length - 1];
  const delta = (last.price - first.price);
  const pct = first.price ? (delta / first.price * 100) : 0;
  const trendCls = delta > 0 ? 'trend-up' : delta < 0 ? 'trend-down' : 'trend-flat';
  const spark = buildSpark(vals);
  const stats = `<div class="ph-grid"><div class="ph-stat"><div class="n">${fmtMoney(first.price)}</div><div class="l">首次 ${first.date}</div></div><div class="ph-stat"><div class="n">${fmtMoney(last.price)}</div><div class="l">最近 ${last.date}</div></div><div class="ph-stat"><div class="n ${trendCls}">${delta > 0 ? '+' : ''}${fmtMoney(delta)}</div><div class="l">${pct > 0 ? '+' : ''}${pct.toFixed(0)}% 涨跌</div></div></div>`;
  const list = group.slice().reverse().map(x => `<div class="item ph-list"><div style="flex:1"><div class="title">${fmtMoney(x.price)} <span class="muted small">· ${x.date}</span></div><div class="sub">${esc(x.store || '')}${x.note ? (' · ' + esc(x.note)) : ''}</div></div><button class="icon-btn del" data-act="ph-del" data-id="${x.id}">✕</button></div>`).join('') || emptyHTML('暂无记录');
  const body = `<p class="muted small" style="margin:0 0 4px">🏷️ <b>${esc(p.name)}</b> · 共 ${group.length} 次记录</p>${spark}${stats}<div style="margin-top:8px">${list}</div><div class="sheet-foot"><button class="btn ghost" data-act="sheet-close">关闭</button><button class="btn primary" data-act="ph-add" data-name="${esc(p.name)}">＋ 添加「${esc(p.name)}」新价</button></div>`;
  openSheet('价格历史', body);
}
function openAccountDetail(id) {
  const a = state.accounts.find(x => x.id === id); if (!a) return;
  sheetCtx = { kind: 'acct-detail', id };
  const list = state.ledger.filter(x => x.account === id).sort((x, y) => y.date.localeCompare(x.date) || y.id.localeCompare(x.id)).slice(0, 40);
  const sum = list.reduce((s, x) => s + (x.type === 'in' ? x.amount : -x.amount), 0);
  const listHTML = list.length ? list.map(x => `<div class="item" data-act="open-led" data-id="${x.id}"><div style="flex:1;min-width:0"><div class="title">${esc(x.category)} <span class="muted small">${x.type === 'in' ? '收入' : '支出'}</span>${x.channel ? ` <span class="kind-badge kind-liab">${esc(x.channel)}</span>` : ''}${x.note ? `<span class="muted small"> · ${esc(x.note)}</span>` : ''}</div><div class="sub">${x.date}</div></div><div class="${x.type === 'in' ? 'pos' : 'neg'}" style="font-weight:700">${x.type === 'in' ? '+' : '-'}${fmtMoney(x.amount)}</div><button class="icon-btn del" data-act="del-acct-led" data-id="${x.id}">✕</button></div>`).join('') : emptyHTML('这个账户还没有流水');
  const body = `<div class="card"><div class="item" style="border:none"><div style="font-size:22px">${a.icon}</div><div style="flex:1"><div class="title">${esc(a.name)}</div><div class="sub">${a.kind === 'liability' ? '欠款' : '余额'} ${fmtMoney(a.balance)} · ${list.length} 笔流水 · 净${sum >= 0 ? '+' : '-'}${fmtMoney(Math.abs(sum))}</div></div><button class="btn ghost" data-act="edit-acct" data-id="${a.id}">编辑</button></div></div>
    <div class="card"><h3>🧾 该账户流水</h3>${listHTML}</div>`;
  openSheet(esc(a.name) + ' · 明细', body);
}
function buildSpark(pts, goodUp) {
  if (pts.length < 2) return '<div class="muted small">至少记录两次，才能看到趋势曲线</div>';
  const w = 300, h = 90, pad = 8;
  const min = Math.min(...pts), max = Math.max(...pts), span = (max - min) || 1;
  const step = (w - 2 * pad) / (pts.length - 1);
  const coords = pts.map((v, i) => [pad + i * step, h - pad - (v - min) / span * (h - 2 * pad)]);
  const path = coords.map((c, i) => (i ? 'L' : 'M') + c[0].toFixed(1) + ' ' + c[1].toFixed(1)).join(' ');
  const up = pts[pts.length - 1] >= pts[0];
  const stroke = (goodUp === up) ? 'var(--green)' : 'var(--red)';
  const f = coords[0], l = coords[coords.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${f[0].toFixed(1)}" cy="${f[1].toFixed(1)}" r="3" fill="${stroke}"/><circle cx="${l[0].toFixed(1)}" cy="${l[1].toFixed(1)}" r="3.5" fill="${stroke}"/></svg>`;
}
function buildDonut(segments) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return '<div class="muted small">本月还没有支出</div>';
  const r = 52, cx = 65, cy = 65, c = 2 * Math.PI * r;
  let off = 0;
  const arcs = segments.map(s => {
    const len = s.value / total * c;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="16" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off += len; return seg;
  }).join('');
  const legend = segments.map(s => `<div class="lg"><span class="sw" style="background:${s.color}"></span>${esc(s.label)} ${Math.round(s.value / total * 100)}%</div>`).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 130 130">${arcs}</svg><div class="donut-legend">${legend}</div></div>`;
}
function buildBudgetCard(monthOut) {
  const budget = state.settings.budget || 0;
  if (budget <= 0) return '';
  const pct = Math.min(100, Math.round(monthOut / budget * 100));
  const over = monthOut > budget;
  const remain = budget - monthOut;
  return `<div class="card"><div class="row between"><h3>🎯 本月预算</h3><span class="muted small">${fmtMoney(monthOut)} / ${fmtMoney(budget)}</span></div>
    <div class="budget-bar" style="margin-top:8px"><i style="width:${pct}%"></i></div>
    <div class="muted small" style="margin-top:6px">${over ? ('已超支 ' + fmtMoney(-remain)) : ('还剩 ' + fmtMoney(remain))}</div></div>`;
}
function catOptions(type) {
  return (CATS[type] || []).map(c => `<option value="${c[0]}">${c[1]} ${c[0]}</option>`).join('');
}
function acctOptions(sel) {
  const list = state.accounts.filter(a => !a.isDebt);
  if (!list.length) return '<option value="">（先去账里加账户）</option>';
  return list.map(a => `<option value="${a.id}" ${a.id === sel ? 'selected' : ''}>${a.icon} ${esc(a.name)}</option>`).join('');
}
/* 主页速记账的记忆默认值：按收/支分别记上次用的分类与账户 */
function qDefault(type) {
  const d = (state.settings.lastLed && state.settings.lastLed[type]) || {};
  const cat = (d.cat && CATS[type] && CATS[type].some(c => c[0] === d.cat)) ? d.cat : (CATS[type] && CATS[type][0] && CATS[type][0][0]) || '';
  const accts = state.accounts.filter(a => !a.isDebt);
  const acct = (d.acct && accts.some(a => a.id === d.acct)) ? d.acct : (accts[0] && accts[0].id) || '';
  return { cat, acct };
}
function qCatChips(type, sel) {
  return (CATS[type] || []).map(c => `<span class="chip ${c[0] === sel ? 'on' : ''}" data-act="q-cat" data-cat="${c[0]}">${c[1]} ${c[0]}</span>`).join('');
}
function qAcctChips(sel) {
  const list = state.accounts.filter(a => !a.isDebt);
  if (!list.length) return '<span class="chip disabled">（先去账里加账户）</span>';
  return list.map(a => `<span class="chip ${a.id === sel ? 'on' : ''}" data-act="q-acct" data-id="${a.id}">${a.icon} ${esc(a.name)}</span>`).join('');
}
function channelChips(sel) {
  return CHANNELS.map(c => `<span class="chip ch-sel ${c === sel ? 'on' : ''}" data-act="ch-sel" data-ch="${c}">${c}</span>`).join('');
}

/* ---------- 保存 ---------- */
function saveNote() {
  const get = i => { const el = document.getElementById(i); return el ? el.value : ''; };
  const data = {
    type: sheetCtx.type, title: get('n-title'), body: get('n-body'), place: get('n-place'), date: get('n-date'),
    ingredients: get('n-ingredients').split('\n').map(s => s.trim()).filter(Boolean),
    steps: get('n-steps').split('\n').map(s => s.trim()).filter(Boolean),
    tags: get('n-tags').split('/').map(s => s.trim()).filter(Boolean),
    updated: todayStr()
  };
  const moodEl = document.querySelector('#sheet-body .moodchip.on');
  data.mood = moodEl ? moodEl.dataset.m : '';
  if (sheetCtx.id) { const n = state.notes.find(x => x.id === sheetCtx.id); if (n) Object.assign(n, data); toast('已保存修改'); }
  else { state.notes.push(Object.assign({ id: uid() }, data)); toast('已保存', data.title); }
  save(); closeSheet(); render();
}
function savePrice() {
  const name = document.getElementById('p-name').value.trim(); if (!name) return toast('请填写商品名');
  const price = parseFloat(document.getElementById('p-price').value); if (!(price >= 0)) return toast('请输入价格');
  const chEl = document.querySelector('#p-ch-row .chip.on');
  const data = { name, price: Math.round(price * 100) / 100, date: document.getElementById('p-date').value || todayStr(), store: chEl ? chEl.dataset.ch : '', note: document.getElementById('p-note').value.trim() };
  if (sheetCtx.id) { const p = state.prices.find(x => x.id === sheetCtx.id); if (p) Object.assign(p, data); toast('已保存修改'); }
  else { state.prices.push(Object.assign({ id: uid() }, data)); toast('已记录价格', name); }
  save(); closeSheet(); render();
}
function showAmt(expr) {
  // 表达式过程（含 +/-）原样显示，让用户看到计算步骤
  if (/[+\-]/.test(expr)) return expr;
  // 纯数字（整数或带小数）一律显示两位小数，贴近钱迹
  if (/^\d+(\.\d+)?$/.test(expr)) return Number(expr).toFixed(2);
  // 输入中途（如刚按下小数点 "12."）保持原样以便继续输入
  return expr;
}
function evalExpr(expr) {
  if (!expr || expr === '0') return 0;
  const m = expr.match(/^(-?\d+(?:\.\d+)?)([+\-])(\d+(?:\.\d+)?)$/);
  if (!m) { const n = parseFloat(expr); return isNaN(n) ? 0 : n; }
  const a = parseFloat(m[1]), b = parseFloat(m[3]), op = m[2];
  return op === '+' ? a + b : a - b;
}
function saveLed(stayOpen) {
  const amt = evalExpr(ledExpr); if (!(amt > 0)) return toast('请输入正确金额');
  if (!ledAcct) return toast('请选择账户');
  const chEl = document.querySelector('#led-ch-row .chip.on');
  const channel = chEl ? chEl.dataset.ch : '';
  const data = { type: ledType, amount: Math.round(amt * 100) / 100, category: ledCat, account: ledAcct, date: document.getElementById('l-date').value || todayStr(), note: document.getElementById('l-note').value.trim(), channel };
  if (sheetCtx.id) {
    const old = state.ledger.find(x => x.id === sheetCtx.id);
    if (old) { const a = acct(old.account); if (a) a.balance -= (old.type === 'in' ? old.amount : -old.amount); }
    Object.assign(old, data);
    const a = acct(ledAcct); if (a) a.balance += (ledType === 'in' ? amt : -amt);
    toast('已保存修改');
  } else {
    state.ledger.push(Object.assign({ id: uid() }, data));
    const a = acct(ledAcct); if (a) a.balance += (ledType === 'in' ? amt : -amt);
    toast('已记录', (ledType === 'in' ? '收入 ' : '支出 ') + fmtMoney(amt));
  }
  recordNet(); save();
  if (stayOpen) {
    const oldDate = document.getElementById('l-date').value;
    sheetCtx = { kind: 'ledger', id: null };
    ledExpr = '0';
    const sb = document.getElementById('sheet-body');
    if (sb) {
      sb.innerHTML = ledgerForm();
      setTimeout(() => { const el = document.getElementById('l-date'); if (el) el.value = oldDate; }, 0);
    }
    toast('继续记下一笔');
  } else {
    closeSheet();
  }
  render();
}
function saveMedia() {
  const title = document.getElementById('m-title').value.trim(); if (!title) return toast('请填写名称');
  const total = parseInt(document.getElementById('m-total').value) || 0;
  const current = Math.min(total, parseInt(document.getElementById('m-current').value) || 0);
  const status = document.getElementById('m-status').value;
  if (sheetCtx.id) { const m = state.media.find(x => x.id === sheetCtx.id); if (m) { m.kind = mediaKind; m.title = title; m.total = total; m.current = current; m.status = status; } toast('已保存修改'); }
  else { state.media.push({ id: uid(), kind: mediaKind, title, total, current, status }); toast('已添加', title); }
  save(); closeSheet(); render();
}
function saveTodo() {
  const title = document.getElementById('t-title').value.trim(); if (!title) return toast('请填写事项');
  const data = { title, note: document.getElementById('t-note').value.trim(), due: document.getElementById('t-due').value || '', repeat: document.getElementById('t-repeat').value, remind: document.getElementById('t-remind').checked, lastReminded: '' };
  if (sheetCtx.id) { const t = state.todos.find(x => x.id === sheetCtx.id); if (t) Object.assign(t, data); toast('已保存修改'); }
  else { state.todos.push(Object.assign({ id: uid(), done: false }, data)); toast('已添加待办', title); }
  save(); closeSheet(); render();
}
function saveRem() {
  const name = document.getElementById('r-name').value.trim(); if (!name) return toast('请填写名称');
  const repeat = document.getElementById('r-repeat').value;
  const days = repeat === 'custom' ? [...document.querySelectorAll('#sheet-body .daychip.on')].map(c => +c.dataset.d) : [];
  const data = { name, time: document.getElementById('r-time').value || '07:00', repeat, days, note: document.getElementById('r-note').value.trim(), enabled: true, lastFired: '' };
  if (sheetCtx.id) { const r = state.reminders.find(x => x.id === sheetCtx.id); if (r) Object.assign(r, data); toast('已保存修改'); }
  else { state.reminders.push(Object.assign({ id: uid() }, data)); toast('已添加提醒', name); }
  save(); closeSheet(); render();
}
function saveHab() {
  const name = document.getElementById('h-name').value.trim(); if (!name) return toast('请填写名称');
  const emoji = document.getElementById('h-emoji').value.trim() || '🌿';
  const note = document.getElementById('h-note').value.trim();
  if (sheetCtx.id) {
    const h = state.habits.find(x => x.id === sheetCtx.id);
    if (h) { h.name = name; h.emoji = emoji; h.note = note; }
    toast('已保存修改');
  } else {
    state.habits.push({ id: uid(), name, emoji, note, records: {} });
    toast('已添加日课', name);
  }
  save(); closeSheet(); render();
}
function saveAcct() {
  const name = document.getElementById('a-name').value.trim(); if (!name) return toast('请填写名称');
  const icon = document.getElementById('a-icon').value.trim() || '💳';
  const bal = parseFloat(document.getElementById('a-bal').value) || 0;
  const kind = document.getElementById('a-kind').value;
  if (sheetCtx.id) { const a = state.accounts.find(x => x.id === sheetCtx.id); if (a) { a.name = name; a.icon = icon; a.kind = kind; a.balance = bal; } toast('已保存修改'); }
  else { state.accounts.push({ id: uid(), name, icon, balance: bal, kind }); if (!ledAcct) ledAcct = state.accounts[0].id; toast('已添加账户', name); }
  recordNet(); save(); closeSheet(); render();
}
function delByType(type, id) {
  let msg = '删除这条记录？', act = null;
  if (NOTE_TYPE_IDS.includes(type)) { msg = '删除这条记录？'; act = () => { state.notes = state.notes.filter(x => x.id !== id); }; }
  else if (type === 'price') { msg = '删除这条价格记录？'; act = () => { state.prices = state.prices.filter(x => x.id !== id); }; }
  else if (type === 'media') { msg = '删除这个？'; act = () => { state.media = state.media.filter(x => x.id !== id); }; }
  else if (type === 'todo') { msg = '删除这个待办？'; act = () => { state.todos = state.todos.filter(x => x.id !== id); }; }
  else if (type === 'reminder') { msg = '删除这个提醒？'; act = () => { state.reminders = state.reminders.filter(x => x.id !== id); }; }
  if (!act) return;
  askConfirm('删除确认', msg, () => { act(); save(); render(); });
}
function delLed(id) {
  askConfirm('删除确认', '删除这笔记录？账户余额会回滚。', () => {
    const x = state.ledger.find(y => y.id === id);
    if (x) { const a = acct(x.account); if (a) a.balance -= (x.type === 'in' ? x.amount : -x.amount); }
    state.ledger = state.ledger.filter(y => y.id !== id); recordNet(); save(); render();
  });
}

/* ================= 引擎 ================= */
function checkReminders() {
  const td = todayStr(), t = nowHM(); let fired = false;
  state.reminders.forEach(r => {
    if (!r.enabled || !shouldFireToday(r) || r.lastFired === td) return;
    if (t >= r.time && t <= addMin(r.time, 30)) { fireNote('⏰ ' + r.name, r.note || '该做这件事啦', r.id); r.lastFired = td; fired = true; }
  });
  if (fired) save();
}
function checkTodos() {
  const td = todayStr(); let fired = false;
  state.todos.forEach(t => {
    if (t.done) return;
    const due = !t.due || t.due <= td;
    const recur = t.repeat && t.repeat !== 'none';
    if (t.remind && due && (recur ? t.lastReminded !== td : (!t.due || (t.due === td && t.lastReminded !== td)))) {
      fireNote('✅ 待办', t.title + (recur ? '（' + REPEAT_LABEL[t.repeat] + '）' : ''), t.id);
      t.lastReminded = td; fired = true;
    }
  });
  if (fired) save();
}
function fireNote(title, sub, tag) {
  toast(title, sub);
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body: sub, tag }); } catch (e) {}
  const ch = document.getElementById('chime'); if (ch) { try { ch.currentTime = 0; ch.play(); } catch (e) {} }
}

/* ================= 主题 ================= */
function effTheme() {
  const t = (state.settings && state.settings.theme) || 'light';
  if (t === 'auto') return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  return t;
}
function applyTheme() { document.documentElement.dataset.theme = effTheme(); }

/* ================= 交互 ================= */
/* ---------- 点击动作查表（替代原巨型 if/else 分发）----------
   加功能 = 往 ACTIONS 里加一行 key→handler，互不干扰、可单测。
   handler 签名：(el, e) => void；el 为最近的 [data-act] 元素。 */
function setMoney(key, val) { state.settings[key] = val; save(); if (!renderPane('money')) render(); }

const ACTIONS = {
  'sheet-close': () => closeSheet(),
  'jump': el => navTo(el.dataset.tab),
  'nav-me': () => navTo('me'),
  'back': () => navTo(prevView),

  'q-type': el => {
    qType = el.dataset.t;
    document.querySelectorAll('[data-act="q-type"]').forEach(c => c.classList.toggle('on', c.dataset.t === qType));
    const d = qDefault(qType);
    const cr = document.getElementById('q-cat-row'); if (cr) cr.innerHTML = qCatChips(qType, d.cat);
    const ar = document.getElementById('q-acct-row'); if (ar) ar.innerHTML = qAcctChips(d.acct);
  },
  'q-cat': el => document.querySelectorAll('#q-cat-row .chip').forEach(c => c.classList.toggle('on', c.dataset.cat === el.dataset.cat)),
  'q-acct': el => document.querySelectorAll('#q-acct-row .chip').forEach(c => c.classList.toggle('on', c.dataset.id === el.dataset.id)),
  'q-led': () => quickLed(),

  'open-habit': () => openHabitForm(null),
  'hab-edit': el => openHabitForm(el.dataset.id),
  'open-acct': () => openAccountForm(null),

  'money-sub': el => setMoney('moneySub', el.dataset.v),
  'money-range': el => setMoney('moneyRange', el.dataset.v),
  'money-prev': () => setMoney('moneyAnchor', shiftAnchor(-1)),
  'money-next': () => setMoney('moneyAnchor', shiftAnchor(1)),

  'open-debt': () => openDebtForm(null),
  'open-debt-edit': el => openDebtForm(el.dataset.id),
  'del-debt': el => { const id = el.dataset.id; askConfirm('删除确认', '删除这笔债务？', () => { state.accounts = state.accounts.filter(a => a.id !== id); save(); render(); }); },
  'open-led': el => openLedgerForm(el.dataset.id),
  'open-acct-edit': el => openAccountDetail(el.dataset.id),
  'edit-acct': el => openAccountForm(el.dataset.id),
  'del-led-form': el => { delLed(el.dataset.id); closeSheet(); },
  'del-acct-led': el => { delLed(el.dataset.id); if (sheetCtx && sheetCtx.kind === 'acct-detail') openAccountDetail(sheetCtx.id); else render(); },
  'ch-sel': el => {
    document.querySelectorAll('#sheet-body .ch-sel').forEach(c => c.classList.toggle('on', c.dataset.ch === el.dataset.ch));
    ledChannel = el.dataset.ch;
    const chip = document.querySelector('#sheet-body .led-quick [data-act="led-focus-channel"]');
    if (chip) chip.textContent = ledChannel;
  },

  'lib-choose': () => {
    const body = CONTENT_TYPES.map(tp => `<div class="item" data-act="lib-add" data-t="${tp.id}" style="cursor:pointer"><span style="font-size:20px">${tp.icon}</span><div style="flex:1"><div class="title">${tp.name}</div></div><span class="muted">＋</span></div>`).join('');
    openSheet('记录什么', body);
  },
  'lib-add': el => openAdd(el.dataset.t),
  'lib-filter': el => { libType = el.dataset.t; if (!renderPane('notes')) render(); },
  'lib-open': el => {
    const type = el.dataset.type, id = el.dataset.id;
    if (type === 'price') return openPriceHistory(id);
    if (NOTE_TYPE_IDS.includes(type)) return openNoteForm(type, id);
    if (type === 'ledger') return openLedgerForm(id);
    if (type === 'media') return openMediaForm(id);
    if (type === 'todo') return openTodoForm(id);
    if (type === 'reminder') return openReminderForm(id);
  },
  'lib-del': el => delByType(el.dataset.type, el.dataset.id),
  'del-note': el => { const id = el.dataset.id; askConfirm('删除确认', '删除这条记录？', () => { state.notes = state.notes.filter(x => x.id !== id); save(); closeSheet(); render(); }); },
  'del-led': el => delLed(el.dataset.id),
  'del-acct': el => { const id = el.dataset.id; askConfirm('删除确认', '删除这个账户？相关账单会保留但不再关联账户。', () => { state.accounts = state.accounts.filter(x => x.id !== id); if (ledAcct === id) ledAcct = state.accounts[0] && state.accounts[0].id; recordNet(); save(); render(); }); },
  'ph-add': el => openPriceForm(null, el.dataset.name),
  'ph-del': el => { const id = el.dataset.id; askConfirm('删除确认', '删除这条价格记录？', () => { state.prices = state.prices.filter(x => x.id !== id); save(); closeSheet(); render(); }); },

  'led-type': el => { ledType = el.dataset.t; ledCat = CATS[ledType][0][0]; if (ledFocus === 'channel') ledFocus = null; rerenderLedgerForm(); },
  'led-cat': el => { ledCat = el.dataset.cat; if (ledFocus === 'channel') ledFocus = null; rerenderLedgerForm(); },
  'led-acct': el => { ledAcct = el.dataset.id; ledFocus = null; rerenderLedgerForm(); },
  'ch-sel': el => { ledChannel = el.dataset.ch; ledFocus = null; rerenderLedgerForm(); },
  'kpad': el => {
    const k = el.dataset.k;
    if (k === 'save') { saveLed(); return; }
    if (k === 'more') { saveLed(true); return; }
    if (k === 'del') { ledExpr = ledExpr.length > 1 ? ledExpr.slice(0, -1) : '0'; }
    else if (k === '+' || k === '-') {
      const last = ledExpr.slice(-1);
      if (last === '+' || last === '-') { ledExpr = ledExpr.slice(0, -1) + k; }
      else if (ledExpr.includes('+') || ledExpr.includes('-')) { ledExpr = String(Math.round(evalExpr(ledExpr) * 100) / 100) + k; }
      else { ledExpr += k; }
    }
    else if (k === '.') {
      const parts = ledExpr.split(/[+\-]/);
      const cur = parts[parts.length - 1];
      if (!cur.includes('.')) ledExpr += '.';
    }
    else if (/^\d$/.test(k)) {
      if (ledExpr === '0') { ledExpr = k; }
      else {
        const parts = ledExpr.split(/[+\-]/);
        const cur = parts[parts.length - 1].replace('.', '');
        if (cur.length < 9) ledExpr += k;
      }
    }
    const d = document.getElementById('l-amt'); if (d) d.textContent = showAmt(ledExpr);
  },
  'led-focus-acct': () => { ledFocus = ledFocus === 'acct' ? null : 'acct'; rerenderLedgerForm(); },
  'led-focus-date': () => { ledFocus = ledFocus === 'date' ? null : 'date'; rerenderLedgerForm(); },
  'led-focus-cat': () => { ledFocus = ledFocus === 'cat' ? null : 'cat'; rerenderLedgerForm(); setTimeout(() => { const el = document.querySelector('#sheet-body .cat-grid'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 0); },
  'led-focus-channel': () => { ledFocus = ledFocus === 'channel' ? null : 'channel'; rerenderLedgerForm(); },
  'media-kind': el => { mediaKind = el.dataset.k; document.querySelectorAll('#sheet-body [data-act="media-kind"]').forEach(c => c.classList.toggle('on', c.dataset.k === mediaKind)); },

  'hc': el => { const hb = state.habits.find(x => x.id === el.dataset.id); if (!hb) return; const td = todayStr(); if (hb.records[td]) delete hb.records[td]; else hb.records[td] = true; save(); render(); },
  'toggle-todo': el => { const t = state.todos.find(x => x.id === el.dataset.id); if (t) { t.done = el.checked; if (t.done) t.lastReminded = ''; save(); render(); } },
  'del-hab': el => { const id = el.dataset.id; askConfirm('删除确认', '删除这个日课？打卡记录也会清空。', () => { state.habits = state.habits.filter(x => x.id !== id); save(); closeSheet(); render(); }); },

  'save-note': () => saveNote(),
  'save-price': () => savePrice(),
  'save-led': () => saveLed(),
  'save-led-more': () => saveLed(true),
  'save-media': () => saveMedia(),
  'save-todo': () => saveTodo(),
  'save-rem': () => saveRem(),
  'save-hab': () => saveHab(),
  'save-acct': () => saveAcct(),
  'save-debt': () => saveDebt(),

  'enable-notif': () => { if (!('Notification' in window)) return toast('当前环境不支持通知'); Notification.requestPermission().then(p => { state.settings.notif = p === 'granted'; save(); renderMe(); toast(p === 'granted' ? '通知已开启' : '未授权', p === 'granted' ? '到点会弹窗提醒' : '可在浏览器设置里开启'); }); },
  'set-theme': el => { state.settings.theme = el.dataset.t; save(); render(); },
  'toggle-theme': () => {
    const cur = effTheme();
    state.settings.theme = cur === 'dark' ? 'light' : 'dark';
    save(); render();
    toast(state.settings.theme === 'dark' ? '已切换夜间模式' : '已切换日间模式', '');
  },
  'export': () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `日课备份_${todayStr()}.json`; a.click(); toast('已导出', '文件已下载到本机'); },
  'export-ob': () => exportObsidian(),
  'clear': () => askConfirm('清空确认', '确定清空全部数据？此操作不可恢复（建议先导出备份）。', () => { state = defaults(); ledAcct = state.accounts[0] && state.accounts[0].id; libType = 'all'; libSearch = ''; save(); applyTheme(); navTo('today'); toast('已清空'); }, '清空'),
};
ACTIONS['hab-del'] = ACTIONS['del-hab']; /* 主页与设置页两处删日课共用同一动作 */

function handleClick(e) {
  /* 弹层里的心情/星期多选：不是 data-act，先单独处理 */
  const mc = e.target.closest('#sheet-body .moodchip');
  if (mc) { document.querySelectorAll('#sheet-body .moodchip').forEach(c => { const on = c === mc; c.classList.toggle('on', on); c.style.background = on ? 'var(--accent)' : ''; c.style.color = on ? '#fff' : ''; }); return; }
  const dc = e.target.closest('#sheet-body .daychip');
  if (dc) { dc.classList.toggle('on'); return; }

  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el, e);
}

/* ---------- Obsidian 导出（日记类型） ---------- */
function exportObsidian() {
  const diaries = state.notes.filter(n => n.type === 'diary');
  if (!diaries.length) return toast('还没有日记可导出');
  const files = diaries.map(n => {
    const safe = (n.title || '日记').replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    const front = `---\ntitle: "${esc(n.title || '日记').replace(/"/g, "'")}"\ndate: ${n.date || ''}\nmood: "${n.mood || ''}"\ntags: [日记, 长期主义]\n---\n\n# ${esc(n.title || '日记')}  ${n.mood || ''}\n\n${esc(n.body || '')}\n`;
    return { name: `${n.date || 'diary'} ${safe}.md`, data: front };
  });
  downloadZip(`日记_Obsidian_${todayStr()}.zip`, files);
  toast('已导出 Obsidian', `${files.length} 篇日记打包下载`);
}

/* ---------- 极简 ZIP（store 无压缩） ---------- */
function downloadZip(filename, files) {
  const enc = new TextEncoder();
  const crcTable = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  const locals = [], centrals = []; let offset = 0;
  files.forEach(f => {
    const nameBuf = enc.encode(f.name), dataBuf = enc.encode(f.data);
    const crc = crc32(dataBuf), size = dataBuf.length;
    const local = new Uint8Array(30 + nameBuf.length + size); const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50); dv.setUint16(4, 20); dv.setUint16(6, 0x0800); dv.setUint16(8, 0); dv.setUint16(10, 0); dv.setUint16(12, 0); dv.setUint32(14, crc); dv.setUint32(18, size); dv.setUint32(22, size); dv.setUint16(26, nameBuf.length); dv.setUint16(28, 0);
    local.set(nameBuf, 30); local.set(dataBuf, 30 + nameBuf.length); locals.push(local);
    const cd = new Uint8Array(46 + nameBuf.length); const cv = new DataView(cd.buffer);
    cv.setUint32(0, 0x02014b50); cv.setUint16(4, 20); cv.setUint16(6, 20); cv.setUint16(8, 0x0800); cv.setUint16(10, 0); cv.setUint16(12, 0); cv.setUint16(14, 0); cv.setUint32(16, crc); cv.setUint32(20, size); cv.setUint32(24, size); cv.setUint16(28, nameBuf.length); cv.setUint16(30, 0); cv.setUint16(32, 0); cv.setUint16(34, 0); cv.setUint16(36, 0); cv.setUint32(38, 0); cv.setUint32(42, offset);
    cd.set(nameBuf, 46); centrals.push(cd); offset += local.length;
  });
  const cdSize = centrals.reduce((s, c) => s + c.length, 0);
  const end = new Uint8Array(22); const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50); ev.setUint16(4, 0); ev.setUint16(6, 0); ev.setUint16(8, files.length); ev.setUint16(10, files.length); ev.setUint32(12, cdSize); ev.setUint32(16, offset); ev.setUint16(20, 0);
  const blob = new Blob([...locals, ...centrals, end], { type: 'application/zip' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

/* ---------- 导入 ---------- */
function doImport(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      const merged = Object.assign(defaults(), d, { settings: Object.assign(defaults().settings, d.settings || {}) });
      merged.prices = Array.isArray(d.prices) ? d.prices : [];
      if (!Array.isArray(merged.netHistory)) merged.netHistory = [];
      if (!Array.isArray(merged.accounts) || !merged.accounts.length) merged.accounts = defaults().accounts;
      merged.accounts.forEach(a => { if (!a.kind) a.kind = 'asset'; if (a.isDebt === undefined) a.isDebt = false; });
      ['notes', 'todos', 'media', 'ledger', 'reminders', 'habits'].forEach(k => { if (!Array.isArray(merged[k])) merged[k] = []; });
      state = merged; save(); applyTheme(); navTo('today'); toast('导入成功', '数据已恢复');
    } catch (err) { toast('导入失败', '文件格式不正确'); }
  };
  r.readAsText(file);
}

/* ---------- Toast ---------- */
function toast(title, sub) {
  const wrap = document.getElementById('toast'); if (!wrap) return;
  const el = document.createElement('div'); el.className = 'toast';
  el.innerHTML = `<div class="t-title">${esc(title)}</div>${sub ? `<div class="t-sub">${esc(sub)}</div>` : ''}`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 3200);
}

/* ---------- 事件绑定 ---------- */
/* 绑在 document 上：顶栏齿轮(在 header 内)、视图、底部弹层 都能被统一派发 */
document.addEventListener('click', handleClick);

/* 确认弹窗按钮（静态元素，只绑一次） */
(function bindConfirm() {
  const no = document.getElementById('confirm-no');
  const yes = document.getElementById('confirm-yes');
  const back = document.getElementById('confirm-back');
  if (no) no.addEventListener('click', closeConfirm);
  if (back) back.addEventListener('click', closeConfirm);
  if (yes) yes.addEventListener('click', () => { const cb = confirmCb; closeConfirm(); if (cb) cb(); });
})();
document.addEventListener('change', handleChange);
document.addEventListener('input', e => {
  if (e.target.id === 'lib-search') {
    libSearch = e.target.value;
    const pos = e.target.selectionStart;
    if (!renderPane('notes')) render();
    const inp = document.getElementById('lib-search');
    if (inp) { inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (_) {} }
  }
});
/* 主页速记账：金额框按回车即记一笔 */
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target && e.target.id === 'q-amt') { e.preventDefault(); quickLed(); }
});

/* 手机：设置页从左边缘右滑返回（与 iOS 一致，单手退出更顺） */
let __edgeX = 0, __edgeY = 0, __edgeT = 0, __edgeOK = false;
document.addEventListener('touchstart', e => {
  const t = e.changedTouches[0];
  __edgeX = t.clientX; __edgeY = t.clientY; __edgeT = Date.now();
  __edgeOK = (__edgeX < 28 && view === 'me');
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!__edgeOK) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - __edgeX, dy = t.clientY - __edgeY, dt = Date.now() - __edgeT;
  if (dx > 60 && Math.abs(dy) < 80 && dt < 600) navTo(prevView);
}, { passive: true });

/* 手机：账 Tab 左右滑动切换子视图（概览←→日历←→统计←→资产） */
const MONEY_SUBS = ['overview', 'calendar', 'stats', 'networth'];
let __sx = 0, __sy = 0, __st = 0, __sOK = false;
document.addEventListener('touchstart', e => {
  const t = e.changedTouches[0];
  __sx = t.clientX; __sy = t.clientY; __st = Date.now();
  __sOK = (view === 'money' && window.innerWidth < 760);
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!__sOK) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - __sx, dy = t.clientY - __sy, dt = Date.now() - __st;
  if (Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.4 && dt < 800) {
    const i = MONEY_SUBS.indexOf(state.settings.moneySub || 'overview');
    let ni = i + (dx < 0 ? 1 : -1);
    ni = Math.max(0, Math.min(MONEY_SUBS.length - 1, ni));
    if (ni !== i) setMoney('moneySub', MONEY_SUBS[ni]);
  }
}, { passive: true });
function handleChange(e) {
  const t = e.target;
  if (t.id === 'importFile') { doImport(t.files[0]); return; }
  if (t.dataset && t.dataset.act === 'set-budget') { state.settings.budget = parseFloat(t.value) || 0; save(); return; }
  if (t.id === 'r-repeat') { const d = document.getElementById('r-days'); if (d) d.style.display = t.value === 'custom' ? 'flex' : 'none'; }
  if (t.id === 'l-date') {
    ledFocus = null;
    rerenderLedgerForm();
  }
}

/* ---------- 启动 ---------- */
try { if (state.settings.theme === 'auto' && window.matchMedia) matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme); } catch (_) {}
navTo('today');
setInterval(() => { checkReminders(); checkTodos(); }, 15000);
checkReminders(); checkTodos();

/* PWA：注册 Service Worker（离线缓存 + 可"添加到主屏幕"）；仅支持的环境才注册，失败静默 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(() => {}); });
}
