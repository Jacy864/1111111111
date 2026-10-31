/* ============ 村庄文游 · 引擎逻辑测试（2026-10-30 重建版，随仓库保存） ============ */
/* 拼接在 data.js + engine.js 之后运行：cat src/data.js src/engine.js tests/engine-body.js > _bundle.js */
/* 确定性用例桩 Math.random；另设 30 种子随机浸泡。运行方式见 tests/README.md */
let PASS = 0, FAIL = 0; const FAILS = [];
const REAL_RANDOM = Math.random;
function t(name, fn) {
  try { fn(); PASS++; }
  catch (e) { FAIL++; FAILS.push(`${name}：${e && e.message}`); console.log(`  ✗ ${name}：${e && e.message}`); }
}
function eq(a, b, m) { if (a !== b) throw new Error(`${m || ''} 期望 ${JSON.stringify(b)}，实得 ${JSON.stringify(a)}`); }
function ok(v, m) { if (!v) throw new Error(m || '应为真'); }
function between(v, lo, hi, m) { if (v < lo || v > hi) throw new Error(`${m || ''} 期望 ${lo}~${hi}，实得 ${v}`); }
function fix(v) { Math.random = () => v; }
function seq(...vs) { let i = 0; Math.random = () => vs[i++ % vs.length]; }
function mulberry(seed) { let a = seed >>> 0; Math.random = () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let x = Math.imul(a ^ (a >>> 15), 1 | a); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; }
function fresh() { Math.random = REAL_RANDOM; localStorage.removeItem(SAVE_KEY); SIM_RECENT.length = 0; newGame(); }

/* ============ 一、时间与精力 ============ */
t('T1 时段推进与入夜', () => {
  fresh(); eq(G.node, 0);
  advanceNode(); eq(G.node, 1, '上午→中午');
  advanceNode(); eq(G.node, 2, '中午→下午');
  advanceNode(); eq(G.node, 3, '下午→上半夜');
  const r = advanceNode(); eq(r, 'ok', '进下半夜'); eq(G.node, 4, '上半夜→下半夜');
  eq(advanceNode(), 'settled', '下半夜后结算'); eq(G.node, 0, '次日清晨'); eq(G.day, 2, '第 2 天');
});
t('T2 午休只在中午', () => {
  fresh(); G.node = 0; ok(nap().blocked, '上午不能午休');
  G.node = 1; G.energy = 10;
  const r = nap(); ok(!r.blocked, '中午可午休'); eq(G.energy, 15, '+5');
  G.node = 1; G.energy = 18; nap(); eq(G.energy, 20, '封顶 20');   // 午休占时间格，重置回中午再试
});

/* ============ 二、经济与交易 ============ */
t('T3 买入与卖出', () => {
  fresh(); const c0 = G.coins;
  const r = tradeBuy('bess', '箭矢', 5);
  ok(!r.blocked, '买箭矢'); eq(G.coins, c0 - 5, '扣款'); eq(G.bag['箭矢'], 15, '加 5 支（10+5）');
  G.bag['铁矿'] = 1;
  tradeSell('bess', '铁矿', 5); eq(G.coins, c0 - 5 + 5, '卖回'); eq(G.bag['铁矿'], undefined, '出手');
});
t('T4 熟人收购加价两成', () => {
  fresh(); G.npc.bess.f = 60; G.bag['铁矿'] = 1; const c0 = G.coins;
  tradeSell('bess', '铁矿', 5);
  eq(G.coins - c0, 6, '5 币熟人价 6');
});
t('T5 钱不够买不了', () => {
  fresh(); G.coins = 1;
  ok(tradeBuy('bess', '箭矢', 5).blocked, '拦下');
});
t('T6 Levi 只卖不收（羊毛渠道·言拍板 2026-10-30）', () => {
  fresh();
  const tr = npcDef('levi').trade;
  ok(tr && tr.sell && tr.sell.some(x => x[0] === '羊毛' && x[1] === 3), 'Levi 卖羊毛 3 币');
  eq(tr.buy, undefined, '只卖不收（UI 侧需守卫）');
  const c0 = G.coins;
  const r = tradeBuy('levi', '羊毛', 3);
  ok(!r.blocked, '成交'); eq(G.bag['羊毛'], 1, '入包'); eq(G.coins, c0 - 3, '扣 3 币');
});

/* ============ 三、探险掉落 ============ */
t('T7 采集基础掉落', () => {
  fresh(); seq(0.99, 0.99, 0.99, 0.99, 0.99, 0.99);   // 无稀有花、无木/药/板
  const r = doExplore('forest', 'gather');
  ok(!r.blocked, '采集'); eq(G.bag['蘑菇'], 2, '蘑菇2'); eq(G.bag['水果'], 1, '水果1');
  eq(G.bag['稀有花'], undefined, '这次没稀有花');
});
t('T8 打猎：生肉＋羊毛捎带（新渠道）', () => {
  fresh();
  /* 打猎随机顺序：①命中(0.675) ②肉2+floor(r*3) ③兔皮40% ④羊毛35% ⑤文案rnd ⑥武力40% */
  seq(0.1, 0.9, 0.9, 0.3, 0.9, 0.9);                  // 赢/肉4/无皮/掉毛/无武力
  doExplore('plain', 'hunt');
  eq(G.bag['生肉'], 3 + 4, '初始3+猎4');
  eq(G.bag['兔皮'], undefined, '这次没皮');
  eq(G.bag['羊毛'], 1, '35% 捎带羊毛（言拍板 2026-10-30）');
  G.node = 0; seq(0.1, 0.9, 0.9, 0.9, 0.9, 0.9);      // 第4掷0.9≥0.35 → 不掉毛
  doExplore('plain', 'hunt');
  eq(G.bag['羊毛'], 1, '65% 不掉，还是 1');
});
t('T9 夜间探险全拦（夜间世界规则 2026-10-27）', () => {
  fresh(); G.node = 3;
  for (const z of ['forest', 'water', 'mine', 'plain']) {
    const r = doExplore(z, 'gather');
    ok(r.blocked && r.lines[0].includes('夜里'), z + ' 夜拦');
  }
});

/* ============ 四、送礼与手作 ============ */
t('T10 手作礼物加分', () => {
  fresh(); G.bag['编制小猫'] = 1;
  const f0 = G.npc.asher.f;
  doGift('asher', '编制小猫');
  eq(G.npc.asher.f - f0, GIFT_SCORE['编制小猫'].asher, 'Asher +10');
});
t('T11 花入送礼单·骑士最高（言拍板 2026-10-30）', () => {
  fresh();
  ok(GIFT_ITEMS.includes('花'), '花在送礼单');
  G.bag['花'] = 1;
  const f0 = G.npc.knight.f;
  const r = doGift('knight', '花');
  ok(!r.blocked, '送出');
  eq(G.npc.knight.f - f0, GIFT_SCORE['花'].knight, '骑士 +6');
  const vals = Object.entries(GIFT_SCORE['花']).filter(([id]) => id !== 'knight');
  ok(vals.every(([, v]) => GIFT_SCORE['花'].knight > v), '骑士全表最高');
  eq(G.bag['花'], undefined, '出手');
});
t('T12 每人每天一份', () => {
  fresh(); G.bag['花'] = 2; G.bag['蘑菇'] = 1;
  doGift('leo', '花');
  const r2 = doGift('leo', '蘑菇');
  ok(r2.blocked && r2.lines[0].includes('已经送过'), '第二份拦下');
});
t('T13 手作：羊毛两只能做猫（拍板 #42）', () => {
  fresh(); G.blueprints.cat = true;
  G.bag['羊毛'] = 2;
  const r = doPlaceAction('home', 'craft', 'cat');
  ok(!r.blocked, '做成'); eq(G.bag['编制小猫'], 1, '入包'); eq(G.bag['羊毛'], undefined, '原料扣尽即删键');
});

/* ============ 五、夜话与结算（缺陷A回归） ============ */
t('T14 Asher 夜话当晚照常结算（缺陷A回归）', () => {
  fresh(); G.npc.asher.f = 55; G.node = 3;
  const day0 = G.day;
  const r = restNow();
  ok(r.ev && r.ev.settle === true, 'ash1 夜话事件返回');
  eq(G.day, day0 + 1, '一次休息进次日（不再卡天）');
  eq(G.node, 0, '清晨');
});

/* ============ 六、存档 ============ */
t('T15 存档 round-trip', () => {
  fresh(); G.coins = 77; G.bag['羊毛'] = 3; save();
  const raw = localStorage.getItem(SAVE_KEY);
  ok(raw && JSON.parse(raw).coins === 77, '落盘');
  const okLoad = load();
  ok(okLoad, '读回'); eq(G.coins, 77); eq(G.bag['羊毛'], 3);
});

t('T17 和 Asher 做蛋糕（言拍板 2026-10-30 第十二场）', () => {
  fresh();
  G.bag['小麦'] = 1; G.bag['水果'] = 1;
  ok(bakeCake().blocked, '白天他不在家，拦');
  G.node = 3;
  delete G.bag['小麦'];
  ok(bakeCake().blocked, '缺小麦，拦');
  G.bag['小麦'] = 1;
  const f0 = G.npc.asher.f; const e0 = G.energy; const d0 = G.day;
  const r = bakeCake();
  ok(!r.blocked, '做成');
  eq(G.npc.asher.f - f0, 3, '友+3');
  eq(e0 - G.energy, 1, '精力1');
  eq(G.day, d0, '夜里互动不翻页');
  eq(G.bag['小麦'], undefined, '小麦耗尽删键');
  eq(G.bag['水果'], undefined, '水果耗尽删键');
  G.bag['小麦'] = 1; G.bag['水果'] = 1;
  ok(bakeCake().blocked, '每天一次');
});

/* ============ 六b、矿越挖越熟＋骑士护送（言拍板 2026-10-30） ============ */
t('T18 矿越挖越熟：空镐递增、封顶、出玉清零', () => {
  fresh();
  G.node = 0; G.energy = 20;
  fix(0.5); doExplore('mine', 'minenear');                       // p=0.15，0.5 不中
  eq(G.mineDry, 1, '空一镐，干涸+1');
  G.mineDry = 6; fix(0.4); doExplore('mine', 'minefar');         // p=0.55+封顶0.30=0.85，0.4 中
  eq(G.mineDry, 0, '出玉清零');
  eq(G.bag['黄金玉'], 1, '深矿出玉');
});
t('T19 骑士护送多看一眼矿壁：主roll空手、护送额外roll出玉', () => {
  fresh();
  G.node = 0; G.energy = 20; G.npc.knight.f = 60;
  /* seq：escort判定0.0成立 → 遇怪(忽略) → 铁矿n → 主roll0.9空手 → 护送额外0.1命中 */
  seq(0.0, 0.9, 0.9, 0.9, 0.1); doExplore('mine', 'minenear');
  eq(G.bag['黄金玉'], 1, '护送加成出玉');
  eq(G.mineDry, 1, '主roll空手照常计数');
});

/* ============ 六c、肢体互动（言拍板 2026-10-30 第十九场） ============ */
t('T20 摸头门槛与每日一次', () => {
  fresh();
  G.npc.asher.f = 29;
  ok(doTouch('asher', 'pat').blocked, '友29 摸头拦');
  G.npc.asher.f = 30;
  const r = doTouch('asher', 'pat');
  ok(!r.blocked, '友30 摸头过');
  eq(G.npc.asher.f, 31, '友+1');
  ok(doTouch('asher', 'pat').blocked, '当天第二次拦');
});
t('T21 姐妹线亲脸颊拦（爱恒0）；依偎夜里限定＋爱门槛＋每日一次', () => {
  fresh();
  ok(doTouch('alice', 'kiss').blocked, '姐妹线爱恒0，亲脸颊拦');
  G.npc.knight.l = 90;
  ok(doTouch('knight', 'cuddle').blocked, '白天依偎拦');
  G.node = 3;
  ok(!doTouch('knight', 'cuddle').blocked, '夜里依偎过');
  eq(G.npc.knight.l, 91, '爱+1');
  ok(doTouch('knight', 'cuddle').blocked, '当天第二次拦');
});
t('T22 恢复前 Lee 肢体互动全锁、恢复后解开（言拍板 2026-10-30 翻案 #61）', () => {
  fresh();
  TOUCH_OPEN.push('lee');                    // 测试构造：模拟 Lee 开放后的状态
  G.npc.lee.f = 40; G.npc.lee.l = 80;
  ok(doTouch('lee', 'pat').blocked, '恢复前摸头拦（翻案：全锁）');
  ok(doTouch('lee', 'hug').blocked, '恢复前拥抱拦');
  ok(doTouch('lee', 'kiss').blocked, '恢复前亲脸颊拦');
  G.node = 3;
  ok(doTouch('lee', 'cuddle').blocked, '恢复前依偎拦');
  G.npc.lee.restored = true;
  ok(!doTouch('lee', 'pat').blocked, '恢复后摸头解开');
  ok(!doTouch('lee', 'kiss').blocked, '恢复后亲脸颊解开');
  TOUCH_OPEN.pop();
});

/* ============ 六c、偶遇系统（言拍板 #68 2026-10-31 实装） ============ */
t('T23 偶遇：掷骰与地点过滤、每时间格一次、一人一天一次、纯氛围', () => {
  fresh(); G.node = 0; MEET_NODE = -1;
  for (const k in G.npc) G.npc[k].meetDay = G.day;      // 封全场，只留 Jacob（他无通用句，地点过滤可测）
  G.npc.jacob.meetDay = 0;
  const f0 = G.npc.jacob.f, l0 = G.npc.jacob.last;
  fix(0.9); doMeetCheck('well');                        // 白天 0.9 ≥ 0.4 不中
  ok(G.feed.every(e => e.t !== 'meet'), '掷骰未中不该偶遇');
  fix(0.1); doMeetCheck('library');                     // Jacob 无图书馆句；矿洞口句 p:'zone' 不触发 → 无候选
  ok(G.feed.every(e => e.t !== 'meet'), '地点不匹配与 zone 句不该触发');
  fix(0.1); doMeetCheck('well');                        // 唯一候选：Jacob 井边句
  const m1 = G.feed[G.feed.length - 1];
  eq(m1.t, 'meet', '触发偶遇');
  ok(m1.html.includes('Jacob') && m1.html.includes('桶这么重'), '命中井边句（含场景前缀拼接）');
  eq(G.npc.jacob.meetDay, G.day, '当日偶遇戳');
  eq(G.npc.jacob.f, f0, '不涨友（纯氛围）');
  eq(G.npc.jacob.last, l0, '不算见过（冷落判定不动，言拍板）');
  fix(0.1); doMeetCheck('home');
  ok(G.feed[G.feed.length - 1] === m1, '每时间格最多一次');
  G.npc.olivia.meetDay = 0; MEET_NODE = -1; fix(0.1); doMeetCheck('bakery');   // 放行 Olivia：烘焙坊店门口句
  const m2 = G.feed[G.feed.length - 1];
  ok(m2 !== m1 && m2.t === 'meet', '第二位村民触发');
  ok(m2.html.includes('Olivia') && !m2.html.includes('Jacob'), '一人一天不重复');
});
t('T23b 偶遇夜句与例外夜限定：夜里只出 night 句、Jacob 钟楼顶需夜宿', () => {
  fresh(); G.node = DAY_NODES; MEET_NODE = -1; G.nightJacobAtTower = false;
  for (const k in G.npc) G.npc[k].meetDay = 0;
  fix(0.1); doMeetCheck('well');                        // 夜里 0.1 < 0.25：候选=Bess 窗下＋Isabel 窗外（夜·通用）
  const m = G.feed[G.feed.length - 1];
  eq(m.t, 'meet', '夜句触发');
  ok(m.html.includes('bess') || m.html.includes('isabel'), '夜通用句（井边白天的句子不该出）');
  for (const k in G.npc) G.npc[k].meetDay = G.day;      // 封别人的池，只留 Jacob
  G.npc.jacob.meetDay = 0;
  MEET_NODE = -1; fix(0.1); doMeetCheck('belltower');
  ok(G.feed[G.feed.length - 1] === m, '未夜宿钟楼，钟楼顶句不出');
  G.nightJacobAtTower = true; MEET_NODE = -1; fix(0.1); doMeetCheck('belltower');
  const m2 = G.feed[G.feed.length - 1];
  ok(m2 !== m && m2.t === 'meet' && m2.html.includes('jacob'), '例外夜钟楼顶句触发');
});

/* ============ 六b、婚姻系统（言拍板 #67 2026-10-31） ============ */
t('T24 婚姻：念头门槛/分型触发/婚礼/恋人档切换翻案/拒绝冷却', () => {
  fresh();
  /* 通用型门槛：爱100 + 恋人满60天，10%念头 */
  G.npc.leo.l = 100; G.lover = 'leo'; G.loverDay = G.day;
  fix(0.01); marryTick(); ok(!G.marryReady.leo, '不满60天不出念头');
  G.day += 60;                                            // 恋人第60天
  fix(0.99); marryTick(); ok(!G.marryReady.leo, '掷骰未中不出');
  fix(0.01); marryTick(); ok(!!G.marryReady.leo, '条件齐+掷中→念头');
  /* 温和型：夜里到地不出；白天进图书馆触发 */
  G.node = DAY_NODES; ok(marryPlaceEv('library') === null, '夜里到地不出');
  G.node = 0;
  const ev = marryPlaceEv('library');
  ok(ev && ev.ev.key === 'marPleo', '白天进图书馆→到地求婚');
  ok(!G.marryReady.leo, '念头一次性消耗');
  /* 答应：次日婚礼；修女主持；反应池空回退系统句 */
  const r = marryChoice('marPleo', 'y');
  eq(G.engaged, 'leo', '已订婚'); eq(G.wedday, G.day + 1, '次日婚礼'); ok(!r.settled, '白天答应不当晚结算');
  G.day++; const w = doWedding();
  eq(G.spouse, 'leo', '已成婚'); eq(G.engaged, null, '订婚清空');
  ok(w.lines.some(l => l.includes('修女')), '修女主持');
  ok(w.lines.some(l => l.includes('祝福')), '反应池空→回退系统句');
  /* 恋人档台词：结婚当天起混入，未婚不切（翻案 #35） */
  const leoDef = npcDef('leo');
  const hadPool = Array.isArray(leoDef.afterRealLover) && leoDef.afterRealLover.length > 0;
  if (hadPool) {
    ok(poolArr(leoDef, 'chat', G.npc.leo).includes(leoDef.afterRealLover[0]), '婚后恋人档混入');
    G.spouse = null;
    ok(!poolArr(leoDef, 'chat', G.npc.leo).includes(leoDef.afterRealLover[0]), '未婚不切恋人档');
  }
  /* 偏激型堵门：神母夜谈走完+爱100 → 回家堵门口，夜里答应当天成礼 */
  G.spouse = null; G.engaged = null; G.wedShown = true;
  G.npc.vivienne.l = 100; G.love.vivienne = { n: 1, day: 1 };
  G.marryReady.vivienne = true;
  const hv = marryHomeEv();
  ok(hv && hv.ev.key === 'marvivienne', '偏激型堵门口');
  const r2 = marryChoice('marvivienne', 'y');
  eq(G.wedday, G.day, '夜里答应当天成礼'); ok(r2.settled, '堵门答复跟入睡结算');
  /* 拒绝：占+3固定值 + 30~90天冷却 */
  fresh(); G.npc.leo.l = 100; G.lover = 'leo'; G.loverDay = 1; G.day = 61;
  G.marryReady.leo = true; const p0 = G.npc.leo.p || 0;
  fix(0.5); marryChoice('marPleo', 'n');
  eq(G.npc.leo.p, Math.min(100, p0 + 3), '拒婚占+3');
  between(G.marryCd.leo - G.day, 30, 90, '冷却30~90天');
  fix(0.01); marryTick(); ok(!G.marryReady.leo, '冷却内不再冒念头');
});

t('T24b 婚姻：Asher年龄门/主动求婚/出轨两段式+处理痕迹', () => {
  fresh();
  /* Asher：爱100但未满730天→年龄门拦死 */
  G.npc.asher.l = 100; G.day = 100;
  fix(0.01); marryTick(); ok(!G.marryReady.asher, '未满18岁门');
  const pr = proposeTo('asher');
  ok(pr.blocked && pr.lines[0].includes('年纪'), '主动求也被年龄门拦');
  G.day = 731; fix(0.01); marryTick(); ok(!!G.marryReady.asher, '满730天+掷中→念头（不看告白线别）');
  /* 主动求婚：条件不齐→拖延不扣数值；条件齐→答应次日办 */
  fresh(); G.npc.levi.l = 80; G.lover = 'levi'; G.loverDay = G.day; G.day += 100;
  const pd = proposeTo('levi');
  ok(!pd.blocked && pd.lines.some(l => l.includes('等一等')), '条件不齐→拖延');
  G.npc.levi.l = 100;
  const pa = proposeTo('levi');
  eq(G.engaged, 'levi', '条件齐→答应了'); eq(G.wedday, G.day + 1, '次日婚礼');
  /* 出轨：对象非配偶才记账；两段式查岗；处理痕迹压上限 */
  fresh(); G.spouse = 'leo'; G.npc.levi.l = 100;
  fix(0.99); const f1 = doFun('levi', true, true);
  ok(f1.lines.some(l => l.includes('收拾干净')), '处理痕迹过渡句');
  eq(G.energyDebt, 10, '精力债挂上'); eq(G.npc.levi.cheatN, 1, '出轨记账');
  eq(G.suspect, false, '第一夜没被抓');
  fix(0.01); doFun('levi', true, false);
  eq(G.suspect, true, '第二段前置：起疑（走晨报）');
  fix(0.01); const f3 = doFun('levi', true, false);
  ok(f3.lines.some(l => l.includes('摊开')), '已起疑再被抓→摊牌');
  eq(G.npc.leo.p, 100, '摊牌后占有欲拉满');
  eq(cheatRoll('leo', false), null, '配偶本人不算出轨');
  eq(G.npc.leo.cheatN || 0, 0, '配偶不记账');
  /* 起疑后配偶闲聊混入 suspectText（池空不触发；补词即活）。注意：上面摊牌步已清起疑，这里重新置起疑再验 */
  const leoSus = npcDef('leo');
  leoSus.suspectText = ['【起疑试探】这句话不该出现在闲聊里。'];
  G.suspect = true;
  const mixArr = poolArr(leoSus, 'chat', G.npc.leo);
  ok(mixArr.includes('【起疑试探】这句话不该出现在闲聊里。'), '起疑时配偶闲聊混入试探池');
  G.suspect = false;
  ok(!poolArr(leoSus, 'chat', G.npc.leo).includes('【起疑试探】这句话不该出现在闲聊里。'), '未起疑不混入');
  leoSus.suspectText = [];
});

/* ============ 七、浸泡：30 种子 × 45 天随机乱玩 ============ */
t('T16 浸泡不变量', () => {
  const endings = {};
  for (let seed = 1; seed <= 30; seed++) {
    Math.random = REAL_RANDOM; localStorage.removeItem(SAVE_KEY); SIM_RECENT.length = 0; newGame();
    mulberry(seed * 7919);
    let guard = 0;
    while (!G.over && G.day <= 45 && guard++ < 6000) {
      const acts = [
        () => doExplore('forest', 'gather'), () => doExplore('plain', 'hunt'),
        () => doExplore('water', 'fish'), () => doExplore('mine', 'minenear'),
        () => doPlaceAction('plaza', 'pickflower'), () => doPlaceAction('well', 'water'),
        () => doPlaceAction('field', 'helpfarm'),
        () => tradeBuy('levi', '羊毛', 3), () => tradeBuy('bess', '箭矢', 5),
        () => interact('knight', 'chat'), () => interact('levi', 'chat'),
        () => { G.bag['花'] = (G.bag['花'] || 0) + 1; return doGift('knight', '花'); },
        () => { G.bag['编制小猫'] = (G.bag['编制小猫'] || 0) + 1; return doGift('asher', '编制小猫'); },
        () => restNow(),
        () => { G.node = 4; advanceNode(); },
      ];
      acts[Math.floor(Math.random() * acts.length)]();
      between(G.energy, 0, 20, `seed${seed} 精力越界`);
      between(G.node, 0, 4, `seed${seed} 时段越界`);
      ok(G.coins >= 0, `seed${seed} 负币`);
      for (const n of NPCS) {
        between(G.npc[n.id].f, 0, 100, `seed${seed} ${n.id} 友越界`);
        between(G.npc[n.id].l, 0, 100, `seed${seed} ${n.id} 爱越界`);
      }
      ok(G.feed.length <= 80, `seed${seed} 播报超限`);
      ok(G.chronicle.length <= 60, `seed${seed} 编年史超限`);
    }
    const key = G.over ? `${G.over.t}(第${G.over.day}天)` : `存活至第${G.day}天`;
    endings[key] = (endings[key] || 0) + 1;
  }
  Math.random = REAL_RANDOM;
  console.log('  浸泡结局分布：' + JSON.stringify(endings));
});

console.log(`\n========== 引擎逻辑测试：${PASS} 过 / ${FAIL} 挂 ==========`);
for (const f of FAILS) console.log('✗ ' + f);
