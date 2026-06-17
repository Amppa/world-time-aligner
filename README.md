# World Time Aligner

一個 Chrome MV3 extension popup，用簡易世界地圖選擇城市，並用 24 小時時間軸掃描不同時區。

## 使用方式

1. 打開 Chrome 的 `chrome://extensions/`。
2. 開啟右上角「開發人員模式」。
3. 點「載入未封裝項目」。
4. 選擇這個資料夾：`outputs/world-time-aligner`。

## 功能

- 點地圖上的城市 pin 選擇時區，最多保留 4 個城市。
- 內建台北、香港、東京、DC、紐約、倫敦等熱門城市。
- 右上角齒輪可以調整地圖校準參數：經度、緯度、寬度縮放、高度縮放；縮放以地圖中心為基準。
- 齒輪裡可以新增自訂城市，改名稱、時區、座標，並即時套用。
- 世界小地圖上有簡化時區分隔線，方便快速抓方位。
- 下方以 24 小時時間軸顯示各城市的白天、傍晚、夜晚。
- 城市欄會顯示目前 UTC 偏移，例如 `UTC+8`。
- 滑鼠移到任一時間格時，虛線會跨列對齊所有城市同一個絕對時間。
- 時間軸以 `00` 到 `23` 的純數字顯示。
- 選擇會儲存在本機，下次打開 popup 仍會保留。

## 目前城市列表在哪裡

- 內建城市清單在 [popup.js](/C:/Users/flow/Documents/Codex/2026-06-16/chrome-extension-1-2-3-4/outputs/world-time-aligner/popup.js) 開頭的 `cityCatalog`。
- 自訂城市會存到 `localStorage` 的 `worldTimeAlignerCustomCities`。
- 雪梨座標也在同一份 `cityCatalog` 裡，直接改 `x` / `y` 就可以。
