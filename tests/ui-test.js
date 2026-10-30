/* ============ 村庄文游 · UI 测试（2026-10-30 重建版，随仓库保存） ============ */
/* 依赖：NODE_PATH=/home/lenovo/ucampus/node_modules 的 playwright-core + chrome-headless-shell
   运行：先 python3 -m http.server 8899（仓库根目录），再 timeout 90 node ui-test.js */
const { chromium } = require('playwright-core');
const EXE = process.env.EXE || '/home/lenovo/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell';
const BASE = process.env.BASE || 'http://127.0.0.1:8899/index.html';
let PASS = 0, FAIL = 0; const FAILS = [];
const errors = [];
function t(name, cond, extra) {
  if (cond) { PASS++; console.log(`  ✓ ${name}`); }
  else { FAIL++; FAILS.push(name + (extra ? `（${extra}）` : '')); console.log(`  ✗ ${name}${extra ? ' ' + extra : ''}`); }
}
(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    const ev = (fn, ...args) => page.evaluate(fn, ...args);
    const $txt = sel => page.locator(sel).innerText({ timeout: 15000 }).catch(() => '');

    await page.goto(BASE, { timeout: 15000, waitUntil: 'domcontentloaded' });
    await page.waitForSelector('[data-boot]', { timeout: 15000 });

    /* U1 开机画面 */
    t('U1 开机画面出现', await page.locator('[data-boot]').count() >= 1);
    await page.locator('[data-boot="new"]').click({ timeout: 15000 });
    await page.waitForSelector('#tabbar .tab.active', { timeout: 15000 });
    t('U2 新档进入村庄', (await $txt('#statline')).includes('安娜币'));

    /* U3 物品词条（言拍板 2026-10-30）：点背包看从哪来 */
    await page.locator('[data-t="home"]').click({ timeout: 15000 });
    await page.waitForSelector('.bag-item[data-item="弓"]', { timeout: 15000 });
    await page.locator('.bag-item[data-item="弓"]').click({ timeout: 15000 });
    await page.waitForSelector('#modal-mask.show', { timeout: 15000 });
    let body = await $txt('#modal-body');
    t('U3 词条·弓弹窗有从哪来/有什么用',
      (await $txt('#modal-title')).trim() === '弓' && body.includes('从哪来') && body.includes('有什么用'),
      'title=' + (await $txt('#modal-title')).trim());
    await page.locator('#modal-close-btn').click({ timeout: 15000 });

    /* U4 村庄→养殖场→Levi 档案（Levi 现在是摊主；他下午在养殖场） */
    await ev(() => { G.node = 2; render(); });
    await page.locator('[data-t="village"]').click({ timeout: 15000 });
    await page.locator('[data-place="farm"]').click({ timeout: 15000 });
    await page.waitForSelector('.npc-card[data-npc="levi"]', { timeout: 15000 });
    t('U4 养殖场能见到 Levi', true);
    await page.locator('.npc-card[data-npc="levi"]').click({ timeout: 15000 });
    await page.waitForSelector('[data-act="trade"][data-id="levi"]', { timeout: 15000 });
    t('U4b Levi 档案有交易按钮', true);

    /* U5 交易：TA 卖羊毛 3 币；只卖不收的守卫 */
    await page.locator('[data-act="trade"][data-id="levi"]').click({ timeout: 15000 });
    await page.waitForSelector('.trade', { timeout: 15000 });
    body = await $txt('#modal-body');
    t('U5 Levi 摊·卖羊毛3币', body.includes('TA 卖') && body.includes('羊毛') && body.includes('3币'));
    t('U5b 只卖不收·显示不收东西', body.includes('TA 不收东西。'));
    /* U5c 买羊毛（拍板#47改版：点商品→数量弹窗→确认买） */
    await page.locator('[data-act="qbuy"][data-id="levi"][data-item="羊毛"]').click({ timeout: 15000 });
    await page.waitForSelector('[data-act="buy"][data-id="levi"][data-item="羊毛"]', { timeout: 15000 });
    await page.locator('[data-act="buy"][data-id="levi"][data-item="羊毛"]').click({ timeout: 15000 });
    await page.waitForTimeout(300);
    const r5 = await ev(() => ({ wool: G.bag['羊毛'] || 0, coins: G.coins }));
    t('U5c 买到羊毛（3币）', r5.wool === 1 && r5.coins === 17, JSON.stringify(r5));
    await page.locator('#modal-close-btn').click({ timeout: 15000 });

    /* U6 八摊主渲染全扫（缺陷B回归：只收购的摊子曾崩按钮） */
    const sweep = await ev(() => {
      const out = [];
      for (const n of NPCS) {
        if (!n.trade) continue;
        tradeSheet(n.id);
        const b = document.querySelector('#modal-body').innerText;
        out.push({ id: n.id, sells: !!n.trade.sell, ok: b.includes('TA 收'), sellNote: b.includes('TA 卖'), hasStock: !b.includes('你没有TA收的东西。') });
      }
      document.querySelector('#modal-close-btn').click();
      return out;
    });
    t('U6 共八家摊主', sweep.length === 8, '实得' + sweep.length);
    for (const s of sweep) t(`U6 ${s.id} 摊子开得了`, s.ok);
    const trio = ['vivienne', 'alice', 'olivia'];
    for (const s of sweep.filter(x => trio.includes(x.id)))
      t(`U6b ${s.id} 只收购无「TA 卖」`, !s.sells && !s.sellNote);   // 收购区有没有货看背包，不在此断言
    const lev = sweep.find(x => x.id === 'levi');
    t('U6c levi 只卖不收', lev.sells && lev.sellNote && lev.hasStock);

    /* U7 花入送礼（言拍板 2026-10-30）：骑士 +6 */
    await ev(() => { G.bag['花'] = 1; G.npc.knight.f = 30; giftSheet('knight'); });
    await page.waitForSelector('#modal-mask.show .trade', { timeout: 15000 });
    body = await $txt('#modal-body');
    t('U7 送礼单里有花', body.includes('花×1'));
    const f0 = await ev(() => G.npc.knight.f);
    await page.locator('[data-act="give"][data-item="花"]').click({ timeout: 15000 });
    await page.waitForTimeout(300);
    const r7 = await ev(() => ({ f: G.npc.knight.f, gone: G.bag['花'] === undefined, giftDay: G.npc.knight.giftDay === G.day }));
    t('U7b 花送出去·骑士+6', r7.f === f0 + 6 && r7.gone && r7.giftDay, JSON.stringify(r7));
    await page.locator('#modal-close-btn').click({ timeout: 15000 });

    /* U8 夜话不再卡天（缺陷A回归）：夜里在家休息，Asher 夜话后照样结算 */
    await ev(() => { G.node = 3; G.npc.asher.f = 55; G.love = G.love || {}; render(); });
    await page.locator('[data-t="home"]').click({ timeout: 15000 });
    await page.locator('[data-act="rest"]').click({ timeout: 15000 });
    await page.waitForSelector('#modal-mask.show', { timeout: 15000 });
    const nightTxt = await $txt('#modal-body');
    t('U8 夜话弹窗出现', nightTxt.includes('床的事') || nightTxt.includes('Asher'));
    await page.locator('[data-act="close-res"]').first().click({ timeout: 15000 });
    await page.waitForTimeout(300);
    const settleTxt = await $txt('#modal-title');
    t('U8b 结算弹窗出现', settleTxt.includes('一天结束'), 'title=' + settleTxt.trim());
    await page.locator('[data-act="close-res"]').first().click({ timeout: 15000 });
    await page.waitForTimeout(300);
    const r8 = await ev(() => ({ day: G.day, node: G.node }));
    t('U8c 一夜过去进第2天清晨', r8.day === 2 && r8.node === 0, JSON.stringify(r8));

    /* U10 和 Asher 做蛋糕（言拍板 2026-10-30 第十二场） */
    await ev(() => { G.node = 3; G.bag['小麦'] = 1; G.bag['水果'] = 1; G.cakeDay = 0; render(); });
    await page.locator('[data-t="home"]').click({ timeout: 15000 });
    await page.waitForSelector('[data-act="bake"]', { timeout: 15000 });
    const fa = await ev(() => G.npc.asher.f);
    await page.locator('[data-act="bake"]').click({ timeout: 15000 });
    await page.waitForSelector('#modal-mask.show', { timeout: 15000 });
    body = await $txt('#modal-body');
    t('U10 做蛋糕·台词出现', body.includes('一人一半') && body.includes('比 Olivia 的甜'));
    const r10 = await ev(() => ({ f: G.npc.asher.f, again: !!document.querySelector('[data-act="bake"]') }));
    t('U10b Asher友好+3·当天按钮收回', r10.f === fa + 3 && !r10.again);
    await page.locator('#modal-close-btn').click({ timeout: 15000 });

    /* U11 制作弹窗（言拍板 2026-10-30）：按钮只留名称，精力和材料点开才见 */
    await ev(() => { G.node = 0; G.blueprints.sling = true; G.bag['木材'] = 2; G.bag['兔皮'] = 1; render(); });
    await page.locator('[data-t="home"]').click({ timeout: 15000 });
    await page.waitForSelector('[data-act="craftq"][data-k="sling"]', { timeout: 15000 });
    const cb = await $txt('[data-act="craftq"][data-k="sling"]');
    t('U11 制作按钮只留名称', cb.trim() === '弹弓', JSON.stringify(cb));
    await page.locator('[data-act="craftq"][data-k="sling"]').click({ timeout: 15000 });
    await page.waitForTimeout(200);
    body = await $txt('#modal-body');
    t('U11b 弹窗见精力与材料', body.includes('精力2') && body.includes('木材 ×2') && body.includes('兔皮 ×1'), body.slice(0, 60));
    await page.locator('[data-act="craft"][data-k="sling"]').click({ timeout: 15000 });
    await page.waitForTimeout(300);
    const r11 = await ev(() => ({ got: G.bag['弹弓'] || 0, wood: G.bag['木材'] || 0 }));
    t('U11c 制作入包·材料扣掉', r11.got === 1 && r11.wood === 0, JSON.stringify(r11));
    await page.locator('#modal-close-btn').click({ timeout: 15000 });

    /* U9 全程零报错 */
    t('U9 零页面报错', errors.length === 0, errors.slice(0, 3).join(' | '));
  } finally {
    await browser.close();
  }
  console.log(`\n========== UI 测试：${PASS} 过 / ${FAIL} 挂 ==========`);
  for (const f of FAILS) console.log('✗ ' + f);
  process.exit(FAIL ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(2); });
