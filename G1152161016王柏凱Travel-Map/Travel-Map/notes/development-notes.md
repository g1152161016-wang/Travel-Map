# 開發紀錄

## 城市級地圖改版
- 移除依賴 CDN 載入的 Leaflet 核心，改用原生 JavaScript 實作 Web Mercator 瓦片定位、平移、縮放與標記定位。
- 底圖優先使用 CARTO Positron，並提供 OpenStreetMap 標準圖磚備援。
- 增加 Nominatim 使用者主動搜尋城市、車站、地標功能。
- 城市道路及 POI 名稱由線上底圖瓦片提供，故需要網路；不是離線內嵌資料。
- 不預先大量下載或快取地圖瓦片；搜尋僅在使用者送出時呼叫，並限制短時間重複請求。

## 已知限制
- 若網路環境封鎖 CARTO、OpenStreetMap 或 Nominatim，底圖或搜尋仍可能無法使用；畫面會提供狀態提示。
- OpenStreetMap 標準圖磚有使用政策與流量限制，不可大量抓取或用於離線批次下載。
- Nominatim 公共服務不適合高流量商業用途，正式公開部署應評估託管地理編碼服務。
