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
    (G.hurt ? `<span class="st warn-st">${hurtWord()}</span>` : '');
}

/* ---------- 播报流 ---------- */
function feedHtml() {
  const all = visibleFeed().slice(-30).reverse();
  const starred = Object.keys(G.stars).some(k => G.stars[k]);
  const hint = starred ? '' : `<div class="feed-hint">在人物界面星标后，这里只显示与TA有关的事。现在显示全部。</div>`;
  if (!all.length) return `<div class="feed-hint">${starred ? '星标的人这段时间没有动静。' : '村里还没有动静。'}</div>`;
  const item = e => {
    const tag = e.t === 'you' ? '<span class="ftag you">你</span>' : e.t === 'major' ? '<span class="ftag major">大事</span>' : '';
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
  if (night) html += `<div class="night-note">夜里村民都在家，屋外只有你和前线的骑士。<br>能去的地方：炼药房（Isabel 睡沙发）${G.nightJacobAtTower ? '、钟楼（Jacob 今夜没回家）' : ''}。</div>`;
  if (G.knight.core) {
    const left = Math.max(0, G.knight.doomEnd - G.day);
    html += `<div class="card doom"><div class="b">骑士碎在了村口。还能撑 ${left} 天。</div><div class="dim">胸口的裂缝露着玉色的芯。金粉还能吊住他。皇帝的信使要三十天后才到。夜里怪物还会来——他出战就是死，村里只剩你的弓。</div></div>`;
  }
  html += `<div class="grid">`;
  for (const [pid, p] of Object.entries(PLACES)) {
    if (pid === 'home') continue;
    const who = NPCS.filter(n => locOf(n, G.node) === pid && (G.node < DAY_NODES || (n.nightStay || n.id === 'jacob' && G.nightJacobAtTower)));
    const label = who.length ? `<span class="pwho">${who.map(n => n.name).join('·')}</span>` : '';
    html += `<button class="cell" data-place="${pid}">${p.name}${label}</button>`;
  }
  html += `</div>`;
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
  if (pid === 'belltower' && G.node >= DAY_NODES) acts += `<button class="btn" data-act="shoot">射击（精力2·${G.knight.core ? '守村' : '援护骑士'}）</button>`;
  if (pid === 'church' && who.some(n => n.id === 'vivienne')) acts += `<button class="btn" data-act="pray">祈祷（精力1）</button>`;
  if (pid === 'library' && who.some(n => n.id === 'leo')) acts += `<button class="btn" data-act="study">看半天书（精力1·武力+）</button>`;
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
  html += `<div class="sec-title">背包</div><div class="bag">`;
  for (const [k, v] of Object.entries(G.bag)) {
    html += `<div class="bag-item" data-item="${k}"><b>${k}</b>×${v}<div class="dim">${(ITEMS[k] || {}).d || ''}</div></div>`;
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
  html += `<div class="card"><div class="b">${G.hurt ? `你带着${hurtWord()}。` : '村外的地界，你熟。'}</div><div class="dim">${night ? '夜里怪物全在外面。除了平原，走到哪都会撞上。' : '白天怪物躲在林子和矿里，撞上了就打。打输了会挂彩。'}</div></div>`;
  if (night) html += `<div class="zone"><b>夜猎</b><div class="dim">出村守一夜：一到两波怪物，掉落比白天厚。${G.knight.core ? '现在村里的夜，只有你的弓。' : ''}</div><div class="actrow2"><button class="btn warn" data-act="nighthunt">夜猎守村（精力5）</button></div></div>`;
  for (const [zid, z] of Object.entries(EXPLORE)) {
    const rateTxt = zid === 'plain' ? '绝对安全'
      : night ? '夜里必遇怪'
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
  html += `<div class="sec-title">关于</div><div class="dim" style="margin:2px">村庄 · 批一（活的村庄）+ 批二（经济与探险）已实装。批三：骑士与结局。批四：血肉。</div>`;
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
  let html = `<div class="sheet-head">
    <b class="sheet-name">${n.name}</b>
    <button class="star ${G.stars[id] ? 'on' : ''}" data-act="star" data-id="${id}">${G.stars[id] ? '★ 已星标' : '☆ 星标'}</button>
  </div>`;
  html += `<div class="dim">${n.job}${n.age ? ' · ' + n.age + '岁' : ''} · ${PLACES[locOf(n, G.node)] ? PLACES[locOf(n, G.node)].name : '前线'}</div>`;
  html += `<div class="bio">${n.bio}</div>`;
  if (s.f >= 50) html += `<div class="secret">${n.secretHint}</div>`;
  html += `<div class="relbar"><span>友情 ${friendWord(id)}</span><div class="bar"><div style="width:${s.f}%"></div></div></div>`;
  if (s.l >= 15) html += `<div class="relbar dim">TA好像${loveWord(id)}。</div>`;
  if (id === 'knight') { const cw = knightCondWord(); html += `<div class="relbar dim">状态：${cw[1]}。${cw[2]}</div>`; }
  /* 互动：基础四人组 2×2；送花/交易等进「更多」 */
  const btn = (t, label, dis) => `<button class="btn ib ${dis ? 'dis' : ''}" data-act="ia" data-id="${id}" data-ia="${t}" ${dis ? 'disabled' : ''}>${label}</button>`;
  html += `<div class="sec-sub">互动</div>`;
  html += `<div class="actrow2">`;
  html += btn('chat', `闲聊（1）`);
  html += btn('flirt', `暧昧（2）`, s.f < 40);
  html += btn('tease', `打闹（2）`);
  if (!n.noAttack) html += btn('hit', '攻击（2）');
  html += `</div>`;
  if (s.f < 40) html += `<div class="dim" style="margin:2px">还不够熟，有些话说不出口。（友情 40 开放暧昧）</div>`;
  let extras = '';
  if (id === 'knight') {
    const noFlower = (G.bag.花 || 0) < 1;
    extras += `<button class="btn line ib ${noFlower ? 'dis' : ''}" data-act="ia" data-id="${id}" data-ia="flower" ${noFlower ? 'disabled' : ''}>送花（1）${noFlower ? '·没花' : ''}</button>`;
    if (G.knight.cond < 100) {
      const noGy = (G.bag.黄金玉 || 0) < 1;
      extras += `<button class="btn line ib ${noGy ? 'dis' : ''}" data-act="repair" ${noGy ? 'disabled' : ''}>修补（2·黄金玉）${noGy ? '·没有黄金玉' : ''}</button>`;
    }
  }
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
  if (n.trade) extras += `<button class="btn line ib" data-act="trade" data-id="${id}">交易（1）</button>`;
  if (extras) html += `<div class="sec-sub">更多</div><div class="actrow2">${extras}</div>`;
  openModal('人物档案', html);
}

function tradeSheet(id) {
  const n = npcDef(id), t = n.trade;
  let html = `<div class="dim">${n.name}的摊子。</div><div class="trade">`;
  html += `<div class="sec-sub">TA 卖</div>`;
  for (const [item, price] of t.sell) html += `<button class="btn tb" data-act="buy" data-id="${id}" data-item="${item}" data-p="${price}">${item}${item === '箭矢' ? '×5' : ''} · ${price}币</button>`;
  html += `<div class="sec-sub">TA 收（你有才显示）</div>`;
  const buys = t.buy.filter(([item]) => (G.bag[item] || 0) > 0);
  html += buys.length ? buys.map(([item, price]) => `<button class="btn tb" data-act="sell" data-id="${id}" data-item="${item}" data-p="${price}">${item}×${G.bag[item]} · ${price}币${G.npc[id].f >= 60 ? '+' : ''}</button>`).join('') : `<div class="dim">你没有TA收的东西。</div>`;
  html += `</div><div class="dim" style="margin-top:6px">关系好的话，收价会往上抬一点。</div>`;
  openModal(`交易 · ${n.name}`, html);
}

/* ---------- 结果弹窗 / 结算 ---------- */
function resultSheet(lines) {
  openModal('　', lines.map(l => `<div class="line">${l}</div>`).join('') + `<div class="actrow2"><button class="btn" data-act="close-res">继续</button></div>`);
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

/* ---------- 弹窗 / toast ---------- */
function openModal(title, html) {
  hideToast();
  $('#modal-title').innerHTML = title;
  $('#modal-body').innerHTML = html;
  $('#modal-mask').classList.add('show');
}
function closeModal() { $('#modal-mask').classList.remove('show'); }
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
  if (nm && !e.target.closest('[data-act]')) { npcSheet(nm.dataset.npc); return; }

  const pl = e.target.closest('[data-place]');
  if (pl) { V.place = pl.dataset.place || null; render(); return; }

  const ch = e.target.closest('[data-chron]');
  if (ch) { chronDetail(+ch.dataset.chron); return; }

  const it = e.target.closest('[data-item]');
  if (it) { toast((ITEMS[it.dataset.item] || {}).d || ''); return; }

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

  const act = e.target.closest('[data-act]');
  if (!act) {
    if (e.target.id === 'modal-mask' || e.target.closest('#modal-close-btn')) closeModal();
    return;
  }
  const a = act.dataset.act, id = act.dataset.id;
  if (a === 'close-res') {
    if (V.pendingSettle) { V.pendingSettle = false; settlementSheet(); return; }
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
  if (a === 'ia') {
    if (act.disabled) return;
    const r = interact(id, act.dataset.ia);
    if (r.duel) { duelSheet(); return; }
    resultSheet(r.lines);
    if (G.over) { render(); return; }
    if (r.settled) {
      if (act.dataset.ia === 'fun') V.pendingSettle = true;   // 枕边话先看完，点继续再结算
      else setTimeout(settlementSheet, 10);
    }
    else render();
    return;
  }
  if (a === 'buy' || a === 'sell') {
    const r = a === 'buy' ? tradeBuy(id, act.dataset.item, +act.dataset.p) : tradeSell(id, act.dataset.item, +act.dataset.p);
    resultSheet(r.lines);
    if (r.settled) setTimeout(settlementSheet, 10);
    else if (a === 'buy') tradeSheet(id); else { closeModal(); render(); }
    return;
  }
  if (a === 'repair') {
    const r = repairKnight();
    resultSheet(r.lines);
    if (r.settled) setTimeout(settlementSheet, 10);
    else render();
    return;
  }
  if (a === 'pickflower' || a === 'water' || a === 'pray' || a === 'study') {
    const r = doPlaceAction(V.place, a);
    resultSheet(r.lines);
    if (r.settled) setTimeout(settlementSheet, 10);
    else render();
    return;
  }
  if (a === 'shoot') {
    const r = towerShoot();
    resultSheet(r.lines);
    if (G.over) { render(); return; }
    if (r.settled) setTimeout(settlementSheet, 10);
    else render();
    return;
  }
  if (a === 'nighthunt') {
    const r = nightHunt();
    resultSheet(r.lines);
    if (G.over) { render(); return; }
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
  if (a === 'heal') { const r = healPotion(); resultSheet(r.lines); if (!r.blocked) render(); return; }
  if (a === 'rest') { restNow(); settlementSheet(); render(); return; }
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
        白天五个时段，村里人各在各的岗位上。想找谁，就去哪找。<br>
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
