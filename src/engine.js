/* ═══════════ 引擎 ═══════════ */
let G = null;          // 遊戲狀態
const rnd = n => Math.floor(Math.random()*n);
const d20 = () => 1 + rnd(20);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const fmt = n => n >= 1e8 ? (n/1e8).toFixed(1)+"億" : n >= 1e4 ? (n/1e4).toFixed(1)+"萬" : Math.round(n);

/* ── 新局 ── */
function newGame(name) {
  G = {
    ver: 2,
    player: { name, gender:"F", age:16, day:1, spirit:0, energy:10, energyMax:10, practiceCnt:0, lessonYM:-1,
      stones:500, contrib:0, ri:0, sub:0, deaths:0, alive:true,
      mats:{}, swords:[], equip:null, recipes:["青鋒劍","精鋼獵刀","鎮宅木劍"],
      mastery:{}, forgeLv:1, swordSense:0, // 劍意熟練
      pills:{}, poisons:{}, teacher:null, spouse:null, reputation:0,
      autoSave:true, poisonUnlocked:false, ding:false, yuehuaOwned:false,
      lifeSeed: 130, surviveRisk:0 },
    npcs: genWorld(),
    dayLog:[], monthTask:genTask(), affair:{}, sansheng:[],
    worldLog:[],
    flags:{ sanshengDone:[], dgFirstClear:[], meetLog:{} },
  };
  // 開局認識兩位同屆師兄妹
  const same = G.npcs.filter(n=>n.sect==="萬劍山"&&n.rank==="弟子"&&n.age<=25);
  same.slice(0,2).forEach(n=>{ n.met=true; n.favor=30; });
  msg(`你被萬劍山收入門牆，成為外門弟子。劍道漫漫，今日始。`);
  msg(`同屆的${same.slice(0,2).map(n=>n.name).join("與")}領你認了山門。`);
}
function genTask() { // 每月宗門任務
  const pool = [
    {name:"巡視山門", energy:1, reward:()=>({stones:200, contrib:50}), desc:"驅逐野獸"},
    {name:"斬妖懸賞", energy:2, reward:()=>({stones:500, contrib:150}), desc:"山下有妖獸作亂", needForce:10},
    {name:"採辦劍材", energy:2, reward:()=>({stones:300, contrib:100}), desc:"為鑄劍房收集材料", needMat:true},
    {name:"論劍值日", energy:1, reward:()=>({stones:150, contrib:80}), desc:"維持論劍台秩序"},
  ];
  return pool[rnd(pool.length)];
}

/* ═══════════ 世界生成 ═══════════ */
let NPC_UID = 0;
function genName(gender){
  const pool = gender==="M"?GIVEN_M:GIVEN_F;
  return SURNAMES[rnd(SURNAMES.length)] + pool[rnd(pool.length)];
}
function mkNpc(sect, rank, ri, gender, ageHint) {
  const n = {
    id: NPC_UID++, name: genName(gender), sect, rank, gender, ri,
    sub: REALMS[ri].layers ? rnd(9) : rnd(3),
    age: ageHint !== undefined ? ageHint : (rank==="弟子" ? 16+rnd(30) : rank==="長老" ? 90+rnd(300) : 280+rnd(400)),
    pers: rollPers(sect), special: "",
    met:false, favor:0, love:0, alive:true, deadBy:"",
    spouseId:null, spouse:"", rel:{master:null, friends:[], parents:[], children:[]},
    loc: sect, poison:null, danToxin:0, proposed:false,
  };
  n.lifespan = LIFESPAN(ri);
  if (n.age > n.lifespan*0.85) n.age = Math.floor(n.lifespan*(0.4+Math.random()*0.3));
  if (rank==="稚童") n.age = ageHint||1+rnd(6);
  return n;
}
function genWorld() {
  NPC_UID = 0;
  const npcs = [];
  WORLD_ROSTER.forEach(w => {
    const master = mkNpc(w.sect,"掌門", 5+rnd(2), Math.random()<w.mRatio?"M":"F");
    master.special = w.sect==="大自在殿"?"方丈":"一派掌門";
    if (w.sect==="大自在殿" && Math.random()<0.5) master.pers = "無情";
    npcs.push(master);
    const elders = [];
    for (let i=0;i<w.elders;i++){ const e=mkNpc(w.sect,"長老", w.elderRi[0]+rnd(w.elderRi[1]-w.elderRi[0]+1), Math.random()<w.mRatio?"M":"F"); elders.push(e); npcs.push(e); }
    const discs = [];
    for (let i=0;i<w.discs;i++){ const d=mkNpc(w.sect,"弟子", w.discRi[0]+rnd(w.discRi[1]-w.discRi[0]+1), Math.random()<w.mRatio?"M":"F"); discs.push(d); npcs.push(d); }
    discs.forEach(d=>{ d.rel.master = (Math.random()<0.25? master : elders[rnd(elders.length)]).id; });
    elders.forEach(e=>{ if(Math.random()<0.5) e.rel.master = master.id; });
    [...discs,...elders].forEach(x=>{
      const cnt = 1+rnd(2);
      for(let k=0;k<cnt;k++){ const c=(Math.random()<0.2? elders[rnd(elders.length)] : discs[rnd(discs.length)]);
        if(c!==x && !x.rel.friends.includes(c.id)) x.rel.friends.push(c.id); }
    });
  });
  // 跨派好友（互通款曲）
  for(let k=0;k<10;k++){ const a=npcs[rnd(npcs.length)], b=npcs[rnd(npcs.length)];
    if(a!==b && a.sect!==b.sect && !a.rel.friends.includes(b.id)){ a.rel.friends.push(b.id); b.rel.friends.push(a.id); } }
  // 既有道侶
  for(let k=0;k<6+rnd(4);k++){
    const a=npcs[rnd(npcs.length)];
    if(a.spouseId!==null || (a.rank==="弟子"&&a.age<28)) continue;
    const cands=npcs.filter(b=>b!==a && b.spouseId===null && b.gender!==a.gender && b.rank!=="稚童" && !(b.rank==="弟子"&&b.age<28));
    if(cands.length){ const b=cands[rnd(cands.length)]; a.spouseId=b.id; b.spouseId=a.id; }
  }
  return npcs;
}
function n2t(n){ return `${n.sect}${n.rank==="掌門"?"掌門":n.rank==="稚童"?"小童":""}${n.name}`; }
function wlog(t, important) {
  if (!G.worldLog) G.worldLog=[];
  G.worldLog.unshift({d:G.player.day, t});
  if (G.worldLog.length>80) G.worldLog.pop();
  if (important) msg("【江湖】"+t);
}

/* ═══════════ 世界運轉 ═══════════ */
function tickWorldDaily() { // NPC 位置流動：少出門、快回家，保證門派裡多數有人的
  G.npcs.forEach(n=>{ if(!n.alive) return;
    if (n.loc!==n.sect) { if (Math.random()<0.18) n.loc=n.sect; }
    else if (Math.random()<0.025)
      n.loc = Math.random()<0.5 ? ["坊市","秘境"][rnd(2)] : SECT[rnd(SECT.length)];
  });
}
function worldTickMonthly() {
  const alive = G.npcs.filter(n=>n.alive);
  // 好感淡忘
  alive.forEach(n=>{ if(n.met && n.love<70 && G.player.spouse!==n.id && G.player.spouse!==undefined){
    const dec = Math.round(PERS[n.pers].decay);
    if(dec) n.favor = clamp(n.favor-dec, -200, 120);
  }});
  // NPC 社會事件
  const evts = 1+rnd(3);
  for(let k=0;k<evts;k++) worldEvent(alive);
  // 有人向你求婚
  if (G.player.spouse===null || G.player.spouse===undefined)
    alive.forEach(n=>{ if(n.met && !n.proposed && n.love>=90 && n.age>=18 && Math.random()<0.15){
      n.proposed=true;
      msg(`${n.name}紅著耳根遞來一封信——是求婚之意！可到【關係】頁回應。`);
      wlog(`聽說${n.name}向你提親了，好事者都在看戲。`, false);
    }});
}
function worldEvent(alive) {
  const pick = () => alive[rnd(alive.length)];
  const r = Math.random();
  if (r<0.2) { // 閉關突破
    const n=pick();
    if(n.ri<7 && n.age<n.lifespan*0.7 && Math.random()<0.2){ n.ri++; n.sub=0;
      wlog(`${n2t(n)}閉關而出，一舉突破至【${realmText(n.ri,n.sub)}】。`, n.met); }
  } else if (r<0.38) { // 結為道侶
    const a=pick();
    if(!a.spouseId && a.age>=25 && a.rank!=="稚童" && Math.random()<0.5){
      const cands=alive.filter(b=>b.spouseId===null&&b!==a&&b.gender!==a.gender&&b.age>=25);
      if(cands.length){ const b=cands[rnd(cands.length)]; a.spouseId=b.id; b.spouseId=a.id;
        wlog(`${n2t(a)}與${n2t(b)}結為道侶，各派道賀。`, a.met||b.met); } }
  } else if (r<0.48) { // 道侶破裂（偶發情殺）
    const paired=alive.filter(x=>x.spouseId!==null);
    if(paired.length && Math.random()<0.4){
      const a=paired[rnd(paired.length)], b=npcById(a.spouseId);
      if(b && b.alive){
        a.spouseId=null; b.spouseId=null;
        wlog(`${n2t(a)}與${n2t(b)}道心相悖，一拍兩散，江湖唏噓。`, a.met||b.met);
        if(Math.random()<0.25){
          const loser = npcForce(a)>npcForce(b)?b:a, winner = loser===a?b:a;
          loser.alive=false; loser.deadBy="情殺"; winner.spouseId=null;
          wlog(`${loser.name}糾纏不休，被${winner.name}一劍斃命。各派震動。`, loser.met||winner.met); } } }
  } else if (r<0.6) { // 誕子（外貌基因：隨機遺傳，v3再做捏臉）
    const paired=alive.filter(x=>x.spouseId!==null&&x.gender==="F"&&x.rank!=="稚童");
    if(paired.length && G.npcs.length<130 && Math.random()<0.4){
      const m=paired[rnd(paired.length)], f=npcById(m.spouseId);
      if(f && f.alive){
        const g=Math.random()<0.5?"M":"F";
        const child=mkNpc(f.sect,"稚童",0,g,1+rnd(4));
        child.rel.parents=[f.id,m.id]; m.rel.children.push(child.id); f.rel.children.push(child.id);
        G.npcs.push(child);
        wlog(`${m.name}誕下一${g==="M"?"子":"女"}，取名${child.name}，說書人說眉眼像極了${f.name}。`, m.met||f.met); } }
  } else if (r<0.7) { // 新弟子入門
    const w=WORLD_ROSTER[rnd(WORLD_ROSTER.length)];
    const cnt = G.npcs.filter(x=>x.alive&&x.sect===w.sect&&x.rank!=="掌門"&&x.rank!=="長老").length;
    if(cnt<12 && Math.random()<0.5){
      const d=mkNpc(w.sect,"弟子",0,Math.random()<w.mRatio?"M":"F",16);
      const seniors=G.npcs.filter(x=>x.alive&&x.sect===w.sect&&(x.rank==="長老"||x.rank==="掌門"));
      if(seniors.length) d.rel.master = seniors[rnd(seniors.length)].id;
      G.npcs.push(d);
      wlog(`${d.name}通過入門試煉，拜入${w.sect}。`, false); }
  } else if (r<0.8) { // 壽終
    const old=alive.filter(x=>x.age>x.lifespan*0.8);
    if(old.length && Math.random()<0.5){ const n=old[rnd(old.length)];
      npcDie(n,"壽終");
      wlog(`${n2t(n)}壽元耗盡，含笑坐化，享年${n.age}。`, n.met); }
  } else if (r<0.86) { // 渡劫失敗
    const hi=alive.filter(x=>x.ri>=6);
    if(hi.length && Math.random()<0.2){ const n=hi[rnd(hi.length)];
      npcDie(n,"渡劫");
      wlog(`${n2t(n)}衝擊更高境界失敗，身死道消，舉世震動。`, n.met); }
  }
}
function npcDie(n, cause) { // NPC 死亡公共處理（自然死亡無人遷怒）
  n.alive=false; n.deadBy=cause;
  if(n.spouseId!==null){ const s=npcById(n.spouseId); if(s) s.spouseId=null; }
  if(G.player.spouse===n.id) G.player.spouse=null;
}
function onNpcKilled(n, cause) // 被玩家所殺：親友反目
{
  npcDie(n, cause);
  const hit=(id,v)=>{ const x=npcById(id); if(x&&x.alive&&x.met) x.favor=clamp(x.favor-v,-200,120); };
  if(n.spouseId!==null) hit(n.spouseId,80);
  n.rel.friends.forEach(id=>hit(id,50));
  if(n.rel.master!==null) hit(n.rel.master,60);
  n.rel.parents.forEach(id=>hit(id,80));
  n.rel.children.forEach(id=>hit(id,60));
  G.npcs.filter(o=>o.sect===n.sect&&o.alive&&o.met&&o.id!==n.id).forEach(o=>o.favor=clamp(o.favor-10,-200,120));
  wlog(`${n2t(n)}死了（${cause}）。其親友悲憤不已。`, true);
}

/* ═══════════ 拜訪與結識 ═══════════ */
function hallHere(sect) { return G.npcs.filter(n=>n.alive && n.loc===sect); }
/* 台詞性別適配：男 NPC 自稱自動換（老娘→老子 等），女原樣 */
/* 台詞引號：行內已帶「」則不再外包 */
function q(s){ return s.startsWith("「") ? s : "「"+s+"」"; }
function gdial(n, s){
  if (n.gender!=="M") return s.replace(/老夫/g,"老身"); // 女性自稱修正
  return s.replace(/老娘/g,"老子").replace(/姑奶奶/g,"大爺").replace(/姐姐/g,"哥哥")
          .replace(/小女子/g,"小生").replace(/女兒家/g,"男兒家");
}
function greetLine(n){ const P=PERS[n.pers]; return gdial(n, P.greet[rnd(P.greet.length)]); }
/* 廣場偶遇：-1精力+過天，隨機結識在場陌生人或與舊識閒聊 */
function visitPlaza(sect) {
  const p=G.player;
  if (p.energy<1) return msg("精力不足。");
  p.energy--;
  const here = hallHere(sect).filter(n=>n.rank!=="稚童");
  const unmet = here.filter(n=>!n.met);
  if (unmet.length && Math.random()<0.75) {
    const n = unmet[rnd(unmet.length)];
    const P = PERS[n.pers];
    meetNpc(n.id);
    const st = st3(n.favor);
    const pool = P.chat[st];
    msg(`廣場上，${n.name}主動開了口：${q(gdial(n,pool[rnd(pool.length)]))}`);
  } else if (here.length && Math.random()<0.6) {
    const met = here.filter(n=>n.met);
    if (met.length) {
      const n = met[rnd(met.length)], P = PERS[n.pers];
      n.favor = clamp(n.favor+P.chatFav, -200, 120);
      const st = st3(n.favor), pool = P.chat[st];
      msg(`廣場偶遇${n.name}，聊了幾句（友情+${P.chatFav}）：${q(gdial(n,pool[rnd(pool.length)]))}`);
    } else msg(`${sect}的廣場人來人往，今日沒遇上投緣的。`);
  } else msg(`${sect}的廣場今日靜悄悄，只有掃地的雜役。`);
  nextDay();
}
function meetNpc(id) {
  const n=G.npcs[id]; if(!n.met){ n.met=true;
    msg(`你結識了${n2t(n)}（${realmText(n.ri,n.sub)}·${n.pers}）。${n.name}：「${greetLine(n)}」`); }
}
function introduce(id) {
  const n=npcById(id);
  if (n.favor<60) return msg(`交情不夠（需友情60），${n.name}還不會引薦你。`);
  const circle=[n.rel.master,...n.rel.friends,...n.rel.parents,n.spouseId,...n.rel.children].filter(x=>x!==null&&x!==undefined);
  const unmet=circle.map(x=>npcById(x)).filter(x=>x&&x.alive&&!x.met);
  if(!unmet.length) return msg(`${n.name}的師門親友，你已都識得了。`);
  const t=unmet[rnd(unmet.length)];
  t.met=true; t.favor=Math.max(t.favor,15);
  const rel = t.id===n.rel.master?"師尊": n.rel.friends.includes(t.id)?"摯友": n.rel.parents.includes(t.id)?"父母": t.id===n.spouseId?"道侶":"孩子";
  msg(`${n.name}為你引薦了他的${rel}——${n2t(t)}（${realmText(t.ri,t.sub)}·${t.pers}）。`);
}
function answerProposal(id, yes) {
  const n=npcById(id); if(!n||!n.proposed) return;
  n.proposed=false;
  if(yes){ if(G.player.spouse!==null && G.player.spouse!==undefined) return msg("你已有道侶。");
    G.player.spouse=n.id; n.spouse=G.player.name; n.love=100;
    msg(`${n.name}：「${PERS[n.pers].intimate[0]}」——你們結為道侶！`);
    wlog(`你與${n2t(n)}結為道侶。`, true);
  } else { n.love=clamp(n.love-30,0,100); n.favor=clamp(n.favor-20,-200,120);
    msg(`你婉拒了${n.name}。他眼底的光暗了暗。`); }
  uiRefresh();
}

/* ── 派生屬性 ── */
function playerForce() {
  const p = G.player;
  return Math.round( (p.ri*40 + p.sub*8 + 5) * (1 + p.swordSense*0.003) + (p.equip ? p.equip.power : 0) + p.forgeLv*2 );
}
function npcForce(n) { return Math.round((n.ri*40 + n.sub*8 + 5) * (1 + (n.pers==="寡言"||n.pers==="無情"?0.15:0))); }
function spiritCap() { return spiritNeed(G.player.ri, G.player.sub); }

/* ── 時間 ── */
const DAY_MS = 0; // 回合制，無需真實時間
function dayNum(){ return G.player.day; }
function year(){ return Math.floor((G.player.day-1)/360) + 1; }
function month(){ return Math.floor(((G.player.day-1)%360)/30) + 1; }
function dayOfMonth(){ return ((G.player.day-1)%30) + 1; }
function nextDay(n=1) {
  for (let k=0;k<n;k++) {
    G.player.day++; G.player.age = 16 + Math.floor((G.player.day-1)/360);
    G.player.energy = clamp(G.player.energy+1, 0, G.player.energyMax);
    G.player.practiceCnt = 0;
    tickPoison(); tickNpcYear(); tickWorldDaily(); tickGuest();
    if (dayOfMonth()===1) { onMonth(); worldTickMonthly(); }
    if (year()%5===0 && month()===5) onSummit();
    if (dayOfMonth()===1 && ((G.player.day-1)%360)===0) onYear();
    if (!G.player.alive) return;
  }
  uiRefresh();
}
function onMonth() { G.monthTask = genTask(); msg(`【${year()}年${month()}月】宗門發布新任務：${G.monthTask.name}`);
  if (G.player.autoSave) saveGame(0, true); // 每月自動存檔（槽0，靜默）
}
function onYear() { /* NPC 成長在 tickNpcYear 內按年處理 */ }
function onSummit() {
  msg("五年一度的正道大會召開，各派弟子雲集論劍。");
  const unmet = G.npcs.filter(n=>!n.met && n.alive && n.rank!=="稚童");
  for (let i=0;i<2 && unmet.length;i++) {
    const m = unmet.splice(rnd(unmet.length),1)[0];
    m.met=true; m.favor=10;
    msg(`你在會上結識了${n2t(m)}（${realmText(m.ri,m.sub)}·${m.pers}）。他說：「${greetLine(m)}」`);
  }
}

/* ═══ 訪客：認識的 NPC 會主動來訪，情誼深厚者賴住 3-6 天 ═══ */
function guestBubble(n){
  const P = PERS[n.pers];
  if (n.favor>=70 && n.love>=60) {
    const pool = Math.random()<0.5 ? P.intimate : P.chat[2];
    return gdial(n, pool[rnd(pool.length)]);
  }
  const pool = P.chat[st3(n.favor)];
  return gdial(n, pool[rnd(pool.length)]);
}
/* 來訪門檻：友情、愛情雙高才上門（只有友情高的普通朋友不會賴來家裡） */
const GUEST_REQ_FAV = 60, GUEST_REQ_LOVE = 50;
/* 家中有客仍出門：訪客抱怨（不掉好感，純鬧脾氣） */
function guestSulk(why){
  const p = G.player;
  if (!p.guest) return;
  const n = npcById(p.guest.id);
  if (!n || !n.alive) return;
  const SULK = [
    `「去吧去吧，誰稀罕你陪。」${n.name}抱著膝蓋坐到牆角，背影寫滿怨念。`,
    `「……你走你的。」${n.name}把茶杯磕得很響，顯然在鬧脾氣。`,
    `${n.name}嘟囔著「把我一個人丟在院裡」，賭氣不吃你留的點心。`,
    `「早去早回……哼，我才沒有等你。」${n.name}彆扭地擺手。`,
  ];
  msg(`${SULK[rnd(SULK.length)]}（${why}照常進行，${n.name}有些不高興，但不記仇）`);
}
function tickGuest(){
  const p = G.player;
  if (p.guest) {
    const g = p.guest, n = npcById(g.id);
    if (!n || !n.alive || p.day > g.until) {
      if (n && n.alive) { const P=PERS[n.pers];
        msg(`${n.name}收拾行裝，戀戀不捨地告辭了：${q(gdial(n,P.greet[rnd(P.greet.length)]))}`); }
      p.guest = null; return;
    }
    g.chatted = false; g.bubble = guestBubble(n); // 每日換一句閒話
    return;
  }
  const cands = G.npcs.filter(n=>n.alive&&n.met&&n.favor>=GUEST_REQ_FAV&&n.love>=GUEST_REQ_LOVE);
  if (!cands.length) return;
  const heat = cands.reduce((s,n)=>s+Math.max(0,n.favor-GUEST_REQ_FAV)+Math.max(0,n.love-GUEST_REQ_LOVE), 0);
  if (Math.random() >= 0.05 + heat/6000) return;
  const n = cands[rnd(cands.length)];
  const stayBoth = n.favor>=70 && n.love>=60;
  const days = stayBoth ? 3+rnd(4) : 1;
  const P = PERS[n.pers];
  p.guest = { id:n.id, until:p.day+days, chatted:false, bubble:guestBubble(n) };
  msg(`${n.name}上門來訪${stayBoth?"，看樣子打算賴著小住幾日":"，坐坐便走"}：${q(gdial(n,P.greet[rnd(P.greet.length)]))}`);
}
function guestChat(){
  const p=G.player, g=p.guest; if(!g) return;
  const n = npcById(g.id), P = PERS[n.pers];
  if (g.chatted) return msg(`${n.name}今日已同你說了許多話，這會兒安靜地陪著你打坐。`);
  g.chatted = true;
  n.favor = clamp(n.favor+P.chatFav, -200, 120);
  const pool = P.chat[st3(n.favor)];
  const line = gdial(n,pool[rnd(pool.length)]);
  g.bubble = line;
  msg(`${n.name}：${q(line)}（友情+${P.chatFav}）`);
}
function guestFlirt(){
  const p=G.player, g=p.guest; if(!g) return;
  const n = npcById(g.id), P = PERS[n.pers];
  if (n.favor < P.flirtReq) return msg(`${n.name}：${q(gdial(n,P.flirtNo[rnd(P.flirtNo.length)]))}`);
  const cap = P.loveCap||100, st = st3(n.love);
  const lg = Math.max(0, Math.min(P.loveGain+rnd(3), cap-n.love));
  n.love = clamp(n.love+lg, 0, cap);
  const line = gdial(n,P.flirt[st][rnd(P.flirt[st].length)]);
  g.bubble = line;
  msg(`${n.name}：${q(line)}（愛情+${lg}）`);
}
function guestDual(){ // 院中來客雙修：門檻與切磋台一致
  const p=G.player, g=p.guest; if(!g) return;
  const n = npcById(g.id), P = PERS[n.pers];
  if (n.rank==="稚童") return msg("對方還是個孩子。");
  const openMind = P.flirtReq<=50;
  const ok = n.love>=70 || (openMind && n.love>=40 && n.favor>=60);
  if (!ok) return msg(`${n.name}還未與你到那一步（需愛情70${openMind?"，或此性情者 愛情40+友情60":""}；現愛情${n.love}·友情${n.favor}）。`);
  if (p.spouse!==n.id) msg(`（客居小院，孤男寡女……兩情相悅，何必在乎名分。）`);
  if (sectUnlocked("合歡宗")) { p.spirit += 800; msg(`一夜雙修，靈氣+800。`); }
  else { p.spirit += 400; msg(`一夜雙修，靈氣+400。`); }
  const line = gdial(n,P.intimate[rnd(P.intimate.length)]);
  g.bubble = line;
  msg(`${n.name}：${q(line)}（愛情+5，友情+3）`);
  n.love = clamp(n.love+5,0,P.loveCap||100); n.favor = clamp(n.favor+3,-200,120);
  if (p.spouse===null && n.love>=85 && Math.random()<0.3) propose(n);
  uiRefresh();
}
function guestLeave(){
  const p=G.player, g=p.guest; if(!g) return;
  const n = npcById(g.id);
  msg(`${n.name}被你勸走了，臨走前一步三回頭。`);
  p.guest = null;
}

/* ═══ 宗門遊歷：自動推進天數，直到撞上事件點 ═══ */
function sectTour(){
  const p = G.player, start = p.day;
  guestSulk("遊歷"); // 家中有客也照樣出門，只是TA會不高興
  for (let i=0; i<120; i++){
    const mark = G.dayLog.length;
    nextDay(1);
    if (!p.alive) return;
    const logs = G.dayLog.slice(mark).map(l=>l.t);
    /* 事件點：月令任務、來訪、結識、求婚、正道大會、江湖大事 */
    if (logs.some(t=>t.startsWith("【") || /來訪|結識|求婚|論劍|舊識|告白/.test(t))) {
      msg(`——遊歷途中撞上事端，暫且駐足。（本次遊歷${p.day-start}天）`); return;
    }
    /* 際遇：機遇 / 好運 / 倒霉，12%/日 */
    if (Math.random() < 0.12) {
      const r = Math.random();
      if (r < 0.35) { const g = 200+rnd(800); p.spirit += g;
        msg(`遊歷至山間瀑布，於水聲中若有所悟，靈氣+${g}。（本次遊歷${p.day-start}天）`); return; }
      else if (r < 0.55) { const st = 100+rnd(400); p.stones = (p.stones||0)+st;
        msg(`路遇商隊被妖獸困住，出手相助，得謝禮靈石${st}。（好運）（本次遊歷${p.day-start}天）`); return; }
      else if (r < 0.78) {
        const pool = G.npcs.filter(n=>n.alive && !n.met && n.loc===n.sect && n.rank!=="稚童" && n.sect!==undefined);
        if (pool.length) { const n = pool[rnd(pool.length)]; meetNpc(n.id);
          const P = PERS[n.pers];
          msg(`遊歷至${n.sect}，一位${n.gender==="M"?"男修":"女修"}見你行事沉穩，主動見禮——竟是${n.name}：${q(gdial(n,P.greet[rnd(P.greet.length)]))}（一見如故）（本次遊歷${p.day-start}天）`); return; }
      }
      else { const loss = Math.round(p.spirit*0.08); p.spirit -= loss; p.energy = Math.max(0, p.energy-2);
        msg(`山道上撞見劫道的散修，一場惡戰趕跑了對方，自己也掛了彩（靈氣-${loss}）。（倒霉）（本次遊歷${p.day-start}天）`); return; }
    }
  }
  msg(`走了${p.day-start}天，江湖平靜得無聊，你回了山。（一無所獲）`);
}

/* ── 修煉 ── */
function practice() {
  const p = G.player;
  if (p.practiceCnt >= 5) return msg(`今日已練劍${p.practiceCnt}次，手臂痠麻練不動了（每日5次）。`);
  if (p.energy < 1) return msg("精力不足，做點別的事或休息吧（次日恢復1點）。");
  p.energy--; p.practiceCnt++;
  const gain = Math.round((20 + p.ri*30 + rnd(10)) * (sectUnlocked("妙音門")?1.2:1));
  p.spirit += gain; p.swordSense += 1;
  msg(`你在練劍場揮劍如雨，靈氣+${gain}。（今日第${p.practiceCnt}/5次）`);
  uiRefresh();
}
function takeLesson() {
  const p = G.player;
  const ym = year()*12 + (month()-1);
  if (p.lessonYM === ym) return msg("本月大課已上過（每月一次，開課即入下月）。");
  p.lessonYM = ym;
  guestSulk("閉關聽課"); // 家中有客仍去聽課，TA會抱怨
  const cap = spiritCap();
  const g = Math.round(cap*0.3) + 40 + rnd(30);
  p.spirit = Math.min(cap, p.spirit + g);
  let extra = "";
  if (Math.random()<0.5 && p.recipes.length) { const r=p.recipes[rnd(p.recipes.length)];
    p.mastery[r]=(p.mastery[r]||0)+2; extra=`長老演示《${r}》鍛法，熟練+2。`; }
  msg(`你閉關聽講整月，靈氣+${g}。${extra}`);
  let guard = 0;
  const targetYM = ym+1;
  while (year()*12 + (month()-1) < targetYM && guard++ < 40 && G.player.alive) nextDay();
  msg("——大課結束，一個月過去了。");
}
function tryBreak() {
  const p = G.player;
  const r = REALMS[p.ri];
  const maxSub = r.layers ? 8 : 2;
  if (p.sub >= maxSub && p.ri >= REALMS.length-1) return msg("你已至大乘大圓滿，此界無法再進一步。");
  if (p.spirit < spiritCap()) return msg(`靈氣不足（${fmt(p.spirit)}/${fmt(spiritCap())}），繼續積累吧。`);
  let rate = 0.72 - p.ri*0.06 + p.sub*0.02;
  if (p.pills["突破丹"]>0) { rate += 0.05; p.pills["突破丹"]--; }
  if (sectUnlocked("星機閣")) rate += 0.10;
  if (p.surviveRisk>0 && p.pills["消業丹"]>0) { p.surviveRisk -= 0.3; p.pills["消業丹"]--; }
  rate = clamp(rate, 0.15, 0.95);
  msg(`氣海鼓盪——本次突破成功率約 ${Math.round(rate*100)}%……`);
  if (Math.random() < rate) {
    p.spirit = 0;
    p.sub++;
    if (p.sub > maxSub) { p.ri++; p.sub=0; }
    p.deaths = 0;
    msg(`天靈地靈一齊震動——你突破了！現為【${realmText(p.ri,p.sub)}】。`);
  } else {
    const deathRate = clamp(0.05 + p.ri*0.05, 0, 0.6);
    if (Math.random() < deathRate) { gameOver("突破失敗，靈氣逆衝，你坐下化為飛灰。"); return; }
    p.spirit = Math.round(spiritCap() * 0.2);
    if (!r.layers && p.sub===2) { p.ri++; p.sub=0; msg("突破失敗，但你於絕境中觸摸大圓滿之意，跌入大圓滿（基礎更厚）。"); }
    else msg(`突破失敗，靈氣潰散，僅存兩成。所幸性命無礙（境界越高，失敗與走火風險越大）。`);
  }
  if (G.player.autoSave) saveGame(0);
  uiRefresh();
}
function gameOver(text) { G.player.alive = false; msg("† " + text); }

/* ── 採集與戰鬥 ── */
function gather(map, layer) {
  const p = G.player;
  if (p.ri < MAP_REQ[map]) return msg(`此地需【${REALMS[MAP_REQ[map]].name}】修為方可進入。`);
  if (layer>0 && p.ri < MAP_REQ[map]+1) return msg(`深層需要更高修為（${REALMS[MAP_REQ[map]+1].name}）。`);
  if (p.energy < 1) return msg("精力不足。");
  p.energy--;
  const beasts = BEASTS.filter(b=>b[1]===map && b[2]===layer);
  if (beasts.length && Math.random() < 0.45) return fightBeast(beasts[rnd(beasts.length)], map);
  const mats = Object.values(HERBS).filter(h=>h.map===map && h.layer===layer);
  const n = 1 + rnd(3), got = [];
  for (let i=0;i<n;i++) { const m = mats[rnd(mats.length)]; p.mats[m.name]=(p.mats[m.name]||0)+1; got.push(m.name); }
  nextDay();
  msg(`你在${MAP_NAMES[map]}·${LAYER_NAMES[layer]}採得：${got.join("、")}。`);
}
function fightBeast(b, map) {
  const p = G.player, f = playerForce();
  const score = f / b[3];
  const win = Math.random() < clamp(score*0.8, 0.05, 0.97);
  if (win) {
    const drop = b[4]; p.mats[drop]=(p.mats[drop]||0)+ (1+rnd(2));
    p.spirit += 30 + p.ri*20;
    nextDay();
    msg(`你遭遇${b[0]}，幾劍斬落。取其${drop}，靈氣小漲。`);
  } else {
    p.spirit = Math.max(0, p.spirit - 50);
    nextDay();
    msg(`你遭遇${b[0]}，不敵，狼狽退走（靈氣-50）。`);
  }
}

/* ── 鑄劍 ── */
function forge(recipeName, picks) { // picks: [材料名,...] 已由 UI 選好
  const p = G.player, rc = RECIPES[recipeName];
  const sum = {}; ELES.forEach(e=>sum[e]=0);
  picks.forEach(n => { const h=HERBS[n]; ELES.forEach(e=>sum[e]+=h.ev[e]); });
  let hit = 0; ELES.forEach(e => { if (sum[e] >= (rc.need[e]||Infinity)) hit++; });
  const needCnt = Object.keys(rc.need).length;
  const grade = hit >= needCnt+1 ? 3 : hit >= needCnt ? 2 : hit >= Math.ceil(needCnt/2) ? 1 : 0;
  let succ = rc.succ + p.forgeLv*0.01 + (p.ding?0.2:0) + p.mastery[recipeName]*0.005;
  succ = clamp(succ, 0.1, 0.98);
  p.mastery[recipeName] = (p.mastery[recipeName]||0)+1;
  if (p.mastery[recipeName] % 5 === 0) { p.forgeLv++; msg(`鍛造熟練提升至 Lv.${p.forgeLv}。`); }
  const days = clamp(3 + Math.floor(picks.length/2) - Math.floor(p.forgeLv/3), 1, 10);
  nextDay(days);
  if (Math.random() < succ) {
    const power = Math.round((10 + p.ri*15) * [1,1.6,2.4,3.5][grade]);
    const value = Math.round(rc.value * [1,2,4,8][grade]);
    const sword = { name:recipeName, grade, power, value, id:Date.now() };
    p.swords.push(sword);
    if (rc.type==="佩劍" && (!p.equip || power > p.equip.power)) { p.equip = sword; msg(`好劍！你將其佩於腰間（武力+${power}）。`); }
    msg(`${LINES.forgeOk[rnd(3)]}——${SWORD_GRADES[grade]}「${recipeName}」出爐！`);
  } else {
    msg(LINES.forgeFail[rnd(3)]);
    p.spirit += 40; // 失敗也漲靈氣（原作精神）
  }
  if (G.player.autoSave) saveGame(0);
  uiRefresh();
}

/* ── 經濟 ── */
function sellMat(name, cnt) {
  const p=G.player; if (!(p.mats[name]>=cnt)) return;
  p.mats[name]-=cnt; if(!p.mats[name]) delete p.mats[name];
  p.stones += HERBS[name].value*cnt;
  msg(`售出${name}×${cnt}，得靈石${fmt(HERBS[name].value*cnt)}。`); uiRefresh();
}
function sellSword(id) {
  const p=G.player; const i=p.swords.findIndex(s=>s.id===id); if(i<0) return;
  const s=p.swords[i]; if (p.equip && p.equip.id===id) return msg("佩劍不可售。");
  p.swords.splice(i,1); p.stones+=s.value;
  msg(`售出「${s.name}」，得靈石${fmt(s.value)}。`); uiRefresh();
}
function contribMat(name, cnt) {
  const p=G.player; if(!(p.mats[name]>=cnt)) return;
  p.mats[name]-=cnt; if(!p.mats[name]) delete p.mats[name];
  const c = Math.round(HERBS[name].value*cnt*0.5);
  p.contrib += c; msg(`上繳${name}×${cnt}，貢獻+${fmt(c)}。`); uiRefresh();
}
function contribSword(id) {
  const p=G.player; const i=p.swords.findIndex(s=>s.id===id); if(i<0) return;
  const s=p.swords[i]; if (p.equip&&p.equip.id===id) return msg("佩劍不可上繳。");
  p.swords.splice(i,1); const c=Math.round(s.value*0.6); p.contrib+=c;
  msg(`上繳「${s.name}」，貢獻+${fmt(c)}。`); uiRefresh();
}
function buyPill(name, cnt=1) {
  const p=G.player; const price = PILLS[name]?PILLS[name].price:POISON_PILLS[name].price;
  if (POISON_PILLS[name] && !p.poisonUnlocked) return msg("藥王谷的朋友才懂這些……（需藥王谷好感60解鎖）");
  if (p.stones < price*cnt) return msg("靈石不足。");
  p.stones -= price*cnt;
  const bag = PILLS[name] ? p.pills : p.poisons;
  bag[name]=(bag[name]||0)+cnt;
  msg(`購得${name}×${cnt}。`); uiRefresh();
}
function usePill(name) {
  const p=G.player;
  if (PILLS[name]) {
    if (!p.pills[name]) return;
    if (name==="聚靈散") { p.spirit += PILLS[name].v; msg(`服下聚靈散，靈氣+${fmt(PILLS[name].v)}。`); p.pills[name]--; if(!p.pills[name]) delete p.pills[name]; }
    else if (name==="洗髓丹") { msg(`洗髓丹是禮物：在NPC詳情→送禮送出，30%機率加速其修煉。`); }
    else if (name==="解毒丹") { msg(`解毒丹在自己中毒/丹毒發作時自動生效，平日服用無意義。`); }
    else if (name==="突破丹") { msg(`突破丹會在【嘗試突破】時自動消耗一枚，突破率+5%。`); }
    else if (name==="消業丹") { msg(`消業丹會在渡劫/高風險突破時自動消耗，死亡率-30%。`); }
  }
  uiRefresh();
}

/* ── 社交 ── */
function npcById(id){ return G.npcs[id]; }
function sectFavor(sect) { // 門派好感 = 該派已結識 NPC 平均
  const list = G.npcs.filter(n=>n.sect===sect && n.met && n.alive);
  return list.length ? Math.round(list.reduce((a,n)=>a+n.favor,0)/list.length) : 0;
}
function sectUnlocked(sect) {
  const u = SECT_UNLOCK[sect]; if (!u) return false;
  if (sect==="大自在殿") return G.npcs.some(n=>n.sect===sect && n.love>=99);
  return sectFavor(sect) >= u.favor;
}
function gift(id, itemName) {
  const n=G.npcs[id], p=G.player, P=PERS[n.pers];
  let fav = 4;
  const rc = RECIPES[itemName]; if (rc && rc.type==="禮物" && rc.gift===n.sect) fav = 16;
  else if (rc) fav = 8; // 送劍
  if (itemName==="避雷符"||itemName==="護心符") fav = 12;
  if (PILLS[itemName]) { fav = 6; p.pills[itemName]--; if(!p.pills[itemName]) delete p.pills[itemName]; }
  else if (POISON_PILLS[itemName]) { return; }
  else { const i=p.swords.findIndex(s=>s.name===itemName); if(i>=0){ p.swords.splice(i,1); if(p.equip&&p.equip.name===itemName&&!p.swords.some(s=>s.id===p.equip.id)) p.equip=null; } }
  if (n.favor < 0 && Math.random() < 0.8) { msg(`${n.name}：${q(gdial(n,P.giftBad[rnd(P.giftBad.length)]))}`); return; }
  const gain = Math.max(1, Math.round(fav*P.giftMul));
  n.favor = clamp(n.favor + gain, -200, 120);
  if (itemName==="洗髓丹") { // 特殊：加速修煉
    if (Math.random()<0.3 && n.ri<7) { n.sub++; if(n.sub>2){n.ri++;n.sub=0;}
      wlog(`${n2t(n)}服下你贈的洗髓丹後閉關，一舉突破至${realmText(n.ri,n.sub)}。`, true); } }
  msg(`${n.name}：${q(gdial(n,P.gift[rnd(P.gift.length)]))}（好感+${gain}）`);
  checkSectUnlock(n.sect);
  nextDay(); uiRefresh();
}
function st3(v){ return v<30?0 : v<70?1 : 2; } // 友情/愛情三階段：陌生/熟絡/心腹(情深)
function interact(id, act) {
  const n=G.npcs[id], p=G.player, P=PERS[n.pers];
  if (!n.alive) return msg("人已不在了。");
  if (p.energy<1) return msg("精力不足。");
  if (n.rank==="稚童" && (act==="調情"||act==="雙修")) return msg("對方還是個孩子。");
  p.energy--;
  switch(act) {
    case "交好": {
      const st = st3(n.favor);
      n.favor = clamp(n.favor+P.chatFav, -200, 120);
      G.npcs.filter(o=>o.alive&&o.met&&o.sect===n.sect&&o.id!==n.id).forEach(o=>o.favor=clamp(o.favor+1,-200,120));
      const pool = P.chat[st];
      msg(`${n.name}：${q(gdial(n,pool[rnd(pool.length)]))}（友情+${P.chatFav}，${n.sect}同門+1）`);
      break; }
    case "調情": {
      if (n.favor < P.flirtReq) { msg(`${n.name}：${q(gdial(n,P.flirtNo[rnd(P.flirtNo.length)]))}（需友情${P.flirtReq}）`); break; }
      const cap = P.loveCap||100;
      const st = st3(n.love);
      const lg = Math.max(0, Math.min(P.loveGain+rnd(3), cap-n.love));
      n.love = clamp(n.love+lg, 0, cap);
      const fpool = P.flirt[st];
      msg(`${n.name}：${q(gdial(n,fpool[rnd(fpool.length)]))}（愛情+${lg}${n.love>=cap?` · 情到此境，止步${cap}`:''}）`);
      break; }
    case "誇讚": {
      const pf = P.chatFav>=3 ? 1 : 2; // 話多的不在乎，寡言的記心裡
      n.favor = clamp(n.favor+pf, -200, 120);
      msg(`${n.name}：${q(gdial(n,PRAISE[n.pers]))}（友情+${pf}）`);
      break; }
    case "逗弄": {
      if (p.energy<1) { msg("精力不足，沒力氣鬧了。"); break; }
      p.energy--;
      const likesIt = ["戲精","瘋批","蕩浪","風流","潑辣","樂天","話癆","綠茶","妖媚","癡纏"].includes(n.pers);
      const hatesIt = ["無情","古板","陰鬱","高傲","寡言","聖母"].includes(n.pers);
      if (hatesIt) { n.favor = clamp(n.favor-2, -200, 120);
        msg(`${n.name}：${q(gdial(n,TEASE[n.pers]))}（友情-2，他們不吃這套）`); }
      else if (likesIt) { n.favor = clamp(n.favor+1, -200, 120);
        const cap = P.loveCap||100, tl = Math.min(2, cap-n.love);
        n.love = clamp(n.love+tl, 0, cap);
        msg(`${n.name}：${q(gdial(n,TEASE[n.pers]))}（友情+1${tl>0?`，愛情+${tl}`:""}）`); }
      else msg(`${n.name}：${q(gdial(n,TEASE[n.pers]))}`);
      break; }
    case "安慰": {
      if (p.energy<1) { msg("精力不足，先顧好自己吧。"); break; }
      p.energy--;
      let cf = 2, cl = n.love>=40 ? 1 : 0;
      if (["陰鬱","病嬌","癡纏"].includes(n.pers)) { cf = 3; cl = 2; } // 這幾位最需要
      n.favor = clamp(n.favor+cf, -200, 120);
      const cap = P.loveCap||100; cl = Math.min(cl, cap-n.love);
      n.love = clamp(n.love+cl, 0, cap);
      msg(`${n.name}：${q(gdial(n,COMFORT[n.pers]))}（友情+${cf}${cl>0?`，愛情+${cl}`:""}）`);
      break; }
    case "切磋": return sparNpc(n, false);
    case "雙修": {
      const openMind = P.flirtReq<=50; // 風流/妖媚/蕩浪/癡纏之流不甚設防
      const ok = n.love>=70 || (openMind && n.love>=40 && n.favor>=60);
      if (!ok) { msg(`${n.name}還未與你到那一步（需愛情70${openMind?"，或此類性情者 愛情40+友情60":""}；現愛情${n.love}·友情${n.favor}）。`); break; }
      if (G.player.spouse!==n.id) msg(`（你們並非道侶，但兩情相悅，又何必在乎名分。）`);
      if (sectUnlocked("合歡宗")) { p.spirit += 800; msg(`一夜雙修，靈氣+800。`); }
      else { p.spirit += 400; }
      msg(`${n.name}：${q(gdial(n,P.intimate[rnd(P.intimate.length)]))}`);
      n.love = clamp(n.love+5,0,P.loveCap||100); n.favor = clamp(n.favor+3,-200,120);
      if (G.player.spouse===null && n.love>=85 && Math.random()<0.3) propose(n);
      break; }
    case "下毒": return uiPickPoison(n);
    case "暗殺": return assassinate(n);
  }
  nextDay(); uiRefresh();
}
function sparNpc(n, toDeath) {
  const f = playerForce(), nf = npcForce(n);
  const win = Math.random() < clamp(f/(f+nf), 0.05, 0.95);
  const p = G.player;
  p.spirit += win ? 120 : 40; p.swordSense += 2;
  if (win) { msg(`你與${n.name}在論劍台切磋——${LINES.sparWin[rnd(3)]}。劍意+2，友情+2。`);
    n.favor = clamp(n.favor+2,-200,120); p.reputation += toDeath?-10:3; }
  else { msg(`你與${n.name}在論劍台切磋——${LINES.sparLose[rnd(3)]}。劍意+2。`);
    n.favor = clamp(n.favor+1,-200,120); }
  if (toDeath) {
    if (win) { onNpcKilled(n,"決鬥"); p.reputation-=10;
      msg(`死鬥！${n.name}飲恨劍下。聲望-10，其親友對你敵視。`); }
    else if (Math.random()<0.3) { gameOver(`死鬥敗北，你倒在${n.name}劍下。`); return; }
  }
  nextDay(); uiRefresh();
}
function propose(n) {
  const p=G.player;
  p.spouse = n.id; n.spouse = p.name;
  msg(`${n.name}單膝跪地：「${PERS[n.pers].intimate[0]}」——你們結為道侶！`);
  wlog(`你與${n2t(n)}結為道侶。`, true);
}
function divorce(n) {
  const p=G.player;
  if (realmWeight(p.ri,p.sub) < realmWeight(n.ri,n.sub)) return msg("境界不敵，提不出分手。");
  p.spouse=null; n.spouse=""; n.love=clamp(n.love-50,0,100); n.favor=clamp(n.favor-30,-200,120);
  msg(`你與${n.name}解除道侶關係。對方很長一段時間不會原諒你。`);
  wlog(`你與${n2t(n)}和離的消息傳遍了江湖。`, true);
  uiRefresh();
}

/* ── 毒 & 暗殺 ── */
function tickPoison() { // NPC 每日毒 tick（慢性）
  G.npcs.forEach(n => { if (!n.alive || !n.poison) return;
    n.poison.days--;
    if (n.poison.days<=0) {
      const cured = Math.random() < (n.ri - G.player.ri + 2)*0.15;
      if (cured) { n.poison=null; }
      else if (Math.random() < 0.25) { npcDie(n,"中毒");
        msg(`【傳聞】${n2t(n)}暴斃，死狀蹊蹺，無人知曉原因。`); }
    } });
}
function tickNpcYear() { // 跨年：NPC 老化/成長/壽終
  if (dayOfMonth()!==1 || ((G.player.day-1)%360)!==0) return;
  G.npcs.forEach(n => { if(!n.alive) return;
    n.age++;
    if (n.rank==="稚童" && n.age>=16) { n.rank="弟子";
      wlog(`${n.name}通過考核，正式成為${n.sect}弟子。`, n.met); }
    if (Math.random()<0.25 && n.ri<7 && n.rank!=="稚童") { n.sub++; if(n.sub>2){n.ri++;n.sub=0;} }
    if (n.age > n.lifespan) { npcDie(n,"壽終");
      msg(`【訃聞】${n2t(n)}坐化了，享年${n.age}歲。`);
      wlog(`${n2t(n)}壽終坐化，享年${n.age}。`, n.met); } });
}
function givePoison(n, pillName) {
  const p=G.player; if(!p.poisons[pillName]) return msg("沒有這味毒丹。");
  const isAcute = POISON_PILLS[pillName].kind==="急性";
  const detected = Math.random() < clamp(0.5 - (p.ri-n.ri)*0.1, 0.1, 0.8);
  if (isAcute) {
    if (detected) { n.favor-=50; msg(`你遞藥的手被抓住——${n.name}看穿了！好感-50。`); }
    else if (Math.random()<0.5) { npcDie(n,"中毒");
      msg(`${n.name}服藥後毒發，回天乏術。無人懷疑到你。`);
      wlog(`${n2t(n)}暴斃，死狀蹊蹺，無人知曉原因。`, n.met); }
    else { n.favor-=10; msg(`${n.name}服後吐血，及時護住心脈，只當是丹毒發作。`); }
  } else {
    if (detected) { n.favor-=30; msg(`${n.name}嗅出不對，皺眉放下——好感-30。`); }
    else { n.poison={type:pillName, days:30+rnd(60)}; msg(`毒丹入體，${n.name}毫無察覺。慢性毒開始潛伏……`); }
  }
  p.poisons[pillName]--; if(!p.poisons[pillName]) delete p.poisons[pillName];
  nextDay(); uiRefresh();
}
function assassinate(n) {
  const p=G.player, f=playerForce(), nf=npcForce(n);
  const rate = clamp((f-nf)/(f+nf)*1.6 + 0.3, 0.05, 0.9);
  const unseen = clamp(0.9 - n.ri*0.08, 0.2, 0.9);
  if (Math.random() < rate) {
    onNpcKilled(n,"暗殺");
    if (Math.random() < unseen) {
      msg(`夜探${n.sect}，${LINES.assassinateOk[rnd(2)]}——${n.name}死了，無人懷疑到你。`);
    } else {
      p.reputation -= 40;
      msg(`${LINES.assassinateSeen[rnd(1)]}你仍一劍得手，但${n.name}死前認出了你！聲望-40，其門派敵視。`);
      G.npcs.filter(o=>o.sect===n.sect&&o.alive&&o.met).forEach(o=>o.favor=clamp(o.favor-40,-200,120));
    }
  } else {
    p.reputation -= 15;
    const hurt = Math.random()<0.35;
    msg(`你潛入${n.name}洞府，被護體劍氣逼退——${hurt?"你受了傷，勉強逃脫（靈氣-300）":"僥倖全身而退"}。事情瞞不住，聲望-15。`);
    if (hurt) p.spirit=Math.max(0,p.spirit-300);
    n.favor -= 40;
  }
  nextDay(); uiRefresh();
}
function checkSectUnlock(sect) {
  if (sect==="藥王谷" && !G.player.poisonUnlocked && sectUnlocked("藥王谷")) {
    G.player.poisonUnlocked = true;
    const t = G.npcs.filter(n=>n.sect==="藥王谷"&&n.alive).sort((a,b)=>b.favor-a.favor)[0];
    msg(`${t?t.name:"藥王谷的朋友"}傳你一紙毒方：「善用亦可救人。」藥王谷毒丹可購了。`);
  }
}

/* ── 秘境 ── */
function dgOpen(d) {
  if (d.own && G.player.yuehuaOwned) return true;
  if (d.cycle===0) return true;
  const y = year();
  return d.cycle>0 && y>=d.start && (y-d.start)%d.cycle===0;
}
function exploreDungeon(d) {
  const p=G.player;
  if (!dgOpen(d)) return msg(`${d.name}尚未開啟（${d.desc}）。`);
  if (p.ri < d.req[0] || p.ri > d.req[1]) return msg(`修為不符（需${REALMS[d.req[0]].name}~${REALMS[d.req[1]].name}）。`);
  if (p.energy < 2) return msg("精力不足（需2點）。");
  p.energy -= 2;
  const deep = Math.min(d.layers, 3 + Math.floor(p.ri*1.2));
  let story = [`你踏入${d.name}，一路斬妖推進至第${deep}層。`];
  // 材料掉落
  const pool = Object.values(HERBS).filter(h => h.grade >= Math.min(5, 1+Math.floor(deep/2)));
  for (let i=0;i<2+rnd(3);i++) { const m=pool[rnd(pool.length)]; p.mats[m.name]=(p.mats[m.name]||0)+1; story.push(`拾得${m.name}。`); }
  // 底層特殊
  if (deep >= d.layers-1 && d.drop) {
    if (Math.random() < d.drop.chance) {
      if (d.drop.item==="神鑄劍爐") { p.ding=true; }
      else if (d.drop.item==="劍靈蛋") { p.swords.push({name:"劍靈蛋",grade:0,power:0,value:0,id:Date.now()}); }
      else { p.pills["鮫人淚"]=(p.pills["鮫人淚"]||0)+1; }
      story.push(`【底層寶物】你獲得了${d.drop.item}！`);
    } else story.push("底層一無所獲，或許下次再來（可SL）。");
  }
  if (deep >= d.layers-1 && d.firstReward && !G.flags.dgFirstClear.includes(d.id)) {
    G.flags.dgFirstClear.push(d.id);
    const rcName = d.firstReward.replace("rc_","");
    if (!p.recipes.includes(rcName)) p.recipes.push(rcName);
    story.push(`【首通】你悟得劍譜：《${rcName}》！`);
  }
  if (d.event==="共度一生" && deep>=d.layers-1) {
    const cand = G.npcs.filter(n=>n.alive&&n.love>=70);
    if (cand.length) { const n=cand[rnd(cand.length)]; n.love=clamp(n.love+15,0,100);
      story.push(`幻光如夢，你與${n.name}在秘境中共度一生幻境。愛情+15。`); }
  }
  if (d.id==="sansheng") {
    const n = G.npcs.find(o=>o.alive&&o.love>=99&&!PERS[o.pers].loveCap);
    if (n && !G.flags.sanshengDone.includes(n.id)) { G.flags.sanshengDone.push(n.id);
      story.push(`你將與${n.name}的名字刻上三生石。縱使輪迴，來世重逢。`); }
    else story.push(n ? "名字已刻。" : "三生石前空無一人——你需要一份滿值的愛情（99，無情道除外）。");
  }
  if (d.own) story.push("月華仙谷的材料任你取用。");
  p.spirit += 200 + p.ri*150; p.swordSense += 3;
  nextDay();
  msg(story.join("")); uiRefresh();
}
function buyYuehua() {
  const p=G.player;
  if (p.yuehuaOwned) return msg("月華仙谷已歸你所有。");
  if (p.contrib < 20000000) return msg(`貢獻不足（${fmt(p.contrib)}/2000萬）。`);
  p.contrib -= 20000000; p.yuehuaOwned = true;
  msg("你以兩千萬貢獻換得月華仙谷！從此材料自由。"); uiRefresh();
}

/* ── 任務 ── */
function doTask() {
  const t = G.monthTask, p=G.player;
  if (p.energy < t.energy) return msg("精力不足。");
  if (t.needForce && playerForce() < t.needForce) return msg("武力不足，去練練再來。");
  p.energy -= t.energy;
  const r = t.reward(); p.stones += r.stones; p.contrib += r.contrib;
  nextDay(); msg(`完成【${t.name}】：靈石+${r.stones}，貢獻+${r.contrib}。`); uiRefresh();
}

/* ── 存檔 ── */
function saveGame(slot, silent) {
  localStorage.setItem("wjs_"+slot, JSON.stringify({g:G, t:Date.now()}));
  if (!silent) msg(`已存檔至槽位${slot}。`);
}
function loadGame(slot) {
  const raw = localStorage.getItem("wjs_"+slot);
  if (!raw) return msg("槽位為空。");
  const data = JSON.parse(raw).g;
  if (data.ver !== 2) return msg("舊版存檔不相容（世界系統已重做），請開新局。");
  G = data;
  if (!G.flags) G.flags = {};
  migratePers(); // 舊檔修正：門派專屬性格錯配（如合歡宗的藥罐整天聊丹爐）
  migratePersV2(); // 舊檔重洗：早期版本性格池未生效，重擲一次門派性格
  msg(`讀取存檔${slot}。`); uiRefresh();
}
const PERS_SECT_ONLY = { "藥罐":"藥王谷", "蕩浪":"合歡宗" }; // 這些台詞設定強綁門派
function migratePers(){
  let fixed = 0;
  G.npcs.forEach(n=>{
    const home = PERS_SECT_ONLY[n.pers];
    if (home && n.sect!==home) {
      const pool = (SECT_PERS[n.sect]||PERS_KEYS).filter(k=>!PERS_SECT_ONLY[k]||PERS_SECT_ONLY[k]===n.sect);
      n.pers = pool[rnd(pool.length)];
      fixed++;
    }
  });
  if (fixed) msg(`【修正】${fixed}位修士的性情歸位了（門派專屬性格不再錯配）。`);
}
function migratePersV2(){ // 一次性：修復早期「門派性格池從未生效」的世界
  if (G.flags.persV2) return;
  G.flags.persV2 = true;
  let rerolled = 0;
  G.npcs.forEach(n=>{
    if (n.special && n.pers==="無情") return; // 大自在殿方丈的無情設定保留
    n.pers = rollPers(n.sect);
    rerolled++;
  });
  msg(`【性情重洗】山門上下氣象一新：性格按門派風骨重新分派（${rerolled}人）。舊識的性格可能變了。`);
}
function listSaves() {
  return [0,1,2].map(s => { const r=localStorage.getItem("wjs_"+s);
    return {slot:s, empty:!r, time:r?new Date(JSON.parse(r).t).toLocaleString():"—", name:r?JSON.parse(r).g.player.name+"·"+realmText(JSON.parse(r).g.player.ri,JSON.parse(r).g.player.sub):""}; });
}
/* ── log ── */
function msg(t) { G.dayLog.push({d:G?G.player.day:0, t}); if (G && G.dayLog.length>200) G.dayLog.shift(); }
