/* ═══════════ 出行/關係/我頁 + 啟動 ═══════════ */
let lastLogLen = 0;
function flushLog(extra){
  if (!G) return;
  const news = G.dayLog.slice(lastLogLen);
  lastLogLen = G.dayLog.length;
  news.forEach(t => pushLog({t:t.t}));
  (extra||[]).forEach(t => pushLog({t}));
  uiRefresh();
}

/* ═══ 出行頁 ═══ */
function pageChuxing(){
  const p=G.player;
  const pg = h(`<div>
    <div class="page-title">出 行</div>
    <div class="card"><h3>採集之地</h3><div id="map-list"></div></div>
    <div class="card"><h3>週期秘境</h3><div id="dg-list"></div>
      <div class="btnrow"><button class="small gold" id="btn-yuehua">兌換月華仙谷（2000萬貢獻）</button></div></div>
    <div class="card"><h3>坊市</h3><div id="shop-list"></div></div>
  </div>`);
  const ml = pg.querySelector("#map-list");
  MAP_NAMES.forEach((mn,i)=>{
    const ok = p.ri >= MAP_REQ[i];
    const row = h(`<div class="list-item"><div><b>${mn}</b><span class="tag">${["金鐵","草木","獸材","天材"][i]}</span>
      <div class="desc">${ok?"外緣/內部/核心，可能遇妖獸":"需"+REALMS[MAP_REQ[i]].name+"修為"}</div></div>
      <div class="btnrow">${ok?[0,1,2].map(l=>`<button class="small ghost" data-l="${l}">${LAYER_NAMES[l]}</button>`).join(""):""}</div></div>`);
    if (ok) row.querySelectorAll("button").forEach(b=>b.onclick=()=>{ gather(i,+b.dataset.l); flushLog(); renderTab(); });
    ml.appendChild(row);
  });
  const dl = pg.querySelector("#dg-list");
  DUNGEONS.forEach(d=>{
    const open = dgOpen(d);
    const row = h(`<div class="list-item"><div><b>${d.name}</b>${open?'<span class="tag" style="background:#f5d7b0;color:#8a5a20">已開啟</span>':""}
      <div class="desc">${d.desc}</div></div>
      <button class="small ${open?"gold":"ghost"}" ${open?"":"disabled"}>探索(-2精力)</button></div>`);
    if (open) row.querySelector("button").onclick=()=>{ exploreDungeon(d); flushLog(); renderTab(); };
    dl.appendChild(row);
  });
  pg.querySelector("#btn-yuehua").onclick=()=>{ buyYuehua(); flushLog(); };
  const sl = pg.querySelector("#shop-list");
  const goods = [...Object.keys(PILLS).map(k=>({...PILLS[k],name:k,bag:"pills"})),
                 ...(p.poisonUnlocked?Object.keys(POISON_PILLS).map(k=>({...POISON_PILLS[k],name:k,bag:"poisons",poison:true})):[])];
  goods.forEach(g=>{
    const row = h(`<div class="list-item"><div><b>${g.name}${g.poison?"☠":""}</b><div class="desc">${g.desc}</div></div>
      <div class="btnrow"><span style="font-size:12px;color:#8a6a40;align-self:center">${fmt(g.price)}石</span><button class="small">買</button></div></div>`);
    row.querySelector("button").onclick=()=>{ buyPill(g.name); flushLog(); };
    sl.appendChild(row);
  });
  if (p.poisonUnlocked===false) sl.appendChild(h(`<div class="desc" style="color:#b07050;font-size:11px;margin-top:6px">☠ 毒丹：與藥王谷眾人交好（平均好感60）後解鎖。</div>`));
  return pg;
}

/* ═══ 關係頁：宗門總部（列表 ↔ 總部 兩層） ═══ */
let SECT_VIEW = null; // 當前打開的宗門總部視圖
let JIANGHU_VIEW = null; // null=門派列表 "friends"=相識名錄
function pageGuanxi(){
  if (SECT_VIEW) return pageSectHub(SECT_VIEW);
  if (JIANGHU_VIEW==="friends") return pageFriends();
  const p=G.player;
  const metN = G.npcs.filter(n=>n.met&&n.alive).length;
  const pg = h(`<div>
    <div class="page-title">江 湖</div>
    <div class="btnrow" style="margin-bottom:6px"><button class="gold small" id="jk-friends">我的相識（${metN}人）</button></div>
    <div class="card"><h3>江湖傳聞</h3><div id="world-log" style="max-height:150px;overflow-y:auto;font-size:12px;line-height:1.8;color:#6b5a48">
      ${G.worldLog.length?G.worldLog.slice(0,20).map(l=>`<div>·${l.t}</div>`).join(""):"<div style='color:#9a8a75'>江湖暫無風浪。</div>"}</div></div>
    <div class="card"><h3>各大門派</h3><div id="sect-list"></div>
      <div class="desc" style="font-size:11px;margin-top:4px">點開門派看名冊與人際關係，還能去廣場偶遇結識。</div></div>
  </div>`);
  pg.querySelector("#jk-friends").onclick=()=>{ JIANGHU_VIEW="friends"; renderTab(); };
  const sl = pg.querySelector("#sect-list");
  SECT.forEach(s=>{
    const here = hallHere(s).filter(n=>!n.met&&n.rank!=="稚童").length;
    const row = h(`<div class="list-item" style="cursor:pointer"><div>
      <b>${s}</b>${here?`<span class="tag" style="background:#f5d7b0;color:#8a5a20">有生面孔${here}</span>`:""}
      <div class="desc">${G.npcs.filter(n=>n.sect===s&&n.alive).length} 位修士</div></div>
      <span style="color:#b0a08a">›</span></div>`);
    row.onclick=()=>{ SECT_VIEW=s; renderTab(); };
    sl.appendChild(row);
  });
  return pg;
}
function pageFriends(){
  const p=G.player;
  const met = G.npcs.filter(n=>n.met&&n.alive)
    .sort((a,b)=> (b.love-a.love) || (b.favor-a.favor));
  const gone = G.npcs.filter(n=>n.met&&!n.alive);
  const pg = h(`<div>
    <div class="btnrow" style="margin-bottom:2px"><button class="small ghost" id="fr-back">← 返回江湖</button></div>
    <div class="page-title">我的相識</div>
    ${met.length?`<div class="card"><h3>在世（${met.length}）</h3><div id="fr-list"></div></div>`
      :`<div class="card"><div class="desc">還不認識誰。去門派廣場搭話，或宗門遊歷碰碰運氣。</div></div>`}
    ${gone.length?`<div class="card"><h3 style="color:#a08080">故人（${gone.length}）</h3><div id="fr-gone"></div></div>`:""}
  </div>`);
  pg.querySelector("#fr-back").onclick=()=>{ JIANGHU_VIEW=null; renderTab(); };
  const box = pg.querySelector("#fr-list");
  met.forEach(n=>{
    const away = n.loc!==n.sect;
    const spouse = p.spouse===n.id?'<span class="tag" style="background:#f0c0c0;color:#a04040">道侶</span>':"";
    const proposed = n.proposed?'<span class="tag" style="background:#f5d7b0;color:#8a5a20">求婚中</span>':"";
    const row = h(`<div class="list-item" style="cursor:pointer"><div>
      <b>${n.gender==="M"?"♂":"♀"} ${n.name}</b><span class="tag">${n.sect}</span>${spouse}${proposed}
      <div class="desc">友${n.favor}${n.love>0?` · ❤${n.love}`:""}${away?" · 雲遊中":""}</div></div>
      <span style="color:#b0a08a">›</span></div>`);
    row.onclick=()=>openNpcModal(n.id);
    box.appendChild(row);
  });
  const gbox = pg.querySelector("#fr-gone");
  if (gbox) gone.forEach(n=>{
    gbox.appendChild(h(`<div class="list-item" style="opacity:.55"><div>
      <b>† ${n.name}</b><span class="tag">${n.sect}</span>
      <div class="desc">${n.love>0?"生前與你有過一段情":"故人"}</div></div></div>`));
  });
  return pg;
}
function pageSectHub(sect){
  const p=G.player;
  const alive = G.npcs.filter(n=>n.sect===sect&&n.alive);
  const dead = G.npcs.filter(n=>n.sect===sect&&!n.alive);
  const meetCost = p.energy<1?"（精力不足）":"（-1精力）";
  /* 每日固定洗牌：一天內順序穩定，隔天換位 */
  const seed = G.player.day*97 + SECT.indexOf(sect)*13 + 7;
  let sd = seed % 233280 + 1;
  const roster = [...alive];
  for (let i=roster.length-1;i>0;i--){ sd = (sd*9301+49297)%233280;
    const j = Math.floor(sd/233280*(i+1)); [roster[i],roster[j]]=[roster[j],roster[i]]; }
  const pg = h(`<div>
    <div class="btnrow" style="margin-bottom:2px"><button class="small ghost" id="hub-back">← 返回江湖</button></div>
    <div class="page-title">${sect}</div>
    <div class="card">
      <div class="btnrow"><button class="gold small" id="hub-plaza">廣場偶遇${meetCost}·過天</button></div>
      <div class="desc" style="font-size:11px;margin-top:4px">去廣場轉轉：可能結識生面孔，也可能撞見舊識聊上幾句。</div>
    </div>
    <div class="card"><h3>山門名冊（${alive.length}人·順序每日變動）</h3><div id="hub-roster"></div></div>
    ${dead.length?`<div class="card"><h3 style="color:#a08080">往生（${dead.length}）</h3><div id="rk-dead"></div></div>`:""}
  </div>`);
  pg.querySelector("#hub-back").onclick=()=>{ SECT_VIEW=null; renderTab(); };
  pg.querySelector("#hub-plaza").onclick=()=>{ visitPlaza(sect); flushLog(); renderTab(); };
  const box = pg.querySelector("#hub-roster");
  roster.forEach(n=>{
    const away = n.loc!==sect;
    const met = n.met;
    const heart = met&&n.love>0?` ❤${n.love}`:"";
    const spouse = p.spouse===n.id?'<span class="tag" style="background:#f0c0c0;color:#a04040">道侶</span>':"";
    const proposed = met&&n.proposed?'<span class="tag" style="background:#f5d7b0;color:#8a5a20">求婚中</span>':"";
    const row = h(`<div class="list-item"><div>
      <b>${n.gender==="M"?"♂":"♀"} ${met?n.name:"？？？"}</b>${spouse}${proposed}
      <div class="desc">${met?`友${n.favor}${heart}${away?" · 雲遊中":""}`:(away?"面生，雲遊在外":"面生的"+(n.gender==="M"?"男修":"女修"))}</div></div>
      ${met?'<button class="small ghost" data-open="'+n.id+'">往來</button>'
           :(away?"":'<button class="small gold" data-meet="'+n.id+'">搭話'+meetCost+'</button>')}</div>`);
    box.appendChild(row);
  });
  if (dead.length) {
    const dbox = pg.querySelector("#rk-dead");
    dead.forEach(n=>{
      dbox.appendChild(h(`<div class="list-item" style="opacity:.55"><div>
        <b>† ${n.met?n.name:"？？？"}</b>
        <div class="desc">${n.met?(n.love>0?"生前與你有過一段情":"故人"):"身分不明"}</div></div></div>`));
    });
  }
  pg.querySelectorAll("[data-meet]").forEach(b=>b.onclick=()=>{
    const id=+b.dataset.meet, n=npcById(id);
    if (p.energy<1) return flushLog([["精力不足，改日再聊。"]]);
    p.energy--;
    meetNpc(id);
    msg(`${n.name}：${q(greetLine(n))}`);
    nextDay(); flushLog(); renderTab();
  });
  pg.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openNpcModal(+b.dataset.open));
  return pg;
}
function openNpcModal(id){
  let curLast = null; // 本次互動的最新台詞（顯示在名字下橫幅）
  const renderBody = ()=>{
    const n = npcById(id), p=G.player, P = PERS[n.pers];
    const isMonk = n.sect==="大自在殿";
    const showLove = !isMonk; // 佛門愛情隱藏
    const relOf = rid => { const x = npcById(rid); if(!x) return "";
      return `${x.met?`<b data-open="${x.id}" style="text-decoration:underline;cursor:pointer">${x.name}</b>`:`<span style="color:#b0a08a">${x.alive?"未結識":"已故"}</span>`}（${x.sect}${x.alive?"":"·已故"}）`; };
    let relHtml = "";
    if (n.rel.master!==null) relHtml += `<div class="kv"><span>師尊</span><span>${relOf(n.rel.master)}</span></div>`;
    if (n.spouseId!==null) relHtml += `<div class="kv"><span>道侶</span><span>${relOf(n.spouseId)}</span></div>`;
    if (n.rel.friends.length) relHtml += `<div class="kv"><span>摯友</span><span>${n.rel.friends.slice(0,3).map(relOf).join("、")}</span></div>`;
    if (n.rel.parents.length) relHtml += `<div class="kv"><span>父母</span><span>${n.rel.parents.map(relOf).join("、")}</span></div>`;
    if (n.rel.children.length) relHtml += `<div class="kv"><span>孩子</span><span>${n.rel.children.map(relOf).join("、")}</span></div>`;
    if (!relHtml) relHtml = `<div class="desc" style="font-size:11px;color:#b0a08a">萍水相逢，還不知他的師承故舊。</div>`;
    const gifts = [];
    p.swords.filter(s=>s.grade>=1).slice(0,8).forEach(s=>gifts.push(s.name));
    Object.keys(p.pills).forEach(k=>gifts.push(k));
    RECIPES && Object.keys(RECIPES).forEach(r=>{ const rc=RECIPES[r];
      if (rc.type==="禮物" && p.swords.some(s=>s.name===r)) gifts.push(r); });
    const uniqGifts = [...new Set(gifts)];
    return `
    <div style="font-size:13px;background:#f7efe0;border-radius:8px;padding:8px 10px;margin:6px 0;min-height:38px">
      ${curLast || `${n.name}：${q(greetLine(n))}`}</div>
    <div class="kv"><span>友情 ${n.favor}</span><span>${showLove?`愛情 ${n.love}`:"愛情 ???"}</span></div>
    <div class="bar favorbar"><div style="width:${clamp(n.favor,0,100)}%"></div></div>
    <div class="bar lovebar"><div style="width:${showLove?clamp(n.love,0,100):0}%"></div></div>
    ${n.loc!==n.sect?`<div class="desc" style="font-size:11px;color:#9a8a75;margin:6px 0">現在人在${n.loc}</div>`:""}
    ${n.proposed?`<div class="btnrow" style="margin:6px 0"><button class="gold small" data-prop="yes">答應求婚</button><button class="ghost small" data-prop="no">婉拒</button></div>`:""}
    <h3 style="margin-top:12px;font-size:14px;color:#7a5540">師門親友</h3>
    <div style="font-size:12px">${relHtml}</div>
    <div class="btnrow" style="margin-top:6px"><button class="small ghost" data-act="引薦">請他引薦親友（友情60）</button></div>
    <h3 style="margin-top:12px;font-size:14px;color:#7a5540">往來</h3>
    <div class="btnrow">
      <button class="ghost small" data-act="交好">攀談(-1精力)</button>
      <button class="ghost small" data-act="誇讚">誇讚(-1精力)</button>
      <button class="ghost small" data-act="逗弄">逗弄(-1精力)</button>
      <button class="ghost small" data-act="安慰">安慰(-1精力)</button>
      <button class="ghost small" data-act="調情">調情</button>
      <button class="ghost small" data-act="切磋">切磋</button>
      <button class="ghost small" data-act="雙修">雙修</button>
    </div>
    <h3 style="margin-top:12px;font-size:14px;color:#7a5540">送禮</h3>
    <div id="gift-row" class="btnrow" style="max-height:110px;overflow-y:auto;border:1px dashed #d8c6a8;border-radius:8px;padding:8px">
      ${uniqGifts.length?uniqGifts.map(g=>`<button class="small ghost" data-g="${g}">${g}</button>`).join(""):"<span style='font-size:12px;color:#9a8a75'>沒有可送的東西：鑄禮物劍或買丹藥</span>"}</div>
    <h3 style="margin-top:12px;font-size:14px;color:#7a5540">陰私</h3>
    <div class="btnrow">
      <button class="warn small" data-act="下毒">下毒</button>
      <button class="warn small" data-act="暗殺">暗殺</button>
      ${p.spouse===n.id?'<button class="warn small" id="btn-div">和離</button>':""}
      <button class="warn small" data-act="死鬥">死鬥</button>
    </div>`;
  };
  const bind = body=>{
    const lastMsg = ()=>{ const L=G.dayLog; return L.length? L[L.length-1].t : null; };
    body.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{ const x=npcById(+b.dataset.open);
      if(x&&x.alive){ openNpcModal(x.id); } });
    body.querySelectorAll("[data-prop]").forEach(b=>b.onclick=()=>{ answerProposal(id, b.dataset.prop==="yes"); curLast=lastMsg(); refresh(); flushLog(); });
    body.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{
      const act = b.dataset.act;
      if (act==="下毒") return uiPickPoison(npcById(id));
      if (act==="死鬥") { sparNpc(npcById(id),true); flushLog(); closeModal(); renderTab(); return; }
      if (act==="引薦") { introduce(id); curLast=lastMsg(); flushLog(); return refresh(); }
      interact(id, act); curLast=lastMsg(); flushLog(); refresh();
    });
    body.querySelectorAll("[data-g]").forEach(b=>b.onclick=()=>{
      gift(id, b.dataset.g); curLast=lastMsg(); flushLog(); refresh();
    });
    const dv = body.querySelector("#btn-div");
    if (dv) dv.onclick=()=>{ divorce(npcById(id)); flushLog(); closeModal(); renderTab(); };
  };
  const refresh = ()=>{ // 原地刷新彈窗內容（不關閉、不打斷連續操作）
    const body = el("modal-body");
    const keep = body.scrollTop;
    body.innerHTML = renderBody();
    bind(body);
    body.scrollTop = keep;
    if (npcById(id) && !npcById(id).alive) closeModal();
  };
  const n0 = npcById(id);
  openModal(`${n0.gender==="M"?"♂":"♀"} ${n0.name}（${n0.sect}·${n0.rank}·${realmText(n0.ri,n0.sub)}）`, renderBody(), body=>bind(body));
}

function uiPickPoison(n){
  const p=G.player, ps=Object.keys(p.poisons);
  if (!ps.length) { closeModal(); return flushLog([["你沒有毒丹。（坊市·藥王谷解鎖後可購）"]]); }
  openModal(`對 ${n.name} 下毒`, `<div id="pp-list"></div><div class="btnrow"><button class="ghost" onclick="closeModal()">罷手</button></div>`, body=>{
    const list = body.querySelector("#pp-list");
    ps.forEach(k=>{ const row = h(`<div class="list-item"><div><b>☠${k}</b> ×${p.poisons[k]}<div class="desc">${POISON_PILLS[k].desc}</div></div><button class="small warn">下</button></div>`);
      row.querySelector("button").onclick=()=>{ closeModal(); givePoison(n,k); flushLog(); renderTab(); }; list.appendChild(row); });
  });
}

/* ═══ 我頁 ═══ */
function pageMe(){
  const p=G.player;
  const saves = listSaves();
  const pg = h(`<div>
    <div class="page-title">我</div>
    <div class="card"><h3>面板</h3>
      <div class="kv"><span>姓名/年齡</span><span>${esc(p.name)} · ${p.age}歲</span></div>
      <div class="kv"><span>境界</span><span>${realmText(p.ri,p.sub)}</span></div>
      <div class="kv"><span>武力構成</span><span>基礎${p.ri*40+p.sub*8+5} + 劍意${Math.round((p.ri*40+p.sub*8+5)*p.swordSense*0.003)} + 劍${p.equip?p.equip.power:0}</span></div>
      <div class="kv"><span>聲望</span><span>${p.reputation} ${p.reputation<-50?"（正道通緝中！）":""}</span></div>
      <div class="kv"><span>佩劍</span><span>${p.equip?SWORD_GRADES[p.equip.grade]+"「"+p.equip.name+"」":"空手"}</span></div>
      <div class="kv"><span>道侶</span><span>${p.spouse!==null&&p.spouse!==undefined&&G.npcs[p.spouse]?G.npcs[p.spouse].name:"—"}</span></div>
      <div class="kv"><span>三生石</span><span>${G.flags.sanshengDone.length?G.flags.sanshengDone.map(i=>G.npcs[i].name).join("、"):"—"}</span></div>
    </div>
    <div class="card"><h3>存檔（SL：行動前手動存）</h3><div id="save-list"></div>
      <div class="kv" style="margin-top:8px"><span>自動存檔（每日）</span><button class="small ${p.autoSave?"":"ghost"}" id="btn-auto">${p.autoSave?"開":"關"}</button></div></div>
    <div class="card"><h3>冒險日誌</h3><div style="max-height:180px;overflow-y:auto;font-size:12px;line-height:1.7;color:#6b5a48">
      ${G.dayLog.slice(-40).reverse().map(l=>`<div>·${l.t}</div>`).join("")}</div></div>
  </div>`);
  const sl = pg.querySelector("#save-list");
  saves.forEach(s=>{
    const row = h(`<div class="list-item"><div><b>槽${s.slot}</b>${s.slot===0?"（自動）":""}
      <div class="desc">${s.empty?"空":esc(s.name)+" · "+s.time}</div></div>
      <div class="btnrow"><button class="small" data-op="save">存</button><button class="small ghost" data-op="load" ${s.empty?"disabled":""}>讀</button></div></div>`);
    row.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      if (b.dataset.op==="save"){ saveGame(s.slot); flushLog(); }
      else { loadGame(s.slot); lastLogLen = G.dayLog.length; flushLog(); }
      renderTab();
    });
    sl.appendChild(row);
  });
  pg.querySelector("#btn-auto").onclick=()=>{ p.autoSave=!p.autoSave; uiRefresh(); };
  return pg;
}

/* ═══ 開場 & 啟動 ═══ */
function showIntro(){
  const app = el("app");
  app.insertAdjacentHTML("beforeend", `
  <div id="intro">
    <div style="font-size:40px">🗡</div>
    <h1>萬劍山弟子修煉手札</h1>
    <p>你以凡人之軀拜入萬劍山。<br>練劍、鑄劍、斬妖、論劍，<br>山高路遠，道侶同行。<br>——男女皆可攻略，請自便。</p>
    <input id="intro-name" placeholder="道號（2-6字）" maxlength="6" value="">
    <div class="btnrow" style="justify-content:center">
      <button id="intro-go">拜入山門</button>
      <button class="ghost" id="intro-load">讀取存檔1</button>
    </div>
  </div>`);
  el("intro-go").onclick = ()=>{
    const name = el("intro-name").value.trim() || "無名";
    newGame(name);
    el("intro").remove();
    lastLogLen = 0; flushLog();
    saveGame(0,true);
  };
  el("intro-load").onclick = ()=>{
    if (!localStorage.getItem("wjs_1")) return alert("槽位1為空");
    loadGame(1); el("intro").remove(); lastLogLen = G.dayLog.length; flushLog();
  };
}
function boot(){
  document.querySelectorAll(".tab").forEach(t=>t.onclick=()=>switchTab(t.dataset.t));
  el("modal-close-btn").onclick = closeModal;
  el("modal-mask").onclick = e=>{ if(e.target.id==="modal-mask") closeModal(); };
  showIntro();
}
document.addEventListener("DOMContentLoaded", boot);
