// ─────────────────────────────────────────────────────────────────
//  WasteWatch — js/common.js
//  Core Shared Utilities & Global UI Config
// ─────────────────────────────────────────────────────────────────

const API =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : window.location.origin + "/api";

console.log("WasteWatch API initialized at:", API);

// ── Token helpers ────────────────────────────────────────────────
const getToken = () => localStorage.getItem("ww_token");
const setToken = (t) => localStorage.setItem("ww_token", t);
const clearToken = () => localStorage.removeItem("ww_token");

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("ww_user") || "null"); }
  catch { return null; }
};

window.openDirections = function(lat, lng, locationName) {
  const map = window.adminDetailMapInstance || window.workerDetailMapInstance;
  window.openDirectionsOnMap(map, lat, lng, locationName);
};
const setUser = (u) => localStorage.setItem("ww_user", JSON.stringify({ email: u.email, role: u.role || "user" }));
const clearUser = () => localStorage.removeItem("ww_user");
const getRole = () => getUser()?.role || "user";

function statusClass(s) { return (s || "pending").toLowerCase().replace(/\s+/g, "-"); }
function statusSlug(s) { return (s || "pending").toLowerCase().replace(/\s+/g, "-"); }
function statusSlugAdmin(s) {
  if (s === "Awaiting Verification") return "awaiting-verification";
  if (s === "Verified") return "verified";
  if (s === "Disputed") return "disputed";
  return (s || "pending").toLowerCase().replace(/\s+/g, "-");
}

function logout(redirectTo = "login.html") {
  clearToken();
  clearUser();
  window.location.href = redirectTo;
}

async function fetchCurrentUser() {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${API}/me`, {
    headers: { Authorization: "Bearer " + token },
  });
  if (!res.ok) {
    if (res.status === 401) logout();
    return null;
  }

  const user = await res.json();
  setUser({ email: user.email, role: user.role });
  return user;
}

// ── Navbar rendering ──────────────────────────────────────────────
function applyNavVisibility(userObj) {
  const role = userObj?.role || null;
  const isLoggedIn = Boolean(userObj && getToken());

  document.querySelectorAll('.nav-links a[href="admin.html"]').forEach((el) => {
    const show = role === "admin";
    el.parentElement.style.display = show ? "block" : "none";
    el.classList.toggle("show-nav", show);
  });

  document.querySelectorAll('.nav-links a[href="worker.html"]').forEach((el) => {
    const show = role === "worker";
    el.parentElement.style.display = show ? "block" : "none";
    el.classList.toggle("show-nav", show);
  });

  document.querySelectorAll('.nav-links a[href="profile.html"]').forEach((el) => {
    const show = isLoggedIn;
    el.parentElement.style.display = show ? "block" : "none";
    el.classList.toggle("show-nav", show);
  });

  document.querySelectorAll('.nav-links a[href="report.html"]').forEach((el) => {
    const show = role !== "worker";
    el.parentElement.style.display = show ? "block" : "none";
    el.classList.toggle("show-nav", show);
  });

  document.querySelectorAll(".nav-login-link").forEach((el) => {
    if (isLoggedIn) {
      el.style.display = "none";
    } else {
      el.style.display = "";
      el.textContent = "Login";
      el.href = "login.html";
      el.onclick = null;
    }
  });

  renderMobileHamburgerNav(role, isLoggedIn);
}

async function updateNav() {
  let user = getUser();
  applyNavVisibility(user);

  if (getToken()) {
    try {
      user = await fetchCurrentUser();
      applyNavVisibility(user);
    } catch {
      // Offline fallback
    }
  }
}

function renderMobileHamburgerNav(role = null, isLoggedIn = Boolean(getUser() && getToken())) {
  document.querySelector(".mobile-hamburger-nav")?.remove();
  document.querySelector(".ww-drawer-backdrop")?.remove();
  document.querySelector(".ww-drawer")?.remove();

  const current = window.location.pathname.split("/").pop() || "index.html";

  const items = [
    { href: "index.html",       icon: "home",        label: "Home" },
    { href: "city-status.html", icon: "building-2",  label: "City Status" },
  ];
  if (role === "worker") {
    items.push({ href: "worker.html", icon: "hard-hat", label: "My Work" });
    if (isLoggedIn) items.push({ href: "profile.html", icon: "user-circle", label: "Profile" });
  } else {
    items.push({ href: "report.html", icon: "trash-2", label: "Report" });
    if (isLoggedIn) items.push({ href: "profile.html", icon: "user-circle", label: "Profile" });
    if (role === "admin") items.push({ href: "admin.html", icon: "shield", label: "Admin" });
  }

  const topBar = document.createElement("nav");
  topBar.className = "mobile-hamburger-nav";
  topBar.setAttribute("aria-label", "Mobile top bar");
  topBar.innerHTML = `
    <a href="index.html" class="nav-logo" style="text-decoration:none;">
      <div class="logo-icon" style="width:32px;height:32px;flex:0 0 32px;">
        <i data-lucide="recycle"></i>
      </div>
      <span style="font-family:'Poppins',sans-serif;font-weight:800;font-size:1.1rem;color:var(--green-dark);letter-spacing:-0.5px;">WasteWatch</span>
    </a>
    <button class="hamburger-btn" id="ww-hamburger-btn" aria-label="Open menu">
      <i data-lucide="menu" style="width:22px;height:22px;"></i>
    </button>
  `;

  const backdrop = document.createElement("div");
  backdrop.className = "ww-drawer-backdrop";

  const drawer = document.createElement("div");
  drawer.className = "ww-drawer";
  drawer.innerHTML = `
    <div class="ww-drawer-top">
      <a href="index.html" class="nav-logo" style="text-decoration:none;">
        <div class="logo-icon" style="width:30px;height:30px;flex:0 0 30px;">
          <i data-lucide="recycle"></i>
        </div>
        <span style="font-family:'Poppins',sans-serif;font-weight:800;font-size:1rem;color:var(--green-dark);">WasteWatch</span>
      </a>
      <button class="hamburger-btn" id="ww-drawer-close" aria-label="Close menu">
        <i data-lucide="x" style="width:22px;height:22px;"></i>
      </button>
    </div>
    <div class="ww-drawer-links">
      ${items.map(item => `
        <a href="${item.href}" class="ww-drawer-link ${current === item.href ? "active" : ""}">
          <i data-lucide="${item.icon}" style="width:18px;height:18px;flex-shrink:0;"></i>
          ${item.label}
        </a>
      `).join("")}
    </div>
    <div class="ww-drawer-bottom">
      ${isLoggedIn
        ? `<button id="ww-drawer-logout" class="btn btn-outline" style="width:100%;justify-content:center;gap:8px;color:var(--danger);border-color:var(--danger);">
             <i data-lucide="log-out" style="width:16px;height:16px;"></i>
             Log Out
           </button>`
        : `<a href="login.html" class="btn btn-primary" style="width:100%;justify-content:center;gap:8px;">
             <i data-lucide="log-in" style="width:16px;height:16px;"></i>
             Login
           </a>`
      }
    </div>
  `;

  document.body.prepend(backdrop);
  document.body.prepend(drawer);
  document.body.prepend(topBar);

  if (window.lucide) window.lucide.createIcons();

  function openDrawer()  { drawer.classList.add("open"); backdrop.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeDrawer() { drawer.classList.remove("open"); backdrop.classList.remove("open"); document.body.style.overflow = ""; }

  document.getElementById("ww-hamburger-btn")?.addEventListener("click", openDrawer);
  document.getElementById("ww-drawer-close")?.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", closeDrawer));

  document.getElementById("ww-drawer-logout")?.addEventListener("click", () => {
    closeDrawer();
    logout();
  });
}

// ── Toast Alert Helper ─────────────────────────────────────────────
function showToast(msg, type = "success") {
  let t = document.getElementById("ww-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "ww-toast";
    t.style.cssText = `position:fixed;bottom:2rem;right:2rem;z-index:9999;
      padding:13px 22px;border-radius:12px;font-family:'Poppins',sans-serif;
      font-size:0.92rem;font-weight:500;box-shadow:0 8px 32px rgba(0,0,0,0.18);
      transform:translateY(100px);opacity:0;transition:all 0.3s;`;
    document.body.appendChild(t);
  }
  t.style.background = type === "error" ? "#e05252" : "#1a5c33";
  t.style.color = "#fff";
  t.textContent = msg;
  requestAnimationFrame(() => { t.style.transform = "translateY(0)"; t.style.opacity = "1"; });
  setTimeout(() => { t.style.transform = "translateY(100px)"; t.style.opacity = "0"; }, 3500);
}

// ── Date Formatting Utilities ──────────────────────────────────────
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = Math.floor(seconds / 31536000);
  if (interval >= 1) return interval + "y ago";
  interval = Math.floor(seconds / 2592000);
  if (interval >= 1) return interval + "mo ago";
  interval = Math.floor(seconds / 86400);
  if (interval >= 1) return interval + "d ago";
  interval = Math.floor(seconds / 3600);
  if (interval >= 1) return interval + "h ago";
  interval = Math.floor(seconds / 60);
  if (interval >= 1) return interval + "m ago";
  return seconds < 10 ? "just now" : Math.floor(seconds) + "s ago";
}

// ── Cloudinary Dynamic Thumbnail Generator ─────────────────────────
function getThumbnailUrl(originalUrl, width = 300, height = 300) {
  if (!originalUrl) return "";
  if (originalUrl.includes("res.cloudinary.com")) {
    return originalUrl.replace("/upload/", `/upload/w_${width},h_${height},c_fill,q_auto,f_auto/`);
  }
  return originalUrl;
}

// ── Client-Side WebP Canvas Image Resizing ─────────────────────────
function compressImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxWidth) { h = Math.round((h * maxWidth) / w); w = maxWidth; }
        } else {
          if (h > maxWidth) { w = Math.round((w * maxWidth) / h); h = maxWidth; }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        }, "image/webp", quality);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

// ── UI Form Helper Utilities ───────────────────────────────────────
function showErr(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "block";
}
function hideErr(elId) {
  const el = document.getElementById(elId);
  if (el) el.style.display = "none";
}
function setBtn(btn, text, disabled) {
  if (!btn) return;
  btn.textContent = text;
  btn.disabled = disabled;
}

// ── OpenStreetMap / OSRM Directions (No Google Maps) ─────────────────
// Works inside any open detail popup (admin OR worker) by drawing
// the route directly on the mini Leaflet map inside the slide-up panel.
window.activeRouteLayer = null;
window.activeRouteMarkers = [];

window.openDirectionsOnMap = function(map, lat, lng, locationName) {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) {
    showToast("Exact coordinates not available for routing.", "error");
    return;
  }
  lat = Number(lat); lng = Number(lng);

  if (!map) {
    showToast("Map not initialised yet. Please wait a moment.", "error");
    return;
  }

  // Expand the map container for better route visibility
  const mapContainer = map.getContainer();
  if (mapContainer && mapContainer.style) {
    mapContainer.style.height = '340px';
    map.invalidateSize();
  }

  if (!navigator.geolocation) {
    showToast("Geolocation not supported by your browser.", "error");
    return;
  }

  showToast("📍 Getting your location…");

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${lng},${lat}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes.length) throw new Error("No route");

      const routeCoords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
      const distKm = (data.routes[0].distance / 1000).toFixed(1);
      const durMin = Math.round(data.routes[0].duration / 60);

      // Remove previous route if any
      if (window.activeRouteLayer) {
        try { map.removeLayer(window.activeRouteLayer); } catch(e) {}
      }
      if (window.activeRouteMarkers?.length) {
        window.activeRouteMarkers.forEach((marker) => {
          try { map.removeLayer(marker); } catch (e) {}
        });
      }
      window.activeRouteMarkers = [];

      // Draw the route polyline
      window.activeRouteLayer = L.polyline(routeCoords, {
        color: '#3558b0', weight: 5, opacity: 0.85,
        dashArray: null,
      }).addTo(map);

      // User location marker
      const userMarker = L.marker([userLat, userLng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;background:#3558b0;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(53,88,176,0.5)"></div>`,
          iconSize: [14,14], iconAnchor: [7,7]
        })
      }).addTo(map).bindPopup("<b>Your Location</b>").openPopup();
      window.activeRouteMarkers.push(userMarker);

      // Fit the route in view
      map.fitBounds(window.activeRouteLayer.getBounds(), { padding: [24, 24] });
      showToast(`Route drawn: ${distKm} km, about ${durMin} min`);
    } catch (err) {
      console.error(err);
      showToast("Could not fetch route. Check connection.", "error");
    }
  }, (err) => {
    showToast("Location permission denied.", "error");
  }, { timeout: 8000 });
};

// ── Global Initializations ─────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  updateNav();

  // Index Page Stats
  if (document.getElementById("stat-reports")) {
    fetch(`${API}/complaints/all`)
      .then((r) => r.json())
      .then((all) => {
        document.getElementById("stat-reports").textContent = all.length || 0;
        document.getElementById("stat-resolved").textContent = all.filter((c) => c.status === "Verified" || c.status === "Resolved").length;
      })
      .catch(() => {
        document.getElementById("stat-reports").textContent = "—";
        document.getElementById("stat-resolved").textContent = "—";
      });
  }
});
