# 萬劍山弟子修煉手札（yaowanggu-game）

## 提交規則（用戶定，2026-10-10）
- **無論小改動/大改動，改完直接 `git commit` + `git push origin main`，不用再問**
- commit message 用中文一行式，學 git log 現有風格（「三修：…」「六大項：…」）

## 必守流程
- **改 `src/` 後必須跑 `bash build.sh`** 重建單檔 `index.html`（忘記 = 改動無效）
- build 前後可 `node --check src/<file>.js` 快速驗語法

## 測試基建（無需 npm install）
- playwright：`/home/lenovo/dev/claude-test/node_modules/playwright`
- 瀏覽器：`/home/lenovo/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell`
- 起服務：項目目錄 `python3 -m http.server 8931`（用完 kill）
- 範本腳本：`/tmp/opencode/verify_all.js`（若還在；否則照上兩行路徑自寫，goto 一律帶 timeout）

## 架構速覽
- 單檔 PWA：`index.html` 由 `build.sh` 從 `src/` 合成；`sw.js` 對 index.html 是 network-first（無舊緩存風險）
- `src/engine.js` 遊戲邏輯（世界事件/婚姻/淡忘都在 worldTickMonthly 一帶）
- `src/pers.js` 台詞庫：PERS 27 性格、WED 婚後、RACES 妖族、DIV 和離挽留
- `src/ui.js` modal/框架，`src/ui2.js` 各介面渲染，`src/data.js` 境界/雜項數據
- 存檔：localStorage，`G.player.spouse` 存玩家道侶 id；NPC 的 `spouseId=-1` 表示配偶是玩家

## 已知設計定案（勿「修」）
- 玩家道侶不參與世界婚姻破裂/情殺/誕子事件（`npcById(-1)` 天然排除，未實裝夫妻誕子）
- 情殺死亡不走 `npcDie()` 但指針已先雙向清，無殘留
