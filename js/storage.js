/* Travel Map storage module
 * 負責讀取、儲存、匯入與匯出旅遊地點資料。
 * 資料目前保存在使用者瀏覽器的 LocalStorage。
 */
(function () {
  "use strict";
  const KEY = "travelMap.destinations.v1";

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      // Remove only the built-in demo record; preserve all user-created destinations.
      const cleaned = parsed.filter(item => item && item.id !== "sample-tokyo-sensoji");
      if (cleaned.length !== parsed.length) localStorage.setItem(KEY, JSON.stringify(cleaned));
      return cleaned;
    } catch (error) {
      console.error("讀取旅遊資料失敗：", error);
      return [];
    }
  }

  function save(items) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
      return true;
    } catch (error) {
      console.error("儲存旅遊資料失敗：", error);
      return false;
    }
  }

  function exportData(items) {
    const blob = new Blob([JSON.stringify({
      app: "Travel Map", version: 1, exportedAt: new Date().toISOString(), destinations: items
    }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "travel-map-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function importData(file) {
    return file.text().then(text => {
      const parsed = JSON.parse(text);
      const items = Array.isArray(parsed) ? parsed : parsed.destinations;
      if (!Array.isArray(items)) throw new Error("備份檔格式不正確");
      items.forEach(item => {
        if (!item.id || !item.name || !Number.isFinite(Number(item.lat)) || !Number.isFinite(Number(item.lng))) {
          throw new Error("備份檔含有不完整的地點資料");
        }
      });
      return items;
    });
  }

  window.TravelStorage = { load, save, exportData, importData };
})();
