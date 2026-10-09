/* ═══════════ UI 框架 + 修煉/鑄劍頁 ═══════════ */
let TAB = "xiulian";
function el(id){ return document.getElementById(id); }
function h(html){ const d=document.createElement("div"); d.innerHTML=html; return d.firstElementChild; }
function esc(s){ return String(s).replace(/</g,"&lt;"); }

/* ── 頂欄刷新 ── */
function uiRefresh() {
  if (!G) return;
  const p = G.player;
  el("avatar").textContent = "⛩";
  el("pname").innerHTML = `${esc(p.name)} <span class="realm">${realmText(p.ri,p.sub)}</span>`;
  el("statline").innerHTML =
    `<span class="res">⚡精力${p.energy}/${p.energyMax}</span><span class="res">💰${fmt(p.stones)}</span>`+
    `<span class="res">📜貢獻${fmt(p.contrib)}</span><span class="res">⚔武力${playerForce()}</span>`+
    `<span class="res">⭐聲望${p.reputation}</span>`;
  el("datebar").innerHTML = `<span>${year()}年${month()}月${dayOfMonth()}日 · ${p.age}歲</span><span>靈氣 ${fmt(p.spirit)}/${fmt(spiritCap())}</span>`;
  el("spiritfill").style.width = clamp(p.spirit/spiritCap()*100,0,100)+"%";
  const bp = el("sb-practice");
  if (bp) { bp.textContent = `練劍${p.practiceCnt}/5`; bp.disabled = p.practiceCnt>=5 || p.energy<1; }
  const bt = el("sb-task");
  if (bt && G.monthTask) { bt.textContent = G.monthTask.name.slice(0,2); bt.title = `宗門任務：${G.monthTask.name}——${G.monthTask.desc}`; }
  renderTab();
}
/* ── log（底部彈窗已移除：訊息一律記入修行手札） ── */
function pushLog(entry) { /* 手札即時區在 renderTab 時刷新 */ }
/* ── 彈窗 ── */
function openModal(title, bodyHtml, onMount) {
  el("modal-title").textContent = title;
  el("modal-body").innerHTML = bodyHtml;
  el("modal-mask").classList.add("show");
  if (onMount) onMount(el("modal-body"));
}
function closeModal(){ el("modal-mask").classList.remove("show"); }

/* ── Tab 渲染分流 ── */
function switchTab(t){ TAB=t; try{localStorage.setItem("wjs_tab", t);}catch(e){} if (typeof SECT_VIEW!=="undefined") SECT_VIEW=null; if (typeof JIANGHU_VIEW!=="undefined") JIANGHU_VIEW=null;
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelector(`.tab[data-t="${t}"]`).classList.add("active"); renderTab(); }
function renderTab(){
  const m = el("main");
  const keepScroll = m.scrollTop; // 保留滾動位置，避免重渲染後跳動
  m.innerHTML = "";
  if (TAB==="xiulian") m.appendChild(pageXiulian());
  else if (TAB==="zhujian") m.appendChild(pageZhujian());
  else if (TAB==="chuxing") m.appendChild(pageChuxing());
  else if (TAB==="guanxi") m.appendChild(pageGuanxi());
  else m.appendChild(pageMe());
  m.scrollTop = keepScroll; // 原地刷新，不跳動
}

/* ═══ 修煉頁 ═══ */
function xuiLogHtml(){
  const L = G.dayLog;
  if (!L.length) return `<div style="color:#9a8a75">還沒有記下什麼。</div>`;
  return L.slice().reverse().map(l=>`<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px dotted #e2d5bc">
    <span style="flex:0 0 52px;color:#a8916e;font-size:12px;align-self:center">第${l.d??""}日</span>
    <span style="flex:1">${l.t}</span></div>`).join("");
}
function pageXiulian(){
  const p=G.player;
  const compact = "padding:8px 10px";
  const h3s = "font-size:13px;margin:0 0 4px 0";
  const pg = h(`<div>
    <div class="page-title">修 煉</div>
    <div class="desc" style="font-size:11px;color:#9a8a75;margin-bottom:8px">修行與宗門任務按鈕已移至頂欄；當日記錄見下方手札。</div>
    ${p.guest && npcById(p.guest.id) ? (()=>{ const n=npcById(p.guest.id), g=p.guest;
      return `<div class="card" style="background:#fdf6ec;border:1px dashed #d8c8a8"><h3>院中來客</h3>
      <div class="list-item"><div>
        <b>${n.gender==="M"?"♂":"♀"} ${n.name}</b><span class="tag">${g.until-G.player.day+1}天後走</span>
        <div style="font-size:13px;background:#f7efe0;border-radius:8px;padding:8px 10px;margin:6px 0">${g.bubble?`「${g.bubble}」`:"（安靜地坐著）"}</div>
        <div class="desc">友${n.favor}${n.love>0?` · ❤${n.love}`:""} · 就在你院中盤桓，你修煉時也不打擾</div></div></div>
      <div class="btnrow">
        <button class="small" id="g-chat">閒聊（每日一次）</button>
        <button class="small ghost" id="g-flirt">調情</button>
        <button class="small ghost" id="g-dual">雙修</button>
        <button class="small ghost" id="g-leave">送客</button>
      </div></div>`; })() : ""}
    <div class="card" style="${compact}"><h3 style="${h3s}">丹藥</h3><div id="pill-list"></div></div>
    <div class="card"><h3>修行手札（每日記事·不會消失）</h3>
      <div id="xui-log" style="max-height:46vh;overflow-y:auto;font-size:14px;line-height:1.9;color:#4a3b28">${xuiLogHtml()}</div>
    </div>
  </div>`);
  const refreshLog = ()=>{ const x = pg.querySelector("#xui-log"); if (x) x.innerHTML = xuiLogHtml(); };
  const gc = pg.querySelector("#g-chat");
  if (gc) { gc.onclick = ()=>{ guestChat(); flushLog(); renderTab(); };
    pg.querySelector("#g-flirt").onclick = ()=>{ guestFlirt(); flushLog(); renderTab(); };
    pg.querySelector("#g-dual").onclick = ()=>{ guestDual(); flushLog(); renderTab(); };
    pg.querySelector("#g-leave").onclick = ()=>{ guestLeave(); flushLog(); renderTab(); }; }
  const pl = pg.querySelector("#pill-list");
  const keys = Object.keys(p.pills);
  pl.innerHTML = keys.length ? "" : `<div class="desc" style="color:#9a8a75;font-size:12px">背包沒有丹藥。丹藥可在【出行→坊市】購買。</div>`;
  keys.forEach(k => { const row = h(`<div class="list-item"><div><b>${k}</b> ×${p.pills[k]}<div class="desc">${(PILLS[k]||{}).desc||""}</div></div>
    <button class="small ghost">${k==="聚靈散"?"服用":"說明"}</button></div>`);
    row.querySelector("button").onclick = ()=>{ usePill(k); flushLog(); refreshLog(); }; pl.appendChild(row); });
  return pg;
}

/* ═══ 鑄劍頁 ═══ */
function pageZhujian(){
  const p=G.player;
  const pg = h(`<div>
    <div class="page-title">鑄 劍</div>
    <div class="card"><h3>佩劍</h3>
      <div class="kv"><span>當前佩劍</span><span>${p.equip?SWORD_GRADES[p.equip.grade]+"「"+p.equip.name+"」 力+"+p.equip.power:"空手"}</span></div>
      <div class="kv"><span>鍛造等級</span><span>Lv.${p.forgeLv}${p.ding?" · 神鑄劍爐(+20%)":""}</span></div>
    </div>
    <div class="card"><h3>劍譜</h3><div id="recipe-list"></div></div>
    <div class="card"><h3>劍庫（${p.swords.length}）</h3><div id="sword-list"></div></div>
    <div class="card"><h3>材料（${Object.values(p.mats).reduce((a,b)=>a+b,0)}）</h3>
      <div class="btnrow"><button class="ghost small" id="btn-sellall">批量售賣低階</button></div>
      <div id="mat-list"></div></div>
  </div>`);
  const rl = pg.querySelector("#recipe-list");
  p.recipes.forEach(r => {
    const rc = RECIPES[r]; if (!rc) return;
    const needTxt = Object.entries(rc.need).map(([e,v])=>`<span class="e-${{金:"jin",木:"mu",水:"shui",火:"huo",土:"tu"}[e]}">${e}${v}</span>`).join(" ");
    const row = h(`<div class="list-item"><div><b>${r}</b><span class="tag">${rc.type}</span>
      <div class="desc">${rc.desc} · 需 ${needTxt} · 熟練${p.mastery[r]||0}</div></div>
      <button class="small gold">開爐</button></div>`);
    row.querySelector("button").onclick = ()=>openForgeModal(r);
    rl.appendChild(row);
  });
  const sl = pg.querySelector("#sword-list");
  if (!p.swords.length) sl.innerHTML = `<div class="desc" style="color:#9a8a75;font-size:12px">還沒有鑄出過劍。</div>`;
  p.swords.forEach(s => {
    const row = h(`<div class="list-item"><div><b>${SWORD_GRADES[s.grade]}「${s.name}」</b>${p.equip&&p.equip.id===s.id?'<span class="tag">佩劍中</span>':""}
      <div class="desc">武力+${s.power} · 值${fmt(s.value)}</div></div>
      <div class="btnrow"><button class="small ghost">售</button><button class="small ghost">繳</button>${p.equip&&p.equip.id===s.id?"":'<button class="small">佩</button>'}</div></div>`);
    const [b1,b2,b3] = row.querySelectorAll("button");
    b1.onclick=()=>{ sellSword(s.id); flushLog(); renderTab(); };
    b2.onclick=()=>{ contribSword(s.id); flushLog(); renderTab(); };
    if (b3) b3.onclick=()=>{ p.equip=s; uiRefresh(); };
    sl.appendChild(row);
  });
  const ml = pg.querySelector("#mat-list");
  const mats = Object.keys(p.mats).sort((a,b)=>HERBS[b].grade-HERBS[a].grade);
  if (!mats.length) ml.innerHTML = `<div class="desc" style="color:#9a8a75;font-size:12px">去【出行】採集材料吧。</div>`;
  mats.forEach(k => {
    const mt = HERBS[k];
    const row = h(`<div class="list-item"><div><b>${k}</b> ×${p.mats[k]}<span class="tag">${["一","二","三","四","五"][mt.grade-1]}階</span>
      <div class="desc ele"><b class="e-${{金:"jin",木:"mu",水:"shui",火:"huo",土:"tu"}[mt.ele]}">${mt.ele}${mt.ev[mt.ele]}</b>
      ${ELES.filter(e=>e!==mt.ele&&mt.ev[e]).map(e=>`${e}${mt.ev[e]}`).join(" ")}</div></div>
      <div class="btnrow"><button class="small ghost">售</button><button class="small ghost">繳</button></div></div>`);
    const [b1,b2]=row.querySelectorAll("button");
    b1.onclick=()=>{ sellMat(k,1); flushLog(); renderTab(); };
    b2.onclick=()=>{ contribMat(k,1); flushLog(); renderTab(); };
    ml.appendChild(row);
  });
  pg.querySelector("#btn-sellall").onclick = ()=>{
    let sum=0; Object.keys(p.mats).forEach(k=>{ if(HERBS[k].grade<=2){ sum+=HERBS[k].value*p.mats[k]; delete p.mats[k]; } });
    p.stones+=sum; flushLog([[`批量售賣一二階材料，得靈石${fmt(sum)}。`]]); renderTab(); };
  return pg;
}
/* 選材開爐彈窗 */
let forgePicks = [];
function openForgeModal(recipeName){
  const rc = RECIPES[recipeName];
  forgePicks = [];
  const mats = Object.keys(G.player.mats).sort((a,b)=>HERBS[b].grade-HERBS[a].grade);
  openModal(`開爐：${recipeName}`, `
    <div style="font-size:12px;color:#7a654e;margin-bottom:8px">需求：${Object.entries(rc.need).map(([e,v])=>`${e}≥${v}`).join("、")}
    （屬性總和越全，品質越高：下→中→上→極品）</div>
    <div id="fp-sum" style="font-size:13px;margin-bottom:8px"></div>
    <div style="max-height:200px;overflow-y:auto" id="fp-mats"></div>
    <div class="btnrow"><button id="fp-go" class="gold">開爐！</button><button class="ghost" onclick="closeModal()">算了</button></div>`,
  body => {
    const list = body.querySelector("#fp-mats");
    const render = () => {
      list.innerHTML = "";
      mats.forEach(k => {
        const mt = HERBS[k];
        const cnt = G.player.mats[k] - forgePicks.filter(x=>x===k).length;
        if (cnt<=0) return;
        const row = h(`<div class="list-item"><div><b>${k}</b><div class="desc ele">${ELES.map(e=>`${e}${mt.ev[e]}`).join(" ")}</div></div>
          <button class="small ghost">+加入</button></div>`);
        row.querySelector("button").onclick = ()=>{ forgePicks.push(k); render(); updateSum(); };
        list.appendChild(row);
      });
    };
    const updateSum = () => {
      const sum={}; ELES.forEach(e=>sum[e]=0); forgePicks.forEach(k=>ELES.forEach(e=>sum[e]+=HERBS[k].ev[e]));
      const hits = Object.keys(rc.need).filter(e=>sum[e]>=rc.need[e]).length;
      const total = forgePicks.reduce((a,k)=>a+HERBS[k].value,0);
      body.querySelector("#fp-sum").innerHTML =
        `已選${forgePicks.length}件 → ${ELES.map(e=>`${e}:${sum[e]}`).join(" ")} · 達標 ${hits}/${Object.keys(rc.need).length}`;
    };
    render(); updateSum();
    body.querySelector("#fp-go").onclick = ()=>{
      if (!forgePicks.length) return;
      forgePicks.forEach(k=>{ G.player.mats[k]--; if(!G.player.mats[k]) delete G.player.mats[k]; });
      closeModal(); forge(recipeName, forgePicks); flushLog(); renderTab();
    };
  });
}
