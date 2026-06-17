# World Time Aligner

A Chrome Extension Popup to compare times across multiple timezones. Select cities by clicking on the world map and align their times on a 24-hour timeline.

---

## Features

- **Interactive World Map**: Click pins on the map to select cities. Built-in cities include Taipei, Hong Kong, Tokyo, London, New York, Dallas, Delhi, Sydney, etc.
- **24-Hour Timeline**: Supports selecting up to 6 cities simultaneously.
- **Vertical Hover Guide**: Hover over any hour cell to align all selected cities to the same absolute time.
- **Custom Time Period Colors**: Customize the start/end hours and background/text colors for three custom time periods (default: 08-17, 18-23, 00-07).
- **Custom Cities & Map Calibration**: Add custom cities and adjust the map's zoom and offset parameters.
- **Multi-Language Support (i18n)**: UI and city names support both English and Traditional Chinese.
- **Local Storage Persistence**: Selections and configurations are stored in `localStorage` and persist across sessions.

---

## Project Structure

- manifest.json: Chrome Extension manifest file (MV3).
- popup.html: Popup UI structure.
- popup.js: Timezone logic, timeline rendering, and event handlers.
- cities.js: Pre-defined city coordinates and timezone settings.
- i18n.js: Translation maps for multi-language support.
- assets: Map background image and settings icon.

---

## Installation & Usage

1. Download or clone this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable "Developer mode" in the top-right corner.
4. Click "Load unpacked" and select the root directory of this repository.

---

## Map Calibration Projection

The linear conversion rules for built-in city coordinates:
- **X conversion**: `x = 0.2816 * longitude + 46.2357`
- **Y conversion**: `y = -0.5257 * latitude + 63.3239`

Example:
- **Taipei** (121.5°E, 25.0°N): `x = 80`, `y = 50`
- **Delhi** (77.2°E, 28.6°N): `x = 68`, `y = 48`
- **Dallas** (96.8°W, 32.8°N): `x = 19`, `y = 46`

---
---

# World Time Aligner (中文說明)

一個用於比對多個時區時間的 Chrome Extension Popup。透過點擊世界地圖選取城市，並在 24 小時時間軸上對齊各時區時間。

---

## 功能

- **互動式世界地圖**：點擊地圖上的標記選取城市。內建台北、香港、東京、倫敦、紐約、達拉斯、德里、雪梨等城市。
- **24 小時時間軸**：最多支援同時選取 6 個城市。
- **時間導引虛線**：滑鼠移到時間格時，顯示虛線以對齊所有城市在同一個時間點的狀態。
- **自訂時段色彩**：支援自訂三個時段（預設為 08-17、18-23、00-07）的起迄時間與背景/文字顏色。
- **自訂城市與地圖校準**：可手動新增自訂城市並調整地圖的縮放與偏移參數。
- **多語支援 (i18n)**：介面及城市名稱支援繁體中文與英文。
- **本機狀態保存**：選取的城市與相關設定儲存於 `localStorage`，下次開啟時保留。

---

## 專案檔案結構

- manifest.json：Chrome Extension 核心設定檔 (MV3)。
- popup.html：主畫面 HTML 結構。
- popup.js：時區邏輯、時間軸渲染與事件控制。
- cities.js：預設內建城市的經緯度座標與時區定義。
- i18n.js：語系翻譯對照表。
- assets：世界地圖背景圖檔及設定圖示。

---

## 安裝與使用方式

1. 下載或 Clone 本專案。
2. 開啟 Chrome 瀏覽器，進入 `chrome://extensions/`。
3. 開啟右上角「開發人員模式」。
4. 點擊「載入未封裝項目」，選擇此專案的根目錄資料夾。

---

## 地圖校準投影說明

內建城市投影的線性轉換規則為：
- **X 軸轉換**：`x = 0.2816 * 經度 + 46.2357`
- **Y 軸轉換**：`y = -0.5257 * 緯度 + 63.3239`

例如：
- **台北** (121.5°E, 25.0°N)：`x = 80`, `y = 50`
- **德里** (77.2°E, 28.6°N)：`x = 68`, `y = 48`
- **達拉斯** (96.8°W, 32.8°N)：`x = 19`, `y = 46`
