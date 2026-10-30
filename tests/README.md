# 村庄文游 · 自动化测试（2026-10-30 起，随仓库保存）

## 引擎逻辑测试（无浏览器）
```bash
cd tests
cat ../src/data.js ../src/engine.js engine-body.js > _bundle.js
node -e 'globalThis.localStorage={_m:{},getItem(k){return this._m[k]??null},setItem(k,v){this._m[k]=String(v)},removeItem(k){delete this._m[k]}};require("./_bundle.js")'
```
21 条：时间/交易/掉落/送礼/手作/做蛋糕/夜话结算（缺陷A回归）/存档/矿保底+护送/肢体互动 + 30 种子×45 天浸泡。

## UI 测试（chrome-headless-shell）
```bash
cd .. && bash build.sh
(python3 -m http.server 8899 >/tmp/http8899.log 2>&1 &) && sleep 1
cd tests && NODE_PATH=/home/lenovo/ucampus/node_modules timeout 90 node ui-test.js
pkill -f "http.server 8899"
```
40 步：开机/物品词条/Levi 卖羊毛/八摊主渲染（缺陷B回归）/花送礼/做蛋糕/制作弹窗（材料名可点看来路）/白天灰蛋糕/肢体互动（姐妹线无亲颊）/夜话不卡天/零报错。

改了 src/ 之后两套都要跑。EXE 路径如变，用环境变量 EXE 覆盖。
