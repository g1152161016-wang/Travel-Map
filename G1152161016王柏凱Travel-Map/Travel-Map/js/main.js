/* Travel Map application controller */
(function () {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const form = $("#destination-form");
  let destinations = TravelStorage.load().map(item => ({
    ...item,
    locationSource: item.locationSource || "legacy-unverified",
    locationVerified: item.locationVerified === true
  }));
  let toastTimer;
  let locationSource = "unverified";
  let modalSession = 0;

  const labels = { visited: "去過", wishlist: "想去", planning: "計畫中" };

  function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function notify(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
  }

  function persist(message) {
    const ok = TravelStorage.save(destinations);
    if (ok) {
      TravelMap.render(destinations);
      renderCards();
      if (message) notify(message);
    } else {
      notify("儲存失敗，請匯出備份並檢查瀏覽器儲存空間。");
    }
  }

  function renderStats() {
    const visited = destinations.filter(d => d.status === "visited");
    const countries = [...new Set(visited.map(d => (d.country || "").trim()).filter(Boolean))];
    $("#visited-count").textContent = visited.length;
    $("#wishlist-count").textContent = destinations.filter(d => d.status === "wishlist").length;
    $("#planning-count").textContent = destinations.filter(d => d.status === "planning").length;
    $("#country-count").textContent = countries.length;
  }

  function renderShowcase() {
    const visited = destinations.filter(d => d.status === "visited");
    const countryCounts = new Map();
    visited.forEach(d => {
      const country = (d.country || "").trim();
      if (country) countryCounts.set(country, (countryCounts.get(country) || 0) + 1);
    });
    const countries = [...countryCounts.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0], "zh-Hant"));
    $("#country-summary-count").textContent = countries.length;
    $("#country-list").innerHTML = countries.length
      ? countries.map(([country,count]) => `<button class="country-chip" type="button" data-country="${safe(country)}">${safe(country)}<b>${count}</b></button>`).join("")
      : '<p class="showcase-empty">新增「去過」的地點後，這裡會整理你的造訪國家。</p>';

    const dated = destinations.filter(d => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)).sort((a,b) => b.date.localeCompare(a.date));
    $("#travel-timeline").innerHTML = dated.length
      ? dated.map(d => `<div class="timeline-item"><time class="timeline-date">${safe(d.date)}</time><button class="timeline-open" type="button" data-timeline-id="${safe(d.id)}"><span class="timeline-main"><strong>${safe(d.name)}</strong><span>${safe([d.city,d.country].filter(Boolean).join(" · ") || "旅程紀錄")} · ${safe(labels[d.status] || "想去")}</span></span></button></div>`).join("")
      : '<p class="showcase-empty">替旅程填上日期，就能在這裡留下時間記錄。</p>';

    const photos = destinations.filter(d => d.image && /^https?:\/\//i.test(d.image));
    $("#photo-count").textContent = `${photos.length} ${photos.length === 1 ? "PHOTO" : "PHOTOS"}`;
    $("#photo-wall").innerHTML = photos.length
      ? photos.slice(0,8).map(d => `<button class="photo-tile" type="button" data-photo-id="${safe(d.id)}" aria-label="查看${safe(d.name)}照片"><img src="${safe(d.image)}" alt="${safe(d.name)}" loading="lazy"><span class="photo-tile-caption"><strong>${safe(d.name)}</strong><span>${safe([d.city,d.country].filter(Boolean).join(" · "))}</span></span></button>`).join("")
      : '<div class="photo-empty"><span>▧</span><strong>你的旅行明信片，從第一張照片開始</strong><p>編輯任一地點，加入照片網址，就會自動收錄在這裡。</p></div>';
  }

  function renderCards() {
    const query = $("#search-input").value.trim().toLowerCase();
    const filter = $("#status-filter").value;
    const filtered = destinations.filter(d => {
      const matchesStatus = filter === "all" || d.status === filter;
      const haystack = [d.name, d.country, d.city, d.description].join(" ").toLowerCase();
      return matchesStatus && haystack.includes(query);
    });
    const grid = $("#destination-grid");
    grid.innerHTML = filtered.map(d => {
      const image = d.image
        ? `<img src="${safe(d.image)}" alt="${safe(d.name)}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=&quot;image-placeholder&quot;>✧</div>'">`
        : `<div class="image-placeholder">✧</div>`;
      return `<article class="destination-card">
        <div class="card-image">${image}<span class="status-pill ${safe(d.status)}">${labels[d.status] || "想去"}</span></div>
        <div class="card-body">
          <div class="card-location">⌖ ${safe([d.city, d.country].filter(Boolean).join(" · "))}</div>
          <h3 class="card-title">${safe(d.name)}</h3>
          <p class="card-description">${safe(d.description || "把這個地方加入旅程收藏，留給未來的自己。")}</p>
          <p class="location-check ${d.locationVerified ? "is-verified" : "needs-check"}">${d.locationVerified ? "✓ 座標來源已確認" : "⚠ 舊紀錄座標尚未驗證，建議校正位置"}</p>
          <div class="card-footer"><span class="card-date">${d.date ? safe(d.date) : "等待探索的日子"}</span>
            <div class="card-actions"><button data-action="locate" data-id="${safe(d.id)}">地圖定位</button><button data-action="correct" data-id="${safe(d.id)}">校正位置</button><button data-action="edit" data-id="${safe(d.id)}">編輯</button><button data-action="delete" data-id="${safe(d.id)}">刪除</button></div>
          </div>
        </div></article>`;
    }).join("");
    $("#empty-state").classList.toggle("show", filtered.length === 0);
    grid.style.display = filtered.length ? "grid" : "none";
    renderStats();
    renderShowcase();
  }

  function openModal(coords, item, source = null) {
    modalSession += 1;
    const session = modalSession;
    form.reset();
    $("#destination-id").value = item?.id || "";
    $("#modal-title").textContent = item ? "編輯旅遊地點" : "新增旅遊地點";
    $("#name").value = item?.name || coords?.name || "";
    $("#country").value = item?.country || coords?.country || "";
    $("#city").value = item?.city || coords?.city || "";
    $("#description").value = item?.description || "";
    $("#lat").value = coords?.forceCoordinates ? coords.lat : (item?.lat ?? coords?.lat ?? "");
    $("#lng").value = coords?.forceCoordinates ? coords.lng : (item?.lng ?? coords?.lng ?? "");
    $("#status").value = item?.status || "wishlist";
    $("#date").value = item?.date || "";
    $("#image").value = item?.image || "";
    locationSource = source || item?.locationSource || coords?.source || "unverified";
    const sourceField = $("#location-source");
    if (sourceField) sourceField.value = locationSource;
    if ($("#location-display-name")) $("#location-display-name").value = coords?.displayName || item?.geocoderDisplayName || "";
    const verifyNote = $("#location-verification-note");
    if (verifyNote) verifyNote.textContent =
      locationSource === "geocoder" ? "✓ 已選擇地理搜尋結果，座標直接取自該地點。" :
      locationSource === "map-click" ? "✓ 座標取自你在地圖上點選的位置。" :
      locationSource === "manual" || locationSource === "unverified" ? "⚠ 這筆座標尚未由地點搜尋結果確認；建議先搜尋並選擇正確地點。" :
      "✓ 使用已保存的地點座標。";
    $("#destination-modal").classList.add("open");
    $("#destination-modal").setAttribute("aria-hidden", "false");
    setTimeout(() => $("#name").focus(), 50);
    return session;
  }

  async function reverseLookup(lat, lng, session) {
    const note = $("#location-verification-note");
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=zh-TW,en&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
      const response = await fetch(url, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("reverse lookup failed");
      const place = await response.json();
      if (session !== modalSession || !$("#destination-modal").classList.contains("open")) return;
      const a = place.address || {};
      if (!$("#name").value.trim()) $("#name").value = place.name || (place.display_name || "").split(",")[0] || "";
      if (!$("#country").value.trim()) $("#country").value = a.country || a.state || "";
      if (!$("#city").value.trim()) $("#city").value = a.city || a.town || a.village || a.municipality || a.county || "";
      if (note) note.textContent = place.display_name
        ? `✓ 地圖點選位置已反查：${place.display_name}`
        : "已取得點選座標；請自行確認地點名稱。";
    } catch (_) {
      if (session === modalSession && note) note.textContent = "已保存地圖點選座標；反查地址服務暫時無法連線，請手動填寫地名。";
    }
  }
  function closeModal() {
    $("#destination-modal").classList.remove("open");
    $("#destination-modal").setAttribute("aria-hidden", "true");
  }

  ["#name", "#country", "#city"].forEach(selector => {
    $(selector).addEventListener("input", () => {
      if (locationSource !== "geocoder") return;
      locationSource = "manual";
      if ($("#location-source")) $("#location-source").value = "manual";
      const note = $("#location-verification-note");
      if (note) note.textContent = "⚠ 你已修改搜尋結果的地點名稱或行政區，請重新搜尋核對位置，或確認後手動儲存。";
    });
  });

  ["#lat", "#lng"].forEach(selector => {
    $(selector).addEventListener("input", () => {
      locationSource = "manual";
      if ($("#location-source")) $("#location-source").value = "manual";
      const note = $("#location-verification-note");
      if (note) note.textContent = "⚠ 你已手動修改座標，搜尋驗證狀態已取消；請重新搜尋選擇地點，或確認後手動儲存。";
    });
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    const id = $("#destination-id").value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
    const item = {
      id, name: $("#name").value.trim(), country: $("#country").value.trim(),
      city: $("#city").value.trim(), description: $("#description").value.trim(),
      lat: Number($("#lat").value), lng: Number($("#lng").value),
      status: $("#status").value, date: $("#date").value, image: $("#image").value.trim(),
      locationSource: locationSource,
      locationVerified: ["geocoder", "map-click", "dragged"].includes(locationSource),
      geocoderDisplayName: $("#location-display-name")?.value || ""
    };
    if (!item.name || !item.country || !Number.isFinite(item.lat) || !Number.isFinite(item.lng) ||
        item.lat < -90 || item.lat > 90 || item.lng < -180 || item.lng > 180) {
      notify("請確認必填欄位及經緯度範圍。");
      return;
    }
    if (!item.locationVerified && !confirm("這筆座標尚未經地點搜尋或地圖點選確認。仍要以手動座標儲存嗎？\n建議先使用上方地點搜尋，選擇正確的國家、城市與景點。")) return;
    const index = destinations.findIndex(d => d.id === id);
    if (index >= 0) destinations[index] = item;
    else destinations.unshift(item);
    closeModal();
    persist(index >= 0 ? "地點已更新並自動儲存！" : "新地點已加入旅程收藏！");
  });

  $("#destination-grid").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const item = destinations.find(d => d.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === "locate") {
      $("#map-section").scrollIntoView({ behavior: "smooth" });
      setTimeout(() => TravelMap.focus(item.id), 350);
    } else if (button.dataset.action === "edit") {
      openModal(null, item);
    } else if (button.dataset.action === "correct") {
      $("#map-section").scrollIntoView({ behavior: "smooth" });
      const query = [item.name, item.city, item.country].filter(Boolean).join(" ");
      $("#map-search-input").value = query;
      setTimeout(() => window.TravelGeocoder?.search(query, item.id), 350);
      notify("請從搜尋結果選擇正確的地點，確認後會更新這筆紀錄座標。");
    } else if (button.dataset.action === "delete") {
      if (confirm(`確定要刪除「${item.name}」嗎？`)) {
        destinations = destinations.filter(d => d.id !== item.id);
        persist("地點已刪除。");
      }
    }
  });

  $("#country-list").addEventListener("click", event => {
    const chip = event.target.closest("button[data-country]");
    if (!chip) return;
    $("#search-input").value = chip.dataset.country;
    $("#status-filter").value = "visited";
    renderCards();
    $("#collection").scrollIntoView({ behavior: "smooth" });
  });
  $("#travel-timeline").addEventListener("click", event => {
    const button = event.target.closest("button[data-timeline-id]");
    if (!button) return;
    const item = destinations.find(d => d.id === button.dataset.timelineId);
    if (item) { $("#map-section").scrollIntoView({ behavior: "smooth" }); setTimeout(() => TravelMap.focus(item.id), 350); }
  });
  $("#photo-wall").addEventListener("click", event => {
    const tile = event.target.closest("button[data-photo-id]");
    if (!tile) return;
    const item = destinations.find(d => d.id === tile.dataset.photoId);
    if (item) openModal(null, item);
  });

  $("#open-add").addEventListener("click", () => openModal());
  $("#empty-add").addEventListener("click", () => openModal());
  $("#close-modal").addEventListener("click", closeModal);
  $("#cancel-modal").addEventListener("click", closeModal);
  $("#destination-modal").addEventListener("click", e => { if (e.target === $("#destination-modal")) closeModal(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });
  $("#search-input").addEventListener("input", renderCards);
  $("#status-filter").addEventListener("change", renderCards);
  $("#reset-map").addEventListener("click", TravelMap.reset);

  $("#export-btn").addEventListener("click", () => {
    TravelStorage.exportData(destinations);
    notify("備份檔已下載。");
  });
  $("#import-btn").addEventListener("click", () => $("#import-file").click());
  $("#import-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imported = await TravelStorage.importData(file);
      if (confirm(`備份中有 ${imported.length} 個地點。匯入後會取代目前資料，確定繼續嗎？`)) {
        destinations = imported.map(d => ({ ...d, lat: Number(d.lat), lng: Number(d.lng) }));
        persist("備份匯入成功！");
      }
    } catch (error) {
      notify(error.message || "無法讀取備份檔。");
    } finally {
      event.target.value = "";
    }
  });

  TravelMap.init(
    (lat, lng) => {
      const session = openModal({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) }, null, "map-click");
      reverseLookup(lat, lng, session);
    },
    (id, lat, lng) => {
      const item = destinations.find(d => d.id === id);
      if (!item) return;
      item.lat = Number(lat.toFixed(6));
      item.lng = Number(lng.toFixed(6));
      item.locationSource = "dragged";
      item.locationVerified = true;
      persist("標記位置已更新並自動儲存！");
    }
  );

  window.addEventListener("travelmap:place-selected", event => {
    const place = event.detail || {};
    const lat = Number(place.lat), lng = Number(place.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      notify("搜尋結果座標無效，沒有更新任何資料。");
      return;
    }
    if (place.id) {
      const existing = destinations.find(d => d.id === place.id);
      if (!existing) return;
      const updated = {
        ...existing,
        lat: Number(lat.toFixed(7)),
        lng: Number(lng.toFixed(7)),
        locationSource: "geocoder",
        locationVerified: true,
        geocoderDisplayName: place.displayName || ""
      };
      openModal({ lat: updated.lat, lng: updated.lng, forceCoordinates: true }, updated, "geocoder");
      notify("已帶入搜尋結果座標；儲存後才會更新原紀錄。");
    } else {
      openModal({
        lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)),
        name: place.name, country: place.country, city: place.city,
        source: "geocoder"
      }, null, "geocoder");
      $("#location-display-name").value = place.displayName || "";
    }
  });
  TravelMap.render(destinations);
  renderCards();
})();
