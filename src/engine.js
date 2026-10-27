/* ============ 村庄文游 · 引擎层（第一批） ============ */
/* 状态、节点循环、NPC 并行推演（微事件）、互动结算、存读档 */

const SAVE_KEY = 'village_game_save_v1';

let G = null;

/* ---------- 基础工具 ---------- */
const rnd = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function npcDef(id) { return NPCS.find(n => n.id === id); }
function npcName(id) { const d = npcDef(id); return d ? d.name : id; }

/* ---------- 伤势（§11：完好→轻伤→重伤） ---------- */
function hurtWord() { return G.hurt === 2 ? '重伤' : G.hurt === 1 ? '轻伤' : '完好'; }
function maxE() { return MAX_ENERGY - (G.hurt === 2 ? 8 : G.hurt === 1 ? 3 : 0); }

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
    hurt: 0,               // 伤势：0完好 1轻伤 2重伤
    loveTouch: [],         // 今日亲密对象（暧昧/寻欢），每晚占有欲结算用
    nightHunted: false,    // （夜间出门已删 2026-10-27，字段留作旧档兼容，恒 false）
    helpedKnight: false,   // （钟楼夜射已删 2026-10-27，字段留作旧档兼容，恒 false）
    knight: { cond: 100, streak: 0, best: 0, gyUsed: 0, repairedToday: false, core: false, doomEnd: 0, duelFlag: false },
    stats: { flowers: 0, chats: 0, teases: 0, hunts: 0, kills: 0, gy: 0 },
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
  try {
    G = JSON.parse(raw);
    /* 批二字段迁移（旧档兜底） */
    G.hurt = G.hurt || 0;
    G.stats = G.stats || {};
    G.stats.hunts = G.stats.hunts || 0;
    G.stats.kills = G.stats.kills || 0;
    G.stats.gy = G.stats.gy || 0;
    G.knight = Object.assign({ cond: 100, streak: 0, best: 0, gyUsed: 0, repairedToday: false, core: false, doomEnd: 0, duelFlag: false }, G.knight || {});
    G.nightHunted = !!G.nightHunted;
    G.helpedKnight = !!G.helpedKnight;
    G.loveTouch = Array.isArray(G.loveTouch) ? G.loveTouch : [];
    /* 批四字段迁移：寻欢记忆 flag + 每日一次尝试锁 */
    for (const k in G.npc) {
      G.npc[k].funOnce = !!G.npc[k].funOnce;
      G.npc[k].funDay = G.npc[k].funDay || 0;
    }
    G.duel = null;                                      // 残局清理：决斗弹窗不做恢复
    if (G.over) G.over = { t: G.over.t, day: G.over.day, v: G.over.v || '' };
    return true;
  } catch (e) { return false; }
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
function addFeed(type, text, names) {
  const html = resolveNames(text);
  G.feed.push({ d: G.day, n: G.node, t: type, html, names: names || extractNames(text) });
  if (G.feed.length > 80) G.feed.splice(0, G.feed.length - 80);
}
function visibleFeed() {
  const starred = Object.keys(G.stars).filter(k => G.stars[k]);
  return G.feed.filter(e =>
    e.t === 'major' || e.t === 'you' || e.t === 'morn' ||
    starred.length === 0 || e.names.some(n => starred.includes(n)));
}

/* 你的行动进播报：极简事件句（§8.6），[[id]] 替换成互动对象 */
function youFeed(key, m) {
  const pool = YOU_FEED[key];
  if (!pool || !pool.length) return;
  let t = rnd(pool);
  if (m) {
    if (m.id) t = t.split('[[id]]').join(`[[${m.id}]]`);
    if (m.place) t = t.split('{place}').join(m.place);
    if (m.item) t = t.split('{item}').join(m.item);
  }
  addFeed('you', t);
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
    addFeed('sim', t);
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
      addFeed('sim', t);
    }
  }
}

function genMorning() {
  addFeed('morn', rnd(MORNING_POOL));
  const kn = G.npc.knight;
  if (kn && kn.l >= 60 && G.stats.flowers > 0) {
    addFeed('sim', '[[knight]]胸甲的缝隙里别着一朵花。[[levi]]问起，他说：「她给的。」');
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
    addFeed('sim', '[[jacob]]修表修过了头，索性睡在钟楼。他说：「齿轮比怪物好懂。」');
  }
}

/* ---------- 占有欲通用引擎 + Vivienne 活报纸（拍板 2026-10-15#5 / 2026-10-16#15·修订 2026-10-26） ---------- */
/* 今日亲密对象记录（暧昧/寻欢），供每晚占有欲结算 */
function touchLog(id) {
  G.loveTouch = G.loveTouch || [];
  if (!G.loveTouch.includes(id)) G.loveTouch.push(id);
}

/* 每晚结算：竞争涨/爱高盯紧涨/冷落降/爱褪阴干，乘性格系数；骑士 p=痛苦度（只积累，表现走台词线） */
function possessTick() {
  const touched = G.loveTouch || [];
  let competitors = 0;
  for (const n of NPCS) if (G.npc[n.id].l >= 30) competitors++;
  for (const n of NPCS) {
    const st = G.npc[n.id];
    if (st.l < 30) { st.p = Math.max(0, st.p - 1); continue; }            // 爱意掉出 30，占有欲阴干
    if (G.day - st.last >= 3) { st.p = Math.max(0, st.p - 1); continue; }  // 冷落降
    if (touched.includes(n.id)) continue;                                  // 今天亲近的是TA，安心不涨
    let d = 0;
    if (touched.length) d += 1 + Math.floor(Math.random() * 2);            // 有人跟你亲密了（竞争）
    if (st.l >= 60 && competitors >= 3) d += 1;                            // 爱高+村里竞争者多，盯得更紧
    if (d) st.p = clamp(st.p + Math.round(d * (P_RATE[n.id] || 1)), 0, 100);
  }
  G.loveTouch = [];
}

/* Vivienne 活报纸：昨日真事经她的嘴免费说出；力度按她的爱意分档（不熟只报村闻，爱高全知含私密） */
function vivienneNews() {
  const v = G.npc.vivienne;
  const y = G.chronicle[G.chronicle.length - 1];
  if (!y) return;
  const isPriv = t => /过了今晚|夜猎守村|做了修补/.test(t);
  const priv = y.log.filter(isPriv);
  const acts = y.log.filter(t => !isPriv(t));
  const sims = G.feed.filter(e => e.t === 'sim' && e.d === y.day);
  const send = (kind, fact, names) => {
    const pool = VIV_NEWS[kind];
    /* 台词池待生产线生成；空=回退系统过渡句（占位，2026-10-26） */
    const frame = pool.length
      ? `[[vivienne]]：「${rnd(pool).split('{x}').join(fact)}」`
      : { village: '晨祷后，[[vivienne]]把村里的事说给你听：', act: '[[vivienne]]提起你昨天做的事：', private: '[[vivienne]]凑近了些，说破你昨晚的事：' }[kind] + fact;
    addFeed('morn', frame, names);
  };
  if (v.l >= 60) {                                   /* 全知：私密优先，再带一条村闻 */
    if (priv.length) send('private', rnd(priv));
    if (sims.length) { const e = rnd(sims); send('village', e.html, e.names); }
  } else if (v.l >= 30) {                            /* 行踪档：你的公开行动优先 */
    if (acts.length && Math.random() < 0.6) send('act', rnd(acts));
    else if (sims.length) { const e = rnd(sims); send('village', e.html, e.names); }
  } else if (sims.length && Math.random() < 0.7) {   /* 村闻档：牧师本来就知道的公开事 */
    const e = rnd(sims); send('village', e.html, e.names);
  }
}

/* Vivienne 占有欲链：带刺 p30+ / 上门 p50+ / 公开宣示 p70+；台词池空=不触发（引擎先上线，词后补即活） */
function vivienneChain() {
  const v = G.npc.vivienne;
  if (v.l < 30 || Math.random() >= 0.3) return;
  if (v.p >= 70 && VIV_CHAIN.claim.length) addFeed('sim', `[[vivienne]]当众揽住了你的肩：「${rnd(VIV_CHAIN.claim)}」`, ['vivienne']);
  else if (v.p >= 50 && VIV_CHAIN.visit.length) addFeed('sim', `夜里有人敲你的门。[[vivienne]]：「${rnd(VIV_CHAIN.visit)}」`, ['vivienne']);
  else if (v.p >= 30 && VIV_CHAIN.sting.length) addFeed('morn', `[[vivienne]]：「${rnd(VIV_CHAIN.sting)}」`, ['vivienne']);
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
  vivienneNews();                       /* 活报纸：昨日真事经她的嘴说出（此时 chronicle 末条=昨天，nightHunted 仍是昨日值） */
  if (G.hurt === 1 && Math.random() < 0.5) { G.hurt = 0; addFeed('morn', '睡了一夜，你的伤好利索了。'); }
  G.day++; G.node = 0; G.energy = maxE();
  G.dayLog = []; G.flowersPickedDay = 0; G.nightJacobAtTower = false;
  genMorning();
  knightWear();
  possessTick();                        /* 占有欲每晚结算 */
  vivienneChain();                      /* Vivienne 占有欲链（池空不触发） */
  G.nightHunted = false;
  G.helpedKnight = false;
  save();
}

/* ---------- 结局 ---------- */
function endGame(t) {
  if (G.over) return;
  G.over = { t, day: G.day, v: '' };
  save();
}
/* E3 反杀变体：爱高优先，其次占有欲高，默认全力应战 */
function e3Variant() {
  const k = G.npc.knight;
  if (k.l >= 50) return 'love';
  if (k.p >= 60) return 'poss';
  return 'friend';
}

/* ---------- 骑士：夜战磨损 + 终末之月（批三） ---------- */
function knightCondWord() {
  const c = G.knight.cond;
  return KNIGHT_COND.find(([t]) => c >= t) || KNIGHT_COND[KNIGHT_COND.length - 1];
}

/* 终末之月的一晚：他不再出战；没人守村就被迫出手，加速凋零 */
function doomNight(kn) {
  const decay = 3 + (G.nightHunted ? 0 : 8);
  kn.cond -= decay;
  addFeed('major', rnd(G.nightHunted ? DOOM_TEXT.safe : DOOM_TEXT.forced));
  /* 好感已死 + 对峙已发生：他拒绝修补，提前凋零（E2c） */
  const k = G.npc.knight;
  if (kn.duelFlag && k.f + k.l < 20) { endGame('E2c'); return; }
  if (kn.cond <= 0) { endGame('E1'); return; }
  /* 第 30 天黎明：结算 */
  if (G.day >= kn.doomEnd) {
    if (k.f >= 60 && k.l >= 60 && kn.streak >= 30 && G.stats.gy >= 40) endGame('E2b');
    else endGame('E2a');
  }
}

/* 每晚两波怪，各 40% 磨 2-5 点；约 4% 的夜晚有怪物潮（20-35） */
function knightWear() {
  const kn = G.knight;
  if (kn.repairedToday) { kn.streak++; kn.best = Math.max(kn.best, kn.streak); }
  else kn.streak = 0;
  kn.repairedToday = false;

  if (kn.core) { doomNight(kn); return; }   // 终末之月：不再出战，只衰减

  let dmg = 0;
  const tide = Math.random() < 0.04;
  if (tide) dmg += 20 + Math.floor(Math.random() * 16);
  for (let w = 0; w < 2; w++) if (Math.random() < 0.4) dmg += 2 + Math.floor(Math.random() * 4);
  if (G.helpedKnight) dmg = Math.floor(dmg / 2);     // 钟楼的箭替他分掉一波怪
  if (dmg > 0) {
    kn.cond -= dmg;
    if (tide) addFeed('major', rnd(TIDE_TEXT));
    else {
      const heavy = dmg >= 6 || kn.cond < 35;
      addFeed(heavy ? 'major' : 'sim', rnd(heavy ? KNIGHT_WEAR_HEAVY : KNIGHT_WEAR_LIGHT));
    }
  }
  /* 核心受损：进入终末之月，30 天为限 */
  if (kn.cond <= 0) {
    kn.core = true;
    kn.cond = 30;                       // 吊命线
    kn.doomEnd = G.day + 30;
    addFeed('major', rnd(DOOM_TEXT.start));
    addFeed('sim', resolveNames('[[knight]]说：「三十天后，皇帝的信使到。新的人会来。」'));
  }
}

/* ---------- 骑士：修补（黄金玉×1·精力2） ---------- */
function repairKnight() {
  const kn = G.knight;
  if (G.node >= DAY_NODES) return { lines: [kn.core ? '夜里他不让你碰那道缝。「天亮。」' : '夜里他在前线。等天亮。'], blocked: true };
  const cap = kn.core ? 50 : 100;                       // 终末之月：半死之躯修不满
  if (!kn.core && kn.cond >= 100) return { lines: ['他浑身完好，没有要补的地方。'], blocked: true };
  if (kn.repairedToday) return { lines: ['今天补过了。金粉要吃进瓷里才作数，急不来。'], blocked: true };
  if ((G.bag.黄金玉 || 0) < 1) return { lines: ['手里没有黄金玉。矿洞深处才有。'], blocked: true };
  const err = canDo('repair');
  if (err) return { lines: [err], blocked: true };
  G.bag.黄金玉--; if (G.bag.黄金玉 <= 0) delete G.bag.黄金玉;
  kn.cond = Math.min(cap, kn.cond + 35);
  kn.gyUsed++; kn.repairedToday = true;
  rel('knight', 'f', 2); rel('knight', 'l', 2); rel('knight', 'p', 1);
  const tier = G.npc.knight.l >= 40 ? KNIGHT_REPAIR.high : KNIGHT_REPAIR.low;
  const lines = [
    '你把黄金玉碾成粉，调了水，一点一点按进裂缝。',
    `<b>骑士</b>：「${rnd(tier)}」`,
  ];
  if (!kn.core && kn.cond >= 100) lines.push('瓷面上再看不到缝。他抬了抬右臂，关节里没有声音了。');
  if (kn.core) lines.push('裂缝合上了大半。剩下的缝，不够今天的金粉填。');
  addFeed('you', '你用金粉补上了[[knight]]的裂缝。', ['knight']);
  G.energy -= COST.repair + (G.hurt === 2 ? 1 : 0);
  G.dayLog.push('给骑士做了修补');
  const adv = advanceNode();
  return { lines, settled: adv === 'settled' };
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
  const c = (COST[costKey] || 0) + (G.hurt === 2 ? 1 : 0);   // 重伤所有行动 +1 耗
  if (G.energy < c) return '精力不够了。今天先到这。';
  return null;
}

function knightStressRoll(place, aggressive) {
  if (!PLACES[place] || !PLACES[place].outdoor) return null;
  const k = G.npc.knight;
  const base = aggressive ? 0.9 : 0.08;   // 攻击户外几乎必触发；打闹小概率被拦（与占有欲无关·2026-10-26 言修订）
  if (locOf(npcDef('knight'), G.node) === 'front') return null; // 骑士夜在前线
  if (Math.random() < Math.min(base, 0.95)) {
    return aggressive ? 'stress' : '广场那头传来[[knight]]的声音：「住手。」';
  }
  return null;
}

/* 台词池取值：支持平铺数组（旧格式）与分档对象（v2 台词库）
   chat 按友情分档（0-30/30-60/60+），flirt 按爱意分档（低<40/中40-75/高75+）；缺档回退 low */
/* 寻欢台词池归一：Vivienne/Levi 主池 joy*；骑士 after.fun*；Lee 恢复后台 after（记忆线批四后段再开） */
function funPools(def, st) {
  if (!def) return null;
  if (def.id === 'lee' && !(st && st.restored)) return null;
  const a = def.after || {};
  const inv = def.joyInvite || a.funInv || [], yes = def.joyAccept || a.funYes || [],
        no = def.joyRefuse || a.funNo || [], night = def.joyNight || a.funNight || [],
        morn = def.joyFeed || a.funMorn || [], real = def.afterReal || a.loverSneak || [];
  if (!yes.length || !night.length) return null;
  return { inv, yes, no, night, morn, real };
}

function poolArr(def, type, st) {
  const p = def[type];
  let arr = [];
  if (Array.isArray(p)) arr = p;
  else if (p && typeof p === 'object') {
    const v = type === 'flirt' ? st.l : st.f;
    const hi = type === 'flirt' ? 75 : 60, mid = type === 'flirt' ? 40 : 30;
    const t = v >= hi ? 'high' : v >= mid ? 'mid' : 'low';
    const a = (p[t] && p[t].length) ? p[t] : (p.low && p.low.length ? p.low : (p.mid || p.high || []));
    arr = Array.isArray(a) ? a : [];
  }
  /* 有实后日常混入闲聊池（§8 寻欢：永久切换版；吃醋升级版台词待台词库补） */
  if (type === 'chat' && st && st.funOnce) {
    const fp = funPools(def, st);
    if (fp && fp.real.length) arr = arr.concat(fp.real);
  }
  return arr;
}

/* 寻欢（§8 双轨·偷尝轨）：夜间发起，掷接受率；接受=今晚在这过（直接结算到天亮） */
function doFun(id) {
  const def = npcDef(id), st = G.npc[id], fp = funPools(def, st);
  if (!fp) return { lines: ['现在不适合。'], blocked: true };
  if (st.l < 50) return { lines: ['还不到那一步。'], blocked: true };
  if (G.node < DAY_NODES) return { lines: ['白天各忙各的。这种事，夜里再说。'], blocked: true };
  if (st.funDay === G.day) return { lines: ['今天不用再开口了。'], blocked: true };
  const err = canDo('fun');
  if (err) return { lines: [err], blocked: true };
  st.funDay = G.day;
  /* 接受率：爱情越深越难拒，有过之后不再生分 */
  const rate = clamp(0.5 + st.l * 0.005 + (st.funOnce ? 0.15 : 0), 0, 1);
  if (Math.random() > rate) {
    st.last = G.day;
    return { lines: ['你开口了。', `<b>${def.name}</b>：「${rnd(fp.no)}」`] };
  }
  st.funOnce = true;
  rel(id, 'l', 3 + Math.floor(Math.random() * 3));
  rel(id, 'p', 5 + Math.floor(Math.random() * 4));
  touchLog(id);
  G.energy -= (COST.fun + (G.hurt === 2 ? 1 : 0));
  G.stats.fun = (G.stats.fun || 0) + 1;
  G.dayLog.push(`跟${def.name}过了今晚`);
  st.last = G.day;
  const lines = [
    `<b>${def.name}</b>：「${rnd(fp.inv.concat(fp.yes))}」`,
    `<b>${def.name}</b>：「${rnd(fp.night)}」`,
    '天亮了。',
  ];
  settleDay();
  if (fp.morn.length) addFeed('morn', rnd(fp.morn));
  return { lines, settled: true };
}

function interact(id, type) {
  if (type === 'fun') return doFun(id);
  const def = npcDef(id), st = G.npc[id];
  const err = canDo(type);
  if (err) return { lines: [err], blocked: true };

  /* 攻击骑士本人 = 直接对峙（§6.3 骑士战） */
  if (type === 'hit' && id === 'knight') { startDuel('knightHit'); return { duel: true }; }

  const place = locOf(def, G.node);
  const lines = [];
  const daysSince = G.day - st.last;

  /* 冷落/吃醋前置（闲聊和暧昧时冒头）；吃醋间隔随占有欲缩短 */
  const jgap = st.p >= 70 ? 2 : st.p >= 40 ? 3 : 4;
  if ((type === 'chat' || type === 'flirt') && st.coldPending && def.cold.length) {
    lines.push(`<b>${def.name}</b>：「${rnd(def.cold)}」`);
    st.coldPending = false;
  } else if ((type === 'chat' || type === 'flirt') && st.l >= 30 && daysSince >= jgap && def.jealous.length) {
    lines.push(`<b>${def.name}</b>：「${rnd(def.jealous)}」`);
  }

  const pool = poolArr(def, type, st);
  if (!pool.length) return { lines: ['现在不适合。'], blocked: true };
  const line = rnd(pool);
  lines.push(`<b>${def.name}</b>：「${line}」`);

  /* 效果 */
  const pname = (PLACES[place] || {}).name || '前线';
  if (type === 'chat') { rel(id, 'f', 2); G.stats.chats++; youFeed('chat', { id, place: pname }); if (Math.random() < 0.15 && def.deep.length && st.f >= 40) {
    lines.push(`<b>${def.name}</b>：「${rnd(def.deep)}」`); rel(id, 'f', 1);
  } }
  if (type === 'flirt') { st.f >= 40 ? (rel(id, 'l', 4), rel(id, 'f', 1), rel(id, 'p', 2)) : rel(id, 'l', 1); youFeed('flirt', { id }); touchLog(id); }
  if (type === 'tease') {
    rel(id, 'f', 2); rel(id, 'l', 1); G.stats.teases++; youFeed('tease', { id, place: pname });
    const stress = knightStressRoll(place, false);
    if (stress) {
      lines.push(resolveNames(stress));
      rel('knight', 'f', -2); G.npc.knight.p = clamp(G.npc.knight.p + 1, 0, 100);
      addFeed('sim', `[[knight]]在广场拦下了你和${def.name}的打闹。`);
    }
  }
  if (type === 'hit') {
    rel(id, 'f', -15); st.hitOnce = true;
    lines.push(`你动手了。`);
    const stress = knightStressRoll(place, true);
    if (stress) {
      /* 误判只源于护村设定：他看见你真伤村民，认定你是威胁，剑指（骑士战）——与占有欲无关（言修订 2026-10-26） */
      startDuel('npcHit');
      return { duel: true };
    } else {
      addFeed('sim', `你动了手。${def.name}没有声张。`, [id]);
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
  /* 送花反应读台词池 flower 三档（爱≥60高/≥30中/其余低）；旧硬编码仅作无池回退 */
  const fp = def.flower || {};
  const ftier = l >= 60 ? 'high' : l >= 30 ? 'mid' : 'low';
  const farr = (fp[ftier] && fp[ftier].length) ? fp[ftier] : (fp.low && fp.low.length ? fp.low : null);
  const line = farr ? `「${rnd(farr)}」` : (l >= 60 ? '「胸甲这里还有位置。下一朵留着。」' : l >= 30 ? '「又是花。你都送了几次了。我数着。」' : '「花。谢谢。为什么给我。」');
  G.stats.flowers++;
  rel('knight', 'l', 3); rel('knight', 'f', 1); rel('knight', 'p', 1);
  kn.last = G.day;
  const lines = [`你把花递给骑士。`, `<b>骑士</b>：${line}`];
  if (l >= 60) lines.push(resolveNames('第二天早上，[[knight]]胸甲的缝隙里别着那朵花。'));
  youFeed('flower');
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
    youFeed('pickflower');
    return { lines: ['你摘了一朵野花。'], settled: advanceNode() === 'settled' };
  }
  if (act === 'water') {
    G.bag.水 = (G.bag.水 || 0) + 1;
    G.dayLog.push('打了水');
    youFeed('water');
    return { lines: ['你打了一桶水。不费什么力气。'], settled: advanceNode() === 'settled' };
  }
  if (act === 'pray') {
    const err = canDo('pray'); if (err) return { lines: [err], blocked: true };
    rel('vivienne', 'f', 1);
    G.energy -= COST.pray; G.dayLog.push('在教堂祈祷');
    youFeed('pray');
    const l = G.npc.vivienne.f >= 40
      ? '「今天为你多念一段。」'
      : '「天主保佑。去忙吧。」';
    return { lines: ['你在教堂坐了一会儿。', `<b>Vivienne</b>：${l}`], settled: advanceNode() === 'settled' };
  }
  if (act === 'study') {
    const err = canDo('study'); if (err) return { lines: [err], blocked: true };
    G.force++; rel('leo', 'f', 1);
    G.energy -= COST.study; G.dayLog.push('在图书馆学习');
    youFeed('study');
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
  youFeed('buy', { id, item });
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
  youFeed('sell', { id, item });
  const l = G.npc[id].f >= 60 ? '「给你的价，别跟人说。」' : def.easy ? '「下次还拿来。」' : '「嗯。」';
  return { lines: [`卖出了${item}（+${p} 安娜币${p > price ? '，熟人价' : ''}）`, `<b>${def.name}</b>：${l}`], settled: advanceNode() === 'settled' };
}

/* ---------- 探险（批二） ---------- */
/* 战斗：武力决定胜率；胜涨武力+战利品，败挂彩。平原绝对安全 */
function winChance() { return clamp(0.5 + G.force * 0.035, 0.15, 0.95); }

function dropLoot() {
  const got = [];
  if (Math.random() < 0.6) { G.bag.腐肉 = (G.bag.腐肉 || 0) + 1; got.push('腐肉×1'); }
  if (Math.random() < 0.5) { G.bag.骨头 = (G.bag.骨头 || 0) + 1; got.push('骨头×1'); }
  if (Math.random() < 0.15) { G.bag.怪躯壳 = (G.bag.怪躯壳 || 0) + 1; got.push('完好的躯壳×1'); }
  return got;
}

function monsterFight() {
  const lines = [];
  if (Math.random() < winChance()) {
    const nick = Math.random() < 0.3;
    lines.push(rnd(nick ? EXP_TEXT.mobHurt : EXP_TEXT.mobWin));
    if (nick) G.hurt = Math.min(2, G.hurt + 1);
    const got = dropLoot();
    G.stats.kills++;
    if (Math.random() < 0.5) G.force++;
    if (got.length) lines.push('拾获：' + got.join('、'));
  } else {
    /* 重伤再败：40% 死在野外（E0） */
    if (G.hurt === 2 && Math.random() < 0.4) {
      lines.push(rnd(EXP_TEXT.mobLose), '你没能站起来。天亮的时候，搜索的人找到了你的弓。');
      endGame('E0');
      return lines;
    }
    lines.push(rnd(EXP_TEXT.mobLose));
    G.hurt = Math.min(2, G.hurt + 1);
    if (G.hurt === 2) lines.push(rnd(EXP_TEXT.hurtHeavy));
  }
  youFeed('fight');
  return lines;
}

const EXP_ACT_NAME = { gather: '采集', hunt: '打猎', fish: '钓鱼', dive: '潜水', minenear: '挖了近矿', minefar: '摸进了深矿', train: '练剑' };

/* ---------- 夜间世界规则（言拍板 2026-10-27）：夜里怪物横行，全村闭户，Gloria 也不出门 ---------- */

function doExplore(zone, act) {
  const z = EXPLORE[zone];
  if (G.node >= DAY_NODES) return { lines: ['夜里怪物横行，出不了门。等天亮。'], blocked: true };   // 夜间世界规则（言拍板 2026-10-27）
  const err = canDo(act);
  if (err) return { lines: [err], blocked: true };

  const lines = [];
  let rate = act === 'minefar' ? z.farRate : z.rate;
  /* 近矿卡 bug：白天他送你到村界石（爱≥25 或 友≥50，40%）——近矿他陪，深矿在界外他到不了 */
  let escort = false;
  if (act === 'minenear' && (G.npc.knight.l >= 25 || G.npc.knight.f >= 50) && Math.random() < 0.4) {
    escort = true; rate = 0;
  }

  /* 遇怪：这个节点改成战斗 */
  if (zone !== 'plain' && act !== 'train' && Math.random() < rate) {
    lines.push(...monsterFight(false));
    if (G.over) return { lines };                      // 战死野外，直接进结局
  } else if (act === 'gather') {
    if (Math.random() < 0.08) {
      G.bag.稀有花 = (G.bag.稀有花 || 0) + 1;
      lines.push(rnd(EXP_TEXT.gatherRare), '拾获：稀有花×1');
    } else {
      const got = ['蘑菇×2', '水果×1'];
      G.bag.蘑菇 = (G.bag.蘑菇 || 0) + 2;
      G.bag.水果 = (G.bag.水果 || 0) + 1;
      if (Math.random() < 0.5) { G.bag.木材 = (G.bag.木材 || 0) + 1; got.push('木材×1'); }
      lines.push(rnd(EXP_TEXT.gather), '拾获：' + got.join('、'));
    }
    youFeed('gather');
  } else if (act === 'hunt') {
    if (Math.random() < winChance()) {
      const meat = 2 + Math.floor(Math.random() * 3);
      G.bag.生肉 = (G.bag.生肉 || 0) + meat;
      const got = [`生肉×${meat}`];
      if (Math.random() < 0.4) { G.bag.兔皮 = (G.bag.兔皮 || 0) + 1; got.push('兔皮×1'); }
      lines.push(rnd(EXP_TEXT.huntWin), '拾获：' + got.join('、'));
      G.stats.hunts++;
      if (Math.random() < 0.4) G.force++;
    } else {
      if ((G.bag.箭矢 || 0) > 0) { G.bag.箭矢--; if (G.bag.箭矢 <= 0) delete G.bag.箭矢; }
      lines.push(rnd(EXP_TEXT.huntLose));
    }
    youFeed('hunt', { place: z.name });
  } else if (act === 'fish') {
    const n = 1 + (Math.random() < 0.4 ? 1 : 0);
    G.bag.鱼 = (G.bag.鱼 || 0) + n;
    lines.push(rnd(EXP_TEXT.fish), `拾获：鱼×${n}`);
    youFeed('fish');
  } else if (act === 'dive') {
    const coins = 3 + Math.floor(Math.random() * 4);
    G.coins += coins;
    lines.push(rnd(EXP_TEXT.dive), `河底的旧硬币：+${coins} 安娜币`);
    youFeed('dive');
  } else if (act === 'minenear') {
    const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (escort ? 1 : 0);
    G.bag.铁矿 = (G.bag.铁矿 || 0) + n;
    lines.push(rnd(EXP_TEXT.mineNear), `拾获：铁矿×${n}`);
    if (escort) {
      lines.push(resolveNames('你往近矿走。[[knight]]在界石那里跟上了你，走到洞口就站住。'));
      lines.push(`<b>骑士</b>：「${rnd(KNIGHT_ESCORT)}」`);
      rel('knight', 'f', 1);
      addFeed('you', '你下近矿。[[knight]]送你到洞口，站在村界石上等你出来。', ['knight']);
    }
    youFeed('mine');
  } else if (act === 'minefar') {
    const n = 2 + Math.floor(Math.random() * 2);
    G.bag.铁矿 = (G.bag.铁矿 || 0) + n;
    const got = [`铁矿×${n}`];
    if (Math.random() < 0.12) { G.bag.黄金玉 = (G.bag.黄金玉 || 0) + 1; G.stats.gy++; got.push('黄金玉×1'); }
    lines.push(rnd(got.length > 1 ? EXP_TEXT.gy : EXP_TEXT.mineFar), '拾获：' + got.join('、'));
    youFeed('mine');
  } else if (act === 'train') {
    G.force++;
    lines.push(rnd(EXP_TEXT.train), `武力 +1（现在 ${G.force}）`);
    youFeed('train');
  }

  G.energy -= (COST[act] || 0) + (G.hurt === 2 ? 1 : 0);
  G.dayLog.push(`去${z.name}${EXP_ACT_NAME[act] || act}`);
  const adv = advanceNode();
  return { lines, settled: adv === 'settled' };
}

/* ---------- 骑士战（§6.3）：a 防御 b 进攻 c 下死手（限时） ---------- */
function startDuel(reason) {
  G.duel = { reason, armed: false };
  save();
}

function duelMove(m) {
  const reason = G.duel ? G.duel.reason : 'npcHit';
  G.duel = null;
  const k = G.npc.knight, kn = G.knight;
  const lines = [resolveNames(DUEL_TEXT.scene[reason] || DUEL_TEXT.scene.npcHit)];
  kn.duelFlag = true;

  if (m === 'a') {                                      // 防御：挨一下，关系掉
    if (k.l >= 50) {
      lines.push(`<b>骑士</b>：「${DUEL_TEXT.aStop}」`);
      rel('knight', 'l', -10);
    } else {
      lines.push(DUEL_TEXT.aHurt);
      G.hurt = Math.min(2, G.hurt + 1);
      rel('knight', 'f', -5);
    }
    addFeed('major', '你在广场跟[[knight]]对了一剑。全村都看见了。');
  } else if (m === 'b') {                               // 进攻：武力决胜负
    if (Math.random() < clamp(0.3 + G.force * 0.04, 0.1, 0.9)) {
      lines.push(DUEL_TEXT.bWin);
      rel('knight', 'f', 5);
    } else {
      lines.push(DUEL_TEXT.bLose);
      G.hurt = 2;
      rel('knight', 'f', -5);
    }
    addFeed('major', '你跟[[knight]]真刀真枪打了一场。');
  } else if (m === 'c') {                               // 下死手（限时确认后）
    lines.push(DUEL_TEXT.cGo);
    if (Math.random() < clamp(0.15 + G.force * 0.045, 0.05, 0.85)) {
      lines.push('他看着你，一直看到瓷白碎开。');
      endGame('E3');
      return { lines, over: true };
    }
    if (G.force < 12 && Math.random() < 0.5) {
      lines.push(DUEL_TEXT.cFail, '剑落下来了。');
      endGame('E4');
      return { lines, over: true };
    }
    lines.push(DUEL_TEXT.cLose);
    G.hurt = 2; G.energy = 0;
    rel('knight', 'f', -10); rel('knight', 'l', -10);
  } else {                                              // ctimeout：犹豫败北，不死
    lines.push(DUEL_TEXT.cFail, '剑背把你扫倒在地。他收剑走了，没有再看你。');
    G.hurt = Math.min(2, G.hurt + 1);
    rel('knight', 'f', -5);
    addFeed('major', '你跟[[knight]]对了一剑，输了。');
  }
  save();
  const adv = advanceNode();
  return { lines, settled: adv === 'settled' };
}

/* ---------- 治疗药水 ---------- */
function healPotion() {
  if (!G.hurt) return { lines: ['身上没有伤。'], blocked: true };
  if ((G.bag.治疗药水 || 0) < 1) return { lines: ['手里没有治疗药水。Isabel 那有卖。'], blocked: true };
  G.bag.治疗药水--; if (G.bag.治疗药水 <= 0) delete G.bag.治疗药水;
  G.hurt = 0;
  return { lines: ['你喝下治疗药水。伤处当天收口，力气回来了。'] };
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
  G.energy = Math.min(maxE(), G.energy + 5);
  G.dayLog.push('午休了一会儿');
  youFeed('nap');
  return { lines: [`你睡了半个中午。精力 +5（现在 ${G.energy}）。`], settled: advanceNode() === 'settled' };
}
