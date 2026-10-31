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
function maxE() { return MAX_ENERGY - (G.hurt === 2 ? 8 : G.hurt === 1 ? 3 : 0) - (G.energyDebt || 0); }

/* NPC 当前节点位置（含动态：Jacob 夜宿钟楼、骑士夜在前线、Leo 闭馆三天在家） */
function locOf(def, node) {
  let l = def.loc[node];
  if (node >= DAY_NODES && def.id === 'jacob' && G.nightJacobAtTower) l = 'belltower';
  if (def.id === 'leo' && G.evF && G.evF.leoClosedUntil && G.day < G.evF.leoClosedUntil) l = 'home';
  return l;
}

/* ---------- 开新档 ---------- */
function newGame() {
  G = {
    day: 1, node: 0,
    energy: MAX_ENERGY, coins: 20, force: 5,
    bag: { 弓: 1, 箭矢: 10, 生肉: 3 },
    npc: {}, stars: {},
    feed: [], chronicle: [],
    dayLog: [],            // 今天玩家的行动记录
    flowersPickedDay: 0,
    nightJacobAtTower: false,
    hurt: 0,               // 伤势：0完好 1轻伤 2重伤
    loveTouch: [],         // 今日亲密对象（暧昧/寻欢），每晚占有欲结算用
    touch: {},             // 肢体互动每日记录（言拍板 2026-10-30）
    nightHunted: false,    // （夜间出门已删 2026-10-27，字段留作旧档兼容，恒 false）
    helpedKnight: false,   // （钟楼夜射已删 2026-10-27，字段留作旧档兼容，恒 false）
    knight: { cond: 100, streak: 0, best: 0, gyUsed: 0, repairedToday: false, core: false, doomEnd: 0, duelFlag: false },
    stats: { flowers: 0, chats: 0, teases: 0, hunts: 0, kills: 0, gy: 0 },
    starTipShown: false,
    love: {},               // 感情线（第一批）：每人事件队列进度 {n:完成数, day:上次触发日}
    evF: {},                // 感情线事件 flag 池（记档走向、闭馆日、蓝日期等）
    lover: null,            // 当前恋人（告白接受后；仅一人）
    noPropose: {},          // 告白被拒过的人：不再开口
    weather: 0,             // 今日天气：0晴 1雨（每天早晨掷，约四天一雨）
    nightOut: 0,            // 你夜里出门次数（在村里走动合法；Asher 事件2的引子）
    blueprints: {},         // 已学图纸（拍板 #42）：CRAFT key→true
    spouse: null,           // 配偶（婚礼完成后；仅一人）
    engaged: null,          // 已答应的求婚（婚礼待办）
    wedday: 0,              // 婚期（当天首次关闭弹窗时出婚礼）
    wedShown: true,         // 当天婚礼弹窗是否已出
    marryReady: {},         // 求婚念头已冒出待触发（每人一戳）
    marryCd: {},            // 求婚被拒冷却（到期日前不再开口）
    suspect: false,         // 配偶已起疑（再被抓=摊牌）
    energyDebt: 0,          // 处理痕迹精力债（次日精力上限减额，只压一天）
    loverDay: 0,            // 恋人关系起算日（告白接受当天）
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
    G.mineDry = G.mineDry || 0;   // 矿越挖越熟：连续空镐计数（言拍板 2026-10-30），老档补默认
    G.touch = G.touch || {};      // 肢体互动每日记录（言拍板 2026-10-30），老档补默认
    G.knight = Object.assign({ cond: 100, streak: 0, best: 0, gyUsed: 0, repairedToday: false, core: false, doomEnd: 0, duelFlag: false }, G.knight || {});
    G.nightHunted = !!G.nightHunted;
    G.helpedKnight = !!G.helpedKnight;
    G.loveTouch = Array.isArray(G.loveTouch) ? G.loveTouch : [];
    /* 感情线第一批字段迁移（2026-10-28，旧档自动补齐） */
    G.love = G.love || {};
    G.evF = G.evF || {};
    G.lover = G.lover || null;
    G.noPropose = G.noPropose || {};
    G.weather = G.weather ? 1 : 0;
    G.nightOut = G.nightOut || 0;
    /* 婚姻批字段迁移（2026-10-31，旧档自动补齐；旧档已有恋人的，60 天从迁移日起算） */
    G.spouse = G.spouse || null;
    G.engaged = G.engaged || null;
    G.wedday = G.wedday || 0;
    G.wedShown = G.wedShown !== false;
    G.marryReady = G.marryReady || {};
    G.marryCd = G.marryCd || {};
    G.suspect = !!G.suspect;
    G.energyDebt = G.energyDebt || 0;
    G.loverDay = G.loverDay || (G.lover ? G.day : 0);
    /* Lee 记忆线（#70）：掉落进度/已给遗物兜底；恢复档重放切池（NPCS 从 data.js 重载为原版，幂等安全） */
    G.leeClue = G.leeClue || {};
    if (G.npc.lee && G.npc.lee.restored) applyLeeAfter();
    G.npc.lee.clueGiven = G.npc.lee.clueGiven || [];
    /* 批四字段迁移：寻欢记忆 flag + 每日一次尝试锁；感情线：每人打闹计数；偶遇：每人每日偶遇戳（#68） */
    for (const k in G.npc) {
      G.npc[k].funOnce = !!G.npc[k].funOnce;
      G.npc[k].funDay = G.npc[k].funDay || 0;
      G.npc[k].teases = G.npc[k].teases || 0;
      G.npc[k].meetDay = G.npc[k].meetDay || 0;
      G.npc[k].cheatN = G.npc[k].cheatN || 0;
    }
    /* 礼物手作批字段迁移（拍板 #42）：已学图纸 + 每人每日送礼戳 */
    G.blueprints = G.blueprints || {};
    for (const k in G.npc) G.npc[k].giftDay = G.npc[k].giftDay || 0;
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
    e.t === 'major' || e.t === 'you' || e.t === 'morn' || e.t === 'meet' ||
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

/* 村里动态（拍板 #43）：每节点 2-4 条；专属池 + 通用组合句常驻掺入；
   句子近期去重（12 条滚动窗口，session 级不进存档）＋一人一节点最多 2 条 */
let SIM_RECENT = [];
function genSimEvents(node) {
  if (node >= DAY_NODES) return;          // 夜间不生成 NPC 街面事件
  const ashBlue = !!(G.evF && G.evF.ashBlueUntil && G.day < G.evF.ashBlueUntil);  // 家人档头三天：Asher 躲着不出播报
  const pool = [];
  for (const m of MICRO_EVENTS) {
    if (ashBlue && m.need.includes('asher')) continue;
    if (m.where && npcAt(m.where, node).length === 0) continue;
    const ok = m.need.every(id => locOf(npcDef(id), node) === m.where);
    if (ok) for (const t of m.ev) pool.push(t);
  }
  /* 通用掺入候选：白天在村里的任何人（不含前线骑士、Asher 躲避期）——
     通用句无场景绑定，不同地点的两人「路过遇上」也成立（#41 配对清单同概念） */
  const cands = NPCS.filter(n => locOf(n, node) !== 'front' && !(ashBlue && n.id === 'asher')).map(n => n.id);
  const count = Math.min(2 + Math.floor(Math.random() * 3), 4);   // 每节点 2-4 条
  const picked = {};                       // 人物限次：一人一节点 ≤2 条（按独特涉及算，同句多次提及算 1）
  const usedTexts = new Set();
  for (let made = 0, tries = 0; made < count && tries < 40; tries++) {
    let t = null;
    if (pool.length && Math.random() < 0.6) {          // 专属优先，六成
      t = rnd(pool);
      if (usedTexts.has(t) || SIM_RECENT.includes(t)) continue;   // 同节点＋近期窗口都不重
      if ([...new Set(extractNames(t))].some(id => (picked[id] || 0) >= 2)) continue;
      SIM_RECENT.push(t);
      if (SIM_RECENT.length > 12) SIM_RECENT.shift();
    } else if (cands.length >= 2) {                    // 通用掺入：村里任意两人
      const a = cands[Math.floor(Math.random() * cands.length)];
      let b = a, guard = 0;
      while (b === a && guard++ < 8) b = cands[Math.floor(Math.random() * cands.length)];
      if (b === a) continue;
      if ((picked[a] || 0) >= 2 || (picked[b] || 0) >= 2) continue;
      t = rnd(GENERIC_EVENTS).replace(/\[\[a\]\]/g, `[[${a}]]`).replace(/\[\[b\]\]/g, `[[${b}]]`);
      if (usedTexts.has(t)) continue;                   // 通用池小，只做同节点去重
    } else if (!pool.length) break;                     // 两头都没货，收工
    else continue;
    usedTexts.add(t);
    for (const id of new Set(extractNames(t))) picked[id] = (picked[id] || 0) + 1;
    addFeed('sim', t);
    made++;
  }
  /* 感情线记档解锁的村民播报（一天最多一条） */
  if (G._loveSimDay !== G.day) {
    if (G.evF.leviField && Math.random() < 0.25) { addFeed('sim', LOVE_SIM.leviField); G._loveSimDay = G.day; }
    else if (G.evF.ashPact && !ashBlue && Math.random() < 0.2) { addFeed('sim', LOVE_SIM.ashPact); G._loveSimDay = G.day; }
  }
  leeCareEvent();   // Lee 轮值照顾播报（#70）：恢复前低概率出一条，恢复后退役
}

function genMorning() {
  addFeed('morn', rnd(MORNING_POOL));
  const kn = G.npc.knight;
  if (kn && kn.l >= 60 && G.stats.flowers > 0) {
    addFeed('sim', '[[knight]]胸甲的缝隙里别着一朵花。[[levi]]问起，它说：「她给的。」');
  }
  /* Lee 恢复次日晨报：全村反应 2-3 条（池空回退系统句；LEE_RESTORE_MORN 回流即活） */
  if (G.evF.leeMornPending) {
    G.evF.leeMornPending = false;
    const pool = LEE_RESTORE_MORN.length ? LEE_RESTORE_MORN : [
      '[[asher]]在井边站了很久。他说：「他跟我说话的样子变了。像一下子长大了。」',
      '[[lee]]记忆恢复的事，一上午就传遍了全村。井边围了一圈打听的人。',
    ];
    for (const t of [...pool].sort(() => Math.random() - 0.5).slice(0, 3)) addFeed('morn', t);
    save();
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

/* ---------- 偶遇系统（言拍板 #68 2026-10-31）：进地点掷骰，路过的村民跟你说一句 ----------
   纯氛围事件：不耗精力、不占时间格、不涨好感、不算「今天见过」（冷落判定不动，言拍板）。
   白天 40% / 夜里 25%；每时间格最多 1 次；一人一天最多 1 次；夜句（night 标）只在夜里触发。
   meet 池格式：{ p:地点键|''通用, scene:展示场景, t:台词, night?, tower? }；
   老池 {p,t} 无 scene 的按地点键查 MEET_SCENE。p:'zone'=野外句，v1 不触发（二期野外偶遇）。
   骑士与 Lee 的偶遇句在 after 备用包里（根层无 meet），v1 天然不参与。 */
const MEET_SCENE = { '': '路上', well: '井边', bakery: '烘焙坊门口', forge: '锻造室', church: '教堂门口',
  plaza: '广场', library: '图书馆', field: '农田', farm: '养殖场', alchemy: '炼药房', belltower: '钟楼', home: '你家门口' };
let MEET_NODE = -1;      /* 本时间格已偶遇标记（session 级，不进存档） */
function doMeetCheck(place) {
  if (!place || MEET_NODE === G.node) return;
  const night = G.node >= DAY_NODES;
  if (Math.random() >= (night ? 0.25 : 0.4)) return;
  const ashBlue = !!(G.evF && G.evF.ashBlueUntil && G.day < G.evF.ashBlueUntil);   /* 家人档头三天 Asher 躲避 */
  const cands = [];
  for (const n of NPCS) {
    if (ashBlue && n.id === 'asher') continue;
    if (n.id === 'lee' && G.npc.lee.restored) continue;   // 恢复后 Lee 退出村内偶遇（#70：孩子腔句退役；after.meet 野外句留二期）
    if (!n.meet || !n.meet.length) continue;
    if (G.npc[n.id].meetDay === G.day) continue;
    for (const line of n.meet) {
      if (line.p === 'zone') continue;
      if (!!line.night !== night) continue;
      if (line.p && line.p !== place) continue;
      if (line.tower && !G.nightJacobAtTower) continue;        /* Jacob 夜宿钟楼例外夜限定 */
      cands.push({ n, line });
    }
  }
  if (!cands.length) return;
  const pick = rnd(cands);
  const scene = pick.line.scene || MEET_SCENE[pick.line.p || ''];
  addFeed('meet', `${scene}，[[${pick.n.id}]]说：「${pick.line.t}」`, [pick.n.id]);
  G.npc[pick.n.id].meetDay = G.day;
  MEET_NODE = G.node;
  save();
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
  const isPriv = t => /过了今晚|做了修补/.test(t);
  const isSelf = t => /Vivienne|\[\[vivienne\]\]/.test(t);   /* 事实带她本人：不转述自己（言准 2026-10-31 #71，杜绝「听说你跟我过了今晚」式穿帮） */
  const priv = y.log.filter(t => isPriv(t) && !isSelf(t));
  const acts = y.log.filter(t => !isPriv(t) && !isSelf(t));
  const sims = G.feed.filter(e => e.t === 'sim' && e.d === y.day && !isSelf(e.html));
  const send = (kind, fact, names) => {
    const pool = VIV_NEWS[kind];
    /* 台词池待生产线生成；空=回退系统过渡句（占位，2026-10-26）。
       池句自带句末标点，{x} 填入前剥掉事实尾部句号（2026-10-31 言准开工清单，防「。，」撞标点）；回退支保留原样 */
    const frame = pool.length
      ? `[[vivienne]]：「${rnd(pool).split('{x}').join(String(fact).replace(/[。．.]+$/, ''))}」`
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
  vivienneNews();                       /* 活报纸：昨日真事经她的嘴说出（此时 chronicle 末条=昨天） */
  if (G.hurt === 2) { G.hurt = 1; addFeed('morn', '睡了一夜，重伤将养成了轻伤。再养一晚就好利索。'); }
  else if (G.hurt === 1) { G.hurt = 0; addFeed('morn', '睡了一夜，你的伤好利索了。'); }
  G.day++; G.node = 0; G.energy = maxE();
  G.energyDebt = 0;                     // 处理痕迹精力债只压当天（婚姻批 #67）
  marryTick();                          // 求婚念头（婚姻批 #67）：条件齐了每日 10% 冒念头
  G.dayLog = []; G.flowersPickedDay = 0; G.nightJacobAtTower = false;
  G.escortUsedDay = false; G.arrowsShotNight = 0;   // 拍板 #41：护送每天一次 / 夜射每晚三箭
  genMorning();
  knightWear();
  possessTick();                        /* 占有欲每晚结算 */
  vivienneChain();                      /* Vivienne 占有欲链（池空不触发） */
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

/* 终末之月的一晚：夜里怪物还是会进村口的田，他带伤出去赶，固定裂 11 点
   （旧的「有人替他守村就只裂 3 点」豁免随 2026-10-27 夜间规则删除——夜里谁都不能出村） */
function doomNight(kn) {
  const decay = 11;
  kn.cond -= decay;
  addFeed('major', rnd(DOOM_TEXT.forced));
  /* 好感已死 + 对峙已发生：他拒绝修补，提前凋零（E2c） */
  const k = G.npc.knight;
  if (kn.duelFlag && k.f + k.l < 20) { endGame('E2c'); return; }
  if (kn.cond <= 0) { endGame('E1'); return; }
  /* 第 30 天黎明：结算 */
  if (G.day >= kn.doomEnd) {
    if (k.f >= 60 && k.l >= 60 && kn.streak >= 30 && G.stats.gy >= 20) endGame('E2b');
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

/* ---------- 肢体互动（言拍板 2026-10-30 第十九场）：摸摸头/拥抱/亲脸颊/依偎 ---------- */
function doTouch(id, act) {
  const def = npcDef(id), t = TOUCH[act];
  if (!def || !t) return { lines: ['……'], blocked: true };
  if (!TOUCH_OPEN.includes(id)) return { lines: ['TA 还不习惯这样。'], blocked: true };   // 第一批只开 3 人
  const st = G.npc[id];
  if (!((t.f && st.f >= t.f) || (t.l && st.l >= t.l))) return { lines: ['还没到那一步。'], blocked: true };
  if (t.night && G.node < DAY_NODES) return { lines: ['这个要等夜里。'], blocked: true };
  if (t.afterRestore && id === 'lee' && !st.restored) return { lines: ['他还分不清这些。'], blocked: true };   // 恢复前 Lee 肢体互动全锁（言拍板 2026-10-30 翻案 #61：四按钮全拦）
  G.touch = G.touch || {};
  const key = id + '.' + act;
  if (G.touch[key] === G.day) return { lines: ['今天已经亲近过了，再要就腻了。'], blocked: true };
  G.touch[key] = G.day;
  const pool = (TOUCH_TEXT[id] || {})[act] || [];
  const lines = [pool.length ? rnd(pool) : 'TA 没有躲开。'];   // 台词池空时用中性句，回流后自动换
  if (t.dF) { rel(id, 'f', t.dF); lines.push(`友 +${t.dF}`); }
  if (t.dL) { rel(id, 'l', t.dL); lines.push(`爱 +${t.dL}`); }
  G.dayLog.push(`跟${def.name}${t.name}`);
  return { lines };
}

/* ---------- 骑士：修补（黄金玉×1·精力2） ---------- */
function repairKnight() {
  const kn = G.knight;
  if (G.node >= DAY_NODES) return { lines: [kn.core ? '夜里它不让你碰那道缝。「天亮。」' : '夜里它在前线。等天亮。'], blocked: true };
  const cap = kn.core ? 50 : 100;                       // 终末之月：半死之躯修不满
  if (!kn.core && kn.cond >= 100) return { lines: ['它浑身完好，没有要补的地方。'], blocked: true };
  if (kn.core && kn.cond >= cap) return { lines: ['裂缝还合着，不用补。这块黄金玉省下来，夜里裂开再填。'], blocked: true };
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
  if (!kn.core && kn.cond >= 100) lines.push('瓷面上再看不到缝。它抬了抬右臂，关节里没有声音了。');
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
  if (id === 'lee' && key === 'l' && !s.restored) return;   // 恢复前 Lee 爱情封 0（#70：感情线整线锁，恢复解开）
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
  /* 婚姻批（#67）：出轨对象有实后混入背德池（池空不触发，成句待生产线） */
  if (type === 'chat' && G.spouse && G.spouse !== def.id && st && st.funOnce && Array.isArray(def.afterCheat) && def.afterCheat.length) {
    arr = arr.concat(def.afterCheat);
  }
  /* 婚姻批（#67）：配偶起疑后的带刺试探，混入TA自己的闲聊池（池空不触发） */
  if (type === 'chat' && G.suspect && G.spouse === def.id && Array.isArray(def.suspectText) && def.suspectText.length) {
    arr = arr.concat(def.suspectText);
  }
  /* 感情线→婚姻批（翻案 #35）：恋人档日常改为结婚当天起混入（婚前维持普通版） */
  if (type === 'chat' && G.spouse === def.id && Array.isArray(def.afterRealLover) && def.afterRealLover.length) {
    arr = arr.concat(def.afterRealLover);
  }
  return arr;
}

/* 寻欢（§8 双轨·偷尝轨）：夜间发起，掷接受率；接受=今晚在这过（直接结算到天亮）
   forced=true 跳过时段/当日/掷骰限制（Vivienne 交换夜晚：她开的价，保底接受） */
function doFun(id, forced, cover) {
  const def = npcDef(id), st = G.npc[id], fp = funPools(def, st);
  if (!fp) return { lines: ['现在不适合。'], blocked: true };
  if (!forced && st.l < 50) return { lines: ['还不到那一步。'], blocked: true };
  if (!forced && G.node < DAY_NODES) return { lines: ['白天各忙各的。这种事，夜里再说。'], blocked: true };
  if (!forced && st.funDay === G.day) return { lines: ['今天不用再开口了。'], blocked: true };
  const err = canDo('fun');
  if (err) return { lines: [err], blocked: true };
  st.funDay = G.day;
  /* 接受率：爱情越深越难拒，有过之后不再生分 */
  const rate = clamp(0.5 + st.l * 0.005 + (st.funOnce ? 0.15 : 0), 0, 1);
  if (!forced && Math.random() > rate) {
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
  ];
  if (cover) lines.push('天亮前，你把能想到的痕迹都收拾干净了。');
  lines.push('天亮了。');
  settleDay();
  if (fp.morn.length) addFeed('morn', rnd(fp.morn));
  if (cover) G.energyDebt = 10;         // 处理痕迹的疲惫压到今天上限（婚姻批 #67）
  const cr = cheatRoll(id, cover);      // 对象非配偶=出轨：记账+查岗掷骰（两段式）
  if (cr) lines.push(...cr);
  return { lines, settled: true };
}

function interact(id, type) {
  if (type === 'fun') return doFun(id);
  const def = npcDef(id), st = G.npc[id];
  const err = canDo(type);
  if (err) return { lines: [err], blocked: true };

  /* 攻击骑士本人 = 直接对峙（§6.3 骑士战） */
  if (type === 'hit' && id === 'knight') { startDuel('knightHit'); return { duel: true }; }

  /* Lee 恢复前感情线封死（#70）：暧昧入口拦（与肢体全锁 #61 同句） */
  if (type === 'flirt' && id === 'lee' && !st.restored) return { lines: ['他还分不清这些。'], blocked: true };

  /* 感情线（第一批）：闲聊顶替型事件优先于普通互动（精力检查已在上面 canDo 过了） */
  if (type === 'chat') {
    const ev = chatEvPending(id);
    if (ev) return ev;
  }

  const place = locOf(def, G.node);
  const lines = [];
  const daysSince = G.day - st.last;

  /* 冷落/吃醋前置（闲聊和暧昧时冒头）；吃醋间隔随占有欲缩短 */
  const jgap = st.p >= 70 ? 2 : st.p >= 40 ? 3 : 4;
  if ((type === 'chat' || type === 'flirt') && st.coldPending && def.cold.length) {
    lines.push(`<b>${def.name}</b>：「${rnd(def.cold)}」`);
    st.coldPending = false;
  } else if ((type === 'chat' || type === 'flirt') && (SISTERS.includes(id) ? st.f >= 40 : st.l >= 30) && daysSince >= jgap && def.jealous.length) {   // 姐妹吃醋走友≥40（#38 友谊版），他人仍走爱≥30
    lines.push(`<b>${def.name}</b>：「${rnd(def.jealous)}」`);
  }

  const pool = poolArr(def, type, st);
  if (!pool.length) return { lines: ['现在不适合。'], blocked: true };
  let line = rnd(pool);
  if (id === 'leo' && G.evF.leoColdDay === G.day) line = '还书。登记。就这样。';   // 感情线事件2次日：他把你晾了一天
  lines.push(`<b>${def.name}</b>：「${line}」`);

  /* 效果 */
  const pname = (PLACES[place] || {}).name || '前线';
  if (type === 'chat') { rel(id, 'f', 2); G.stats.chats++; youFeed('chat', { id, place: pname }); if (Math.random() < 0.15 && def.deep.length && st.f >= 40) {
    lines.push(`<b>${def.name}</b>：「${rnd(def.deep)}」`); rel(id, 'f', 1);
  } else if (SISTERS.includes(id) && st.f >= 60 && def.bestie && def.bestie.length && Math.random() < 0.15) {   // 摯友限定（#38）：友 60+ 低概率冒头
    lines.push(`<b>${def.name}</b>：「${rnd(def.bestie)}」`);
  } }
  if (type === 'flirt') { st.f >= 40 ? (rel(id, 'l', 4), rel(id, 'f', 1), rel(id, 'p', 2)) : rel(id, 'l', 1); youFeed('flirt', { id }); touchLog(id); }
  if (type === 'tease') {
    rel(id, 'f', 2); if (!SISTERS.includes(id)) rel(id, 'l', 1); G.stats.teases++; st.teases = (st.teases || 0) + 1; youFeed('tease', { id, place: pname });
    const stress = id === 'knight' ? null : knightStressRoll(place, false);   /* 2026-10-30 言拍板：闹的对象就是骑士本人时不再拦——不能拦自己 */
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

  /* 感情线：Levi 事件2（打斗之后）——跟他打闹满 3 次的那天，打完追加 */
  if (type === 'tease' && id === 'levi' && nextEv('levi') === 'lev2' && loveReady('levi') && EV_GATES.lev2()) {
    loveDone('levi'); rel('levi', 'l', 2);
    G.evF.leviSitLate = true;               // 当晚播报：他一个人在田里坐到很晚
    lines.push('你把他按在草垛上，他不挣了。');
    lines.push('<b>Levi</b>：「没事。起来干活了。」');
  }
  /* 感情线：Asher 事件3 选了如实说——你打 Alice 的主意，他都要插一脚 */
  if (type === 'tease' && id === 'alice' && G.evF.ashSabUp) {
    lines.push('<b>Asher</b>：「Alice 姐，昨天的干粮还有吗，我帮你搬。」');
    addFeed('sim', '你和[[alice]]闹着玩。[[asher]]凑了过去，非拉她去搬东西。', ['alice', 'asher']);
  }

  /* Asher 拆散：你对骑士亲密，且 Asher 同场或在家里（告白选我心里有人后关停） */
  if (id === 'knight' && (type === 'flirt' || type === 'flower') && G.npc.knight.l >= 25 && !G.evF.ashSabOff && Math.random() < 0.3) {
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

/* ---------- 送礼（拍板 #42）：手作礼物＋稀有花；每人每天一份，精力1、占时间格、算理过TA ---------- */
const GIFT_ITEMS = ['编制小猫', '小帽子', '泥金手绘本', '宝石项链', '弹弓', '稀有花', '花'];
function doGift(id, item) {
  const def = npcDef(id), st = G.npc[id];
  if (st.giftDay === G.day) return { lines: ['今天已经送过TA一份了。明天再来。'], blocked: true };
  if ((G.bag[item] || 0) < 1) return { lines: [`手里没有${item}。`], blocked: true };
  const err = canDo('gift'); if (err) return { lines: [err], blocked: true };
  G.bag[item]--; if (G.bag[item] <= 0) delete G.bag[item];
  st.giftDay = G.day; st.last = G.day;               // 算理过TA：与闲聊同记，隔日吃醋不误触
  const lines = [];
  if (item === '稀有花') {
    /* 稀有花（爱情信物）：全员爱+6；骑士爱+9；Leo 再友+3；三姐妹转友+3（姐妹锁不破） */
    lines.push('你把稀有花送了出去。');
    if (SISTERS.includes(id)) rel(id, 'f', 3);
    else if (id === 'knight') rel(id, 'l', 9);
    else { rel(id, 'l', 6); if (id === 'leo') rel(id, 'f', 3); }
  } else {
    const score = (GIFT_SCORE[item] && GIFT_SCORE[item][id]) || 1;
    rel(id, 'f', score);
    lines.push(score >= 9 ? 'TA捧着它，半天没说出话。'
      : score >= 4 ? 'TA拿在手里翻来覆去看了很久。'
      : 'TA收下了，没多说什么。');
  }
  G.energy -= COST.gift; G.dayLog.push(`给${def.name}送了${item}`);
  const adv = advanceNode();
  return { lines, settled: adv === 'settled' };
}

/* ---------- 场所行动 ---------- */
function doPlaceAction(place, act, sub) {
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
  if (act === 'shoot') {
    /* 钟楼夜射（拍板 #41，翻 2026-10-27 夜间禁战案·仅此一处）：每箭精力2+箭矢1，
       命中 60%+武力×1% 封顶100%，每晚至多3箭；命中掉落怪躯壳/腐肉/骨头（4:4:2） */
    if (place !== 'belltower' || G.node < DAY_NODES) return { lines: ['白天怪物不进城，钟楼下没有影子。'], blocked: true };
    if ((G.arrowsShotNight || 0) >= 3) return { lines: ['钟楼下的影子散尽了，今晚没得射了。'], blocked: true };
    if ((G.bag.箭矢 || 0) < 1) return { lines: ['箭袋空了。'], blocked: true };
    const err = canDo('shoot'); if (err) return { lines: [err], blocked: true };
    G.energy -= COST.shoot;
    G.bag.箭矢--; if (G.bag.箭矢 <= 0) delete G.bag.箭矢;
    G.arrowsShotNight = (G.arrowsShotNight || 0) + 1;
    const slines = ['你搭箭，对着钟楼下的影子开弓。'];
    if (Math.random() < Math.min(1, 0.6 + G.force * 0.01)) {
      const r = Math.random(); let got;
      if (r < 0.4) { G.bag.怪躯壳 = (G.bag.怪躯壳 || 0) + 1; got = '怪躯壳×1'; }
      else if (r < 0.8) { G.bag.腐肉 = (G.bag.腐肉 || 0) + 1; got = '腐肉×1'; }
      else { G.bag.骨头 = (G.bag.骨头 || 0) + 1; got = '骨头×1'; }
      slines.push('正中。怪物栽倒在钟楼下。', '拾获：' + got);
    } else {
      slines.push('箭扎进空处。影子缩回了墙根。');
    }
    G.dayLog.push('夜里在钟楼放箭');
    return { lines: slines };
  }
  if (act === 'blueprint') {
    /* 图书馆学图纸（拍板 #42）：每张精力1、占时间格，一张只描一次 */
    if (place !== 'library') return { lines: ['图纸只在图书馆能学。'], blocked: true };
    const c = CRAFT[sub];
    if (!c) return { lines: ['没有这张图纸。'], blocked: true };
    if (G.blueprints[sub]) return { lines: ['这张图纸你已经描过了。'], blocked: true };
    const err = canDo('blueprint'); if (err) return { lines: [err], blocked: true };
    G.blueprints[sub] = true;
    G.energy -= COST.blueprint; G.dayLog.push(`描了〈${c.name}〉的图纸`);
    return { lines: [`你把〈${c.name}〉的图纸描了下来。`, `学会制作：${c.name}`], settled: advanceNode() === 'settled' };
  }
  if (act === 'craft') {
    /* 在家照图纸制作（拍板 #42）：精力2、占时间格；缺料直接退，不扣精力 */
    if (place !== 'home') return { lines: ['得回家安安静静做。'], blocked: true };
    const c = CRAFT[sub];
    if (!c || !G.blueprints[sub]) return { lines: ['还没学会这个的做法。'], blocked: true };
    const err = canDo('craft'); if (err) return { lines: [err], blocked: true };
    const lack = [];
    for (const m in c.mats) { const need = c.mats[m] - (G.bag[m] || 0); if (need > 0) lack.push(`${m}×${need}`); }
    if (lack.length) return { lines: [`材料不够：还差${lack.join('、')}。`], blocked: true };
    for (const m in c.mats) { G.bag[m] -= c.mats[m]; if (G.bag[m] <= 0) delete G.bag[m]; }
    const n = c.out || 1;
    G.bag[c.name] = (G.bag[c.name] || 0) + n;
    G.energy -= COST.craft; G.dayLog.push(n > 1 ? `做了${c.name}×${n}` : `做了${c.name}`);
    return { lines: [`照着图纸，你做完了〈${c.name}〉。`, `入手：${c.name}×${n}`], settled: advanceNode() === 'settled' };
  }
  if (act === 'helpfarm') {
    /* 农田帮工换粮（拍板 #42）：白天 Levi 在田时，精力3 → 小麦×1 + 70% 羊毛×1 + Levi 友+2 */
    if (place !== 'field') return { lines: ['这里没有要帮的农活。'], blocked: true };
    if (G.node >= DAY_NODES) return { lines: ['天黑了，田里没活。'], blocked: true };
    if (locOf(npcDef('levi'), G.node) !== 'field') return { lines: ['Levi 不在田里，没人派活。'], blocked: true };
    const err = canDo('helpfarm'); if (err) return { lines: [err], blocked: true };
    G.bag.小麦 = (G.bag.小麦 || 0) + 1;
    let got = '小麦×1';
    if (Math.random() < 0.7) { G.bag.羊毛 = (G.bag.羊毛 || 0) + 1; got += '、羊毛×1'; }
    rel('levi', 'f', 2);
    G.energy -= COST.helpfarm; G.dayLog.push('在农田帮了半天工');
    return { lines: ['你帮 Levi 干了半天农活。他话不多，活交得清楚。', `拾获：${got}`], settled: advanceNode() === 'settled' };
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
/* 交易改版（言拍板 2026-10-30）：买卖可选数量；交易不再消耗精力（重伤+1也不适用），时间照常流逝 */
function tradeBuy(id, item, price, qty) {
  qty = Math.max(1, qty | 0);
  if (G.coins < price * qty) return { lines: ['钱不够。'], blocked: true };
  G.coins -= price * qty;
  G.bag[item] = (G.bag[item] || 0) + (item === '箭矢' ? 5 : 1) * qty;
  const def = npcDef(id); rel(id, 'f', 1);
  G.dayLog.push(`从${def.name}那买了${item}${qty > 1 ? '×' + qty : ''}`);
  youFeed('buy', { id, item: qty > 1 ? `${item}×${item === '箭矢' ? 5 * qty : qty}` : item });
  const l = def.easy ? '「拿好。」' : def.hard ? '「钱货两清。」' : '「还要别的吗。」';
  return { lines: [`买到了${item}${item === '箭矢' ? '×' + 5 * qty : ''}（−${price * qty} 安娜币）`, `<b>${def.name}</b>：${l}`], settled: advanceNode() === 'settled' };
}
function tradeSell(id, item, price, qty) {
  qty = Math.max(1, qty | 0);
  if ((G.bag[item] || 0) < qty) return { lines: ['你没有这个。'], blocked: true };
  G.bag[item] -= qty; if (G.bag[item] <= 0) delete G.bag[item];
  const def = npcDef(id);
  const per = G.npc[id].f >= 60 ? Math.ceil(price * 1.2) : price;   // 熟人价按件计
  const total = per * qty;
  G.coins += total; rel(id, 'f', 1);
  G.dayLog.push(`卖给了${def.name}${item}${qty > 1 ? '×' + qty : ''}`);
  youFeed('sell', { id, item: qty > 1 ? `${item}×${qty}` : item });
  const l = G.npc[id].f >= 60 ? '「给你的价，别跟人说。」' : def.easy ? '「下次还拿来。」' : '「嗯。」';
  return { lines: [`卖出了${item}${qty > 1 ? '×' + qty : ''}（+${total} 安娜币${per > price ? '，熟人价' : ''}）`, `<b>${def.name}</b>：${l}`], settled: advanceNode() === 'settled' };
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

/* 矿越挖越熟（言拍板 2026-10-30）：连续空镐每镐 +6%、封顶 +30%；出玉清零、跨天保留；不粗暴抬基础概率 */
function mineRoll(base) {
  const p = base + Math.min(0.30, (G.mineDry || 0) * 0.06);
  if (Math.random() < p) { G.mineDry = 0; return true; }
  G.mineDry = (G.mineDry || 0) + 1; return false;
}

/* ---------- Lee 记忆恢复线（言拍板 #70 2026-10-31）：纯探索掉落；任意一件遗物交到他手上即触发恢复，不要求集齐、不讲顺序 ----------
   多余遗物恢复后再给 = 补忆句；台词池 LEE_* 待生产线回流，空 = 回退系统句（同 VIV_NEWS 模式） */
const LEE_CLUES = {
  gather:  { item: '铜哨',           rate: 0.04, pity: 25 },
  dive:    { item: '旧地图',         rate: 0.06, pity: 16 },
  minefar: { item: '烧掉一半的手札', rate: 0.05, pity: 20 },
};
/* 掉落检查：挂 doExplore 的 gather/dive/minefar 分支；三件独立计数，各只掉一次 */
function clueDropCheck(act, lines) {
  const c = LEE_CLUES[act];
  if (!c) return;
  G.leeClue = G.leeClue || {};
  const st = G.leeClue[act] || { n: 0, got: false };
  if (!st.got && !(G.bag[c.item] > 0)) {
    st.n++;
    if (Math.random() < c.rate || st.n >= c.pity) {
      st.got = true;
      G.bag[c.item] = (G.bag[c.item] || 0) + 1;
      lines.push(`角落里翻出一件被埋了很久的东西——<b>${c.item}</b>。（Lee 也许认得。）`);   // 系统过渡句（备案言可改）
    }
  }
  G.leeClue[act] = st;
}
/* 恢复后台词包切入主池（幂等；NPCS 每次会话从 data.js 重载，_afterApplied 自然重置）：
   chat/flirt/tease/hit/cold/jealous/deep 全覆盖，bio/secretHint 换 LEE_AFTER——所有取池点零改动生效 */
function applyLeeAfter() {
  const def = npcDef('lee');
  if (!def || !def.after || def._afterApplied) return;
  const a = def.after;
  for (const k of ['chat', 'flirt', 'tease', 'hit', 'cold', 'jealous', 'deep']) {
    if (a[k]) def[k] = a[k];
  }
  def.bio = LEE_AFTER.bio;
  def.secretHint = LEE_AFTER.hint;
  def._afterApplied = true;
}
/* 给 Lee 看遗物：不耗精力不占时间格（言拍板）；夜里他不出门；同件不可重给 */
function doGiveLeeClue(item) {
  const st = G.npc.lee;
  if (!Object.values(LEE_CLUES).some(c => c.item === item)) return { lines: ['……'], blocked: true };
  if (G.node >= DAY_NODES) return { lines: ['夜里他不出门。等天亮。'], blocked: true };
  if (!(G.bag[item] > 0)) return { lines: ['你没有这件东西。'], blocked: true };
  st.clueGiven = st.clueGiven || [];
  if (st.clueGiven.includes(item)) return { lines: ['这个他已经看过了。'], blocked: true };
  G.bag[item]--; if (G.bag[item] <= 0) delete G.bag[item];
  st.clueGiven.push(item);
  st.last = G.day;
  if (!st.restored) return leeRestore(item);
  /* 恢复后：多余遗物 = 补忆句 */
  const pool = LEE_CLUE_EXTRA[item] || [];
  const line = pool.length ? rnd(pool) : '这段我想起来了。谢谢你替我捡回来。';   // 池空回退（备案）
  rel('lee', 'f', 3);
  return { lines: [`你把<b>${item}</b>放到他手里。`, `<b>Lee</b>：「${line}」`] };
}
/* 恢复事件（evSheet 弹窗，同 Leo 图书馆事件款）：restored 置真、友+15、整包切池、次日晨报挂起 */
function leeRestore(item) {
  const st = G.npc.lee;
  st.restored = true;
  rel('lee', 'f', 15);
  applyLeeAfter();
  G.evF.leeMornPending = true;
  addFeed('major', '[[lee]]把那件东西攥在手里，站在井边很久没说话。然后他抬起头——眼神跟平时不一样了。');
  const lines = [
    `你把<b>${item}</b>放到他手里。`,
    '他低头看了很久。手指在那上面一遍遍地摸。',
  ];
  if (LEE_RESTORE_EVT.length) lines.push(...LEE_RESTORE_EVT.slice(0, 4));   // 3-4 段渐进节奏（第一段泛指，任一遗物都能接上）
  else lines.push('<b>Lee</b>：「……我想起来了。」', '<b>Lee</b>：「全部。都想起来了。」');   // 池空回退（备案）
  lines.push('他的眼神定下来了。跟平时不一样了。');
  save();
  return { lines, ev: { k: 'leerestore' } };
}
/* 轮值照顾播报（#70）：恢复前每天最多一条、18% 出；随机照顾者＋care 池；恢复后退役 */
function leeCareEvent() {
  const st = G.npc.lee;
  if (st.restored || G._leeCareDay === G.day) return;
  if (Math.random() >= 0.18) return;
  const def = npcDef('lee');
  if (!def.care || !def.care.length) return;
  const carers = NPCS.filter(n => !['lee', 'knight'].includes(n.id)).map(n => n.id);   // 骑士守前线不参与轮值
  const cid = rnd(carers);
  addFeed('sim', `今天轮到[[${cid}]]照看[[lee]]。[[lee]]说：「${rnd(def.care)}」`, [cid, 'lee']);
  G._leeCareDay = G.day;
}

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
    /* 骑士遇怪护送（拍板 #41）：爱≥60 三成击杀、掉落归你；爱40-59 五成吓退、无掉落；每天最多救一次。
       台词池感性模型回流前为空池，触发只显示系统句 */
    const kl = G.npc.knight.l;
    const esc = !G.escortUsedDay
      ? ((kl >= 60 && Math.random() < 0.3) ? 'kill' : (kl >= 40 && kl < 60 && Math.random() < 0.5) ? 'scare' : null)
      : null;
    if (esc) {
      G.escortUsedDay = true;
      lines.push('怪物的影子从林子里压出来。');
      if (esc === 'kill') {
        const m = 1 + (Math.random() < 0.5 ? 1 : 0);
        G.bag.腐肉 = (G.bag.腐肉 || 0) + m; G.bag.骨头 = (G.bag.骨头 || 0) + 1;
        lines.push('剑光比你反应快。骑士收剑入鞘，把能捡的指给你。');
        if (KNIGHT_ESCORT_KILL.length) lines.push(`<b>骑士</b>：「${rnd(KNIGHT_ESCORT_KILL)}」`);
        lines.push(`拾获：腐肉×${m}、骨头×1`);
      } else {
        lines.push('一道白影先你一步落在它面前。是骑士。怪物退回了暗处。');
        if (KNIGHT_ESCORT_SCARE.length) lines.push(`<b>骑士</b>：「${rnd(KNIGHT_ESCORT_SCARE)}」`);
      }
    } else {
      lines.push(...monsterFight(false));
      if (G.over) return { lines };                    // 战死野外，直接进结局
    }
  } else if (act === 'gather') {
    if (Math.random() < 0.08) {
      G.bag.稀有花 = (G.bag.稀有花 || 0) + 1;
      lines.push(rnd(EXP_TEXT.gatherRare), '拾获：稀有花×1');
    } else {
      const got = ['蘑菇×2', '水果×1'];
      G.bag.蘑菇 = (G.bag.蘑菇 || 0) + 2;
      G.bag.水果 = (G.bag.水果 || 0) + 1;
      if (Math.random() < 0.5) { G.bag.木材 = (G.bag.木材 || 0) + 1; got.push('木材×1'); }
      if (Math.random() < 0.15) { G.bag.药材 = (G.bag.药材 || 0) + 1; got.push('药材×1'); }   // 供货 Isabel 收购（拍板 #40）
      if (Math.random() < 0.12) { G.bag.木板 = (G.bag.木板 || 0) + 1; got.push('木板×1'); }   // 供货 Jacob 收购（拍板 #40）
      lines.push(rnd(EXP_TEXT.gather), '拾获：' + got.join('、'));
    }
    clueDropCheck('gather', lines);   // Lee 记忆线线索：铜哨（#70）
    youFeed('gather');
  } else if (act === 'hunt') {
    if (Math.random() < winChance()) {
      const meat = 2 + Math.floor(Math.random() * 3);
      G.bag.生肉 = (G.bag.生肉 || 0) + meat;
      const got = [`生肉×${meat}`];
      if (Math.random() < 0.4) { G.bag.兔皮 = (G.bag.兔皮 || 0) + 1; got.push('兔皮×1'); }
      if (Math.random() < 0.35) { G.bag.羊毛 = (G.bag.羊毛 || 0) + 1; got.push('羊毛×1'); }   // 羊毛渠道（言拍板 2026-10-30）：打猎捎带
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
    clueDropCheck('dive', lines);     // Lee 记忆线线索：旧地图（#70）
    youFeed('dive');
  } else if (act === 'minenear') {
    const n = 1 + (Math.random() < 0.5 ? 1 : 0) + (escort ? 1 : 0);
    G.bag.铁矿 = (G.bag.铁矿 || 0) + n;
    const got = [`铁矿×${n}`];
    if (mineRoll(0.15) || (escort && Math.random() < 0.2)) { G.bag.黄金玉 = (G.bag.黄金玉 || 0) + 1; G.stats.gy++; got.push('黄金玉×1'); }   // 护送时他帮你多看一眼矿壁（言拍板 2026-10-30）
    if (Math.random() < 0.12) { G.bag.金粉 = (G.bag.金粉 || 0) + 1; got.push('金粉×1'); }   // 手绘本原料（拍板 #42）
    if (Math.random() < 0.06) { G.bag.宝石 = (G.bag.宝石 || 0) + 1; got.push('宝石×1'); }   // 项链原料（拍板 #42）
    lines.push(rnd(got.length > 1 ? EXP_TEXT.gy : EXP_TEXT.mineNear), '拾获：' + got.join('、'));
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
    if (mineRoll(0.55)) { G.bag.黄金玉 = (G.bag.黄金玉 || 0) + 1; G.stats.gy++; got.push('黄金玉×1'); }
    if (Math.random() < 0.20) { G.bag.金粉 = (G.bag.金粉 || 0) + 1; got.push('金粉×1'); }   // 手绘本原料（拍板 #42）
    if (Math.random() < 0.12) { G.bag.宝石 = (G.bag.宝石 || 0) + 1; got.push('宝石×1'); }   // 项链原料（拍板 #42）
    lines.push(rnd(got.length > 1 ? EXP_TEXT.gy : EXP_TEXT.mineFar), '拾获：' + got.join('、'));
    clueDropCheck('minefar', lines);  // Lee 记忆线线索：烧掉一半的手札（#70）
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
  const lines = m === 'ctimeout' ? [resolveNames(DUEL_TEXT.scene[reason] || DUEL_TEXT.scene.npcHit)] : [];   /* 开场句对剑弹窗已播过，结果不重播；超时判负隔了确认窗，保留交代场面 */
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
      lines.push('它看着你，一直看到瓷白碎开。');
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
    lines.push(DUEL_TEXT.cFail, '剑背把你扫倒在地。它收剑走了，没有再看你。');
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
  const mev = marryHomeEv();            // 婚姻批（#67）：偏激型夜里回家堵门求婚，优先于一切
  const ev = mev || restLoveEvent();    // 感情线：夜里在家的事件（Asher 一串）优先于入睡结算
  settleDay();                         // 缺陷A修复：夜话只推迟结算弹窗的展示，结算本身照常走（看完/选完再弹「一天结束」）
  if (ev) return { ev };
  return { settled: true };
}
function nap() {
  if (G.node !== 1) return { lines: ['只有中午能午休。'], blocked: true };
  if (G.energy >= maxE()) return { lines: ['精力是满的。'], blocked: true };
  G.energy = Math.min(maxE(), G.energy + 5);
  G.dayLog.push('午休了一会儿');
  youFeed('nap');
  return { lines: [`你睡了半个中午。精力 +5（现在 ${G.energy}）。`], settled: advanceNode() === 'settled' };
}

/* ---------- 家：和 Asher 做蛋糕（言拍板 2026-10-30 第十二场） ---------- */
/* 夜里在家才做得了（他白天不在家）；小麦1+水果1+精力1；Asher 友+3；每天一次；当场分掉不出物品 */
const CAKE_OPEN = [
  '灶上坐了水。Asher 负责看火，你负责和面。',
  '面粉沾了他一手。他看了看，接着揉。',
];
function bakeCake() {
  if (G.node < DAY_NODES) return { lines: ['他白天不在家，做不了。天黑他回来再说。'], blocked: true };
  if (G.cakeDay === G.day) return { lines: ['今天做过一次了。灶还热着。'], blocked: true };
  const lack = [];
  if ((G.bag['小麦'] || 0) < 1) lack.push('小麦×1');
  if ((G.bag['水果'] || 0) < 1) lack.push('水果×1');
  if (lack.length) return { lines: [`材料不够：还差${lack.join('、')}。`], blocked: true };
  const err = canDo('bake'); if (err) return { lines: [err], blocked: true };
  G.bag['小麦']--; if (G.bag['小麦'] <= 0) delete G.bag['小麦'];
  G.bag['水果']--; if (G.bag['水果'] <= 0) delete G.bag['水果'];
  G.cakeDay = G.day;
  G.energy -= COST.bake;
  rel('asher', 'f', 3);
  G.dayLog.push('和 Asher 做了蛋糕');
  addFeed('you', '你和[[asher]]做了蛋糕，站在灶边分着吃了。', ['asher']);
  return { lines: [rnd(CAKE_OPEN), '蛋糕不大，你们站在灶边一人一半吃完了。', '<b>Asher</b>：「比 Olivia 的甜。」'] };
}

/* ============ 感情线事件引擎（第一批·言拍板 2026-10-28） ============ */
/* 三姐妹纯友情线（拍板 #38/#40）：爱情值锁 0——无暧昧池＋打闹不涨爱情 */
const SISTERS = ['alice', 'bess', 'olivia'];
/* 每人一条顺序事件队列（LOVE_SEQ），一天一人最多触发一个（loveReady）。
   触发方式：闲聊顶替（EV_CHAT）/ 白天进图书馆撞见（Leo）/ 夜里去井边撞见（Asher）/
   夜里在家休息时自动（Asher 一串）/ Levi 两个专属按钮。
   选项走弹窗按钮 → loveChoice(key, 选)。
   告白：接受=记 G.lover（恋人档台词池由各 NPC afterRealLover/after 自带，本批不新写），
   拒绝=记 G.noPropose，线不断；告白只在单身（G.lover 空）时提出。
   婚姻层（求婚念头）不在本批。 */

const LOVE_SEQ = {
  vivienne: ['viv2'],
  levi: ['lev1', 'lev2', 'lev3', 'lev4', 'levC'],
  leo: ['leo1', 'leo2', 'leo3', 'leo4', 'leoC'],
  asher: ['ash1', 'ash2', 'ash3', 'ash4', 'ashC'],
};
const EV_CHAT = { viv2: 1, lev1: 1, leo1: 1, leo4: 1, levC: 1, leoC: 1 };   // 闲聊顶替型
const EV_GATES = {
  viv2: () => G.npc.vivienne.l >= 60,
  lev1: () => G.npc.levi.f >= 40,
  lev2: () => G.npc.levi.f >= 50 && (G.npc.levi.teases || 0) >= 3,
  lev3: () => G.npc.levi.l >= 40,
  lev4: () => G.npc.levi.l >= 55,
  levC: () => G.npc.levi.l >= 60 && G.npc.levi.f >= 60,
  leo1: () => G.npc.leo.f >= 40,
  leo2: () => G.npc.leo.l >= 35,
  leo3: () => G.npc.leo.l >= 50,
  leo4: () => G.npc.leo.l >= 60,
  leoC: () => G.npc.leo.l >= 60 && G.npc.leo.f >= 55,
  ash1: () => G.npc.asher.f >= 50,
  ash2: () => (G.nightOut || 0) >= 2,
  ash3: () => G.npc.knight.l >= 40,
  ash4: () => G.npc.asher.l >= 50,
  ashC: () => G.npc.asher.l >= 60 && G.npc.asher.f >= 70,
};

function loveSt(id) { return G.love[id] || (G.love[id] = { n: 0, day: 0 }); }
function loveDone(id) { const s = loveSt(id); s.n++; s.day = G.day; }
function loveReady(id) { return loveSt(id).day !== G.day; }

/* 队列里的下一个事件 key（走完=null；Leo 断线后全线停） */
function nextEv(id) {
  if (id === 'leo' && G.evF.leoLineDead) return null;
  const seq = LOVE_SEQ[id];
  if (!seq) return null;
  const n = loveSt(id).n;
  return n < seq.length ? seq[n] : null;
}

/* 闲聊顶替：结算按普通闲聊（精力1+时段），见 chatTail */
function chatTail(id) {
  const st = G.npc[id];
  st.last = G.day;
  G.energy -= COST.chat + (G.hurt === 2 ? 1 : 0);
  G.dayLog.push(`跟${npcDef(id).name}聊了聊`);
  G.stats.chats++;
  return advanceNode() === 'settled';
}

function chatEvPending(id) {
  const key = nextEv(id);
  if (!key || !EV_CHAT[key] || !loveReady(id)) return null;
  if (!EV_GATES[key]()) return null;
  if (key === 'lev1' && locOf(npcDef('levi'), G.node) !== 'field') return null;   // 只在农田闲聊时顶替
  if ((key === 'levC' || key === 'leoC') && G.lover) return null;                 // 告白只在单身时提出
  return runChatEv(id, key);
}

function runChatEv(id, key) {
  if (key === 'leo1') {
    loveDone('leo'); rel('leo', 'f', 1);
    return {
      lines: [
        '登记本摊在柜台上。你名字那一行，笔画比别的行深。',
        '他把本子合上了。',
        '<b>Leo</b>：「墨透了。我补的。」',
      ],
      settled: chatTail(id),
    };
  }
  if (key === 'leo4') {
    loveDone('leo'); rel('leo', 'l', 2);
    return {
      lines: [
        '里侧最好的位置上放了块小木牌，没有字。你问是谁的。',
        '<b>Leo</b>：「常来的人。就你。」',
      ],
      settled: chatTail(id),
    };
  }
  if (key === 'lev1') {
    return {
      lines: [
        '他的田垄到头就是你的地。他蹲在垄沟边拔草，顺手把你地里的也拔了。',
        '你问：「你帮所有人，你自己的田谁管。」',
        '<b>Levi</b>：「我的长得慢就慢吧。」',
      ],
      ev: { key: 'lev1', choices: [{ k: 'a', t: '明天我来管' }, { k: 'b', t: '不接话' }] },
    };
  }
  if (key === 'levC') {
    return {
      lines: [
        '太阳偏西。你们坐在田埂上。',
        '<b>Levi</b>：「我知道我不该想这些。你要是嫌烦，我照样帮你干活。」',
      ],
      ev: { key: 'levC', choices: [{ k: 'y', t: '接受' }, { k: 'n', t: '拒绝' }] },
    };
  }
  if (key === 'leoC') {
    return {
      lines: [
        '闭馆后，他递给你一本书。是你第一次借的那本。',
        '扉页有铅笔字，写了又擦过。',
        '<b>Leo</b>：「这本…你第一次借的。扉页…有字。擦掉的那句…和现在这句…是一个意思。」',
        '扉页现在的那句写着：「这本书你借过。这次不用还。」',
      ],
      ev: { key: 'leoC', choices: [{ k: 'y', t: '接受' }, { k: 'n', t: '拒绝' }] },
    };
  }
  if (key === 'viv2') {
    return {
      lines: [
        '她把你叫住了。',
        '<b>Vivienne</b>：「你要的东西我这里有。这次也照旧，拿一晚来换。」',
      ],
      ev: { key: 'viv2', choices: [{ k: 'y', t: '答应（把今晚给她）' }, { k: 'n', t: '摇头' }] },
    };
  }
  return null;
}

/* 白天进图书馆撞见（Leo 事件2/3） */
function enterEvPending() {
  if (G.node >= DAY_NODES) return null;
  const key = nextEv('leo');
  if (!key || !loveReady('leo')) return null;
  if (key === 'leo2' && EV_GATES.leo2()) {
    loveDone('leo'); rel('leo', 'l', 2);
    G.evF.leoLightLate = true;             // 当晚：图书馆的灯亮到很晚
    G.evF.leoColdDay = G.day + 1;          // 次日：他的所有回覆换成一條
    return {
      lines: [
        'Alice 在柜台还书。Leo 多擦了一遍柜台。',
        '你进门，他把抹布收进了抽屉。',
      ],
    };
  }
  if (key === 'leo3' && EV_GATES.leo3()) {
    loveDone('leo');
    return {
      lines: ['<b>Leo</b>：「Alice 的事，你看出来了。」'],
      ev: { key: 'leo3', choices: [{ k: 'a', t: '帮他去问' }, { k: 'b', t: '劝他放下' }, { k: 'c', t: '不管' }] },
    };
  }
  return null;
}

/* 夜里去井边撞见（Asher 事件2；只在你夜里出门满 2 次后，井边格子出现时） */
function wellEvPending() {
  if (G.node < DAY_NODES) return null;
  if (nextEv('asher') !== 'ash2' || !loveReady('asher') || !EV_GATES.ash2()) return null;
  loveDone('asher'); rel('asher', 'l', 1);
  G.evF.ashBedFirst = true;                // 当晚：他先你一步钻进了被窝
  return {
    lines: [
      '井后面站着一个人。是 Asher，兜里揣着弹弓。',
      '<b>Asher</b>：「我散步。」',
    ],
  };
}
/* 井边格子是否显示（夜里，仅事件待触发时） */
function ashWellPending() {
  return G.node >= DAY_NODES && nextEv('asher') === 'ash2' && loveReady('asher') && EV_GATES.ash2();
}

/* 夜里在家休息时自动（Asher 事件1/3/4、告白；只占当晚，完再入睡结算） */
function restLoveEvent() {
  if (G.node < DAY_NODES) return null;
  const key = nextEv('asher');
  if (!key || !loveReady('asher')) return null;
  if (key === 'ash1' && EV_GATES.ash1()) {
    loveDone('asher'); rel('asher', 'f', 1);
    return {
      lines: [
        '夜里你听见他翻身。',
        '<b>Asher</b>：「床的事。我就是还没习惯有自己的一张。」',
      ],
      settle: true,
    };
  }
  if (key === 'ash3' && EV_GATES.ash3()) {
    loveDone('asher');
    return {
      lines: ['<b>Asher</b>：「骑士知不知道你晚上去哪。」'],
      ev: { key: 'ash3', choices: [{ k: 'a', t: '如实说' }, { k: 'b', t: '敷衍' }, { k: 'c', t: '反问他在想什么' }] },
      settle: true,
    };
  }
  if (key === 'ash4' && EV_GATES.ash4() && G.weather && Math.random() < 0.5) {
    loveDone('asher');
    addFeed('sim', '傍晚下起了雨。[[asher]]淋着回来的。', ['asher']);
    return {
      lines: [
        '傍晚下起了雨。Asher 淋着回来的。',
        '夜里他烧得迷迷糊糊，说了一夜胡话。',
        '<b>Asher</b>：「村口。马车。他们说去去就回。」',
        '天亮时烧退了。他问：',
        '<b>Asher</b>：「我说什么了。」',
      ],
      ev: { key: 'ash4', choices: [{ k: 'y', t: '说' }, { k: 'n', t: '不说' }] },
      settle: true,
    };
  }
  if (key === 'ashC' && G.evF.bdayToday && EV_GATES.ashC()) {
    loveDone('asher');
    return {
      lines: [
        '你回到家。他还坐在桌边，没睡。',
        '<b>Asher</b>：「全村都说我是大家的孩子。」',
        '他停了一会儿。',
        '<b>Asher</b>：「我不想当你的孩子。」',
      ],
      ev: { key: 'ashC', choices: [{ k: 'a', t: '等你长大' }, { k: 'b', t: '你永远是我家人' }, { k: 'c', t: '我心里有人' }] },
      settle: true,
    };
  }
  return null;
}

/* Levi 两个专属按钮（一次性；出现在他的档案页） */
function levButton(key) {
  if (!loveReady('levi')) return { lines: ['今天他够累的了。明天再说。'], blocked: true };
  if (nextEv('levi') !== key) return { lines: ['现在没这个由头。'], blocked: true };
  if (key === 'lev3') {
    const err = canDo('gather'); if (err) return { lines: [err], blocked: true };
    loveDone('levi'); rel('levi', 'l', 4); rel('levi', 'f', 2);
    G.energy -= COST.gather + (G.hurt === 2 ? 1 : 0);
    G.dayLog.push('带 Levi 出村去林子帮忙');
    addFeed('you', '你带着[[levi]]出了村界，往林子那边去。', ['levi']);
    const lines = [
      '出了村界，就只有你们俩。',
      '你话没说完，他就答应了。答应完，他自己站了一会儿。',
      '<b>Levi</b>：「从小就这样。他们打我，都是顺手的。你是专门的。」',
    ];
    return { lines, settled: advanceNode() === 'settled' };
  }
  if (key === 'lev4') {
    const err = canDo('chat'); if (err) return { lines: [err], blocked: true };
    loveDone('levi'); rel('levi', 'l', 3);
    G.evF.leviBasket = true;               // 当晚结算：一筐东西+字条
    G.energy -= COST.chat + (G.hurt === 2 ? 1 : 0);
    G.dayLog.push('让 Levi 歇一天');
    const lines = [
      '你让他歇一天，田里的活不许他碰。',
      '<b>Levi</b>：「好。」',
    ];
    return { lines, settled: advanceNode() === 'settled' };
  }
  return { lines: ['（这个动作还没实装）'], blocked: true };
}

/* Vivienne 的消息：按进度自动挑（骑士损耗 > 村民秘密 > Lee 胡话） */
function vivInfoText() {
  const k = G.npc.knight, kn = G.knight;
  if (kn.core || kn.cond < 90) {   /* 2026-10-30 言拍板：完好（90+）不提骑士，真有伤才报；分档与状态栏四档对齐 */
    const est = rnd(kn.core ? VIV_KNIGHT_EST.core
      : kn.cond >= 65 ? VIV_KNIGHT_EST.light
      : kn.cond >= 35 ? VIV_KNIGHT_EST.mid
      : VIV_KNIGHT_EST.heavy);
    return `[[vivienne]]清点着蜡烛，压低了声音：「${est}」`;
  }
  const cands = NPCS.filter(n => n.secretHint && n.id !== 'lee' && n.id !== 'vivienne' && G.npc[n.id].f < 50);
  if (cands.length && Math.random() < 0.75) {
    const n = rnd(cands);
    return `[[vivienne]]说起[[${n.id}]]：「${n.secretHint}」`;
  }
  const lc = npcDef('lee').chat;
  const line = rnd(Array.isArray(lc) ? lc : (lc.low || lc.mid || lc.high || ['今天天气好。']));
  return `[[vivienne]]背了一条[[lee]]的胡话：「${line}」他说过的，她全记着。`;
}

/* 选项结算（弹窗按钮回调）；夜里事件的选项带 settled:true，UI 收到后入睡结算 */
function loveChoice(key, c) {
  const F = G.evF;
  if (key === 'lev1') {
    loveDone('levi');
    if (c === 'a') F.leviField = true;
    const lines = c === 'a'
      ? ['你说：明天我来管。', '<b>Levi</b>：「成。」']
      : ['你没有接话。他也没再说。'];
    return { lines, settled: chatTail('levi') };
  }
  if (key === 'levC') {
    loveDone('levi');
    if (c === 'y') {
      G.lover = 'levi';
      G.loverDay = G.day;               // 婚姻批（#67）：恋人满 60 天从此起算
      const say = rnd([
        '你可别跟我开这种玩笑，我这人当真的。',
        '以后你说什么我都听你的，你让我干啥我就干啥，别赶我走，行不行。',
        '我啥也不会说，就是心里烫得慌，只要能这么守着你，让我干什么都行。',
      ]);
      return { lines: ['你答应了。', '他低着头，伸手拽住了你的衣角。', `<b>Levi</b>：「${say}」`], settled: chatTail('levi') };
    }
    G.noPropose.levi = true;
    return { lines: ['你摇了头。', '<b>Levi</b>：「嗯。草我明天照拔。」'], settled: chatTail('levi') };
  }
  if (key === 'leoC') {
    loveDone('leo');
    if (c === 'y') {
      G.lover = 'leo';
      G.loverDay = G.day;               // 婚姻批（#67）：恋人满 60 天从此起算
      return { lines: ['你答应了。', '他把登记本翻开，把你那一行的墨又描深了一遍。'], settled: chatTail('leo') };
    }
    G.noPropose.leo = true;
    return { lines: ['你摇了头。他把那本书放回了架子上。'], settled: chatTail('leo') };
  }
  if (key === 'viv2') {
    loveDone('vivienne');
    if (c === 'y') {
      F.vivInfo = vivInfoText();                 // 先记下：结算里的 genMorning 会把它发进次日晨报
      const r = doFun('vivienne', true);         // 今晚直接结算
      if (r.blocked) { delete F.vivInfo; return r; }
      return r;
    }
    F.vivSnub = true;                            // 当晚：教堂的蜡烛没点
    return {
      lines: [
        '你摇了头。',
        '<b>Vivienne</b>：「拿去。这次不要钱。」',
        resolveNames(vivInfoText()),
      ],
      settled: chatTail('vivienne'),
    };
  }
  if (key === 'leo3') {
    if (c === 'a') {
      F.leoAskRejected = true;
      F.leoClosedUntil = G.day + 4;              // 闭馆三天，第四天重开
      const lines = [
        '你把话带到了。',
        '<b>Alice</b>：「你替我把书还了。跟他说，往后我不去了。」',
      ];
      if (G.npc.alice.l > G.npc.leo.l) lines.push('<b>Alice</b>：「他不敢自己来。他喜欢的是你，你不知道？」');
      lines.push('当天，图书馆关了门。');
      return { lines };
    }
    if (c === 'b') {
      F.leoUnresolved = true;
      return { lines: ['你劝他把这件事放下。', '<b>Leo</b>：「放着吧，反正也不重。」'] };
    }
    F.leoSkipped = true;
    return { lines: ['你没有接话。他也没再说。'] };
  }
  if (key === 'ash3') {
    if (c === 'a') {
      F.ashSabUp = true;                         // 往后你打 Alice 的主意他都插一脚
      return { lines: ['你把夜里的事一五一十说了。', '<b>Asher</b>：「行。你知道自己在干什么就行。」'], settled: true };
    }
    if (c === 'b') return { lines: ['你含糊了两句。他没有再问。'], settled: true };
    rel('asher', 'l', 1);
    return { lines: ['你反问他在想什么。', '<b>Asher</b>：「没想什么。」'], settled: true };
  }
  if (key === 'ash4') {
    if (c === 'y') return { lines: ['你把那句话原样说给他听。', '他半天没说话。', '<b>Asher</b>：「哦。」'], settled: true };
    F.ashRainSecret = true;                      // 村口马车那句，归你保管
    return { lines: ['你说不记得了。', '这个秘密归你保管。'], settled: true };
  }
  if (key === 'ashC') {
    if (c === 'a') {
      F.ashPact = true;                          // 约定档：家页添一行+留饭播报
      return { lines: ['你说：等你长大。', '<b>Asher</b>：「好。」'], settled: true };
    }
    if (c === 'b') {
      F.ashFamily = true;                        // 家人档：难过三天，之后真的变成家人
      F.ashBlueUntil = G.day + 4;
      F.ashBdayNext = G.day + 30;                // 往后每 30 天生日那天他多喝一杯
      return { lines: ['你说：你永远是我家人。', '那晚他没有再说话。'], settled: true };
    }
    F.ashSabOff = true;                          // 心里有人：拆散机制从此关停
    return { lines: ['你说：我心里有人。', '<b>Asher</b>：「我知道。我早就知道了。」', '当晚，他睡回了第二张床。'], settled: true };
  }
  return { lines: ['（这个选项还没实装）'], blocked: true };
}

/* 夜里出门计数（Asher 事件2的引子；在村里走动合法，一夜一个节点只计一次） */
function markNightOut() {
  const k = G.day * 10 + G.node;
  if (G._nOutKey === k) return;
  G._nOutKey = k;
  G.nightOut++;
}

/* 每日晨间勾子（包在 genMorning 前）：天气、雨天闲话、情报送达、生日 */
function morningLoveTick() {
  G.weather = Math.random() < 0.25 ? 1 : 0;
  if (G.weather && Math.random() < 0.3) addFeed('sim', rnd(RAIN_FEED));
  if (G.evF.vivInfo) { addFeed('morn', G.evF.vivInfo); delete G.evF.vivInfo; }
  if (G.evF.ashBdayNext && G.day >= G.evF.ashBdayNext) {
    addFeed('sim', '[[asher]]今天多喝了一杯。谁劝都没用。');
    G.evF.ashBdayNext = G.day + 30;
  }
  /* 告白排到位后，数日内某天轮到他的生日（40%/天） */
  if (nextEv('asher') === 'ashC' && EV_GATES.ashC() && !G.evF.bdayToday && Math.random() < 0.4) {
    G.evF.bdayToday = true;
    G.evF.bdayMark = G.day;               // 打上当天戳：loveNightFeed 只撤隔夜未用的
    addFeed('morn', '今天是 Asher 的生日。全村给他过了，蛋糕是 Olivia 的，酒是 Jasper 出的。');
  }
}

/* 每晚结算后勾子：当晚专属播报、Levi 一筐东西、Leo 断线判定 */
function loveNightFeed() {
  const F = G.evF;
  if (F.leviSitLate) { addFeed('sim', '[[levi]]一个人在田里坐到很晚。'); delete F.leviSitLate; }
  if (F.leoLightLate) { addFeed('sim', '图书馆的灯亮到很晚。', ['leo']); delete F.leoLightLate; }
  if (F.vivSnub) { addFeed('sim', '[[vivienne]]晚上没点教堂的蜡烛。'); delete F.vivSnub; }
  if (F.ashBedFirst) { addFeed('sim', '他先你一步钻进了被窝。', ['asher']); delete F.ashBedFirst; }
  if (F.leviBasket) {
    G.bag.小麦 = (G.bag.小麦 || 0) + 2;
    G.bag.羊毛 = (G.bag.羊毛 || 0) + 1;
    addFeed('sim', '[[levi]]晚上送来一筐东西，小麦和羊毛码得整整齐齐。筐底压着字条：「今天是我今年最开心的一天。」');
    delete F.leviBasket;
  }
  /* Leo 断线：帮问被拒后 30 天没再理他 */
  if (F.leoAskRejected && !F.leoLineDead && !(G.love.leo && G.love.leo.n >= LOVE_SEQ.leo.length) && G.day - G.npc.leo.last >= 30) {
    F.leoLineDead = true;
    addFeed('major', '[[leo]]把窗边那把椅子搬回了原位。');
  }
  if (F.bdayToday && F.bdayMark !== G.day) delete F.bdayToday;   // 生日旗标隔夜未用才撤（当晚没在家睡：改日再轮）
}

const _genMorningLove = genMorning;
genMorning = function () { morningLoveTick(); _genMorningLove(); };
const _settleDayLove = settleDay;
settleDay = function () { _settleDayLove(); loveNightFeed(); };

/* ============ 婚姻系统（言拍板 #67 2026-10-31 实装） ============
   可婚八人：神母/Levi/Leo/Isabel/Jacob/Jasper/Lee/Asher（三姐妹友情线锁爱 #38/#40、骑士不婚）。
   念头：每晚结算掷 10%；冒出后分性格触发——偏激型（神母/Jacob/Asher）回家休息时堵门口，
   温和型（Levi农田/Leo图书馆/Isabel炼药房/Jasper广场/Lee井边）白天进TA常驻地撞上。
   拒绝：占+3（固定值）＋30~90 天冷却。主控可随时主动求婚（档案页按钮）。
   婚前一切等婚后（翻案 #35）：恋人档台词改结婚当天起混入。
   出轨：对象非配偶时寻欢结算后掷骰——发现率=地点(室内8%/户外18%)+次数×5%+配偶占有欲×0.15%−处理痕迹12%，
   夹 5%~90%；两段式：先起疑（次日晨报），已起疑再被抓=摊牌（占直接100）。
   台词池 marryAsk/marryWed/suspectText/confrontText/afterCheat 池空回退系统句，成句待感性模型生产线。 */
const MARRYABLE = ['vivienne', 'levi', 'leo', 'isabel', 'jacob', 'jasper', 'lee', 'asher'];
const MARRY_HOT = ['vivienne', 'jacob', 'asher'];                               // 偏激型：回家堵门
const MARRY_PLACE = { levi: 'field', leo: 'library', isabel: 'alchemy', jasper: 'plaza', lee: 'well' };  // 温和型：白天常驻地
const MARRY_PRON = { vivienne: '她', isabel: '她', levi: '他', leo: '他', jacob: '他', jasper: '他', lee: '他', asher: '他' };

function marryCond(id) {
  if (!MARRYABLE.includes(id)) return false;
  if ((G.npc[id].l || 0) < 100) return false;
  if (id === 'asher') return G.day >= 731;                                       // 18岁门：开档满730天，不看告白线别
  if (id === 'vivienne') return !!(G.love.vivienne && G.love.vivienne.n >= 1);   // 她的夜谈（viv2）走完
  return G.lover === id && G.loverDay > 0 && G.day - G.loverDay >= 60;           // 通用型：恋人满60天
}
function marryGate(id) {
  if (G.spouse || G.engaged) return false;
  if (G.marryReady[id]) return false;
  if ((G.marryCd[id] || 0) > G.day) return false;
  return marryCond(id);
}
function marryTick() {
  if (G.spouse || G.engaged) return;
  for (const id of MARRYABLE) if (marryGate(id) && Math.random() < 0.1) G.marryReady[id] = true;
}
function marryEv(id, home) {
  const def = npcDef(id), pron = MARRY_PRON[id];
  const say = (Array.isArray(def.marryAsk) && def.marryAsk.length) ? rnd(def.marryAsk) : null;
  const lines = home
    ? [`${def.name}等在你家门口，看你的眼神，是要一个说法。`]
    : [`你一到，${def.name}就放下了手里的活，朝你走过来。`];
  if (say) lines.push(`<b>${def.name}</b>：「${say}」`);
  else lines.push(`${pron}开口说的，是婚事。`);
  return { lines, ev: { key: (home ? 'mar' : 'marP') + id, choices: [{ k: 'y', t: '答应' }, { k: 'n', t: '再想想' }] } };
}
function marryHomeEv() {                    // 偏激型：回家休息时堵门（restNow 里优先调用）
  if (G.spouse || G.engaged) return null;
  for (const id of MARRY_HOT) {
    if (!G.marryReady[id]) continue;
    G.marryReady[id] = false;
    if (!marryCond(id)) continue;           // 条件已失（如爱意褪了）：念头作废
    return marryEv(id, true);
  }
  return null;
}
function marryPlaceEv(place) {              // 温和型：白天进TA常驻地
  if (!place || G.node >= DAY_NODES || G.spouse || G.engaged) return null;
  for (const id in MARRY_PLACE) {
    if (MARRY_PLACE[id] !== place || !G.marryReady[id]) continue;
    G.marryReady[id] = false;
    if (!marryCond(id)) continue;
    return marryEv(id, false);
  }
  return null;
}
function engage(id, dawn) {                 // dawn=true：夜里堵门当场答应（结算已过）→ 当天婚礼；否则次日
  G.engaged = id;
  G.wedday = dawn ? G.day : G.day + 1;
  G.wedShown = false;
  const nm = npcDef(id).name;
  G.dayLog.push(`答应了${nm}的求婚`);
  addFeed('major', dawn ? `夜里定下的事，天不亮就传遍了：教堂有婚礼。（${nm}）` : `村里传开了：明日教堂有婚礼。（${nm}）`);
}
function marryChoice(key, c) {
  const home = !key.startsWith('marP');     // mar+id=堵门（夜，已结算）；marP+id=到地（白天）
  const id = key.replace(/^marP?/, '');
  const def = npcDef(id), pron = MARRY_PRON[id];
  if (c === 'y') {
    engage(id, home);
    return { lines: ['你点了头。', `${def.name}的求婚，你答应了。`], settled: home };
  }
  G.marryCd[id] = G.day + 30 + Math.floor(Math.random() * 61);    // 30~90 天后再开口
  G.marryReady[id] = false;                                        // 念头一并作废
  G.npc[id].p = clamp((G.npc[id].p || 0) + 3, 0, 100);            // 拒一次占+3（固定值，不乘性格系数）
  return { lines: [`${def.name}看了你很久，最后什么也没说，走了。`, `之后一段时间，${pron}不会再提这件事。`], settled: home };
}
function proposeTo(id) {                    // 主控主动求婚：条件齐→答应次日办；不齐→拖延，不扣数值可再点
  const def = npcDef(id), pron = MARRY_PRON[id];
  if (!MARRYABLE.includes(id)) return { lines: ['现在不是提这个的时候。'], blocked: true };
  if (G.spouse || G.engaged) return { lines: ['你已经有婚约在身了。'], blocked: true };
  if (id === 'asher' && G.day < 731) return { lines: ['他还不到年纪。这事急不来。'], blocked: true };
  if (marryCond(id)) {
    engage(id, false);
    return { lines: ['你开了口。', `${def.name}看了你很久，然后点头了。`, '婚事就这么定了——明天教堂。'] };
  }
  return { lines: ['你开了口。', `${def.name}听完，隔了很久才开口——${pron}想再等一等。`, '没有生气，也没有变卦。这件事以后还可以再提。'] };
}
function doWedding() {                      // 婚礼：修女主持；高好感反应池空回退系统句
  const def = npcDef(G.engaged);
  G.wedShown = true;
  G.spouse = G.engaged;
  G.engaged = null;
  G.marryReady = {}; G.marryCd = {};
  G.suspect = false;
  G.dayLog.push(`和${def.name}成了婚`);
  const lines = ['第二天，教堂的修女为你们主持了婚礼。能来的村民都来了。'];
  const said = [];
  for (const x of MARRYABLE) {
    if (x === def.id || !G.npc[x] || G.npc[x].l < 60) continue;
    const pool = npcDef(x).marryWed;
    if (Array.isArray(pool) && pool.length) said.push(`<b>${npcDef(x).name}</b>：「${rnd(pool)}」`);
  }
  if (said.length) lines.push(...said);
  else lines.push('没有人说什么怪话——今天大家都在说祝福。');
  lines.push(`从今往后，${def.name}是你的伴侣了。你们各住各的——想对方了，就走过去看看。`);
  return { lines };
}
function cheatRoll(id, cover) {             // 出轨查岗：寻欢结算后掷（两段式）；返回 null=没被发现或起疑走晨报
  const sp = G.spouse;
  if (!sp || sp === id) return null;
  const def = npcDef(id), st = G.npc[id];
  st.cheatN = (st.cheatN || 0) + 1;
  const home = def.loc[3] || def.loc[4] || 'home';
  const base = (PLACES[home] || {}).outdoor ? 0.18 : 0.08;
  const chance = clamp(base + st.cheatN * 0.05 + (G.npc[sp].p || 0) * 0.0015 - (cover ? 0.12 : 0), 0.05, 0.9);
  if (Math.random() >= chance) return null;
  const spd = npcDef(sp), pron = MARRY_PRON[sp] || 'TA';
  if (!G.suspect) {
    G.suspect = true;
    addFeed('morn', `${spd.name}最近看你的眼神，有点不一样了。`);
    return null;
  }
  G.suspect = false;
  G.npc[sp].p = 100;
  const lines = [`${spd.name}把你做的事，一件一件摊开了。${pron}什么都知道了。`];
  const pool = spd.confrontText;
  if (Array.isArray(pool) && pool.length) lines.push(`<b>${spd.name}</b>：「${rnd(pool)}」`);
  lines.push('那晚之后，有些东西回不去了。');
  return lines;
}
