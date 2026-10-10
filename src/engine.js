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
/* 妖精命名：名字不重樣，用完允許重複 */
let DEMON_USED = {};
function demonName(){
  const free = DEMON_NAMES.filter(x=>!DEMON_USED[x]);
  const pool = free.length ? free : DEMON_NAMES;
  const nm = pool[rnd(pool.length)];
  DEMON_USED[nm] = 1;
  return nm;
}
function mkNpc(sect, rank, ri, gender, ageHint) {
  const demon = sect===DEMON_SECT && typeof DEMON_SECT!=="undefined";
  const n = {
    id: NPC_UID++, name: demon ? demonName() : genName(gender), sect, rank, gender, ri,
    sub: REALMS[ri].layers ? rnd(9) : rnd(3),
    age: ageHint !== undefined ? ageHint : (rank==="弟子" ? 16+rnd(30) : rank==="長老" ? 90+rnd(300) : 280+rnd(400)),
    pers: rollPers(sect), special: "",
    met:false, favor:0, love:0, alive:true, deadBy:"",
    spouseId:null, spouse:"", rel:{master:null, friends:[], parents:[], children:[]},
    loc: sect, poison:null, danToxin:0, proposed:false,
  };
  if (demon) { n.demon = true; n.race = RACE_KEYS[rnd(RACE_KEYS.length)]; }
  n.lifespan = LIFESPAN(ri);
  if (demon) n.lifespan = Math.round(n.lifespan*2); // 妖修壽長
  if (n.age > n.lifespan*0.85) n.age = Math.floor(n.lifespan*(0.4+Math.random()*0.3));
  if (rank==="稚童") n.age = ageHint||1+rnd(6);
  return n;
}
function genWorld() {
  NPC_UID = 0;
  DEMON_USED = {};
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
function n2t(n){
  if (n.demon) return `${n.sect}${n.rank==="掌門"?"妖王":n.rank==="長老"?"大妖":n.rank==="稚童"?"幼崽":"妖修"}${n.name}`;
  return `${n.sect}${n.rank==="掌門"?"掌門":n.rank==="稚童"?"小童":""}${n.name}`;
}
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
  // 好感淡忘（龜族記性千年不磨）——朝 0 收斂：好感降到 0 為止，仇怨隨時間沖淡也回到 0，不再無故跌成負數
  alive.forEach(n=>{ if(n.met && !n.pursue && n.love<70 && G.player.spouse!==n.id){
    if (n.demon && n.race==="龜族") return;
    const dec = Math.round(PERS[n.pers].decay);
    if(dec) n.favor = n.favor>0 ? Math.max(0, n.favor-dec) : Math.min(0, n.favor+dec);
  }});
  // NPC 社會事件
  const evts = 1+rnd(3);
  for(let k=0;k<evts;k++) worldEvent(alive);
  // 有人向你求婚（已有配偶的不提；玩家有道侶也不提）
  if (G.player.spouse===null || G.player.spouse===undefined)
    alive.forEach(n=>{ if(n.met && !n.proposed && n.spouseId===null && n.love>=90 && n.age>=18 && Math.random()<0.15){
      n.proposed=true;
      msg(`${n.name}紅著耳根遞來一封信——是求婚之意！可到【關係】頁回應。${n.sweet?'（你們早兩情相悅了）':''}`);
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
  } else if (r<0.38) { // 結為道侶（與玩家有情愫或已提親的不參與，防橫刀奪愛）
    const solo = x => x.spouseId===null && x.love<50 && !x.proposed;
    const a=pick();
    if(solo(a) && a.age>=25 && a.rank!=="稚童" && Math.random()<0.5){
      const cands=alive.filter(b=>solo(b)&&b!==a&&b.gender!==a.gender&&b.age>=25);
      if(cands.length){ const b=cands[rnd(cands.length)]; a.spouseId=b.id; b.spouseId=a.id;
        [a,b].forEach(x=>{if(x.pursue){x.pursue=false;x.gaveUp=true;}});
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
  if(G.player.spouse===n.id){ G.player.spouse=null; G.player.mate=null;
    if(G.player.confess&&G.player.confess.id===n.id)G.player.confess=null;
    if(G.player.invite&&G.player.invite.id===n.id)G.player.invite=null;
    msg(`${n.name}走了。院子裡TA常坐的那個位置，空了下來。`); }
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
function greetLine(n){
  /* 道侶：婚後問候全套換新 */
  if (G && G.player && G.player.spouse===n.id && WED[n.pers])
    return gdial(n, WED[n.pers].greet[rnd(WED[n.pers].greet.length)]);
  /* 妖精：四成機率用種族腔調開口 */
  if (n.demon && RACES[n.race] && Math.random()<0.4)
    return gdial(n, RACES[n.race].greet[rnd(RACES[n.race].greet.length)]);
  const P=PERS[n.pers]; return gdial(n, P.greet[rnd(P.greet.length)]);
}
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
    msg(`你結識了${n2t(n)}（${realmText(n.ri,n.sub)}·${n.pers}${n.demon?"·"+n.race:""}）。${n.name}：「${greetLine(n)}」`); }
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
    // 清理舊婚約（橫刀奪愛也要明媒正娶：解除 TA 與前配偶的互相指向）
    if(n.spouseId!==null && n.spouseId>=0){ const ex=npcById(n.spouseId);
      if(ex){ ex.spouseId=null; wlog(`${ex.name}與${n.name}的婚約作罷，江湖唏噓。`, ex.met); } }
    G.player.spouse=n.id; n.spouse=G.player.name; n.spouseId=-1; n.love=100;
    G.player.mate = { chatted:false, bubble:"", ignored:0, sulking:false };
    msg(`${n.name}：「${PERS[n.pers].intimate[0]}」——你們結為道侶！`);
    msg(`${n.name}收拾了行囊搬進你的小院。從今往後，修煉的日子裡TA都在。`);
    clearPursuits(n.id); G.player.confess=null;
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
    tickPoison(); tickNpcYear(); tickWorldDaily(); tickGuest(); mateTick(); tickInvite();
    if (dayOfMonth()===1) { onMonth(); worldTickMonthly(); }
    if (year()%5===0 && month()===5) onSummit();
    if (dayOfMonth()===1 && ((G.player.day-1)%360)===0) onYear();
    if (!G.player.alive) return;
  }
  uiRefresh();
}
function onMonth() { G.monthTask = genTask(); msg(`【${year()}年${month()}月】宗門發布新任務：${G.monthTask.name}`);
  const crow = G.npcs.find(n=>n.alive&&n.met&&n.demon&&n.race==="鴉族"); // 鴉族天機
  if (crow && Math.random()<0.6) {
    const PROP = ["下月月色圓潤，宜閉關突破","血月將至，近期突破需謹慎","東山有妖獸躁動，採集結伴為妙","有貴人將至，近日遊歷易逢知己","妖市進了批新貨，早去早挑","山雨欲來，練劍最宜"];
    msg(`鴉族${crow.name}落在院牆上：「呱——${PROP[rnd(PROP.length)]}。」`);
  }
  pursueRoll(); pursueGiveUp(); confessRoll();
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
  const cands = G.npcs.filter(n=>n.alive&&n.met&&n.favor>=GUEST_REQ_FAV&&n.love>=GUEST_REQ_LOVE&&n.id!==G.player.spouse);
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
  const n = npcById(g.id), P = PERS[n.pers]; touch(n);
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
  const n = npcById(g.id), P = PERS[n.pers]; touch(n);
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
  const n = npcById(g.id), P = PERS[n.pers]; touch(n);
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
  uiRefresh();
}
function guestLeave(){
  const p=G.player, g=p.guest; if(!g) return;
  const n = npcById(g.id);
  msg(`${n.name}被你勸走了，臨走前一步三回頭。`);
  p.guest = null;
}

/* ═══ v5 道侶同居：婚後TA常住你院中；連日冷落會生悶氣 ═══ */
function mateOk(){
  const p=G.player;
  return p.spouse!==null && p.spouse!==undefined && G.npcs[p.spouse] && G.npcs[p.spouse].alive;
}
function mateBubble(n){
  const m = G.player.mate;
  if (m && m.sulking) return gdial(n, WED[n.pers].sulk[rnd(WED[n.pers].sulk.length)]);
  if (n.demon && RACES[n.race] && Math.random()<0.25)
    return gdial(n, RACES[n.race].chat[rnd(RACES[n.race].chat.length)]);
  const W = WED[n.pers];
  if (Math.random()<0.55) return W.home[rnd(W.home.length)]; // 動作式閒話（不帶引號）
  return gdial(n, W.chat[n.love>=70?1:0][rnd(W.chat[n.love>=70?1:0].length)]);
}
function mateTick(){ // 每日：換閒話、計冷落、同修靈氣；冷落7天生悶氣
  const p=G.player;
  if (!mateOk()) { p.mate=null; return; }
  const n = G.npcs[p.spouse];
  if (!p.mate) p.mate = { chatted:false, bubble:"", ignored:0, sulking:false };
  const m = p.mate;
  m.ignored++;
  m.chatted = false;
  if (m.sulking) {
    n.love = clamp(n.love-1, 0, 100);
    if (Math.random()<0.3) msg(`${n.name}：${q(gdial(n, WED[n.pers].sulk[rnd(WED[n.pers].sulk.length)]))}`);
  } else if (m.ignored>=7) {
    m.sulking = true;
    msg(`${n.name}板起了臉：${q(gdial(n, WED[n.pers].sulk[rnd(WED[n.pers].sulk.length)]))}（已連著${m.ignored}日沒人陪TA說話了）`);
  } else {
    p.spirit += 30; // 同修共枕，日增靈氣
  }
  m.bubble = mateBubble(n);
}
function mateCare(n, m){ // 任何互動皆可破冰
  m.sulking = false; m.ignored = 0;
  n.love = clamp(n.love+2, 0, 100);
  msg(`${n.name}：${q(gdial(n, WED[n.pers].care))}（氣消了，愛情+2）`);
}
function mateChat(){
  const p=G.player; if(!mateOk()) return;
  const n=G.npcs[p.spouse], m=p.mate;
  if (m.sulking) return mateCare(n, m);
  if (m.chatted) return msg(`${n.name}今日已同你說了許多話，這會兒安靜地陪著你打坐。`);
  m.chatted = true; m.ignored = 0;
  n.favor = clamp(n.favor+2, -200, 120); n.love = clamp(n.love+1, 0, 100);
  const line = mateBubble(n);
  m.bubble = line;
  msg(`${n.name}：${q(line)}（友情+2，愛情+1）`);
}
function mateFlirt(){
  const p=G.player; if(!mateOk()) return;
  const n=G.npcs[p.spouse], m=p.mate;
  if (m.sulking) { n.love = clamp(n.love+1, 0, 100);
    return msg(`${n.name}別過頭去：「現在才來說這些……哼。（但耳朵紅了）（愛情+1）`); }
  m.ignored = 0;
  n.love = clamp(n.love+2, 0, 100);
  const line = gdial(n, WED[n.pers].flirt[rnd(WED[n.pers].flirt.length)]);
  m.bubble = line;
  msg(`${n.name}：${q(line)}（愛情+2）`);
}
function mateDual(){
  const p=G.player; if(!mateOk()) return;
  const n=G.npcs[p.spouse], m=p.mate;
  if (n.love<40) return msg(`${n.name}還未與你到那一步（需愛情40）。`);
  if (m.sulking) mateCare(n, m);
  m.ignored = 0;
  const gain = sectUnlocked("合歡宗") ? 1200 : 600;
  p.spirit += gain;
  n.love = clamp(n.love+3, 0, 100); n.favor = clamp(n.favor+2, -200, 120);
  const line = gdial(n, WED[n.pers].dual);
  m.bubble = line;
  msg(`與道侶${n.name}一夜雙修，靈氣+${gain}。${n.name}：${q(line)}（愛情+3，友情+2）`);
  uiRefresh();
}

/* ═══ v7 NPC自主攻略：心動→邀約→告白→婚後約會 ═══ */
const P_DATE = {
  aggressive:["癡纏","病嬌","醋罈","妖媚","風流","蕩浪"],
  cling:["癡纏","病嬌","醋罈"],
  fragile:["高傲","古板","無情","陰鬱"],
  restricted:["無情","古板","高傲","寡言"],
};
function touch(n){ n.lastTouch=G.player.day; n.invDeclined=0; }
function pursueGiveUpLine(n){ return `${n.name}：${gdial(n,DATE_GIVEUP[n.pers]||"「……此後不擾。」")}`; }
function giveUpPursuit(n, silent){
  n.pursue=false; n.gaveUp=true;
  if(!silent) msg(pursueGiveUpLine(n));
}
function clearPursuits(exceptId){
  const ps=G.npcs.filter(n=>n.alive&&n.pursue&&n.id!==exceptId);
  ps.slice(0,2).forEach(n=>giveUpPursuit(n,true));
  ps.forEach(n=>{n.pursue=false;n.gaveUp=true;});
  if(ps.length>2) msg("另有數人默默收起了心事。");
  else ps.forEach(n=>msg(pursueGiveUpLine(n)));
}
function pursueRoll(){
  const p=G.player;
  G.npcs.forEach(n=>{
    if(!n.alive||!n.met||n.rank==="稚童"||n.pursue||n.gaveUp) return;
    if(n.spouseId!==null) return; // 未婚也未嫁玩家
    const a=P_DATE.aggressive.includes(n.pers), r=P_DATE.restricted.includes(n.pers);
    const ok=a?(n.favor>=45&&n.love>=25):r?(n.love>=70&&n.favor>=60):(n.favor>=50&&n.love>=30);
    if(!ok) return;
    if(Math.random() < (a?0.35:r?0.10:0.20)){
      n.pursue=true; n.invDeclined=0; n.lastTouch=p.day;
      if(Math.random()<0.2) msg(`${n.name}近日時常望向你練劍的方向。`);
    }
  });
}
function pursueGiveUp(){
  const p=G.player;
  G.npcs.forEach(n=>{
    if(!n.alive||!n.pursue) return;
    if(p.day-(n.lastTouch??p.day)>60) return giveUpPursuit(n);
    if(n.invDeclined===undefined) return;
    const th=P_DATE.fragile.includes(n.pers)?2:P_DATE.cling.includes(n.pers)?99:3;
    if(n.invDeclined>=th) giveUpPursuit(n);
  });
}
function confessExpire(){
  const p=G.player;
  if(!p.confess) return;
  const n=npcById(p.confess.id);
  if(!n||!n.alive){p.confess=null;return;}
  if(p.day>p.confess.until){ n.love=clamp(n.love-5,0,PERS[n.pers].loveCap||100); p.confess=null;
    msg(`那句沒等到回應的話，${n.name}再也不提了。`); }
}
function confessRoll(){
  const p=G.player;
  confessExpire();
  if(p.confess||p.spouse!==null&&p.spouse!==undefined) return;
  const cands=G.npcs.filter(n=>n.alive&&n.met&&n.pursue&&!n.confessed&&!n.proposed&&n.love>=70&&n.spouseId===null&&n.rank!=="稚童");
  if(!cands.length||Math.random()>=0.25) return;
  const n=cands[rnd(cands.length)];
  n.confessed=true; p.confess={id:n.id,until:p.day+10};
  msg(`${n.name}紅著臉攔住你，說了句憋了很久的心裡話——這是一場告白。可到【關係】頁回應。`);
  wlog(`聽說${n.name}攔住你說了很長一段話，旁人只聽清最後三個字。`,false);
}
function dateActFor(n, spouse){
  const keys=Object.keys(DATE_ACTS);
  if(spouse){
    if(Math.random()<0.5){const ss=keys.filter(k=>DATE_ACTS[k].who==="spouse");if(ss.length)return ss[rnd(ss.length)];}
    const sects=keys.filter(k=>DATE_ACTS[k].who==="sect:"+n.sect);
    if(sects.length) return sects[rnd(sects.length)];
  }
  if(n.demon){
    const races=keys.filter(k=>DATE_ACTS[k].who==="race:"+n.race);
    if(races.length&&Math.random()<0.35) return races[rnd(races.length)];
  }
  const pers=keys.filter(k=>DATE_ACTS[k].who==="pers:"+n.pers);
  if(pers.length) return pers[rnd(pers.length)];
  const sects=keys.filter(k=>DATE_ACTS[k].who==="sect:"+n.sect);
  if(sects.length) return sects[rnd(sects.length)];
  return keys[rnd(keys.length)];
}
function weightedPick(list, weight){
  if(!list.length) return null;
  const ws=list.map(weight), total=ws.reduce((a,b)=>a+b,0);
  let r=Math.random()*total;
  for(let i=0;i<list.length;i++){r-=ws[i];if(r<=0)return list[i];}
  return list[list.length-1];
}
function dateGiftToPlayer(n){
  const p=G.player; n.lastGiftDay=p.day;
  n.love=clamp(n.love+1,0,PERS[n.pers].loveCap||100);
  let what="", gain="";
  if(n.sect==="大自在殿"){p.spirit+=150;what="一盒素齋點心";gain="靈氣+150";}
  else if(n.pers==="財迷"){const g=200+rnd(400);p.stones+=g;what="一小袋靈石";gain=`靈石+${g}「利息都替你算好了。」`;}
  else if(n.pers==="藥罐"){p.pills["聚靈散"]=(p.pills["聚靈散"]||0)+1;what="一包藥香";gain="聚靈散×1";}
  else if(n.pers==="武癡"){p.swordSense+=2;what="一疊拆招筆記";gain="劍意+2「昨夜替你把那招拆了三百遍。」";}
  else if(["風流","妖媚","蕩浪"].includes(n.pers)){const g=100+rnd(100);p.stones+=g;what="一箋熏香短箋";gain=`內附靈石+${g}`;}
  else{
    const r=Math.random();
    if(r<0.6){const maxG=clamp(2+Math.floor(p.ri/2),1,5);const pool=Object.values(HERBS).filter(m=>m.grade<=maxG);const m=pool[rnd(pool.length)];p.mats[m.name]=(p.mats[m.name]||0)+1;what=m.name+"一份";gain=`${m.name}×1`;}
    else if(r<0.85){const g=100+rnd(200);p.stones+=g;what="一小袋靈石";gain=`靈石+${g}`;}
    else{p.spirit+=200;what="一個同心結";gain="靈氣+200「不知是誰打的。」";}
  }
  msg(`院門口多了一個小包裹——${n.name}托人送來的：${what}（${gain}）`);
}
function tickInvite(){
  const p=G.player;
  if(!p||!p.alive) return;
  confessExpire();
  if(p.confess){const cn=npcById(p.confess.id);if(!cn||!cn.alive)p.confess=null;}
  if(p.invite){
    const old=npcById(p.invite.id);
    if(!old||!old.alive){p.invite=null;}
    else if(p.day>p.invite.until){ if(p.invite.from==="pursuer") old.favor=clamp(old.favor-1,-200,120);
      p.invite=null; msg(`你錯過了${old.name}的邀約，紙條在風裡打了個旋。`); }
  }
  G.npcs.forEach(n=>{
    if(!n.alive||!n.pursue) return;
    if(p.day-(n.lastGiftDay??-99)<20) return;
    if(Math.random()<0.012+n.love*0.0003) dateGiftToPlayer(n);
  });
  if(p.invite) return;
  const base=G.npcs.filter(n=>n.alive&&n.met&&n.rank!=="稚童");
  const pools=[];
  const pursuers=base.filter(n=>n.pursue&&n.spouseId===null);
  if(pursuers.length) pools.push({list:pursuers,prob:1,kind:"pursuer"});
  const friends=base.filter(n=>!n.pursue&&n.favor>=40&&n.love<30);
  if(friends.length) pools.push({list:friends,prob:1,kind:"friend"});
  if(p.spouse!==null&&p.spouse!==undefined){const sp=base.filter(n=>n.id===p.spouse);if(sp.length)pools.push({list:sp,prob:1,kind:"spouse"});}
  for(const pool of pools){
    const n=weightedPick(pool.list,x=>pool.kind==="friend"?Math.max(1,x.favor):Math.max(1,x.favor+x.love));
    if(!n) continue;
    let prob=pool.kind==="pursuer"?(0.02+n.love*0.0005+n.favor*0.0002)*(P_DATE.aggressive.includes(n.pers)?1.3:1)
      :pool.kind==="friend"?0.004+n.favor*0.00015:0.03;
    if(Math.random()>=prob) continue;
    const key=dateActFor(n,pool.kind==="spouse"), act=DATE_ACTS[key];
    p.invite={id:n.id,key,until:p.day+5,from:pool.kind};
    const line=gdial(n,act.line[rnd(act.line.length)]);
    const arrive=pool.kind==="pursuer"?`【邀約】一隻紙鶴落在你窗台上，翅膀上寫著：${n.name}約你${act.name}。`
      :pool.kind==="friend"?`【邀約】${n.name}托掃地的雜役帶話：得空嗎？一起去${act.name}。`
      :`【邀約】${n.name}把一張字條塞進你手心：今日，陪我。${act.name}，就我們倆。`;
    msg(arrive); msg(`${n.name}：${q(line)}`);
    break;
  }
}
function runDateDanger(p,n,strong){
  const base=playerForce(), denom=base+(strong?280:300)+p.ri*100;
  const win=Math.random()<clamp(base/denom,0.1,0.95);
  if(win){const g=strong?100:400;p.spirit+=g;if(!strong){const st=100+rnd(200);p.stones+=st;}return DATE_TWIST_LINE.dangerWin.replace(/\$\{name\}/g,n.name)+(strong?"（同行者替你擋了一下，靈氣+100）":"（靈氣+400，得靈石）");}
  p.spirit=Math.max(0,p.spirit-50);n.favor=clamp(n.favor+2,-200,120);
  return DATE_TWIST_LINE.dangerLose.replace(/\$\{name\}/g,n.name)+"（靈氣-50，友情+2）";
}
function runDateTwist(p,n){
  const pool=[
    {w:3,run(){const ids=[...n.rel.friends,...n.rel.parents,...n.rel.children,n.rel.master].filter(x=>x!==null&&x!==undefined&&x!==n.spouseId);const unmet=ids.map(x=>npcById(x)).filter(x=>x&&x.alive&&!x.met);if(!unmet.length)return null;const t=unmet[rnd(unmet.length)];t.met=true;t.favor=10;return DATE_TWIST_LINE.meet.replace(/\$\{name\}/g,n.name).replace(/\$\{target\}/g,t.name)+"（結識新知，友情10）";}},
    {w:2,run(){return runDateDanger(p,n,true);}},
    {w:3,run(){const cap=PERS[n.pers].loveCap||100;n.love=clamp(n.love+2,0,cap);return DATE_TWIST_LINE.memory.replace(/\$\{name\}/g,n.name)+"（愛情+2）";}},
    {w:2,run(){const r=Math.random();if(r<0.3){const g=100+rnd(200);p.stones+=g;return DATE_TWIST_LINE.treasure.replace(/\$\{name\}/g,n.name)+`（靈石+${g}）`;}if(r<0.7){const pool2=Object.values(HERBS).filter(m=>m.grade<=clamp(2+Math.floor(p.ri/2),1,5));const m=pool2[rnd(pool2.length)];p.mats[m.name]=(p.mats[m.name]||0)+1;return DATE_TWIST_LINE.treasure.replace(/\$\{name\}/g,n.name)+`（${m.name}×1）`;}return DATE_TWIST_LINE.treasure.replace(/\$\{name\}/g,n.name)+"（其實撿到的是TA的笑）";}}
  ];
  const all=[];pool.forEach(x=>{for(let i=0;i<x.w;i++)all.push(x);});
  const r=all[rnd(all.length)].run();
  if(r) msg("約會插曲："+r);
}
function jealousyCheck(n){
  const cands=G.npcs.filter(x=>x.alive&&x.met&&x.pursue&&x.love>=40&&x.id!==n.id);
  const hit=[];
  cands.forEach(x=>{const heavy=["醋罈","病嬌","癡纏"].includes(x.pers);if(Math.random()<(heavy?0.5:0.15))hit.push(x);});
  if(!hit.length)return;
  const j=hit[rnd(hit.length)];j.favor=clamp(j.favor-3,-200,120);
  const heavy=["醋罈","病嬌","癡纏"].includes(j.pers);
  const pool=heavy?DATE_JEALOUSY_HEAVY:DATE_JEALOUSY_LIGHT;
  msg("【心動】"+pool[rnd(pool.length)].replace(/\$\{name\}/g,j.name)+"（友情-3）");
}
function acceptInvite(){
  const p=G.player, inv=p.invite;
  if(!inv) return;
  const n=npcById(inv.id);
  if(!n||!n.alive){p.invite=null;return msg("邀約的人已不在了。");}
  if(p.energy<1) return msg("精力不足，改日再說。");
  const act=DATE_ACTS[inv.key]||Object.values(DATE_ACTS)[0];
  p.energy--; guestSulk("赴約");
  const P=PERS[n.pers], cap=P.loveCap||100;
  let favGain=0,loveGain=0;
  if(inv.from==="friend"){favGain=P.chatFav+1+act.favAdd;loveGain=act.loveAdd;}
  else if(inv.from==="pursuer"){favGain=P.chatFav+2+act.favAdd;loveGain=2+rnd(3)+act.loveAdd+(n.sweet?1:0);}
  else{favGain=2+act.favAdd;loveGain=3+act.loveAdd;if(!p.mate)p.mate={chatted:false,bubble:"",ignored:0,sulking:false};}
  favGain=Math.max(0,favGain);loveGain=Math.max(0,Math.min(loveGain,cap-n.love));
  n.favor=clamp(n.favor+favGain,-200,120);n.love=clamp(n.love+loveGain,0,cap);
  touch(n);
  msg(`你應了${n.name}的邀約，一同前往${act.name}。${n.name}：${q(gdial(n,act.line[rnd(act.line.length)]))}`);
  const reward=act.reward(p,n);
  msg(`約會收穫：${reward}（友情+${favGain}${loveGain?`，愛情+${loveGain}`:""}）`);
  let spouseDate=false;
  if(inv.from==="spouse"&&p.mate){spouseDate=true;p.mate.ignored=0;p.mate.sulking=false;}
  if(Math.random()<0.3) runDateTwist(p,n);
  if(inv.from==="pursuer") jealousyCheck(n);
  p.invite=null;
  nextDay();
  if(spouseDate&&G.player.mate){G.player.mate.ignored=0;G.player.mate.sulking=false;if(WED[n.pers])msg(`${n.name}：${q(gdial(n,WED[n.pers].care))}`);}uiRefresh();
}
function declineInvite(){
  const p=G.player,inv=p.invite;
  if(!inv)return;
  const n=npcById(inv.id);
  p.invite=null;
  if(!n||!n.alive)return msg("那張邀約紙條終究沒能送到人手上。");
  if(inv.from==="spouse"){n.favor=clamp(n.favor-1,-200,120);if(p.mate)p.mate.ignored+=3;msg(`${n.name}收回了字條，輕聲說：「……好，你去忙。」（TA有些失落）`);uiRefresh();return;}
  if(inv.from==="friend"){n.favor=clamp(n.favor-1,-200,120);msg(`${n.name}：${q(gdial(n,"「好嘛，下次再約。」"))}（友情-1）`);uiRefresh();return;}
  let dec=["溫柔","聖母","樂天"].includes(n.pers)?1:2+rnd(3);
  n.favor=clamp(n.favor-dec,-200,120);n.invDeclined=(n.invDeclined||0)+1;
  const th=P_DATE.fragile.includes(n.pers)?2:P_DATE.cling.includes(n.pers)?99:3;
  if(n.invDeclined>=th)giveUpPursuit(n);
  else msg(`${n.name}：${q(gdial(n,DATE_DECLINE[n.pers]||"「……下次再說。」"))}（友情-${dec}）`);
  uiRefresh();
}
function answerConfess(id,yes){
  const p=G.player,n=npcById(id);
  if(!p.confess||p.confess.id!==id||!n||!n.alive)return; touch(n);
  p.confess=null;
  const cap=PERS[n.pers].loveCap||100;
  if(yes){n.sweet=true;n.love=clamp(n.love+5,0,cap);n.favor=clamp(n.favor+3,-200,120);
    msg(`你點了頭。${n.name}眼裡的光，藏都藏不住。（你們兩情相悅了）`);wlog(`有人看見${n.name}從你的院門口跑出去，一路都在笑。`,false);}
  else{n.love=clamp(n.love-20,0,cap);n.favor=clamp(n.favor-5,-200,120);n.invDeclined=(n.invDeclined||0)+1;
    if(P_DATE.fragile.includes(n.pers))giveUpPursuit(n);
    else if(!P_DATE.cling.includes(n.pers)&&Math.random()<0.5)giveUpPursuit(n);
    else msg(`${n.name}：${q(gdial(n,DATE_DECLINE[n.pers]||"「……我知道了。」"))}（愛情-20，友情-5）`);}
  uiRefresh();
}

function mateTogether(){ // 相伴一日：-1精力，靜靜過一天
  const p=G.player; if(!mateOk()) return;
  if (p.energy<1) return msg("精力不足，好好歇一天吧。");
  const n=G.npcs[p.spouse], m=p.mate, wasSulk = m.sulking;
  p.energy--;
  msg(`你放下劍，陪${n.name}過了一整日：煮茶、看雲、說些不著邊際的話。`);
  nextDay();
  if (!p.mate) return; // 極端情況（次日身故等）
  p.mate.ignored = 0; p.mate.sulking = false;
  if (wasSulk) { n.love = clamp(n.love+3, 0, 100);
    msg(`${n.name}：${q(gdial(n, WED[n.pers].care))}（氣消了，愛情+3）`); }
  else { n.love = clamp(n.love+2, 0, 100); n.favor = clamp(n.favor+1, -200, 120);
    msg(`${n.name}眼裡都是笑意（愛情+2，友情+1）。`); }
  uiRefresh();
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
  const craneAura = G.npcs.some(n=>n.alive&&n.met&&n.demon&&n.race==="鶴族"&&n.favor>=50); // 鶴友同山，劍意清亮
  const gain = Math.round((20 + p.ri*30 + rnd(10)) * (sectUnlocked("妙音門")?1.2:1) * (craneAura?1.1:1));
  p.spirit += gain; p.swordSense += 1;
  msg(`你在練劍場揮劍如雨，靈氣+${gain}${craneAura?"（鶴族道友臨山，劍意清亮+10%）":""}。（今日第${p.practiceCnt}/5次）`);
  uiRefresh();
}
function takeLesson() {
  const p = G.player;
  const ym = year()*12 + (month()-1);
  if (p.lessonYM === ym) return msg("本月大課已上過（每月一次，一課閉關整月）。");
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
  const targetDay = p.day + 30; // 從開課日起整整一個月：不再只跳到下月一號（月底開課只跳一天）
  while (G.player.day < targetDay && guard++ < 40 && G.player.alive) nextDay();
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
  if (p.pills["妖丹"]>0) { rate += 0.08; p.pills["妖丹"]--; } // 妖市貨，可疊加
  if (sectUnlocked("星機閣")) rate += 0.10;
  if (p.stargaze) { rate += 0.03; p.stargaze = false; }
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
  if (G.npcs.some(x=>x.alive&&x.met&&x.demon&&x.race==="鯉族"&&x.favor>=30) && Math.random()<0.25) {
    const m2 = mats[rnd(mats.length)]; p.mats[m2.name]=(p.mats[m2.name]||0)+1; got.push(m2.name+"（鯉族指路）"); }
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
function demonShopOpen(){ return sectFavor(DEMON_SECT) >= 40; } // 妖市：與妖精們交好即可入
function buyPill(name, cnt=1) {
  const p=G.player; const price = PILLS[name]?PILLS[name].price:POISON_PILLS[name].price;
  if (POISON_PILLS[name] && !p.poisonUnlocked) return msg("藥王谷的朋友才懂這些……（需藥王谷好感60解鎖）");
  if (PILLS[name] && PILLS[name].demon && !demonShopOpen())
    return msg("妖市之貨，需與十萬大山的妖精們交好（平均好感40）方可購得。");
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
    else if (name==="月華露飲") { p.spirit += PILLS[name].v; msg(`飲下月華露，靈氣+${fmt(PILLS[name].v)}。`);
      p.pills[name]--; if(!p.pills[name]) delete p.pills[name]; }
    else if (name==="妖丹") { msg(`妖丹會在【嘗試突破】時自動消耗一枚，突破率+8%（可與突破丹疊加）。`); }
    else if (name==="化形丹") { msg(`化形丹是禮物：送給妖精同伴（十萬大山），愛情+15。`); }
  }
  uiRefresh();
}

/* ── 社交 ── */
function npcById(id){ return (id===null||id===undefined||id<0) ? null : G.npcs[id]; }
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
  const n=npcById(id), p=G.player; if(!n)return; const P=PERS[n.pers]; touch(n);
  let fav = 4;
  const rc = RECIPES[itemName]; if (rc && rc.type==="禮物" && rc.gift===n.sect) fav = 16;
  else if (rc) fav = 8; // 送劍
  if (itemName==="避雷符"||itemName==="護心符") fav = 12;
  if (PILLS[itemName]) { fav = 6; p.pills[itemName]--; if(!p.pills[itemName]) delete p.pills[itemName]; }
  else if (POISON_PILLS[itemName]) { return; }
  else { const i=p.swords.findIndex(s=>s.name===itemName); if(i>=0){ p.swords.splice(i,1); if(p.equip&&p.equip.name===itemName&&!p.swords.some(s=>s.id===p.equip.id)) p.equip=null; } }
  if (itemName==="化形丹") { // 妖市珍品：只對妖精有效
    if (!n.demon) { p.pills["化形丹"]=(p.pills["化形丹"]||0)+1;
      return msg(`${n.name}又不是妖身，用不得這個。（化形丹退回）`); }
    n.love = clamp(n.love+15, 0, 100); n.favor = clamp(n.favor+4, -200, 120);
    msg(`${n.name}雙眼放光：「這是……化形丹！」（愛情+15，友情+4）`);
    checkSectUnlock(n.sect); nextDay(); uiRefresh(); return;
  }
  if (n.favor < 0 && Math.random() < 0.8) { msg(`${n.name}：${q(gdial(n,P.giftBad[rnd(P.giftBad.length)]))}`); return; }
  let gmul = P.giftMul;
  if (n.demon) { if (n.race==="蛇族") gmul *= 1.25;       // 蛇族重恩
    else if (n.race==="熊族") gmul *= 1.2;                // 熊族厚禮
    else if (n.race==="蘭花精") gmul *= 1.3; }            // 草木識寶
  const gain = Math.max(1, Math.round(fav*gmul));
  n.favor = clamp(n.favor + gain, -200, 120);
  if (itemName==="洗髓丹") { // 特殊：加速修煉
    if (Math.random()<0.3 && n.ri<7) { n.sub++; if(n.sub>2){n.ri++;n.sub=0;}
      wlog(`${n2t(n)}服下你贈的洗髓丹後閉關，一舉突破至${realmText(n.ri,n.sub)}。`, true); } }
  const gline = (n.demon && RACES[n.race] && Math.random()<0.35)
    ? gdial(n, RACES[n.race].gift) : gdial(n, P.gift[rnd(P.gift.length)]);
  msg(`${n.name}：${q(gline)}（好感+${gain}）`);
  checkSectUnlock(n.sect);
  nextDay(); uiRefresh();
}
function st3(v){ return v<30?0 : v<70?1 : 2; } // 友情/愛情三階段：陌生/熟絡/心腹(情深)
function interact(id, act) {
  const n=npcById(id), p=G.player; if(!n)return; const P=PERS[n.pers]; touch(n);
  if (!n.alive) return msg("人已不在了。");
  if (p.energy<1) return msg("精力不足。");
  if (n.rank==="稚童" && (act==="調情"||act==="雙修")) return msg("對方還是個孩子。");
  p.energy--;
  switch(act) {
    case "交好": {
      const st = st3(n.favor);
      n.favor = clamp(n.favor+P.chatFav, -200, 120);
      G.npcs.filter(o=>o.alive&&o.met&&o.sect===n.sect&&o.id!==n.id).forEach(o=>o.favor=clamp(o.favor+1,-200,120));
      /* 台詞分流：道侶走婚後庫（再無求婚口）→ 妖精三成走種族腔 → 常規性格庫 */
      let line;
      if (G.player.spouse===n.id && WED[n.pers])
        line = gdial(n, WED[n.pers].chat[n.love>=70?1:0][rnd(WED[n.pers].chat[n.love>=70?1:0].length)]);
      else if (n.demon && RACES[n.race] && Math.random()<0.3)
        line = gdial(n, RACES[n.race].chat[rnd(RACES[n.race].chat.length)]);
      else { const pool = P.chat[st]; line = gdial(n, pool[rnd(pool.length)]); }
      let extra = "";
      if (n.demon && n.race==="狐族") { n.love=clamp(n.love+1,0,P.loveCap||100); extra="，愛情+1（狐族善解人意）"; }
      if (n.demon && n.race==="兔族") { p.energy++; extra="（兔族話投機，精力退還）"; }
      msg(`${n.name}：${q(line)}（友情+${P.chatFav}，${n.sect}同門+1${extra}）`);
      break; }
    case "調情": {
      /* 道侶：無門檻，走婚後情話庫 */
      if (G.player.spouse===n.id && WED[n.pers]) {
        const cap0 = P.loveCap||100;
        const lg0 = Math.max(0, Math.min(P.loveGain+rnd(3), cap0-n.love));
        n.love = clamp(n.love+lg0, 0, cap0);
        msg(`${n.name}：${q(gdial(n, WED[n.pers].flirt[rnd(WED[n.pers].flirt.length)]))}（愛情+${lg0}）`);
        break; }
      if (n.favor < P.flirtReq) { msg(`${n.name}：${q(gdial(n,P.flirtNo[rnd(P.flirtNo.length)]))}（需友情${P.flirtReq}）`); break; }
      const cap = P.loveCap||100;
      const st = st3(n.love);
      let lg = P.loveGain+rnd(3);
      if (n.demon && n.race==="蛛族") lg += 1; // 蛛族織情入網
      lg = Math.max(0, Math.min(lg, cap-n.love));
      n.love = clamp(n.love+lg, 0, cap);
      const fpool = P.flirt[st];
      const fline = (n.demon && RACES[n.race] && Math.random()<0.3)
        ? gdial(n, RACES[n.race].flirt) : gdial(n, fpool[rnd(fpool.length)]);
      msg(`${n.name}：${q(fline)}（愛情+${lg}${n.demon&&n.race==="蛛族"?"（蛛族+1）":""}${n.love>=cap?` · 情到此境，止步${cap}`:''}）`);
      break; }
    case "誇讚": {
      const pf = P.chatFav>=3 ? 1 : 2; // 話多的不在乎，寡言的記心裡
      n.favor = clamp(n.favor+pf, -200, 120);
      msg(`${n.name}：${q(gdial(n,PRAISE[n.pers]))}（友情+${pf}）`);
      break; }
    case "逗弄": {
      if (p.energy<1) { msg("精力不足，沒力氣鬧了。"); break; }
      p.energy--;
      const likesIt = ["戲精","瘋批","蕩浪","風流","潑辣","樂天","話癆","綠茶","妖媚","癡纏"].includes(n.pers) || (n.demon&&n.race==="貓族");
      const hatesIt = ["無情","古板","陰鬱","高傲","寡言","聖母"].includes(n.pers);
      if (hatesIt) { n.favor = clamp(n.favor-2, -200, 120);
        msg(`${n.name}：${q(gdial(n,TEASE[n.pers]))}（友情-2，他們不吃這套）`); }
      else if (likesIt) { n.favor = clamp(n.favor+1, -200, 120);
        if (n.demon && n.race==="貓族") n.favor = clamp(n.favor+1, -200, 120); // 貓族記恩
        const cap = P.loveCap||100, tl = Math.min(2, cap-n.love);
        n.love = clamp(n.love+tl, 0, cap);
        msg(`${n.name}：${q(gdial(n,TEASE[n.pers]))}（友情+1${n.demon&&n.race==="貓族"?"+1（貓族）":""}${tl>0?`，愛情+${tl}`:""}）`); }
      else msg(`${n.name}：${q(gdial(n,TEASE[n.pers]))}`);
      break; }
    case "安慰": {
      if (p.energy<1) { msg("精力不足，先顧好自己吧。"); break; }
      p.energy--;
      let cf = 2, cl = n.love>=40 ? 1 : 0;
      if (["陰鬱","病嬌","癡纏"].includes(n.pers)) { cf = 3; cl = 2; } // 這幾位最需要
      if (n.demon && n.race==="鹿族") cl += 1; // 鹿族心軟
      if (n.demon && n.race==="蝶族") cf += 1; // 蝶族暖語
      n.favor = clamp(n.favor+cf, -200, 120);
      const cap = P.loveCap||100; cl = Math.min(cl, cap-n.love);
      n.love = clamp(n.love+cl, 0, cap);
      msg(`${n.name}：${q(gdial(n,COMFORT[n.pers]))}（友情+${cf}${cl>0?`，愛情+${cl}`:""}）`);
      break; }
    case "切磋": return sparNpc(n, false);
    case "雙修": {
      const openMind = P.flirtReq<=50; // 風流/妖媚/蕩浪/癡纏之流不甚設防
      const ok = n.love>=70 || (openMind && n.love>=40 && n.favor>=60) || G.player.spouse===n.id;
      if (!ok) { msg(`${n.name}還未與你到那一步（需愛情70${openMind?"，或此類性情者 愛情40+友情60":""}；現愛情${n.love}·友情${n.favor}）。`); break; }
      if (G.player.spouse!==n.id) msg(`（你們並非道侶，但兩情相悅，又何必在乎名分。）`);
      if (sectUnlocked("合歡宗")) { p.spirit += 800; msg(`一夜雙修，靈氣+800。`); }
      else { p.spirit += 400; }
      const dline = (G.player.spouse===n.id && WED[n.pers]) ? gdial(n, WED[n.pers].dual)
        : (n.demon && RACES[n.race] && Math.random()<0.35) ? gdial(n, RACES[n.race].intimate)
        : gdial(n, P.intimate[rnd(P.intimate.length)]);
      msg(`${n.name}：${q(dline)}`);
      n.love = clamp(n.love+5,0,P.loveCap||100); n.favor = clamp(n.favor+3,-200,120);
      break; }
    case "下毒": return uiPickPoison(n);
    case "暗殺": return assassinate(n);
  }
  /* 與道侶的任何往來都算「陪了TA」：冷落計數清零，悶氣全消 */
  if (p.spouse===n.id && p.mate) {
    p.mate.ignored = 0;
    if (p.mate.sulking) { p.mate.sulking = false;
      msg(`${n.name}：${q(gdial(n, WED[n.pers].care))}（氣消了）`); }
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
  const p=G.player; clearPursuits(n.id); G.player.confess=null;
  if(n.spouseId!==null && n.spouseId>=0){ const ex=npcById(n.spouseId); if(ex) ex.spouseId=null; }
  p.spouse = n.id; n.spouse = p.name; n.spouseId = -1; n.love = 100;
  msg(`${n.name}單膝跪地：「${PERS[n.pers].intimate[0]}」——你們結為道侶！`);
  wlog(`你與${n2t(n)}結為道侶。`, true);
}
function divorce(n) {
  const p=G.player;
  if (realmWeight(p.ri,p.sub) < realmWeight(n.ri,n.sub)) return msg("境界不敵，提不出分手。");
  p.spouse=null; p.mate=null; n.spouse=""; n.spouseId=null;
  n.love=clamp(n.love-50,0,100); n.favor=clamp(n.favor-30,-200,120);
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
  migrateDemons(); // v5：舊檔補生十萬大山妖精
  migrateIdFix(); // v6：修復v5遺留的妖精撞號（舊檔曾從0重發id，npcById按索引認錯人）
  migrateFavorFloor(); // v6：舊版淡忘把無仇怨的相識扣成負數，一朝清零
  NPC_UID = G.npcs.length; // 修復：讀檔後新NPC的id接續（舊檔曾從0重發）
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
function migrateDemons(){ // v5 一次性：舊檔補生十萬大山妖精群落
  if (G.flags.demons) return;
  G.flags.demons = true;
  if (G.npcs.some(n=>n.demon)) return;
  DEMON_USED = {};
  NPC_UID = G.npcs.length; // 補生妖精的id必須從現有人數接續：npcById按陣列索引取人，從0重發會撞號認錯人
  const w = WORLD_ROSTER.find(x=>x.demon);
  const master = mkNpc(w.sect,"掌門",5+rnd(2),Math.random()<w.mRatio?"M":"F");
  master.special = "一山妖王";
  G.npcs.push(master);
  for(let i=0;i<w.elders;i++) G.npcs.push(mkNpc(w.sect,"長老", w.elderRi[0]+rnd(w.elderRi[1]-w.elderRi[0]+1), Math.random()<w.mRatio?"M":"F"));
  for(let i=0;i<w.discs;i++) G.npcs.push(mkNpc(w.sect,"弟子", w.discRi[0]+rnd(w.discRi[1]-w.discRi[0]+1), Math.random()<w.mRatio?"M":"F"));
  wlog(`十萬大山的妖精們走出深山，各派議論紛紛。`, false);
  msg(`【十萬大山】山那邊的門戶洞開——狐、蛇、貓、狼等十四族妖精現身世間。去【江湖→十萬大山】結識他們吧。`);
}
function migrateIdFix(){ // v6 一次性：修復v5補生妖精的id撞號（0~13與舊NPC重複，往來認錯人）
  if (G.flags.idfix) return;
  G.flags.idfix = true;
  const broken = G.npcs.filter(d=>d.demon && d.id!==G.npcs.indexOf(d));
  if (!broken.length) return;
  const byOldId = new Map(broken.map(d=>[d.id, d])); // 舊錯id → 妖精本體
  const spouseAnchor = G.npcs.findIndex(n=>n.spouseId===-1); // 玩家道侶錨點（本體在哪，配偶就指哪）
  const remap = v => { const d = byOldId.get(v); return d ? G.npcs.indexOf(d) : v; };
  /* 先全量判定再統一套用：邊改邊查會讓後查者的互指判定用到已換的新id，誤判又誤換 */
  const moves = [];
  G.npcs.forEach(x=>{
    /* 指向妖精的舊指針：妖精本尊回指確認才換（道侶看互指、師承看輩分、父母看反指孩子） */
    if (x.spouseId!==null && x.spouseId>=0){
      const d = byOldId.get(x.spouseId);
      if (d && d!==x && d.spouseId===x.id) moves.push([x, "spouseId", G.npcs.indexOf(d)]); // d!==x：防妖精自己回指自己
    }
    if (x.rel.master!==null && x.rel.master!==undefined){
      const y = G.npcs[x.rel.master];
      if (!y || (y.rank!=="掌門" && y.rank!=="長老")) moves.push([x, "master", remap(x.rel.master)]);
    }
    if (x.rel.parents.length) {
      const np = x.rel.parents.map(pid=>{
        const y = G.npcs[pid];
        return (!y || !y.rel.children.includes(x.id)) ? remap(pid) : pid;
      });
      if (np.some((v,i)=>v!==x.rel.parents[i])) moves.push([x, "parents", np]);
    }
  });
  moves.forEach(([o,k,v])=>{ if(k==="spouseId") o.spouseId=v; else if(k==="master") o.rel.master=v; else o.rel.parents=v; });
  G.npcs.forEach((n,i)=>{ n.id = i; }); // id歸位＝陣列索引
  if (G.player.spouse!==null && G.player.spouse!==undefined && spouseAnchor>=0) G.player.spouse = spouseAnchor;
  if (G.player.guest) G.player.guest = null; // 來客若認錯了人，請TA重新上門
  msg(`【修正】十萬大山名冊歸位：妖精們的身分對上了號，往來從此認對人。`);
}
function migrateFavorFloor(){ // v6 一次性：舊版淡忘無條件扣好感，相識無仇怨卻成負數，清零了帳
  if (G.flags.favorFloor) return;
  G.flags.favorFloor = true;
  let fixed = 0;
  G.npcs.forEach(n=>{ if (n.favor<0){ n.favor=0; fixed++; } });
  if (fixed) msg(`【修正】${fixed}位故識心頭的隔閡散了——舊年的誤會一筆勾銷，情分從頭再來。`);
}
function listSaves() {
  return [0,1,2].map(s => { const r=localStorage.getItem("wjs_"+s);
    return {slot:s, empty:!r, time:r?new Date(JSON.parse(r).t).toLocaleString():"—", name:r?JSON.parse(r).g.player.name+"·"+realmText(JSON.parse(r).g.player.ri,JSON.parse(r).g.player.sub):""}; });
}
/* ── log ── */
function msg(t) { G.dayLog.push({d:G?G.player.day:0, t}); if (G && G.dayLog.length>200) G.dayLog.shift(); }
