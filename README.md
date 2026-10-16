# Deskmates

陪你上班的桌上小夥伴。像素角色住在工作列上方，演出你和 AI 正在做的事：你寫程式他打字、Claude 在讀檔他捧書、等你批准時他跳起來揮手。

不用 AI 也能玩：開「電腦活動」來源，代表你的角色會跟著前景程式切換動作。

## 兩種模式

- **工作列**：角色直接站在工作列上，可以拖、可以甩，點一下看資訊、雙擊摸頭
- **房間**：一間浮在桌面右下角的等角小屋（可以拖到別處）：兩面牆、二樓夾層和樓梯。角色會走到對應的家具，也會上下樓：寫程式去電腦桌、下指令去伺服器、讀檔去書櫃、開 subagent 去會議桌、等批准去按櫃台鈴、閒置去床或沙發

兩邊都有按鈕可以互相切換（工作列右下角的小工具列、房間右上角的工具列）。

## 角色在演什麼

| 來源 | 會發生什麼 |
|---|---|
| Claude Code hooks | 每個 session 一位夥伴；你送出指令時，你的角色會走過去把話說出來 |
| 電腦活動 | 依前景程式：VS Code／Unity → 寫程式、Photoshop／Aseprite → 畫畫、瀏覽器 → 上網、Spotify → 跳舞…（設定裡可以自訂對應表）；離開電腦就睡覺 |
| 番茄鐘 | 專注倒數、休息時去喝咖啡 |
| 通用 API | 任何程式 POST 到 `http://127.0.0.1:47321/api/event` 就能驅動一位夥伴 |
| Codex CLI | `notify = ["curl", "-s", "-m", "1", "http://127.0.0.1:47321/codex", "-H", "Content-Type: application/json", "-d"]` |

隱私：只讀前景程式的名稱和有沒有在活動，不記錄鍵盤輸入，也不讀視窗內容。所有資料都只在本機。

## 收集

- **金幣只能靠工作賺**：AI 完成回合、完成番茄鐘、陪伴時間、抓 bug、拆包裹。沒有任何付費管道
- **招募**：10 🪙 抽一次，抽角色、配件、家具、地板、牆面；重複退 3 🪙，十連保底稀有以上
- **圖鑑、成就、每週戰績卡**（可存成圖片分享）
- **隨機事件**：工具失敗時跑出一隻 bug、長任務完成送來包裹、context 壓縮時 UFO 飛過

## 自訂

- 11 種角色和 8 種配件；AI session 預設是暴走機器人。傳說角色是我們團隊本人：冷酷吉米（黑騎士）、OUKAI（鴨嘴獸）、布魯（白貓），只能抽到
- 角色是一格一格點的 Q 版像素（約 28x36 細像素、兩頭身），沒有黑色描邊，邊緣用同色系的深色收
- 房間編輯器：擺家具、塗地板、換牆面、調高度
- 自己的素材放進 `%APPDATA%\Deskmates\custom\`：
  - `characters/<名稱>/`：Aseprite 匯出的 PNG + JSON，用 frame tag 命名動作（idle、walk、work、type、command、game、read、wait、done、sleep…）
  - `tiles/`：16x16 PNG，房間編輯器的「自訂地板」可以直接塗

## 開發

```
npm install
npm start              # 啟動
npm run demo           # 播放示範
npm run install-hooks  # 安裝 Claude Code hooks（設定視窗也有按鈕）
npm run preview -- chars out.png   # 輸出角色/家具預覽圖（chars | lineup | minis | anim | fx | iso）
```

啟動參數：`--demo`、`--mode=room|strip`、`--open=settings|guild`；設 `DESKMATES_DEBUG=1` 會印出 hook 事件和視窗 console。

```
src/main/        主程式：actors（角色狀態）、progress（金幣/成就/招募）、fx（隨機事件）、
                 focus（番茄鐘）、activity（前景程式偵測）、server（HTTP）、windows、hub（工作列按鈕）、store
src/shared/      主程式和畫面共用：catalog（物品/成就）、sprites（角色）、furniture（房間）
src/renderer/    strip（工作列）、room（房間 + 編輯器）、settings、guild（夥伴手冊）
```

美術全部用程式畫，沒有外部素材。所有圖都畫在兩倍細的網格上（角色 64x56、地磚 32x32 細格）；不用黑色描邊，每個部位的邊用它自己顏色的深一階來收，角色是大頭、扁臉、豆豆眼。

## 授權

MIT，詳見 [LICENSE](LICENSE)。
