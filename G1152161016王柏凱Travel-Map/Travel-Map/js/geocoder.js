/* Search-first geocoding: never guess coordinates or silently pick the first match. */
(function () {
  "use strict";
  const input = document.getElementById("map-search-input");
  const button = document.getElementById("map-search-button");
  const results = document.getElementById("map-search-results");
  const status = document.getElementById("map-service-status");
  if (!input || !button || !results) return;

  let lastRequestAt = 0;
  let currentResults = [];
  let pendingEditId = null;

  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));

  function addressParts(item) {
    const a = item.address || {};
    return {
      country: a.country || a.state || "",
      city: a.city || a.town || a.village || a.municipality || a.county || "",
      name: item.name || (item.display_name || "").split(",")[0] || ""
    };
  }

  function fitResult(item) {
    const lat = Number(item.lat), lng = Number(item.lon);
    const box = Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : null;
    const type = String(item.type || "").toLowerCase();
    const addressType = String(item.addresstype || "").toLowerCase();
    const isPlaceFeature = ["city", "town", "village", "hamlet", "administrative", "country", "state", "county"].includes(type)
      || ["country", "state", "province", "region", "county", "city", "town", "village"].includes(addressType);
    if (box && box.length === 4 && isPlaceFeature) {
      window.TravelMap.focusBounds(box[0], box[1], box[2], box[3]);
    } else {
      window.TravelMap.focusCoords(lat, lng, type === "country" ? 5 : 17);
    }
  }

  async function search(query = input.value, editId = null) {
    const q = String(query || "").trim();
    if (!q) {
      status.textContent = "請輸入國家、城市或明確景點名稱";
      input.focus();
      return;
    }
    const now = Date.now();
    if (now - lastRequestAt < 1100) {
      status.textContent = "搜尋太頻繁，請稍候再試";
      return;
    }
    lastRequestAt = now;
    pendingEditId = editId;
    button.disabled = true;
    button.textContent = "搜尋中…";
    results.hidden = false;
    results.innerHTML = '<div class="map-search-empty">正在查詢地名與地理座標…</div>';
    try {
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&limit=8&accept-language=zh-TW,en&q=" + encodeURIComponent(q);
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("搜尋服務暫時無法使用");
      const data = await response.json();
      currentResults = data.filter(d => Number.isFinite(Number(d.lat)) && Number.isFinite(Number(d.lon)));
      if (!currentResults.length) {
        results.innerHTML = '<div class="map-search-empty">找不到符合的地點。請補上城市與國家，例如「雷門 淺草 東京 日本」。</div>';
        status.textContent = "沒有找到可用的地理座標";
        return;
      }
      results.innerHTML = currentResults.map((d, i) => {
        const parts = addressParts(d);
        const kind = [d.type, d.class].filter(Boolean).join(" · ");
        return `<button type="button" data-index="${i}">
          <strong>${esc(parts.name)}</strong>
          <small>${esc(d.display_name || "")}</small>
          <small>座標 ${Number(d.lat).toFixed(5)}, ${Number(d.lon).toFixed(5)}${kind ? " · " + esc(kind) : ""}</small>
          <span class="map-result-action">選擇此地點並帶入正確座標</span>
        </button>`;
      }).join("");
      status.textContent = `找到 ${currentResults.length} 筆結果，請核對國家及城市後選擇`;
    } catch (error) {
      currentResults = [];
      results.innerHTML = '<div class="map-search-empty">搜尋服務目前無法連線。請確認網路後再試；未取得座標前不會自動新增地點。</div>';
      status.textContent = "地理搜尋暫時無法連線";
    } finally {
      button.disabled = false;
      button.textContent = "搜尋地點";
    }
  }

  results.addEventListener("click", event => {
    const choice = event.target.closest("button[data-index]");
    if (!choice) return;
    const item = currentResults[Number(choice.dataset.index)];
    if (!item) return;
    const lat = Number(item.lat), lng = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      status.textContent = "這筆搜尋結果沒有有效座標，請改選其他結果";
      return;
    }
    fitResult(item);
    const parts = addressParts(item);
    results.hidden = true;
    status.textContent = `已選擇：${item.display_name}｜座標已帶入表單`;
    window.dispatchEvent(new CustomEvent("travelmap:place-selected", {
      detail: {
        id: pendingEditId,
        name: parts.name,
        country: parts.country,
        city: parts.city,
        displayName: item.display_name || "",
        lat, lng,
        source: "geocoder",
        osmType: item.osm_type || "",
        osmId: item.osm_id || null,
        category: item.category || item.class || "",
        type: item.type || ""
      }
    }));
    pendingEditId = null;
  });

  button.addEventListener("click", () => search());
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); search(); }
    if (event.key === "Escape") results.hidden = true;
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".map-searchbar")) results.hidden = true;
  });

  window.TravelGeocoder = { search };
})();
