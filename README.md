# Travel Map｜城市地標互動旅遊地圖

繁體中文個人旅遊地圖與旅行手帳。保留原有足跡統計、時間軸、照片牆、旅程收藏簿、搜尋篩選、編輯刪除及 JSON 備份，並升級成可放大到城市道路與地標的線上瓦片地圖。

## 專案結構

```text
Travel-Map/
├── AGENTS.md
├── README.md
├── index.html
├── css/style.css
├── js/map.js
├── js/geocoder.js
├── js/storage.js
├── js/main.js
├── data/destinations.json
├── assets/images/
├── ideas/
├── slide_notes/
└── notes/
```

## 開啟方式

1. 解壓縮專案。
2. 直接雙擊 `index.html` 即可開啟介面；城市級底圖與搜尋需要網路連線。
3. 建議以 GitHub Pages 或其他靜態網站主機公開，因部分網路可能限制 `file://` 網頁呼叫外部服務。

## 城市與地標地圖

- 地圖引擎：專案內 `js/map.js` 的原生 JavaScript Web Mercator 瓦片引擎，不依賴 Leaflet CDN。
- 底圖：CARTO Positron（主要）及 OpenStreetMap 標準圖磚（備援）。
- 地點搜尋：使用者主動搜尋時呼叫 Nominatim。
- 放大至城市街區後，街道名稱、車站及部分 POI 會依底圖資料與縮放層級顯示。
- 服務需要網路連線；若服務遭網路政策封鎖，可能無法載入。

## 地圖操作

- 滑鼠滾輪或左上角 +／−：縮放。
- 按住拖曳：移動地圖。
- 點擊地圖空白處：新增旅遊紀錄並帶入座標。
- 點擊搜尋結果：定位到城市或景點。
- 點擊旅遊標記：查看名稱與狀態。

## 資料與備份

旅遊紀錄保存在目前瀏覽器的 LocalStorage。清除網站資料或更換瀏覽器／裝置不會自動同步，請定期使用右上方匯出功能備份 JSON。

## GitHub Pages 部署

將 `Travel-Map` 資料夾內所有檔案與子資料夾上傳至 repository 根目錄，再到 Settings → Pages，選擇 Deploy from a branch、`main`、`/(root)` 並儲存。

## 資料來源與致謝

- © OpenStreetMap contributors，資料依 ODbL 授權。
- CARTO 底圖樣式及 attribution 依 CARTO 服務規範。
- Nominatim 搜尋服務由 OpenStreetMap Foundation 社群基礎設施提供。

請遵守各服務的使用政策；本專案不會大量預抓地圖瓦片。


## 本次載入修正
- `index.html` 已內嵌 CSS 與 JavaScript，直接開啟時不必依賴 `css/`、`js/` 的相對路徑。
- `css/`、`js/`、`data/`、`ideas/`、`notes/`、`slide_notes/`、`assets/` 等原始專案資料夾仍完整保留，方便後續編輯與繳交。
- 城市道路及景點底圖仍需網路連線；若底圖服務被網路封鎖，地圖詳細街道仍可能無法顯示。


## 2026-11-16 圖資服務修正
- 移除會顯示 `API KEY REQUIRED` 的 CARTO 圖磚服務。
- 改用 OpenStreetMap 公開圖磚作為主要底圖，並加入 OpenStreetMap DE 備援。
- 不需要 CARTO API Key。城市道路、街道與景點標籤仍需網路連線。
- 若兩個圖磚服務都被目前網路封鎖，請改用其他網路或 GitHub Pages 網址測試。


## 2026-11-16 地圖服務更新
- 由於目前網路對 OpenStreetMap 公用圖磚回傳 403，已移除 OSM 公用圖磚作為底圖來源。
- 改用 Esri World Street Map 作為主要圖磚，Esri World Topographic Map 作為備援。
- 不需要在本專案填入 CARTO API Key；城市道路和地標仍須網路連線。
- Esri 街道圖的資料來源及歸屬資訊已顯示於地圖程式中。


## 搜尋定位修正
- 國家／城市搜尋結果會依 Nominatim 回傳的 bounding box 自動調整地圖範圍。
- 精確景點搜尋會定位到景點座標並放大檢視。
- 移除內建東京示範紀錄；若瀏覽器 LocalStorage 中仍有該示範項目，也只會清除該筆，不影響使用者自行新增的資料。
- 仍使用 Esri 街道圖與地形圖備援，城市街道圖資需要網路連線。


## 標記拖曳與資訊卡修正
- 可直接按住地圖上的既有旅遊標記拖曳到新位置，放開後自動更新經緯度並儲存至 LocalStorage。
- 地圖平移、縮放或重新繪製時會關閉舊的資訊卡，避免資訊卡留在不相干的地圖區域。
- 新增標記仍可透過點擊地圖完成。
- 原有旅遊紀錄不會因本次更新而清除。


## 精確地點與座標校正（2026-11）
- 搜尋結果列出地名、完整地址與座標；使用者必須自行選擇正確的結果，不會自動選第一筆。
- 選取搜尋結果後，系統直接把該筆經緯度帶入新增／校正表單。
- 點擊地圖新增時，使用點擊位置作為座標，並嘗試反向地理編碼補齊地址。
- 既有舊紀錄若沒有座標來源，會標示「尚未驗證」，可在收藏卡片使用「校正位置」重新搜尋並更新。
- 手動改動經緯度會取消驗證狀態，儲存前要求再次確認。
- 地理編碼仍可能有同名地點或資料庫缺漏；務必核對結果顯示的國家、城市與完整地址。系統不應宣稱所有地名都能百分之百自動判斷。
