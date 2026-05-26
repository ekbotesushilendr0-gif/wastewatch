// ─────────────────────────────────────────────────────────────────
//  WasteWatch — js/city-status.js
//  Public City Status & Map Logic
// ─────────────────────────────────────────────────────────────────

if (document.getElementById("citySummaryCards")) {
  // Fetch overall complaints data for stats and recent list
  fetch(`${API}/complaints/all`)
    .then((r) => r.json())
    .then((raw) => {
      const all = raw.filter(c => c.status !== "Verified");
      const pending = all.filter((c) => c.status === "Pending").length;
      const inProg = all.filter((c) => c.status === "In Progress").length;
      const resolved = raw.filter((c) => c.status === "Verified").length;

      const summaryEl = document.getElementById("citySummaryCards");
      if (summaryEl) {
        summaryEl.innerHTML = `
          <div class="admin-card"><span>Total Reports</span><strong>${all.length}</strong></div>
          <div class="admin-card pending"><span>Pending</span><strong>${pending}</strong></div>
          <div class="admin-card"><span>In Progress</span><strong style="color:#3558b0">${inProg}</strong></div>
          <div class="admin-card resolved"><span>Resolved</span><strong>${resolved}</strong></div>`;
      }

      const areaMap = {};
      raw.forEach((c) => {
        const area = (c.location || "Unknown").split(",")[0].trim();
        if (!areaMap[area]) areaMap[area] = { total: 0, resolved: 0 };
        areaMap[area].total++;
        if (c.status === "Verified") areaMap[area].resolved++;
      });

      const areaEl = document.getElementById("areaWiseList");
      if (areaEl) {
        const areas = Object.entries(areaMap).sort((a, b) => b[1].total - a[1].total);
        areaEl.innerHTML = areas.slice(0, 8).map(([name, d]) => `
          <div class="area-row">
            <span style="display:flex;align-items:center;gap:0.3rem;"><i data-lucide="map-pin" style="width:16px;height:16px;color:var(--primary);"></i> ${name}</span>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <strong>${d.total} report${d.total !== 1 ? "s" : ""}</strong>
              <span class="status-pill" style="background:rgba(45,138,78,0.1);color:var(--green-dark);font-size:0.75rem">${d.resolved} resolved</span>
            </div>
          </div>`).join("") || `<p class="city-empty">No area data yet.</p>`;
      }

      const recentEl = document.getElementById("recentComplaintsList");
      if (recentEl) {
        recentEl.innerHTML = all.slice(0, 6).map((c) => `
          <div class="recent-item">
            <div>
              <strong style="display:flex;align-items:center;gap:0.3rem;"><i data-lucide="map-pin" style="width:16px;height:16px;color:var(--primary);"></i> ${c.location}</strong>
              <p>${(c.description || "").slice(0, 80)}${(c.description || "").length > 80 ? "…" : ""}</p>
              <small>${new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</small>
            </div>
            <span class="status-badge status-${statusClass(c.status)}">${c.status}</span>
          </div>`).join("") || `<p class="city-empty">No recent complaints.</p>`;
      }

      if (window.lucide) window.lucide.createIcons();
    })
    .catch(() => showToast("Could not load city data.", "error"));

  // Fetch lightweight map data for Leaflet Map
  if (window.L && document.getElementById("cityStatusMap")) {
    fetch(`${API}/complaints/map`)
      .then((r) => r.json())
      .then((markers) => {
        initLeafletMap("cityStatusMap", markers);
      })
      .catch(() => showToast("Could not load map markers.", "error"));
  }
}

function getComplaintCoords(complaint, cache) {
  const lat = Number(complaint.lat);
  const lng = Number(complaint.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return Promise.resolve([lat, lng]);
  return geocodeLocation(complaint.location, cache);
}

function geocodeLocation(locationStr, cache) {
  if (cache && cache[locationStr]) return Promise.resolve(cache[locationStr]);
  const viewbox = "74.98,15.28,75.27,15.46";
  return fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationStr + ", Hubli-Dharwad, Karnataka")}&limit=1&viewbox=${viewbox}&bounded=0`,
    { headers: { "Accept-Language": "en" } }
  )
    .then((r) => r.json())
    .then((results) => {
      if (results && results[0]) {
        const coords = [parseFloat(results[0].lat), parseFloat(results[0].lon)];
        if (cache) cache[locationStr] = coords;
        return coords;
      }
      return null;
    })
    .catch(() => null);
}

function initLeafletMap(containerId, complaints) {
  if (!window.L || !document.getElementById(containerId)) return;
  const HDMC_CENTER = [15.3647, 75.1240];
  const HDMC_BOUNDS = L.latLngBounds([15.28, 74.98], [15.46, 75.27]);
  const map = L.map(containerId, {
    minZoom: 11,
    maxZoom: 18,
    maxBounds: HDMC_BOUNDS,
    maxBoundsViscosity: 1.0,
  }).setView(HDMC_CENTER, 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
  if (!complaints.length) return map;
  const cache = {};
  const bounds = [];
  const promises = complaints.map((c) =>
    getComplaintCoords(c, cache).then((coords) => {
      if (!coords) return;
      bounds.push(coords);
      const color = 
        c.status === "Verified" ? "#2d8a4e" : 
        c.status === "In Progress" ? "#3558b0" : 
        c.status === "Awaiting Verification" ? "#f5a623" : 
        c.status === "Disputed" ? "#e05252" : 
        "#e05252";

      const marker = L.marker(coords, {
        icon: L.divIcon({ className: "", html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })
      }).addTo(map);

      // Show temporary loading popup
      const popup = L.popup({ minWidth: 180 }).setContent(`<div style="font-family:'Poppins',sans-serif;font-size:0.82rem;color:var(--text-muted);"><p>Loading details...</p></div>`);
      marker.bindPopup(popup);

      // On-demand fetch detailed description & info on click
      marker.on("click", async () => {
        try {
          const res = await fetch(`${API}/complaints/${c._id}`);
          if (!res.ok) throw new Error("Failed to fetch");
          const detailed = await res.json();
          // Use Cloudinary thumbnail in popup
          const thumb = detailed.imagePath ? getThumbnailUrl(detailed.imagePath, 200, 120) : '';
          popup.setContent(`
            <div style="min-width:180px;font-family:'Poppins',sans-serif">
              ${thumb ? `<img src="${thumb}" style="width:100%;height:100px;object-fit:cover;border-radius:8px;margin-bottom:6px;border:1px solid var(--border);">` : ''}
              <b>${detailed.location}</b><br>
              <span style="font-size:0.8rem;color:#5a7060">${detailed.category || ""}</span><br>
              <span style="color:${color};font-weight:700">${detailed.status}</span>
              ${detailed.description ? `<p style="font-size:0.82rem;margin-top:4px;color:#5a7060;margin-bottom:0;line-height:1.45;">"${detailed.description}"</p>` : ''}
            </div>
          `);
          popup.update();
        } catch {
          popup.setContent(`<div style="color:var(--danger);font-size:0.82rem;">Failed to load details.</div>`);
          popup.update();
        }
      });
    }));

  Promise.all(promises).then(() => {
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    else if (bounds.length === 1) map.setView(bounds[0], 14);
  });
  return map;
}

// openDirections is now defined globally in common.js

