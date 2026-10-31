/* ============ 村庄文游 · UI 层（第一批） ============ */

const V = { tab: 'village', place: null, chronDay: null, feedAll: false, endingChoice: 0 };

const $ = s => document.querySelector(s);
const app = () => $('#main');

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

/* ---------- 顶栏 ---------- */
function renderStatus() {
  $('#statline').innerHTML =
    `<span class="st">第 ${G.day} 天 · ${NODE_NAMES[G.node]}</span>` +
    `<span class="st">精力 ${G.energy}/${maxE()}</span>` +
    `<span class="st">安娜币 ${G.coins}</span>` +
    `<span class="st">武力 ${G.force}</span>` +
    (G.weather ? `<span class="st">雨</span>` : '') +
    (G.hurt ? `<span class="st warn-st">${hurtWord()}</span>` : '');
}

/* ---------- 播报流 ---------- */
function feedHtml() {
  const all = visibleFeed().slice(-30).reverse();
  const starred = Object.keys(G.stars).some(k => G.stars[k]);
  const hint = starred ? '' : `<div class="feed-hint">在人物界面星标后，这里只显示与TA有关的事。现在显示全部。</div>`;
  if (!all.length) return `<div class="feed-hint">${starred ? '星标的人这段时间没有动静。' : '村里还没有动静。'}</div>`;
  const item = e => {
    const tag = e.t === 'you' ? '<span class="ftag you">你</span>' : e.t === 'major' ? '<span class="ftag major">大事</span>' : e.t === 'meet' ? '<span class="ftag meet">偶遇</span>' : '';
    return `<div class="feed ${e.t}"><div class="fmeta">第${e.d}天 ${NODE_NAMES[e.n]}${tag}</div><div class="ftext">${e.html}</div></div>`;
  };
  const shown = V.feedAll ? all : all.slice(0, 6);
  const more = all.length > 6
    ? `<button class="feed-more" data-act="feed-toggle">${V.feedAll ? '收起播报' : `更早的播报 · 还有 ${all.length - 6} 条`}</button>`
    : '';
  return hint + shown.map(item).join('') + more;
}

/* ---------- 村庄页 ---------- */
function villageHtml() {
  if (V.place) return placeHtml(V.place);
  const night = G.node >= DAY_NODES;
  let html = `<div class="sec-title">去哪</div>`;
  if (night) html += `<div class="night-note">夜里怪物横行，全村闭户。村里房屋互通，想去谁家从下面进。<br>还开着门的铺子：炼药房（Isabel 睡沙发）、图书馆（Leo 守着灯）${G.nightJacobAtTower ? '、钟楼（Jacob 今夜没回家）' : ''}。钟楼的门夜里不锁，上楼能朝楼下的影子放箭。骑士在前线。</div>`;
  if (G.knight.core) {
    const left = Math.max(0, G.knight.doomEnd - G.day);
    html += `<div class="card doom"><div class="b">骑士碎在了村口。还能撑 ${left} 天。</div><div class="dim">胸口的裂缝露着玉色的芯。金粉还能吊住他——白天挖到黄金玉就补，一天都别断。夜里怪物还会来，他带伤出去赶，每赶一夜裂得深一分。皇帝的信使三十天后到。</div></div>`;
  }
  html += `<div class="grid">`;
  for (const [pid, p] of Object.entries(PLACES)) {
    if (pid === 'home') continue;
    if (pid === 'well' && night && ashWellPending()) {   // 感情线：Asher 事件2待触发时，井边夜里可见
      html += `<button class="cell" data-place="well">${p.name}</button>`;
      continue;
    }
    if (pid === 'belltower' && night) {                  // 钟楼夜射（拍板 #41）：夜里钟楼始终上得去
      html += `<button class="cell" data-place="belltower">钟楼${G.nightJacobAtTower ? '<span class="pwho">Jacob</span>' : ''}</button>`;
      continue;
    }
    const who = NPCS.filter(n => locOf(n, G.node) === pid && (G.node < DAY_NODES || (n.nightStay || n.id === 'jacob' && G.nightJacobAtTower)));
    if (night && !who.length) continue;   // 夜里没人的铺子不开门
    const label = who.length ? `<span class="pwho">${who.map(n => n.name).join('·')}</span>` : '';
    html += `<button class="cell" data-place="${pid}">${p.name}${label}</button>`;
  }
  html += `</div>`;
  if (night) {
    /* 夜间世界规则（言拍板 2026-10-27）：全村闭户、屋里互通——各家可敲门找；Asher 在你家不列；骑士在前线 */
    const homes = NPCS.filter(n => locOf(n, G.node) === 'home' && n.id !== 'asher');
    html += `<div class="sec-title">夜里能找的人</div>`;
    html += homes.map(n => npcCard(n)).join('');
    html += npcCard(npcDef('knight'));
    html += `<div class="dim" style="margin:4px 2px">骑士在前线杀怪，天亮前后经过村口。</div>`;
  }
  html += `<div class="sec-title" id="feed-sec">播报</div><div class="feed-wrap">${feedHtml()}</div>`;
  return html;
}

function placeHtml(pid) {
  const p = PLACES[pid];
  const who = NPCS.filter(n => locOf(n, G.node) === pid);
  let html = `<button class="back" data-place="">← 村庄</button>`;
  html += `<div class="sec-title">${p.name}</div><div class="place-desc">${p.desc}</div>`;
  let acts = '';
  if (pid === 'plaza') acts += `<button class="btn" data-act="pickflower">摘野花（精力1${G.flowersPickedDay >= 2 ? '·今日已够' : ''}）</button>`;
  if (pid === 'well') acts += `<button class="btn" data-act="water">打水（精力0）</button>`;
  if (pid === 'church' && who.some(n => n.id === 'vivienne')) acts += `<button class="btn" data-act="pray">祈祷（精力1）</button>`;
  if (pid === 'library' && who.some(n => n.id === 'leo')) {
    acts += `<button class="btn" data-act="study">看半天书（精力1·武力+）</button>`;
    /* 学图纸（拍板 #42）：未学的逐张列出，一张精力1、占时间格 */
    for (const [k, c] of Object.entries(CRAFT)) {
      if (!G.blueprints[k]) acts += `<button class="btn" data-act="blueprint" data-k="${k}">学图纸·〈${c.name}〉（精力1）</button>`;
    }
  }
  if (pid === 'field' && G.node < DAY_NODES && locOf(npcDef('levi'), G.node) === 'field')
    acts += `<button class="btn" data-act="helpfarm">帮工换粮（精力3·小麦+）</button>`;   // 帮工（拍板 #42）：羊毛70%随行
  if (pid === 'belltower' && G.node >= DAY_NODES) {   // 钟楼夜射（拍板 #41）
    const sn = G.arrowsShotNight || 0;
    const tag = sn >= 3 ? '·今晚没得射了' : ((G.bag.箭矢 || 0) < 1 ? '·箭袋空了' : `·${sn}/3`);
    acts += `<button class="btn" data-act="shoot">放箭（精力2·箭1${tag}）</button>`;
  }
  if (acts) html += `<div class="actrow2">${acts}</div>`;
  if (!who.length) html += `<div class="dim">这里现在没有人。</div>`;
  else html += who.map(n => npcCard(n)).join('');
  return html;
}

function npcCard(n) {
  const s = G.npc[n.id];
  return `<button class="npc-card" data-npc="${n.id}">
    <span class="nname">${n.name}${G.stars[n.id] ? '<span class="star-mark">★</span>' : ''}</span>
    <span class="njob">${n.job}</span>
    <span class="nrel">${friendWord(n.id)}${s.l >= 15 ? ' · ' + loveWord(n.id) : ''}</span>
  </button>`;
}

/* ---------- 家页 ---------- */
function homeHtml() {
  const s = G.npc.asher;
  let html = `<div class="sec-title">家</div>`;
  html += `<div class="card">
    <div class="row"><b>Gloria</b><span class="dim">猎户·外来者</span></div>
    <div class="dim">精力 ${G.energy}/${maxE()} · 武力 ${G.force} · 安娜币 ${G.coins}${G.hurt ? ` · ${hurtWord()}` : ''}</div>
    <div class="actrow2">
      ${G.node === 1 && G.energy < maxE() ? `<button class="btn" data-act="nap">午休（+5精力）</button>` : ''}
      ${G.hurt ? `<button class="btn" data-act="heal">治疗药水</button>` : ''}
      <button class="btn" data-act="rest">休息（结束今天）</button>
    </div>
  </div>`;
  html += `<div class="sec-title">同住</div>`;
  html += npcCard(npcDef('asher'));
  html += `<div class="dim" style="margin:6px 2px">他白天在图书馆、广场或农田，天黑回来睡第二张床。</div>`;
  if (G.evF.ashPact) html += `<div class="dim" style="margin:2px">他床边多了个自己钉的架子，放着你的弓。</div>`;   /* 感情线：等你长大（约定档） */
  /* 和 Asher 做蛋糕（言拍板 2026-10-30 第十二场）：夜里在家，小麦1+水果1+精力1，友+3，每天一次 */
  if (G.node >= DAY_NODES) html += `<div class="actrow2">${
    G.cakeDay === G.day ? `<button class="btn dis" disabled>做蛋糕·今天做过了</button>`
      : ((G.bag['小麦'] || 0) >= 1 && (G.bag['水果'] || 0) >= 1) ? `<button class="btn" data-act="bake">和 Asher 做蛋糕（小麦1·水果1·精力1）</button>`
      : `<button class="btn dis" disabled>和 Asher 做蛋糕·缺小麦或水果</button>`
  }</div>`;
  /* 制作区（拍板 #42）：学会的图纸才能在家做，精力2、占时间格 */
  const learned = Object.keys(CRAFT).filter(k => G.blueprints[k]);
  html += `<div class="sec-title">制作</div>`;
  if (learned.length || G.node < DAY_NODES) {
    html += `<div class="actrow2">`;
    for (const k of learned) {
      html += `<button class="btn" data-act="craftq" data-k="${k}">${CRAFT[k].name}</button>`;   /* 言拍板 2026-10-30：按钮只留名称，详情点开再看 */
    }
    if (G.node < DAY_NODES) html += `<button class="btn ghost" data-act="craftq" data-k="cake">和 Asher 做蛋糕</button>`;   /* 言拍板 2026-10-30：白天灰显可点，进去看要什么材料、缺什么 */
    html += `</div>`;
  }
  if (!learned.length) html += `<div class="dim" style="margin:6px 2px">图书馆里能描到一些图纸。</div>`;
  html += `<div class="sec-title">背包</div><div class="bag">`;
  for (const [k, v] of Object.entries(G.bag)) {
    html += `<div class="bag-item" data-item="${k}"><b>${k}</b>×${v}</div>`;   /* 言拍板 2026-10-30：格子只留名称数量，描述/来路点开才看（词条弹窗） */
  }
  html += `</div>`;
  return html;
}

/* ---------- 探险页（批二实装） ---------- */
const EXP_BTNS = {
  forest: [['gather', '采集（精力2）'], ['hunt', '打猎（精力3）']],
  water:  [['fish', '钓鱼（精力2）'], ['dive', '潜水（精力3）']],
  mine:   [['minenear', '近矿（精力4）'], ['minefar', '深矿（精力4·险）']],
  plain:  [['hunt', '打猎（精力3）'], ['train', '练剑（精力2·武力+）']],
};

function exploreHtml() {
  const night = G.node >= DAY_NODES;
  let html = `<div class="sec-title">探险</div>`;
  html += `<div class="card"><div class="b">${G.hurt ? `你带着${hurtWord()}。` : '村外的地界，你熟。'}</div><div class="dim">${night ? '夜里怪物全在外面，谁都不出门。天亮再说。' : '白天怪物躲在林子和矿里，撞上了就打。打输了会挂彩。'}</div></div>`;
  for (const [zid, z] of Object.entries(EXPLORE)) {
    if (night) {
      html += `<div class="zone"><b>${z.name}</b><div class="dim">${z.desc}</div><div class="dim">夜里去不了。</div></div>`;
      continue;
    }
    const rateTxt = zid === 'plain' ? '绝对安全'
      : zid === 'mine' ? '遇怪：近矿30% · 深矿50%' : `遇怪 ${Math.round(z.rate * 100)}%`;
    html += `<div class="zone"><b>${z.name}</b><div class="dim">${z.desc}</div><div class="dim">${rateTxt}</div><div class="actrow2">${EXP_BTNS[zid].map(([a, t]) => `<button class="btn" data-exp="${zid}:${a}">${t}</button>`).join('')}</div></div>`;
  }
  return html;
}

/* ---------- 设定页 ---------- */
function settingsHtml() {
  let html = `<div class="sec-title">设定</div>`;
  html += `<div class="actrow2">
    <button class="btn" data-act="save">保存</button>
    <button class="btn" data-act="reload">读档</button>
    <button class="btn warn" data-act="newgame">开新档</button>
  </div><div class="dim" style="margin:4px 2px">每个节点自动存档。单存档位。</div>`;
  html += `<div class="sec-title">编年史</div>`;
  if (!G.chronicle.length) html += `<div class="dim">还没有记录。</div>`;
  else html += G.chronicle.slice().reverse().map(c =>
    `<div class="chron" data-chron="${c.day}"><b>第 ${c.day} 天</b><div class="dim">${c.log.slice(0, 2).join('；')}${c.log.length > 2 ? '…' : ''}</div></div>`).join('');
  html += `<div class="sec-title">关于</div><div class="dim" style="margin:2px">村庄 · 批一（活的村庄）/ 批二（经济与探险）/ 批三（骑士与结局）已实装。批四（寻欢·占有欲·感情线）实装中，配角台词陆续上生产线。</div>`;
  return html;
}

function chronDetail(day) {
  const c = G.chronicle.find(x => x.day === day);
  if (!c) return;
  let html = `<div class="sec-sub">你做了什么</div>` + c.log.map(l => `<div class="li">· ${l}</div>`).join('');
  html += `<div class="sec-sub">Asher</div><div class="li">${c.ash}</div>`;
  html += `<div class="sec-sub">村里发生了什么</div>`;
  html += c.ev.length ? c.ev.map(e => `<div class="li">${e}</div>`).join('') : `<div class="dim">平静的一天。</div>`;
  openModal(`第 ${c.day} 天`, html);
}

/* ---------- NPC 个人界面 ---------- */
function npcSheet(id) {
  const n = npcDef(id), s = G.npc[id];
  if (!G.starTipShown) {
    G.starTipShown = true;
    toast('星标后，播报只显示与TA有关的事。星标不影响世界运转。');
  }
  const night = G.node >= DAY_NODES;
  const knNight = id === 'knight' && night;   /* 2026-10-30 言拍板：夜里骑士只留寻欢，它在前线，其他白天再来 */
  let html = `<div class="sheet-head">
    <b class="sheet-name">${n.name}</b>
    <button class="star ${G.stars[id] ? 'on' : ''}" data-act="star" data-id="${id}">${G.stars[id] ? '★ 已星标' : '☆ 星标'}</button>
  </div>`;
  const lnow = locOf(n, G.node);
  const locName = lnow === 'home' ? (n.livesWithYou ? '你家' : '家里') : (PLACES[lnow] ? PLACES[lnow].name : '前线');
  html += `<div class="dim">${n.job}${n.age ? ' · ' + n.age + '岁' : ''} · ${locName}${G.spouse === id ? ' · 你的伴侣' : ''}</div>`;
  /* 感情线：Leo 帮问被拒后闭馆三天，敲门只有一条门缝 */
  if (id === 'leo' && G.evF.leoClosedUntil && G.day < G.evF.leoClosedUntil) {
    html += `<div class="line">门开了一条缝。</div>`;
    html += `<div class="line"><b>Leo</b>：「我就知道会这样。」</div>`;
    openModal('人物档案', html);
    return;
  }
  html += `<div class="bio">${n.bio}</div>`;
  if (n.secretHint && s.f >= 50) html += `<div class="secret">${n.secretHint}</div>`;   /* 空秘密不显示（#64：Bess 撤案后置空） */
  html += `<div class="relbar"><span>友情 ${friendWord(id)}</span><div class="bar"><div style="width:${s.f}%"></div></div></div>`;
  if (s.l >= 15) html += `<div class="relbar dim">TA好像${loveWord(id)}。</div>`;
  if (id === 'knight') { const cw = knightCondWord(); html += `<div class="relbar dim">状态：${cw[1]}。${cw[2]}</div>`; }
  /* 互动：基础四人组 2×2；送花/交易等进「更多」 */
  const btn = (t, label, dis) => `<button class="btn ib ${dis ? 'dis' : ''}" data-act="ia" data-id="${id}" data-ia="${t}" ${dis ? 'disabled' : ''}>${label}</button>`;
  if (knNight) html += `<div class="dim" style="margin:4px 2px">骑士在前线杀怪，天亮前后经过村口。</div>`;
  else {
    html += `<div class="sec-sub">互动</div>`;
    html += `<div class="actrow2">`;
    html += btn('chat', `闲聊（1）`);
    if (!SISTERS.includes(id) && !(id === 'lee' && !s.restored)) html += btn('flirt', `暧昧（2）`, s.f < 40);   // Lee 恢复前藏暧昧（#70 感情线封死）
    html += btn('tease', `打闹（2）`);
    if (!n.noAttack) html += btn('hit', '攻击（2）');
    html += `</div>`;
    if (id === 'lee' && !s.restored) html += `<div class="dim" style="margin:2px">他看你的眼神很干净，什么都还分不清。</div>`;   // 备案文案（言可改）
    else if (!SISTERS.includes(id) && s.f < 40) html += `<div class="dim" style="margin:2px">还不够熟，有些话说不出口。（友情 40 开放暧昧）</div>`;
  }
  let extras = '';
  /* Lee 记忆线（#70）：捡到的遗物交给他——恢复前任一件当场触发恢复；恢复后多余遗物=补忆句 */
  if (id === 'lee') {
    const given = G.npc.lee.clueGiven || [];
    for (const c of Object.values(LEE_CLUES)) {
      if ((G.bag[c.item] || 0) > 0 && !given.includes(c.item))
        extras += `<button class="btn line ib" data-act="ia" data-id="lee" data-ia="clue" data-item="${c.item}">给他看〈${c.item}〉</button>`;
    }
  }
  if (id === 'knight' && !knNight) {
    const noFlower = (G.bag.花 || 0) < 1;
    extras += `<button class="btn line ib ${noFlower ? 'dis' : ''}" data-act="ia" data-id="${id}" data-ia="flower" ${noFlower ? 'disabled' : ''}>送花（1）${noFlower ? '·没花' : ''}</button>`;
    if (G.knight.cond < 100) {
      const noGy = (G.bag.黄金玉 || 0) < 1;
      extras += `<button class="btn line ib ${noGy ? 'dis' : ''}" data-act="repair" ${noGy ? 'disabled' : ''}>修补（2·黄金玉）${noGy ? '·没有黄金玉' : ''}</button>`;
    }
  }
  /* 感情线：Levi 两个专属按钮（一次性，走完队列就不再出现） */
  if (id === 'levi') {
    const nk = nextEv('levi');
    if (nk === 'lev3' && EV_GATES.lev3() && loveReady('levi'))
      extras += `<button class="btn line ib" data-act="levbtn" data-k="lev3">约他去森林帮忙（2·时段）</button>`;
    if (nk === 'lev4' && EV_GATES.lev4() && loveReady('levi'))
      extras += `<button class="btn line ib" data-act="levbtn" data-k="lev4">命令他歇一天（1·时段）</button>`;
  }
  /* 婚姻批（#67）：主动求婚——未婚未订婚且对方可婚就显示，成不成交给引擎判断 */
  if (!G.spouse && !G.engaged && MARRYABLE.includes(id))
    extras += `<button class="btn line ib" data-act="propose" data-id="${id}">求婚</button>`;
  /* 寻欢：有台词池就常驻显示，按爱情解锁（偷尝轨·感情线条件待告白系统实装后补） */
  const fp = funPools(n, s);
  if (fp) {
    if (s.l >= 50 && G.node >= DAY_NODES)
      extras += `<button class="btn line ib" data-act="ia" data-id="${id}" data-ia="fun">寻欢（${COST.fun}·度过今晚）</button>`;
    else if (s.l >= 50)
      extras += `<button class="btn line ib dis" disabled>寻欢（夜里来）</button>`;
    else
      extras += `<button class="btn line ib dis" disabled>寻欢（还不到那一步）</button>`;
  }
  if (n.trade) extras += `<button class="btn line ib" data-act="trade" data-id="${id}">交易（精力0）</button>`;
  /* 肢体互动（言拍板 2026-10-30 第十九场）：解锁了才显示，未解锁隐藏；当天用过灰态 */
  if (TOUCH_OPEN.includes(id)) {
    for (const [k, t] of Object.entries(TOUCH)) {
      const st = G.npc[id];
      if (!((t.f && st.f >= t.f) || (t.l && st.l >= t.l))) continue;   // 未解锁不显示（言拍板：隐藏到解锁）
      if (t.night && G.node < DAY_NODES) continue;                     // 依偎只在夜里出现
      if (t.afterRestore && id === 'lee' && !st.restored) continue;    // 恢复前 Lee 肢体互动全锁（言拍板 2026-10-30 翻案 #61：四按钮全隐藏）
      const used = ((G.touch || {})[id + '.' + k] === G.day);
      extras += used
        ? `<button class="btn line ib dis" disabled>${t.name}·今天过了</button>`
        : `<button class="btn line ib" data-act="touch" data-id="${id}" data-k="${k}">${t.name}</button>`;
    }
  }
  /* 送礼（拍板 #42）：每人每天一份，精力1、占时间格（夜里骑士不送，白天再来） */
  if (!knNight) {
    const giftables = GIFT_ITEMS.filter(it => (G.bag[it] || 0) > 0);
    if (s.giftDay === G.day)
      extras += `<button class="btn line ib dis" disabled>送礼（1）·今天送过了</button>`;
    else if (!giftables.length)
      extras += `<button class="btn line ib dis" disabled>送礼（1）·没有能送的</button>`;
    else
      extras += `<button class="btn line ib" data-act="gift" data-id="${id}">送礼（1）</button>`;
  }
  if (extras) html += `<div class="sec-sub">更多</div><div class="actrow2">${extras}</div>`;
  openModal('人物档案', html);
}

/* ---------- 物品词条（言拍板 2026-10-30）：点背包里的东西，看从哪来、有什么用 ---------- */
function itemSheet(k) {
  const it = ITEMS[k];
  if (!it) return;
  let html = `<div class="line">${it.d || ''}</div>`;
  if (it.s) html += `<div class="sec-sub">从哪来</div><div class="li">· ${it.s}</div>`;
  if (it.u) html += `<div class="sec-sub">有什么用</div><div class="li">· ${it.u}</div>`;
  if (V.craftBack) html += `<div class="actrow2"><button class="btn" data-act="craftq" data-k="${V.craftBack}">返回制作</button></div>`;   // 从制作弹窗点进来的：看完来路一键回去接着做
  openModal(k, html);
}

function tradeSheet(id) {
  const n = npcDef(id), t = n.trade;
  let html = `<div class="dim">${n.name}的摊子。</div><div class="trade">`;
  if (t.sell) {                        // 缺陷B修复：只收购不出售的摊主（Vivienne/Alice/Olivia）没有 t.sell，整段跳过
    html += `<div class="sec-sub">TA 卖</div>`;
    for (const [item, price] of t.sell) html += `<button class="btn tb" data-act="qbuy" data-id="${id}" data-item="${item}" data-p="${price}">${item}${item === '箭矢' ? '×5' : ''} · ${price}币</button>`;
  }
  html += `<div class="sec-sub">TA 收（你有才显示）</div>`;
  const buys = (t.buy || []).filter(([item]) => (G.bag[item] || 0) > 0);   // 只卖不收的摊主（Levi 卖羊毛）兼容
  html += (t.buy || []).length
    ? (buys.length ? buys.map(([item, price]) => `<button class="btn tb" data-act="qsell" data-id="${id}" data-item="${item}" data-p="${price}">${item}×${G.bag[item]} · ${price}币${G.npc[id].f >= 60 ? '+' : ''}</button>`).join('') : `<div class="dim">你没有TA收的东西。</div>`)
    : `<div class="dim">TA 不收东西。</div>`;
  html += `</div><div class="dim" style="margin-top:6px">关系好的话，收价会往上抬一点。</div>`;
  openModal(`交易 · ${n.name}`, html);
}

/* ---------- 数量选择弹窗（言拍板 2026-10-30）：点摊子上的东西后选买/卖几个 ---------- */
function qtySheet(id, item, price, mode) {
  const buy = mode === 'buy';
  const max = buy ? Math.max(1, Math.floor(G.coins / price)) : Math.max(1, G.bag[item] || 0);
  V.qty = { id, item, price, mode, n: 1, max };
  qtyHtml();
}
function qtyHtml() {
  const q = V.qty; if (!q) return;
  const buy = q.mode === 'buy';
  const per = !buy && G.npc[q.id].f >= 60 ? Math.ceil(q.price * 1.2) : q.price;   // 卖出按熟人价预览
  const isArrow = q.item === '箭矢';
  let html = `<div class="dim">${buy ? '从TA这买' : '卖给TA'}：${q.item}${isArrow ? '（一份5支）' : ''} · 单价${per}币</div><div class="trade" style="text-align:center">`;
  html += `<button class="btn tb" data-act="qminus" ${q.n <= 1 ? 'disabled' : ''}>−</button>`;
  html += ` <span class="line" style="display:inline-block;min-width:3em"><b>${q.n}</b> / ${q.max}</span> `;
  html += `<button class="btn tb" data-act="qplus" ${q.n >= q.max ? 'disabled' : ''}>＋</button>`;
  html += `</div><div class="actrow2">`;
  if (buy) html += `<button class="btn" data-act="buy" data-id="${q.id}" data-item="${q.item}" data-p="${q.price}" data-q="${q.n}">买 ${q.n} ${isArrow ? '份' : '个'} · ${q.price * q.n} 安娜币</button>`;
  else html += `<button class="btn" data-act="sell" data-id="${q.id}" data-item="${q.item}" data-p="${q.price}" data-q="${q.n}">卖 ${q.n} 个 · ${per * q.n} 安娜币${per > q.price ? '（熟人价）' : ''}</button>`;
  html += `</div>`;
  openModal(`${buy ? '买' : '卖'}多少？ · ${q.item}`, html);
}

/* 材料行（制作/蛋糕弹窗共用）：名称可点看来路；言拍板 2026-10-30 全黑不用红 */
function matsHtml(need) {
  const lack = [];
  const html = Object.entries(need).map(([m, q]) => {
    const have = G.bag[m] || 0;
    if (have < q) lack.push(`${m}×${q - have}`);
    return `<div class="line"><span class="ilink" data-act="itemq" data-k="${m}">${m}</span> ×${q} <span class="dim">（你有${have}）</span>${have < q ? ` <b>还差${q - have}</b>` : ''}</div>`;
  }).join('');
  return { html, lack };
}

/* ---------- 制作详情弹窗（言拍板 2026-10-30）：点开才看清精力和材料，确认再动手 ---------- */
/* 材料名可点 → 弹该材料指引（哪里能弄到）；指引不平铺，点开才看（言拍板 2026-10-30 第二轮） */
function craftSheet(k) {
  if (k === 'cake') { cakeSheet(); return; }   // 白天灰蛋糕按钮也走这，分流到蛋糕弹窗
  const c = CRAFT[k]; if (!c) return;
  V.craftBack = k;
  const { html: mats, lack } = matsHtml(c.mats);
  openModal(`制作 · ${c.name}`, `<div class="dim">精力2 · 占一个时间格${c.out ? ` · 做一份得${c.name}×${c.out}` : ''}</div>${mats}<div class="actrow2">${
    lack.length ? `<button class="btn dis" disabled>材料不够·还差${lack.join('、')}</button>`
      : `<button class="btn" data-act="craft" data-k="${k}">制作（精力2）</button>`
  }</div>`);
}

/* ---------- 蛋糕材料预览（言拍板 2026-10-30）：白天灰按钮点开看要什么、缺什么，天黑才能真做 ---------- */
function cakeSheet() {
  V.craftBack = 'cake';
  const { html: mats, lack } = matsHtml({ 小麦: 1, 水果: 1 });
  openModal('和 Asher 做蛋糕', `<div class="dim">夜里在家才能做 · 精力1 · Asher 友+3 · 每天一次 · 当场分掉</div>${mats}<div class="actrow2"><button class="btn dis" disabled>${
    lack.length ? `还差${lack.join('、')}，天黑也做不了` : '材料齐了，天黑回家做'
  }</button></div>`);
}

/* ---------- 送礼弹窗（拍板 #42）：列出手里能送的东西，每人每天一份 ---------- */
function giftSheet(id) {
  const n = npcDef(id);
  const list = GIFT_ITEMS.filter(it => (G.bag[it] || 0) > 0);
  let html = `<div class="dim">送给 ${n.name}。今天只有这一份的机会。</div><div class="trade">`;
  html += list.length ? list.map(it =>
    `<button class="btn tb" data-act="give" data-id="${id}" data-item="${it}">${it}×${G.bag[it]}</button>`).join('')
    : `<div class="dim">没有能送的东西。</div>`;
  html += `</div>`;
  openModal(`送礼 · ${n.name}`, html);
}

/* ---------- 结果弹窗 / 结算 ---------- */
function resultSheet(lines) {
  openModal('　', lines.map(l => `<div class="line">${l}</div>`).join('') + `<div class="actrow2"><button class="btn" data-act="close-res">继续</button></div>`);
}

/* ---------- 感情线事件弹窗（第一批）：台词+选项按钮；无选项的看完继续（夜里事件继续=入睡结算） ---------- */
function evSheet(r) {
  let html = (r.lines || []).map(l => `<div class="line">${l}</div>`).join('');
  if (r.ev && r.ev.choices) {
    html += `<div class="actrow2">${r.ev.choices.map(c =>
      `<button class="btn" data-act="evc" data-ev="${r.ev.key}" data-c="${c.k}">${c.t}</button>`).join('')}</div>`;
  } else {
    if (r.settle) V.pendingSettle = true;
    html += `<div class="actrow2"><button class="btn" data-act="close-res">继续</button></div>`;
  }
  openModal('　', html);
}

function settlementSheet() {
  const c = G.chronicle[G.chronicle.length - 1];
  if (!c) return;
  let html = `<div class="sec-sub">第 ${c.day} 天过去了</div>`;
  html += c.log.map(l => `<div class="li">· ${l}</div>`).join('');
  html += `<div class="sec-sub">夜里</div><div class="li">${c.ash}</div>`;
  html += `<div class="actrow2"><button class="btn" data-act="close-res">天亮了</button></div>`;
  openModal('一天结束', html);
}

/* 婚姻批（#67）：已婚跟配偶以外的人寻欢——先问一句要不要处理痕迹 */
function coverSheet(id) {
  const n = npcDef(id);
  const lowE = G.energy < COST.fun + 10;                     // 精力腾不出 10 点，痕迹处理不动
  openModal('　', [
    `<div class="line">夜还长。${n.name}不是你的伴侣——今晚要小心点吗？</div>`,
    `<div class="actrow2">`,
    `<button class="btn" data-act="fun-plain" data-id="${id}">就这一夜（照常）</button>`,
    `<button class="btn ${lowE ? 'dis' : ''}" data-act="fun-cover" data-id="${id}" ${lowE ? 'disabled' : ''}>处理痕迹（精力-10·不容易被发现）</button>`,
    `</div>`,
  ].join(''));
}

/* ---------- 弹窗 / toast ---------- */
function openModal(title, html) {
  hideToast();
  $('#modal-title').innerHTML = title;
  $('#modal-body').innerHTML = html;
  $('#modal-mask').classList.add('show');
}
function closeModal() { $('#modal-mask').classList.remove('show'); V.craftBack = null; }
let toastTimer = null;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(hideToast, 2200);
}
function hideToast() { clearTimeout(toastTimer); $('#toast').classList.remove('show'); }

/* ---------- 结局画面（批三） ---------- */
function renderEnding() {
  closeModal();
  $('#tabbar').style.display = 'none';
  $('#statline').innerHTML = `<span class="st">第 ${G.over.day} 天 · 终</span>`;
  const t = G.over.t, e = ENDINGS[t];
  let body = t === 'E3'
    ? (e3Variant() === 'love' ? e.bodyLove : e3Variant() === 'poss' ? e.bodyPoss : e.bodyFriend).concat(e.tail)
    : (e.body || []);
  let html = `<div class="ending"><div class="end-title">${e.title}</div>`;
  if (e.sub) html += `<div class="end-sub">${e.sub}</div>`;
  html += `<div class="end-body">${body.map(l => `<div class="line">${l}</div>`).join('')}</div>`;
  if (t === 'E2b' && !G.over.v) {
    html += `<div class="actrow2 end-choice">
      <button class="btn" data-act="endchoice" data-v="v0">一起走</button>
      <button class="btn" data-act="endchoice" data-v="v1">他留下</button>
    </div>`;
  } else {
    if (t === 'E2b') html += `<div class="end-body">${e[G.over.v].map(l => `<div class="line">${l}</div>`).join('')}</div>`;
    html += `<div class="end-stats">存活 ${G.over.day} 天 · 武力 ${G.force} · 击杀 ${G.stats.kills}</div>
      <div class="actrow2"><button class="btn warn" data-act="newgame">重新开始</button></div>`;
  }
  app().innerHTML = html + `</div>`;
  window.scrollTo(0, 0);
}

/* ---------- 决斗弹窗（§6.3） ---------- */
let duelTimer = null;
function duelSheet() {
  if (!G.duel) return;
  openModal('骑士', `
    <div class="line">${resolveNames(DUEL_TEXT.scene[G.duel.reason] || DUEL_TEXT.scene.npcHit)}</div>
    <div class="line dim">你的武力：${G.force}。</div>
    <div class="actrow2">
      <button class="btn" data-act="duel" data-m="a">防御</button>
      <button class="btn" data-act="duel" data-m="b">进攻</button>
    </div>
    <div class="actrow2"><button class="btn warn" data-act="duel-c">下死手</button></div>`);
}
function duelConfirmSheet() {
  openModal('骑士', `
    <div class="line">${DUEL_TEXT.cGo}</div>
    <div class="line dim">只有一次机会。五秒之内动手。</div>
    <div class="duel-timer"><div class="duel-bar"></div></div>
    <div class="actrow2"><button class="btn warn" data-act="duel" data-m="c">动手</button></div>`);
  clearTimeout(duelTimer);
  duelTimer = setTimeout(() => {
    if (!G.duel) return;
    const r = duelMove('ctimeout');
    resultSheet(r.lines);
    if (!r.settled) render();
  }, 5000);
}

/* ---------- 主渲染 ---------- */
function render() {
  if (G.over) { renderEnding(); return; }
  renderStatus();
  $('#tabbar').style.display = '';
  const map = { village: villageHtml, home: homeHtml, explore: exploreHtml, settings: settingsHtml };
  app().innerHTML = map[V.tab]();
  document.querySelectorAll('#tabbar .tab').forEach(el => el.classList.toggle('active', el.dataset.t === V.tab));
  window.scrollTo(0, 0);
}

/* ---------- 事件委托 ---------- */
document.addEventListener('click', e => {
  const tab = e.target.closest('#tabbar .tab');
  if (tab) { V.tab = tab.dataset.t; V.place = null; closeModal(); render(); return; }

  const nm = e.target.closest('[data-npc]');
  if (nm && !e.target.closest('[data-act]')) {
    /* 感情线：夜里出门找人/去铺子，计一次夜里出门（Asher 事件2的引子；家里和骑士不算） */
    if (nm.classList.contains('npc-card') && G.node >= DAY_NODES && nm.dataset.npc !== 'knight' && nm.dataset.npc !== 'asher') markNightOut();
    npcSheet(nm.dataset.npc);
    return;
  }

  const pl = e.target.closest('[data-place]');
  if (pl) {
    V.place = pl.dataset.place || null;
    if (pl.dataset.place && G.node >= DAY_NODES) markNightOut();
    if (pl.dataset.place) doMeetCheck(pl.dataset.place);   /* 偶遇系统（#68）：进地点掷骰 */
    render();
    /* 感情线：白天进图书馆撞见（Leo 事件2/3）；夜里去井边撞见（Asher 事件2） */
    if (V.place === 'library') { const ev = enterEvPending(); if (ev) evSheet(ev); }
    if (V.place === 'well' && G.node >= DAY_NODES) { const ev = wellEvPending(); if (ev) evSheet(ev); }
    const mp = marryPlaceEv(V.place);                        /* 婚姻批（#67）：温和型白天在常驻地开口求婚 */
    if (mp) evSheet(mp);
    return;
  }

  const ch = e.target.closest('[data-chron]');
  if (ch) { chronDetail(+ch.dataset.chron); return; }

  const it = e.target.closest('[data-item]');
  if (it && !e.target.closest('[data-act]') && !it.classList.contains('bag-item')) { toast((ITEMS[it.dataset.item] || {}).d || ''); return; }   // 背包物品走下面的完整词条，不走这句提示

  const ex = e.target.closest('[data-exp]');
  if (ex) {
    const [z, a] = ex.dataset.exp.split(':');
    const r = doExplore(z, a);
    resultSheet(r.lines);
    if (G.over) { render(); return; }
    if (r.settled) setTimeout(settlementSheet, 10);
    else render();
    return;
  }

  const bi = e.target.closest('.bag-item');            // 物品词条（言拍板 2026-10-30）：点背包里的东西看来路
  if (bi && bi.dataset.item) { itemSheet(bi.dataset.item); return; }

  const act = e.target.closest('[data-act]');
  if (!act) {
    if (e.target.id === 'modal-mask' || e.target.closest('#modal-close-btn')) closeModal();
    return;
  }
  const a = act.dataset.act, id = act.dataset.id;
  if (a === 'close-res') {
    if (V.pendingSettle) { V.pendingSettle = false; settlementSheet(); return; }
    if (G.engaged && G.wedday === G.day && !G.wedShown) {     // 婚姻批（#67）：婚期当天首次关弹窗→婚礼
      const w = doWedding(); save(); resultSheet(w.lines); return;
    }
    closeModal(); render(); return;
  }
  if (a === 'feed-toggle') {
    V.feedAll = !V.feedAll; render();
    const f = document.getElementById('feed-sec');
    if (f) f.scrollIntoView({ block: 'start' });
    return;
  }
  if (a === 'star') { G.stars[id] = !G.stars[id]; save(); npcSheet(id); render(); return; }
  if (a === 'trade') { tradeSheet(id); return; }
  if (a === 'gift') { giftSheet(id); return; }
  if (a === 'touch') {   // 肢体互动（言拍板 2026-10-30 第十九场）
    const r = doTouch(id, act.dataset.k);
    resultSheet(r.lines);
    if (!r.blocked) render();
    return;
  }
  if (a === 'give') {
    const r = doGift(id, act.dataset.item);
    resultSheet(r.lines);
    if (r.settled) setTimeout(settlementSheet, 10); else render();
    return;
  }
  if (a === 'ia') {
    if (act.disabled) return;
    if (act.dataset.ia === 'clue') {   // Lee 记忆线（#70）：给遗物（不耗精力不占时间格；恢复返回 ev 自动走 evSheet）
      const r = doGiveLeeClue(act.dataset.item);
      if (r.ev) { evSheet(r); return; }
      resultSheet(r.lines);
      render();
      return;
    }
    if (act.dataset.ia === 'fun' && G.spouse && id !== G.spouse) { coverSheet(id); return; }   // 婚姻批（#67）：出轨前先问一句
    const r = interact(id, act.dataset.ia);
    if (r.duel) { duelSheet(); return; }
    if (r.ev) { evSheet(r); return; }                       // 感情线：带选项的事件弹窗
    resultSheet(r.lines);
    if (G.over) { render(); return; }
    if (r.settled) {
      if (act.dataset.ia === 'fun') V.pendingSettle = true;   // 枕边话先看完，点继续再结算
      else setTimeout(settlementSheet, 10);
    }
    else render();
    return;
  }
  if (a === 'fun-plain' || a === 'fun-cover') {              // 婚姻批（#67）：出轨夜的两种过法
    const r = doFun(id, false, a === 'fun-cover');
    resultSheet(r.lines);
    if (G.over) { render(); return; }
    if (r.settled) V.pendingSettle = true;
    else render();
    return;
  }
  if (a === 'propose') {                                     // 婚姻批（#67）：主动求婚
    const r = proposeTo(id);
    resultSheet(r.lines);
    if (!r.blocked) { save(); render(); }
    return;
  }
  if (a === 'evc') {                                          // 感情线：事件选项结算
    if (act.dataset.ev.startsWith('mar')) {                   // 婚姻批（#67）：求婚答复（答应/再想想）
      const res = marryChoice(act.dataset.ev, act.dataset.c);
      resultSheet(res.lines);
      if (res.settled) V.pendingSettle = true;
      else render();
      return;
    }
    const res = loveChoice(act.dataset.ev, act.dataset.c);
    resultSheet(res.lines);
    if (G.over) { render(); return; }
    if (res.settled) V.pendingSettle = true;
    else render();
    return;
  }
  if (a === 'levbtn') {                                       // 感情线：Levi 专属按钮
    const r = levButton(act.dataset.k);
    resultSheet(r.lines);
    if (G.over) { render(); return; }
    if (r.settled) setTimeout(settlementSheet, 10);
    else render();
    return;
  }
  if (a === 'qbuy' || a === 'qsell') {
    qtySheet(id, act.dataset.item, +act.dataset.p, a === 'qbuy' ? 'buy' : 'sell');
    return;
  }
  if (a === 'qminus' || a === 'qplus') {
    if (!V.qty) return;
    V.qty.n = Math.min(V.qty.max, Math.max(1, V.qty.n + (a === 'qplus' ? 1 : -1)));
    qtyHtml();
    return;
  }
  if (a === 'buy' || a === 'sell') {
    const qty = Math.max(1, +act.dataset.q || 1);
    const r = a === 'buy' ? tradeBuy(id, act.dataset.item, +act.dataset.p, qty) : tradeSell(id, act.dataset.item, +act.dataset.p, qty);
    if (r.settled) { resultSheet(r.lines); setTimeout(settlementSheet, 10); return; }
    toast(r.lines[0]);
    tradeSheet(id); render();          // 买/卖完留在摊子弹窗原地刷新（拍板 2026-10-30）
    return;
  }
  if (a === 'repair') {
    const r = repairKnight();
    resultSheet(r.lines);
    if (r.settled) setTimeout(settlementSheet, 10);
    else render();
    return;
  }
  if (a === 'craftq') { craftSheet(act.dataset.k); return; }
  if (a === 'itemq') { itemSheet(act.dataset.k); return; }   // 制作弹窗里点材料名 → 看哪里能弄到
  if (a === 'pickflower' || a === 'water' || a === 'pray' || a === 'study' || a === 'shoot'
    || a === 'blueprint' || a === 'craft' || a === 'helpfarm') {
    const r = doPlaceAction(a === 'craft' ? 'home' : V.place, a, act.dataset.k);
    resultSheet(r.lines);
    if (r.settled) setTimeout(settlementSheet, 10);
    else render();
    return;
  }
  if (a === 'duel') {
    clearTimeout(duelTimer);
    const r = duelMove(act.dataset.m);
    resultSheet(r.lines);
    if (G.over) { render(); return; }
    if (r.settled) setTimeout(settlementSheet, 10);
    else render();
    return;
  }
  if (a === 'duel-c') { duelConfirmSheet(); return; }
  if (a === 'endchoice') {
    G.over.v = act.dataset.v; save();
    render();
    return;
  }
  if (a === 'nap') { const r = nap(); resultSheet(r.lines); if (!r.blocked) render(); return; }
  if (a === 'bake') { const r = bakeCake(); resultSheet(r.lines); if (!r.blocked) render(); return; }   // 和 Asher 做蛋糕（言拍板 2026-10-30）
  if (a === 'heal') { const r = healPotion(); resultSheet(r.lines); if (!r.blocked) render(); return; }
  if (a === 'rest') {
    const r = restNow();
    if (r.ev) evSheet(r.ev);                                  // 感情线：夜里在家的事件（Asher），看完/选完再入睡结算
    else { settlementSheet(); render(); }
    return;
  }
  if (a === 'save') { save(); toast('已保存。'); return; }
  if (a === 'reload') { if (load()) { V.place = null; closeModal(); render(); toast('已读档。'); } return; }
  if (a === 'newgame') {
    if (confirm('开新档会覆盖现有存档。确定？')) { newGame(); V.place = null; closeModal(); render(); }
    return;
  }
});

/* ---------- 启动 ---------- */
function boot() {
  const saved = hasSave();
  $('#tabbar').style.display = 'none';
  app().innerHTML = `
    <div class="boot">
      <div class="boot-title">村庄</div>
      <div class="boot-sub">西幻中世纪 · 自由向文游</div>
      <div class="boot-box"><div class="boot-txt">
        你是 Gloria，猎户，外来者，把家安在村口以北。<br>
        村里有一位皇帝送的骑士，浑身瓷白，夜里在前线杀怪物。<br>
        一天五个时段。白天三个，村里人各在各的岗位上；夜里两个，全村闭户，人都待在屋里。<br>
        <span class="dim">每个行动推进一个时段。播报里能看见村里人之间的事。</span>
      </div></div>
      <div class="boot-actions">
        ${saved ? `<button class="btn big" data-boot="continue">继续旅程</button>` : ''}
        <button class="btn big ${saved ? 'warn' : 'gold'}" data-boot="new">${saved ? '新的旅程' : '开始'}</button>
      </div>
      ${saved ? '<div class="boot-note">新的旅程会覆盖旧档</div>' : ''}
    </div>`;
  document.querySelectorAll('[data-boot]').forEach(b => b.onclick = () => {
    if (b.dataset.boot === 'continue') { load(); } else { newGame(); }
    V.tab = 'village'; render();
  });
}
document.addEventListener('DOMContentLoaded', boot);
