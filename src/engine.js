/* ============ 村庄文游 · 引擎层（第一批） ============ */
/* 状态、节点循环、NPC 并行推演（微事件）、互动结算、存读档 */

const SAVE_KEY = 'village_game_save_v1';

let G = null;

/* ---------- 基础工具 ---------- */
const rnd = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function npcDef(id) { return NPCS.find(n => n.id === id); }
function npcName(id) { const d = npcDef(id); return d ? d.name : id; }

/* NPC 当前节点位置（含动态：Jacob 夜宿钟楼、骑士夜在前线） */
function locOf(def, node) {
  let l = def.loc[node];
  if (node >= DAY_NODES && def.id === 'jacob' && G.nightJacobAtTower) l = 'belltower';
  return l;
}

/* ---------- 开新档 ---------- */
function newGame() {
  G = {
    day: 1, node: 0,
    energy: MAX_ENERGY, coins: 20, force: 5,
    bag: { 弓: 1, 箭矢: 10, 生肉: 3, 旧地图: 1, 铜哨: 1 },
    npc: {}, stars: {},
    feed: [], chronicle: [],
    dayLog: [],            // 今天玩家的行动记录
    flowersPickedDay: 0,
    nightJacobAtTower: false,
    stats: { flowers: 0, chats: 0, teases: 0 },
    starTipShown: false,
  };
  for (const n of NPCS) G.npc[n.id] = { f: n.initF, l: 0, p: 0, last: 1, coldPending: false };
  addFeed('major', '你把家安在了村口以北。第一天，从上午开始。');
  genMorning();
  save();
}

/* ---------- 存读档 ---------- */
function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) {} }
function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
function load() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try { G = JSON.parse(raw); return true; } catch (e) { return false; }
}

/* ---------- 播报流 ---------- */
/* html 里 [[id]] 渲染成可点人名。names 用于星标过滤。 */
function resolveNames(text) {
  return text.replace(/\[\[(\w+)\]\]/g, (_, id) =>
    `<span class="nm" data-npc="${id}">${npcName(id)}</span>`);
}
function extractNames(text) {
  const out = [];
  text.replace(/\[\[(\w+)\]\]/g, (_, id) => { out.push(id); return _; });
  return out;
}
function addFeed(type, html, names) {
  G.feed.push({ d: G.day, n: G.node, t: type, html, names: names || extractNames(html) });
  if (G.feed.length > 80) G.feed.splice(0, G.feed.length - 80);
}
function visibleFeed() {
  const starred = Object.keys(G.stars).filter(k => G.stars[k]);
  return G.feed.filter(e =>
    e.t === 'major' || e.t === 'you' || e.t === 'morn' ||
    starred.length === 0 || e.names.some(n => starred.includes(n)));
}

/* ---------- NPC 并行推演（微事件引擎） ---------- */
function npcAt(place, node) {
  return NPCS.filter(n => locOf(n, node) === place).map(n => n.id);
}

function genSimEvents(node) {
  if (node >= DAY_NODES) return;          // 夜间不生成 NPC 街面事件
  const pool = [];
  for (const m of MICRO_EVENTS) {
    if (m.where && npcAt(m.where, node).length === 0) continue;
    const ok = m.need.every(id => locOf(npcDef(id), node) === m.where);
    if (ok) for (const t of m.ev) pool.push(t);
  }
  const count = Math.min(pool.length, 1 + Math.floor(Math.random() * 3)); // 每节点 1-3 条
  const used = new Set();
  for (let i = 0; i < count && pool.length; i++) {
    const t = rnd(pool);
    if (used.has(t) && used.size < pool.length) { i--; continue; }
    used.add(t);
    addFeed('sim', resolveNames(t));
  }
  /* 兜底：共处但没专属事件的二人 */
  if (used.size === 0) {
    const byPlace = {};
    for (const p of ['plaza', 'field', 'bakery', 'library']) {
      const ids = npcAt(p, node);
      if (ids.length >= 2) byPlace[p] = ids;
    }
    const ps = Object.keys(byPlace);
    if (ps.length) {
      const p = rnd(ps), ids = byPlace[p];
      const a = ids[Math.floor(Math.random() * ids.length)];
      let b = a; while (b === a && ids.length > 1) b = rnd(ids);
      const t = rnd(GENERIC_EVENTS).replace(/\[\[a\]\]/g, `[[${a}]]`).replace(/\[\[b\]\]/g, `[[${b}]]`);
      addFeed('sim', resolveNames(t));
    }
  }
}

function genMorning() {
  addFeed('morn', resolveNames(rnd(MORNING_POOL)));
  const kn = G.npc.knight;
  if (kn && kn.l >= 60 && G.stats.flowers > 0) {
    addFeed('sim', resolveNames('[[knight]]胸甲的缝隙里别着一朵花。[[levi]]问起，他说：「她给的。」'));
  }
}

/* ---------- 节点推进 ---------- */
function advanceNode() {
  genSimEvents(G.node);                    // 你行动的这个节点里，村里也动了
  G.node++;
  if (G.node >= 5) { settleDay(); return 'settled'; }
  if (G.node === DAY_NODES) nightfall();
  save();
  return 'ok';
}

function nightfall() {
  G.nightJacobAtTower = Math.random() < 0.25;
  if (G.nightJacobAtTower) {
    addFeed('sim', resolveNames('[[jacob]]修表修过了头，索性睡在钟楼。他说：「齿轮比怪物好懂。」'));
  }
}

function settleDay() {
  /* 结算：编年史 + Asher 夜话 + 入夜杂闻 */
  const ash = rnd(npcDef('asher').night);
  const ev = visibleDayEvents();
  G.chronicle.push({
    day: G.day,
    log: G.dayLog.length ? G.dayLog : ['在村里闲逛了一天。'],
    ash, ev,
  });
  addFeed('morn', ash);
  if (G.chronicle.length > 60) G.chronicle.splice(0, G.chronicle.length - 60);
  G.day++; G.node = 0; G.energy = MAX_ENERGY;
  G.dayLog = []; G.flowersPickedDay = 0; G.nightJacobAtTower = false;
  genMorning();
  save();
}

function visibleDayEvents() {
  return G.feed.filter(e => e.d === G.day && e.t === 'sim').map(e => e.html);
}

/* ---------- 关系 ---------- */
function rel(id, key, delta) {
  const s = G.npc[id];
  s[key] = clamp(s[key] + delta, 0, key === 'f' ? 100 : 100);
}
function loveWord(id) {
  const l = G.npc[id].l;
  if (l < 15) return '普通';
  if (l < 35) return '会多看你一眼';
  if (l < 60) return '目光会追随你';
  if (l < 85) return '心里有人';
  return '满心是你';
}
function friendWord(id) {
  const f = G.npc[id].f;
  if (f < 15) return '点头之交';
  if (f < 35) return '熟人';
  if (f < 60) return '朋友';
  if (f < 85) return '好友';
  return '挚交';
}

/* ---------- 互动结算 ---------- */
/* 返回 {lines:[html], feedType} 供 UI 展示；内部处理节点/精力/关系/应激 */
function canDo(costKey) {
  const c = COST[costKey] || 0;
  if (G.energy < c) return '精力不够了。今天先到这。';
  return null;
}

function knightStressRoll(place, aggressive) {
  if (!PLACES[place] || !PLACES[place].outdoor) return null;
  const k = G.npc.knight;
  const base = aggressive ? 0.9 : 0.08 + k.p * 0.003;   // 攻击户外几乎必触发；打闹随占有欲上升
  if (locOf(npcDef('knight'), G.node) === 'front') return null; // 骑士夜在前线
  if (Math.random() < Math.min(base, 0.95)) {
    return aggressive
      ? '剑尖停在你脖子侧面。[[knight]]说：「再动一下试试。」'
      : '广场那头传来[[knight]]的声音：「住手。」';
  }
  return null;
}

/* 台词池取值：支持平铺数组（旧格式）与分档对象（v2 台词库）
   chat 按友情分档（0-30/30-60/60+），flirt 按爱意分档（低<40/中40-75/高75+）；缺档回退 low */
function poolArr(def, type, st) {
  const p = def[type];
  if (Array.isArray(p)) return p;
  if (p && typeof p === 'object') {
    const v = type === 'flirt' ? st.l : st.f;
    const hi = type === 'flirt' ? 75 : 60, mid = type === 'flirt' ? 40 : 30;
    const t = v >= hi ? 'high' : v >= mid ? 'mid' : 'low';
    const arr = (p[t] && p[t].length) ? p[t] : (p.low && p.low.length ? p.low : (p.mid || p.high || []));
    return Array.isArray(arr) ? arr : [];
  }
  return [];
}

function interact(id, type) {
  const def = npcDef(id), st = G.npc[id];
  const err = canDo(type);
  if (err) return { lines: [err], blocked: true };

  const place = locOf(def, G.node);
  const lines = [];
  const daysSince = G.day - st.last;

  /* 冷落/吃醋前置（闲聊和暧昧时冒头） */
  if ((type === 'chat' || type === 'flirt') && st.coldPending && def.cold.length) {
    lines.push(`<b>${def.name}</b>：「${rnd(def.cold)}」`);
    st.coldPending = false;
  } else if ((type === 'chat' || type === 'flirt') && st.l >= 30 && daysSince >= 4 && def.jealous.length) {
    lines.push(`<b>${def.name}</b>：「${rnd(def.jealous)}」`);
  }

  const pool = poolArr(def, type, st);
  if (!pool.length) return { lines: ['现在不适合。'], blocked: true };
  const line = rnd(pool);
  lines.push(`<b>${def.name}</b>：「${line}」`);

  /* 效果 */
  if (type === 'chat') { rel(id, 'f', 2); G.stats.chats++; if (Math.random() < 0.15 && def.deep.length && st.f >= 40) {
    lines.push(`<b>${def.name}</b>：「${rnd(def.deep)}」`); rel(id, 'f', 1);
  } }
  if (type === 'flirt') { st.f >= 40 ? (rel(id, 'l', 4), rel(id, 'f', 1), rel(id, 'p', 2)) : rel(id, 'l', 1); }
  if (type === 'tease') {
    rel(id, 'f', 2); rel(id, 'l', 1); G.stats.teases++;
    const stress = knightStressRoll(place, false);
    if (stress) {
      lines.push(resolveNames(stress));
      rel('knight', 'f', -2); G.npc.knight.p = clamp(G.npc.knight.p + 1, 0, 100);
      addFeed('sim', resolveNames(`[[knight]]在广场拦下了你和${def.name}的打闹。`));
    }
  }
  if (type === 'hit') {
    rel(id, 'f', -15); st.hitOnce = true;
    lines.push(`你动手了。`);
    const stress = knightStressRoll(place, true);
    if (stress) {
      lines.push(resolveNames(stress));
      rel('knight', 'f', -10);
      addFeed('major', resolveNames(`你在${PLACES[place].name}动手打了${def.name}。[[knight]]的剑出了鞘。`));
    } else {
      addFeed('sim', resolveNames(`你动了手。${def.name}没有声张。`), [id]);
    }
  }

  /* Asher 拆散：你对骑士亲密，且 Asher 同场或在家里 */
  if (id === 'knight' && (type === 'flirt' || type === 'flower') && G.npc.knight.l >= 25 && Math.random() < 0.3) {
    const ashHere = locOf(npcDef('asher'), G.node) === place;
    if (ashHere || G.node >= DAY_NODES) {
      lines.push(`<b>Asher</b>：「Levi 找你搬东西。现在就要。」<span class="dim">他盯着骑士看，不等回答。</span>`);
      rel('asher', 'p', 2);
    }
  }

  st.last = G.day;
  G.energy -= COST[type]; G.dayLog.push(`跟${def.name}${actName(type)}`);
  const adv = advanceNode();
  return { lines, settled: adv === 'settled' };
}

function actName(t) {
  return { chat: '聊了聊', deep: '深聊', flirt: '说了些暧昧话', tease: '打闹', hit: '动了手', trade: '做了笔交易', flower: '送了花' }[t] || t;
}

/* ---------- 骑士：送花 ---------- */
function giveFlower() {
  const err = canDo('flower');
  if (err) return { lines: [err], blocked: true };
  if ((G.bag.花 || 0) < 1) return { lines: ['手里没有花。广场边可以摘。'], blocked: true };
  G.bag.花--;
  const kn = G.npc.knight, def = npcDef('knight');
  const l = kn.l;
  const line = l >= 60 ? '「胸甲这里还有位置。下一朵留着。」' : l >= 30 ? '「又是花。你都送了几次了。我数着。」' : '「花。谢谢。为什么给我。」';
  G.stats.flowers++;
  rel('knight', 'l', 3); rel('knight', 'f', 1); rel('knight', 'p', 1);
  kn.last = G.day;
  const lines = [`你把花递给骑士。`, `<b>骑士</b>：${line}`];
  if (l >= 60) lines.push(resolveNames('第二天早上，[[knight]]胸甲的缝隙里别着那朵花。'));
  G.energy -= COST.flower; G.dayLog.push('给骑士送了花');
  const adv = advanceNode();
  return { lines, settled: adv === 'settled' };
}

/* ---------- 场所行动 ---------- */
function doPlaceAction(place, act) {
  if (act === 'pickflower') {
    if (G.flowersPickedDay >= 2) return { lines: ['今天的野花摘够了，明天再来。'], blocked: true };
    const err = canDo('pickflower'); if (err) return { lines: [err], blocked: true };
    G.bag.花 = (G.bag.花 || 0) + 1; G.flowersPickedDay++;
    G.energy -= COST.pickflower; G.dayLog.push('在广场边摘了花');
    return { lines: ['你摘了一朵野花。'], settled: advanceNode() === 'settled' };
  }
  if (act === 'water') {
    G.bag.水 = (G.bag.水 || 0) + 1;
    G.dayLog.push('打了水');
    return { lines: ['你打了一桶水。不费什么力气。'], settled: advanceNode() === 'settled' };
  }
  if (act === 'pray') {
    const err = canDo('pray'); if (err) return { lines: [err], blocked: true };
    rel('vivienne', 'f', 1);
    G.energy -= COST.pray; G.dayLog.push('在教堂祈祷');
    const l = G.npc.vivienne.f >= 40
      ? '「今天为你多念一段。」'
      : '「天主保佑。去忙吧。」';
    return { lines: ['你在教堂坐了一会儿。', `<b>Vivienne</b>：${l}`], settled: advanceNode() === 'settled' };
  }
  if (act === 'study') {
    const err = canDo('study'); if (err) return { lines: [err], blocked: true };
    G.force++; rel('leo', 'f', 1);
    G.energy -= COST.study; G.dayLog.push('在图书馆学习');
    const l = rnd(['「看完了就放回去。」', '「坐里面。里面亮。」', '「这本不适合你。换那本。」']);
    return { lines: [`你看了一上午书。武力 +1（现在 ${G.force}）`, `<b>Leo</b>：${l}`], settled: advanceNode() === 'settled' };
  }
  return { lines: ['（这个动作还没实装）'], blocked: true };
}

/* ---------- 交易 ---------- */
function tradeBuy(id, item, price) {
  if (G.coins < price) return { lines: ['钱不够。'], blocked: true };
  const err = canDo('trade'); if (err) return { lines: [err], blocked: true };
  G.coins -= price;
  G.bag[item] = (G.bag[item] || 0) + (item === '箭矢' ? 5 : 1);
  const def = npcDef(id); rel(id, 'f', 1);
  G.energy -= COST.trade; G.dayLog.push(`从${def.name}那买了${item}`);
  const l = def.easy ? '「拿好。」' : def.hard ? '「钱货两清。」' : '「还要别的吗。」';
  return { lines: [`买到了${item}${item === '箭矢' ? '×5' : ''}（−${price} 安娜币）`, `<b>${def.name}</b>：${l}`], settled: advanceNode() === 'settled' };
}
function tradeSell(id, item, price) {
  if ((G.bag[item] || 0) < 1) return { lines: ['你没有这个。'], blocked: true };
  const err = canDo('trade'); if (err) return { lines: [err], blocked: true };
  G.bag[item]--; if (G.bag[item] <= 0) delete G.bag[item];
  const def = npcDef(id);
  let p = price;
  if (G.npc[id].f >= 60) { p = Math.ceil(price * 1.2); }
  G.coins += p; rel(id, 'f', 1);
  G.energy -= COST.trade; G.dayLog.push(`卖给了${def.name}${item}`);
  const l = G.npc[id].f >= 60 ? '「给你的价，别跟人说。」' : def.easy ? '「下次还拿来。」' : '「嗯。」';
  return { lines: [`卖出了${item}（+${p} 安娜币${p > price ? '，熟人价' : ''}）`, `<b>${def.name}</b>：${l}`], settled: advanceNode() === 'settled' };
}

/* ---------- 冷落计时（每天结算时检查） ---------- */
/* 在 settleDay 里调用于 day++ 之前的数据更新 */
function coldCheck() {
  for (const n of NPCS) {
    const st = G.npc[n.id];
    if (st.f > 20 && G.day - st.last > 6) st.coldPending = true;
  }
}

/* settleDay 包装：先冷落检查再结算 */
const _settleDay = settleDay;
settleDay = function () { coldCheck(); _settleDay(); };

/* ---------- 家：休息/午休 ---------- */
function restNow() {
  const adv = settleDay();
  return { settled: true };
}
function nap() {
  if (G.node !== 1) return { lines: ['只有中午能午休。'], blocked: true };
  if (G.energy >= MAX_ENERGY) return { lines: ['精力是满的。'], blocked: true };
  G.energy = Math.min(MAX_ENERGY, G.energy + 5);
  G.dayLog.push('午休了一会儿');
  return { lines: [`你睡了半个中午。精力 +5（现在 ${G.energy}）。`], settled: advanceNode() === 'settled' };
}
