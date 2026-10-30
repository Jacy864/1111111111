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
