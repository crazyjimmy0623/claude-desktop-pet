# Deskmates

陪你上班的桌上小夥伴。目前每個 Claude Code session 會變成一隻像素小騎士（Deskmates 的吉祥物），站在工作列上方，演出 Claude 正在做的事。
用的是 Claude Code 的 http hooks，不需要改變你使用終端機的習慣。

| Claude 在做什麼 | 騎士的樣子 |
|---|---|
| 收到你的指令 | 💭 思考中…（先顯示一下你的指令） |
| Read / Grep / WebSearch… | 📖 捧著書看 |
| Edit / Write / Bash… | 🔨 在鐵砧上打鐵，氣泡顯示工具和檔名 |
| 開 subagent | 旁邊多出小騎士幫忙打鐵 |
| 等你批准權限 | ❗ 黃色氣泡、跳上跳下揮手 |
| 回合結束 | ✨ 舉劍、閃閃發光 |
| 閒置 | 在工作列上走來走去，3 分鐘後坐下睡覺 💤 |
| session 結束 | 👋 走出畫面 |

## 使用

- **啟動**：雙擊 `start-deskmates.vbs`（或 `npm start`）
- **示範**：`npm run demo`，或從系統匣圖示選「播放示範」
- **點騎士**：顯示詳細資訊（專案、狀態、最後指令、上工時間）
- **拖曳騎士**：把他抓起來甩，放開會掉下去
- **右鍵騎士**：開啟專案資料夾 / 叫他下班
- **系統匣圖示**：顯示／隱藏、重新排隊、全部下班、開機自動啟動、結束

## Hooks

`npm run install-hooks` 會在 `~/.claude/settings.json` 為 12 個事件加上
`{"type": "http", "url": "http://127.0.0.1:47321/event"}`。不會動到既有的 hooks，原檔會備份成
`settings.json.bak-deskmates`。`npm run uninstall-hooks` 可以移除。

Deskmates 沒開時 hook 連不上會直接略過，不會擋到 Claude。伺服器只綁 127.0.0.1，回應永遠是空的 204，
所以不會影響 Claude 的任何決定。

想換 port 就設環境變數 `DESKMATES_PORT`，程式和安裝腳本都會讀這個變數。

## 結構

```
src/main.js            Electron 主程式：透明置頂視窗、系統匣、本機 HTTP 伺服器
src/summarize.js       把 hook payload 濃縮成畫面需要的欄位
src/demo.js            假事件腳本
src/renderer/sprite.js 程式繪製的像素騎士（32x28 格）
src/renderer/pet.js    每個 session 的狀態機、動畫、拖曳、資訊卡
scripts/install-hooks.js
```

## 授權

MIT，詳見 [LICENSE](LICENSE)。
