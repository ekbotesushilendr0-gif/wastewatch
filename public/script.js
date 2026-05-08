// ─────────────────────────────────────────────────────────────────
//  WasteWatch — script.js
//  Pure real backend auth. No fake users. No localStorage tricks.
// ─────────────────────────────────────────────────────────────────

const API =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000/api"
    : window.location.origin + "/api";

console.log("WasteWatch API initialized at:", API);


// ── Token helpers (only the JWT lives in localStorage) ────────────
const getToken = () => localStorage.getItem("ww_token");
const setToken = (t) => localStorage.setItem("ww_token", t);
const clearToken = () => localStorage.removeItem("ww_token");

const getUser = () => {
  try { return JSON.parse(localStorage.getItem("ww_user") || "null"); }
  catch { return null; }
};
const setUser = (u) => localStorage.setItem("ww_user", JSON.stringify({ email: u.email, role: u.role || "user" }));
const clearUser = () => localStorage.removeItem("ww_user");
const getRole = () => getUser()?.role || "user";

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

// ── Navbar ────────────────────────────────────────────────────────
function applyNavVisibility(userObj) {
  const role = userObj?.role || null;
  const isLoggedIn = Boolean(userObj && getToken());

  document.querySelectorAll('.nav-links a[href="admin.html"]').forEach((el) => {
    const show = role === "admin";
    el.parentElement.style.display = show ? "block" : "none";
    el.classList.toggle("show-nav", show);
  });

  document.querySelectorAll('.nav-links a[href="profile.html"]').forEach((el) => {
    const show = isLoggedIn;
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
  // 1. Immediately apply cached UI state to prevent UI flashing
  let user = getUser();
  applyNavVisibility(user);

  // 2. Fetch fresh user data from server asynchronously
  if (getToken()) {
    try {
      user = await fetchCurrentUser();
      applyNavVisibility(user);
    } catch {
      // Keep localStorage state if network fails
    }
  }
}

function renderMobileHamburgerNav(role = null, isLoggedIn = Boolean(getUser() && getToken())) {
  // Remove any existing injected mobile nav
  document.querySelector(".mobile-hamburger-nav")?.remove();
  document.querySelector(".ww-drawer-backdrop")?.remove();
  document.querySelector(".ww-drawer")?.remove();

  const current = window.location.pathname.split("/").pop() || "index.html";

  const items = [
    { href: "index.html",       icon: "home",        label: "Home" },
    { href: "city-status.html", icon: "building-2",  label: "City Status" },
    { href: "report.html",      icon: "trash-2",     label: "Report" },
  ];
  if (isLoggedIn) items.push({ href: "profile.html", icon: "user-circle", label: "Profile" });
  if (role === "admin") items.push({ href: "admin.html", icon: "shield", label: "Admin" });

  // ── Top bar ────────────────────────────────────────────────
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

  // ── Backdrop ───────────────────────────────────────────────
  const backdrop = document.createElement("div");
  backdrop.className = "ww-drawer-backdrop";

  // ── Drawer ─────────────────────────────────────────────────
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

  // ── Inject into body ───────────────────────────────────────
  document.body.prepend(backdrop);
  document.body.prepend(drawer);
  document.body.prepend(topBar);

  if (window.lucide) window.lucide.createIcons();

  // ── Toggle logic ───────────────────────────────────────────
  function openDrawer()  { drawer.classList.add("open"); backdrop.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeDrawer() { drawer.classList.remove("open"); backdrop.classList.remove("open"); document.body.style.overflow = ""; }

  document.getElementById("ww-hamburger-btn")?.addEventListener("click", openDrawer);
  document.getElementById("ww-drawer-close")?.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);
  drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", closeDrawer));

  // Logout button (only rendered when logged in)
  document.getElementById("ww-drawer-logout")?.addEventListener("click", () => {
    closeDrawer();
    logout();
  });
}

renderMobileHamburgerNav();

// ── Toast ─────────────────────────────────────────────────────────
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

// ── Injected styles ───────────────────────────────────────────────
(function () {
  if (document.getElementById("ww-styles")) return;
  const s = document.createElement("style");
  s.id = "ww-styles";
  s.textContent = `
    .status-badge{display:inline-flex;align-items:center;padding:5px 12px;border-radius:8px;font-size:0.78rem;font-weight:700;white-space:nowrap;}
    .status-badge.status-pending{background:rgba(245,166,35,0.15);color:#9b6a00;}
    .status-badge.status-in-progress{background:rgba(53,88,176,0.13);color:#3558b0;}
    .status-badge.status-resolved{background:rgba(45,138,78,0.13);color:#1a5c33;}
    .otp-step{display:none;} .otp-step.active{display:block;}
    /* Prevent Nav Flashing */
    .nav-links a[href="admin.html"], .nav-links a[href="profile.html"] { display: none !important; }
    .nav-links a[href="admin.html"].show-nav, .nav-links a[href="profile.html"].show-nav { display: block !important; }
  `;
  document.head.appendChild(s);
})();

// Initialize Navigation Globally
updateNav();

function statusClass(s) { return (s || "pending").toLowerCase().replace(/\s+/g, "-"); }

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
function setBtn(btn, text, disabled) { btn.textContent = text; btn.disabled = disabled; }

// ─────────────────────────────────────────────────────────────────
//  INDEX PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("stat-reports")) {
  fetch(`${API}/complaints/all`)
    .then((r) => r.json())
    .then((all) => {
      document.getElementById("stat-reports").textContent = all.length || 0;
      document.getElementById("stat-resolved").textContent = all.filter((c) => c.status === "Resolved").length;
    })
    .catch(() => {
      document.getElementById("stat-reports").textContent = "—";
      document.getElementById("stat-resolved").textContent = "—";
    });
}

// ─────────────────────────────────────────────────────────────────
//  LOGIN PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("loginForm")) {
  if (getUser() && getToken()) window.location.href = "profile.html";

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;
    const btn = e.target.querySelector("button[type=submit]");
    hideErr("formError");
    setBtn(btn, "Signing in…", true);

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { showErr("formError", data.error || "Login failed."); setBtn(btn, "Sign In →", false); return; }
      setToken(data.token);
      setUser({ email: data.email, role: data.role });
      window.location.href = "profile.html";
    } catch (err) {
      console.error("Login Error:", err);
      showErr("formError", "Cannot reach server. Please check your connection.");
      setBtn(btn, "Sign In →", false);
    }
  });
}

// ─────────────────────────────────────────────────────────────────
//  REGISTER PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("registerForm")) {
  if (getUser() && getToken()) window.location.href = "profile.html";

  let pendingEmail = "";
  let pendingPassword = "";

  document.getElementById("registerForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("regEmail").value.trim().toLowerCase();
    const password = document.getElementById("regPassword").value;
    const confirm = document.getElementById("regConfirmPassword").value;
    const btn = e.target.querySelector("button[type=submit]");
    hideErr("formError");

    if (password !== confirm) { showErr("formError", "Passwords do not match."); return; }
    if (password.length < 6) { showErr("formError", "Password must be at least 6 characters."); return; }

    setBtn(btn, "Sending OTP…", true);
    try {
      const res = await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { showErr("formError", data.error || "Registration failed."); setBtn(btn, "Create Account →", false); return; }
      pendingEmail = email;
      pendingPassword = password;
      document.getElementById("otpEmailDisplay").textContent = email;
      document.getElementById("step-register").classList.remove("active");
      document.getElementById("step-otp").classList.add("active");
    } catch (err) {
      console.error("Register Error:", err);
      showErr("formError", "Cannot reach server. Please check your connection.");
      setBtn(btn, "Create Account →", false);
    }
  });

  document.getElementById("otpForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const otp = document.getElementById("otpInput").value.trim();
    const btn = e.target.querySelector("button[type=submit]");
    hideErr("otpError");
    setBtn(btn, "Verifying…", true);

    try {
      const res = await fetch(`${API}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, otp }),
      });
      const data = await res.json();
      if (!res.ok) { showErr("otpError", data.error || "Invalid OTP."); setBtn(btn, "Verify & Continue →", false); return; }
      setToken(data.token);
      setUser({ email: data.email, role: data.role });
      showToast("Email verified! Welcome to WasteWatch");
      setTimeout(() => (window.location.href = "profile.html"), 800);
    } catch {
      showErr("otpError", "Cannot reach server.");
      setBtn(btn, "Verify & Continue →", false);
    }
  });

  document.getElementById("resendOtpBtn").addEventListener("click", async () => {
    const btn = document.getElementById("resendOtpBtn");
    btn.textContent = "Sending…";
    btn.disabled = true;
    try {
      await fetch(`${API}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: pendingEmail, password: pendingPassword }),
      });
      showToast("OTP resent to " + pendingEmail);
    } catch {
      showToast("Failed to resend OTP.", "error");
    }
    setTimeout(() => { btn.textContent = "Resend OTP"; btn.disabled = false; }, 4000);
  });
}

// ─────────────────────────────────────────────────────────────────
//  REPORT PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("reportPage")) {
  const user = getUser();
  const formSection = document.getElementById("reportFormSection");
  const loginPrompt = document.getElementById("reportLoginPrompt");

  if (!user || !getToken()) {
    formSection.style.display = "none";
    loginPrompt.style.display = "flex";
  } else {
    formSection.style.display = "block";
    loginPrompt.style.display = "none";

    const imageInput = document.getElementById("imageInput");
    const imagePreview = document.getElementById("imagePreview");
    const uploadZone = document.getElementById("uploadZone");
    const locationInput = document.getElementById("location");
    const getLocationBtn = document.getElementById("getLocationBtn");
    const latInput = document.getElementById("lat");
    const lngInput = document.getElementById("lng");
    const selectMapEl = document.getElementById("selectMap");
    let selectMap = null;
    let selectedMarker = null;

    function setSelectedLocation(lat, lng, zoom = 16) {
      if (latInput) latInput.value = lat;
      if (lngInput) lngInput.value = lng;
      locationInput.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      if (!selectMap) return;
      if (selectedMarker) selectedMarker.setLatLng([lat, lng]);
      else selectedMarker = L.marker([lat, lng]).addTo(selectMap);
      selectMap.setView([lat, lng], zoom);
    }

    if (selectMapEl && window.L) {
      const HDMC_CENTER = [15.3647, 75.1240];
      const HDMC_BOUNDS = L.latLngBounds([15.28, 74.98], [15.46, 75.27]);
      selectMap = L.map("selectMap", {
        minZoom: 11,
        maxZoom: 18,
        maxBounds: HDMC_BOUNDS,
        maxBoundsViscosity: 1.0,
      }).setView(HDMC_CENTER, 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 18,
      }).addTo(selectMap);
      selectMap.on("click", (e) => {
        setSelectedLocation(e.latlng.lat, e.latlng.lng, selectMap.getZoom());
        showToast("Map location selected.");
      });
      setTimeout(() => selectMap.invalidateSize(), 100);
    }

    imageInput.addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => { imagePreview.src = ev.target.result; imagePreview.style.display = "block"; };
      reader.readAsDataURL(file);
    });

    uploadZone.addEventListener("dragover", (e) => { e.preventDefault(); uploadZone.style.borderColor = "var(--green)"; });
    uploadZone.addEventListener("dragleave", () => { uploadZone.style.borderColor = ""; });
    uploadZone.addEventListener("drop", (e) => {
      e.preventDefault();
      uploadZone.style.borderColor = "";
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        imageInput.files = e.dataTransfer.files;
        const reader = new FileReader();
        reader.onload = (ev) => { imagePreview.src = ev.target.result; imagePreview.style.display = "block"; };
        reader.readAsDataURL(file);
      }
    });

    // --- GPS LOGIC ---
    if (getLocationBtn) {
      getLocationBtn.addEventListener("click", () => {
        if (!navigator.geolocation) {
          showToast("Geolocation not supported", "error");
          return;
        }

        getLocationBtn.textContent = "Getting GPS location...";

        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = Math.round(pos.coords.accuracy || 0);

            setSelectedLocation(lat, lng, 17);
            getLocationBtn.textContent = "📍 Location added";
          },
          () => {
            showToast("Location permission denied", "error");
            getLocationBtn.textContent = "📍 Use My Location";
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });
    }

    document.getElementById("reportForm").addEventListener("submit", async function (e) {
      e.preventDefault();
      const btn = this.querySelector("button[type=submit]");
      setBtn(btn, "Submitting…", true);

      const formData = new FormData();
      formData.append("location", locationInput.value.trim());
      formData.append("category", document.getElementById("category").value);
      formData.append("description", document.getElementById("description").value.trim());
      formData.append("urgency", document.querySelector('input[name="urgency"]:checked').value);
      
      if (latInput && latInput.value) {
        formData.append("lat", latInput.value);
        formData.append("lng", lngInput.value);
      }

      if (imageInput.files[0]) formData.append("image", imageInput.files[0]);

      try {
        const res = await fetch(`${API}/complaints`, {
          method: "POST",
          headers: { Authorization: "Bearer " + getToken() },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Failed to submit.", "error"); setBtn(btn, "Submit Report", false); return; }
        setBtn(btn, "Submitted!", true);
        showToast("Report submitted successfully!");
        setTimeout(() => (window.location.href = "profile.html"), 900);
      } catch {
        showToast("Cannot reach server.", "error");
        setBtn(btn, "Submit Report", false);
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────
//  PROFILE PAGE (SPA)
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("profilePage")) {
  if (!getUser() || !getToken()) { window.location.href = "login.html"; }

  const user = getUser();
  const initials = (user?.email || "?")[0].toUpperCase();
  
  // Desktop elements
  const avatarEl  = document.getElementById("profAvatarInitial");
  const emailEl   = document.getElementById("profAvatarEmail");
  const badgeEl   = document.getElementById("profRoleBadge");
  
  // Mobile elements
  const mAvatarEl = document.getElementById("profMAvatarInitial");
  const mEmailEl  = document.getElementById("profMAvatarEmail");
  const mBadgeEl  = document.getElementById("profMRoleBadge");
  const mNameEl   = document.getElementById("profMName");

  const infoEmailEl = document.getElementById("infoEmail");
  const infoRoleEl  = document.getElementById("infoRole");

  if (avatarEl)  avatarEl.textContent = initials;
  if (emailEl)   emailEl.textContent  = user?.email || "—";
  if (badgeEl) {
    badgeEl.textContent = user?.role === "admin" ? "Admin" : "User";
    if (user?.role === "admin") badgeEl.classList.add("admin");
  }

  if (mAvatarEl) mAvatarEl.textContent = initials;
  if (mEmailEl)  mEmailEl.textContent  = user?.email || "—";
  if (mNameEl)   mNameEl.textContent   = (user?.email || "User").split('@')[0];
  if (mBadgeEl) {
    mBadgeEl.textContent = user?.role === "admin" ? "Admin" : "User";
    if (user?.role === "admin") mBadgeEl.classList.add("admin");
  }

  if (infoEmailEl) infoEmailEl.textContent = user?.email || "—";
  if (infoRoleEl)  infoRoleEl.textContent  = user?.role === "admin" ? "Admin" : "User";

  // ── Tab switching ────────────────────────────────────────
  function showTab(tabId) {
    document.querySelectorAll(".prof-tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".prof-sidenav-item").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".prof-m-tab-btn").forEach(b => b.classList.remove("active"));

    document.getElementById("tab-" + tabId)?.classList.add("active");
    document.querySelector(`.prof-sidenav-item[data-tab="${tabId}"]`)?.classList.add("active");
    document.querySelector(`.prof-m-tab-btn[data-tab="${tabId}"]`)?.classList.add("active");
    
    if (window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  document.querySelectorAll(".prof-sidenav-item, .prof-m-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      if (tab) showTab(tab);
    });
  });

  document.getElementById("profBackBtn")?.addEventListener("click", () => showTab("complaints"));

  let allComplaints = [];

  function updateInfoStats() {
    const total    = allComplaints.length;
    const resolved = allComplaints.filter(c => c.status === "Verified").length;
    const pending  = allComplaints.filter(c => ["Pending", "Awaiting Verification", "Disputed"].includes(c.status)).length;
    const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    el("infoStatTotal",    total);
    el("infoStatResolved", resolved);
    el("infoStatPending",  pending);
  }

  function statusSlug(s) { return (s || "pending").toLowerCase().replace(/\s+/g, "-"); }

  function renderCard(c) {
    const date = new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const imgHtml = c.imagePath
      ? `<div class="prof-c-img"><img src="${c.imagePath}" alt="complaint"></div>`
      : `<div class="prof-c-img"><i data-lucide="camera" style="width:22px;height:22px;"></i></div>`;
    const slug = statusSlug(c.status);
    const isAwaiting = c.status === "Awaiting Verification";

    return `
      <div class="prof-c-card ${isAwaiting ? "awaiting" : ""}" data-id="${c._id}">
        <div class="prof-c-card-inner">
          ${imgHtml}
          <div class="prof-c-body">
            <div class="prof-c-title">${c.category || "Waste Report"}</div>
            <div class="prof-c-loc">
              <i data-lucide="map-pin" style="width:12px;height:12px;flex-shrink:0;"></i>
              ${c.location}
            </div>
            <div class="prof-c-footer">
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                <span class="prof-status ${slug}">${c.status}</span>
                ${isAwaiting ? `<span class="action-required-chip">⚡ Action Required</span>` : ""}
              </div>
              <span class="prof-c-date">${date}</span>
            </div>
          </div>
        </div>
      </div>`;
  }

  function renderComplaints(list) {
    const body = document.getElementById("complaintsBody");
    const countEl = document.getElementById("complaintCount");
    const badge = document.getElementById("profComplaintBadge");
    const mBadge = document.getElementById("profMComplaintBadge");

    if (countEl) countEl.textContent = `${allComplaints.length} complaint${allComplaints.length !== 1 ? "s" : ""} submitted`;
    
    if (badge) {
      badge.textContent = allComplaints.length;
      badge.style.display = allComplaints.length ? "inline-flex" : "none";
    }
    if (mBadge) {
      mBadge.textContent = allComplaints.length;
      mBadge.style.display = allComplaints.length ? "inline-flex" : "none";
    }

    const awaitingCount = allComplaints.filter(c => c.status === "Awaiting Verification").length;
    const complaintsNavBtn = document.querySelector('.prof-sidenav-item[data-tab="complaints"]');
    if (complaintsNavBtn) {
      const existingDot = complaintsNavBtn.querySelector(".verification-dot");
      if (awaitingCount > 0 && !existingDot) {
        const dot = document.createElement("span");
        dot.className = "verification-dot";
        complaintsNavBtn.appendChild(dot);
      } else if (awaitingCount === 0 && existingDot) {
        existingDot.remove();
      }
    }

    if (!list.length) {
      body.innerHTML = `<div class="prof-empty">
        <i data-lucide="inbox" style="width:44px;height:44px;"></i>
        <h3>No complaints yet</h3>
        <p>Submit your first waste report to get started.</p>
        <a href="report.html" class="btn btn-primary" style="display:inline-flex;gap:6px;">
          <i data-lucide="plus" style="width:16px;height:16px;"></i> New Report
        </a>
      </div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    body.innerHTML = list.map(renderCard).join("");
    if (window.lucide) window.lucide.createIcons();

    body.querySelectorAll(".prof-c-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.dataset.id;
        const complaint = allComplaints.find(c => c._id === id);
        if (complaint) openDetail(complaint);
      });
    });
  }

  function openDetail(c) {
    const date = new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const slug = statusSlug(c.status);

    const timelineSteps = [
      { label: "Complaint Submitted",   done: true },
      { label: "Seen by Municipality",  done: ["In Progress", "Awaiting Verification", "Verified", "Disputed"].includes(c.status) },
      { label: "Worker Assigned",       done: ["In Progress", "Awaiting Verification", "Verified", "Disputed"].includes(c.status) },
      { label: "Cleaning In Progress",  done: ["Awaiting Verification", "Verified"].includes(c.status) },
      { label: "Awaiting Verification", done: ["Verified"].includes(c.status) },
    ];

    const timelineHtml = `
      <div class="prof-timeline">
        <div class="prof-timeline-head">Status Timeline</div>
        ${timelineSteps.map((s, i) => {
          const isActive = !s.done && timelineSteps.slice(0, i).every(prev => prev.done);
          return `<div class="prof-timeline-step">
            <div class="prof-timeline-dot ${s.done ? "done" : isActive ? "active" : ""}"></div>
            <div class="prof-timeline-text ${s.done ? "done" : ""}">${s.label}</div>
          </div>`;
        }).join("")}
      </div>`;

    // ── AWAITING VERIFICATION ─────────────────────────────────
    if (c.status === "Awaiting Verification") {
      const reportImg = c.imagePath
        ? `<img src="${c.imagePath}" class="proof-photo-img" alt="Your report">`
        : `<div class="proof-photo-empty"><i data-lucide="image" style="width:24px;height:24px;"></i></div>`;
      const proofImg = c.proofImagePath
        ? `<img src="${c.proofImagePath}" class="proof-photo-img" alt="Work done">`
        : `<div class="proof-photo-empty">No proof photo</div>`;

      document.getElementById("complaintDetailContent").innerHTML = `
        <div class="awaiting-banner-ext">
          <div class="await-icon"><i data-lucide="sparkles"></i></div>
          <div class="await-text">
            <h3>Resolution Ready!</h3>
            <p>The municipality has cleaned this area. Please verify the work below.</p>
          </div>
        </div>
        
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.5rem;flex-wrap:wrap;">
          <h2 style="font-family:'Poppins',sans-serif;font-size:1.5rem;font-weight:800;flex:1;">${c.category || "Waste Report"}</h2>
          <span class="prof-status awaiting-verification">⏳ Awaiting Verification</span>
        </div>

        <div class="proof-compare-grid">
          <div class="proof-photo-card">
            <div class="proof-card-head"><i data-lucide="camera" style="width:14px;height:14px;"></i> Original Report</div>
            ${reportImg}
          </div>
          <div class="proof-photo-card">
            <div class="proof-card-head"><i data-lucide="check-circle" style="width:14px;height:14px;color:var(--green);"></i> Resolution Proof</div>
            ${proofImg}
          </div>
        </div>

        ${c.resolutionNote ? `
          <div class="res-note-premium">
            <div class="res-note-title">Municipality Response</div>
            <p>${c.resolutionNote}</p>
          </div>
        ` : ""}

        <div class="verify-action-grid">
          <button class="btn-verify-primary" id="verifyConfirmBtn">
            <i data-lucide="check-circle" style="width:18px;height:18px;"></i> Yes, it's cleaned
          </button>
          <button class="btn-verify-secondary" id="verifyDisputeBtn">
            <i data-lucide="alert-circle" style="width:18px;height:18px;"></i> No, it's still dirty
          </button>
        </div>
        <div class="dispute-box" id="disputeBox">
          <div class="dispute-box-inner">
            <label for="disputeReason">Why are you disputing this?</label>
            <textarea id="disputeReason" placeholder="Tell the admin what's still wrong…"></textarea>
            <button class="btn btn-danger" id="disputeSubmitBtn" style="width:100%;margin-top:1rem;">Submit Dispute</button>
          </div>
        </div>
        ${timelineHtml}`;

      showTab("detail");
      if (window.lucide) window.lucide.createIcons();

      document.getElementById("verifyConfirmBtn").addEventListener("click", async () => {
        const btn = document.getElementById("verifyConfirmBtn");
        btn.disabled = true; btn.textContent = "Confirming…";
        try {
          const res = await fetch(`${API}/complaints/${c._id}/verify`, {
            method: "POST", headers: { Authorization: "Bearer " + getToken() },
          });
          const data = await res.json();
          if (!res.ok) { showToast(data.error || "Failed.", "error"); btn.disabled = false; btn.innerHTML = `<i data-lucide="check-circle" style="width:18px;height:18px;"></i> Yes, it's cleaned`; if(window.lucide) window.lucide.createIcons(); return; }
          allComplaints = allComplaints.map(x => x._id === c._id ? { ...x, status: "Verified" } : x);
          showToast("Thank you! Resolution confirmed ✅");
          openDetail({ ...c, status: "Verified" });
          renderComplaints(allComplaints);
        } catch { showToast("Network error.", "error"); btn.disabled = false; }
      });

      document.getElementById("verifyDisputeBtn").addEventListener("click", () => {
        document.getElementById("disputeBox").classList.toggle("open");
      });

      document.getElementById("disputeSubmitBtn").addEventListener("click", async () => {
        const reason = document.getElementById("disputeReason").value.trim();
        const btn = document.getElementById("disputeSubmitBtn");
        btn.textContent = "Submitting…"; btn.disabled = true;
        try {
          const res = await fetch(`${API}/complaints/${c._id}/dispute`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
            body: JSON.stringify({ reason }),
          });
          const data = await res.json();
          if (!res.ok) { showToast(data.error || "Failed.", "error"); btn.textContent = "Submit Dispute"; btn.disabled = false; return; }
          allComplaints = allComplaints.map(x => x._id === c._id ? { ...x, status: "Disputed", disputeReason: reason } : x);
          showToast("Dispute submitted. Admin will review.", "error");
          openDetail({ ...c, status: "Disputed", disputeReason: reason });
          renderComplaints(allComplaints);
        } catch { showToast("Network error.", "error"); btn.textContent = "Submit Dispute"; btn.disabled = false; }
      });

      return;
    }

    // ── VERIFIED ──────────────────────────────────────────────
    if (c.status === "Verified") {
      const ri = c.imagePath ? `<img src="${c.imagePath}" class="proof-photo-img" alt="Report">` : `<div class="proof-photo-empty">No photo</div>`;
      const pi = c.proofImagePath ? `<img src="${c.proofImagePath}" class="proof-photo-img" alt="Proof">` : `<div class="proof-photo-empty">No proof</div>`;
      document.getElementById("complaintDetailContent").innerHTML = `
        <div class="verified-hero">
          <div class="v-hero-icon"><i data-lucide="check-circle"></i></div>
          <h2>Task Completed</h2>
          <p>This report has been verified and resolved. Thank you for your contribution!</p>
        </div>

        <div class="proof-compare-grid">
          <div class="proof-photo-card">
            <div class="proof-card-head">Before</div>
            ${ri}
          </div>
          <div class="proof-photo-card">
            <div class="proof-card-head">After</div>
            ${pi}
          </div>
        </div>
        ${c.resolutionNote ? `
          <div class="res-note-premium verified">
            <div class="res-note-title">Resolution Record</div>
            <p>${c.resolutionNote}</p>
          </div>
        ` : ""}
        ${timelineHtml}`;
      showTab("detail");
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // ── DISPUTED ──────────────────────────────────────────────
    if (c.status === "Disputed") {
      document.getElementById("complaintDetailContent").innerHTML = `
        <div class="disputed-banner">
          <i data-lucide="alert-triangle" style="width:20px;height:20px;"></i>
          Disputed — The municipality is reviewing your feedback.
        </div>
        <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.2rem;flex-wrap:wrap;">
          <h2 style="font-family:'Poppins',sans-serif;font-size:1.4rem;font-weight:800;flex:1;">${c.category || "Waste Report"}</h2>
          <span class="prof-status disputed">🔴 Disputed</span>
        </div>
        ${c.disputeReason ? `<div class="resolution-note-box"><div class="note-label">Your Dispute Reason</div><p>${c.disputeReason}</p></div>` : ""}
        ${timelineHtml}`;
      showTab("detail");
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    // ── DEFAULT: Pending / In Progress ────────────────────────
    const imgHtml = c.imagePath ? `<img src="${c.imagePath}" class="prof-detail-img" alt="Complaint photo">` : "";

    document.getElementById("complaintDetailContent").innerHTML = `
      ${imgHtml}
      <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.2rem;flex-wrap:wrap;">
        <h2 style="font-family:'Poppins',sans-serif;font-size:1.4rem;font-weight:800;flex:1;">${c.category || "Waste Report"}</h2>
        <span class="prof-status ${slug}">${c.status}</span>
      </div>
      <div class="prof-detail-meta">
        <div class="prof-detail-meta-item">
          <div class="prof-detail-meta-lbl">Date Submitted</div>
          <div class="prof-detail-meta-val">${date}</div>
        </div>
        <div class="prof-detail-meta-item">
          <div class="prof-detail-meta-lbl">Location</div>
          <div class="prof-detail-meta-val" style="font-size:0.82rem;">${c.location}</div>
        </div>
        ${c.description ? `<div class="prof-detail-meta-item" style="grid-column:1/-1;">
          <div class="prof-detail-meta-lbl">Description</div>
          <div class="prof-detail-meta-val" style="font-weight:500;font-size:0.88rem;">${c.description}</div>
        </div>` : ""}
      </div>
      ${timelineHtml}`;

    showTab("detail");
    if (window.lucide) window.lucide.createIcons();
  }

  async function loadMyComplaints() {
    const body = document.getElementById("complaintsBody");
    body.innerHTML = `<div class="prof-empty"><p>Loading…</p></div>`;
    try {
      const res = await fetch(`${API}/complaints/me`, {
        headers: { Authorization: "Bearer " + getToken() },
      });
      if (res.status === 401) { logout(); return; }
      allComplaints = await res.json();
    } catch (err) {
      console.error("Fetch complaints error:", err);
      allComplaints = [];
      showToast("Could not load complaints — is the server running?", "error");
    }
    updateInfoStats();
    renderComplaints(allComplaints);
  }

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      renderComplaints(filter === "all" ? allComplaints : allComplaints.filter(c => c.status === filter));
    });
  });

  document.getElementById("clearComplaintsBtn")?.addEventListener("click", async () => {
    if (!confirm("Are you sure you want to clear all your complaints?")) return;
    try {
      const res = await fetch(`${API}/complaints/me/all`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + getToken() }
      });
      if (!res.ok) throw new Error("Failed");
      showToast("All complaints deleted successfully.");
      loadMyComplaints();
    } catch {
      showToast("Failed to clear complaints.", "error");
    }
  });

  loadMyComplaints();
}

// ─────────────────────────────────────────────────────────────────
//  ADMIN PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("adminComplaintsBody")) {
  const adminWrap = document.querySelector(".admin-wrap");
  let adminMap = null;

  async function verifyAdminPageAccess() {
    const token = getToken();
    if (!token) {
      clearToken();
      clearUser();
      window.location.href = "index.html";
      return null;
    }

    try {
      const res = await fetch(`${API}/me`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error("Invalid session");

      const user = await res.json();
      if (user.role !== "admin") throw new Error("Not admin");

      setUser({ email: user.email, role: user.role });
      if (adminWrap) adminWrap.style.visibility = "visible";
      updateNav();
      return user;
    } catch {
      clearToken();
      clearUser();
      window.location.href = "index.html";
      return null;
    }
  }

  function setupMakeAdminForm() {
    const form = document.getElementById("makeAdminForm");
    const input = document.getElementById("makeAdminEmail");
    if (!form || !input) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = input.value.trim().toLowerCase();
      if (!email) return;

      try {
        const res = await fetch(`${API}/admin/make-admin`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + getToken(),
          },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "Failed to promote user.", "error");
          return;
        }

        showToast(`${data.email} is now an admin`);
        input.value = "";
      } catch {
        showToast("Failed to promote user.", "error");
      }
    });
  }

  async function loadAdminComplaints() {
    let all = [];
    try {
      const res = await fetch(`${API}/complaints/all`);
      const raw = await res.json();
      all = raw.filter(c => c.status !== "Verified");
    } catch { showToast("Could not load complaints.", "error"); }

    const summaryEl = document.getElementById("adminSummaryCards");
    if (summaryEl) {
      const counts = {
        total:    all.length,
        pending:  all.filter(c => c.status === "Pending").length,
        inProg:   all.filter(c => c.status === "In Progress").length,
        awaiting: all.filter(c => c.status === "Awaiting Verification").length,
        disputed: all.filter(c => c.status === "Disputed").length,
      };
      summaryEl.innerHTML = `
        <div class="admin-card"><span>Active Reports</span><strong>${counts.total}</strong></div>
        <div class="admin-card pending"><span>Pending</span><strong>${counts.pending}</strong></div>
        <div class="admin-card"><span>Worker Assigned</span><strong style="color:#3558b0">${counts.inProg}</strong></div>
        <div class="admin-card" style="border-color:rgba(245,166,35,0.4)"><span>Awaiting Verification</span><strong style="color:#7a4f00">${counts.awaiting}</strong></div>
        <div class="admin-card" style="border-color:rgba(224,82,82,0.35)"><span>Disputed</span><strong style="color:#b52b2b">${counts.disputed}</strong></div>`;
    }

    const tbody = document.getElementById("adminComplaintsBody");
    if (!all.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><span class="empty-icon"><i data-lucide="clipboard-list" style="width:40px;height:40px;color:var(--text-muted);"></i></span><h3>No complaints yet</h3></div></td></tr>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    tbody.innerHTML = all.map(c => {
      const imgCell = c.imagePath
        ? `<img src="${c.imagePath}" style="width:56px;height:44px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`
        : `<div style="width:56px;height:44px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;border:1px solid var(--border);"><i data-lucide="camera" style="width:20px;height:20px;color:var(--text-muted);"></i></div>`;

      const proofCell = c.proofImagePath
        ? `<img src="${c.proofImagePath}" style="width:56px;height:44px;object-fit:cover;border-radius:8px;border:1px solid rgba(45,138,78,0.3)" title="Proof photo">`
        : `<span style="font-size:0.75rem;color:var(--text-muted)">—</span>`;

      let statusCell = "";
      if (c.status === "Pending" || c.status === "In Progress") {
        statusCell = `
          <select class="status-select" data-id="${c._id}" style="padding:7px 10px;border-radius:8px;border:1.5px solid var(--border);font-family:'Poppins',sans-serif;font-size:0.85rem;background:var(--bg);cursor:pointer;display:block;width:100%;margin-bottom:6px;">
            <option value="Pending"     ${c.status === "Pending"     ? "selected" : ""}>Pending</option>
            <option value="In Progress" ${c.status === "In Progress" ? "selected" : ""}>Worker Assigned</option>
          </select>
          ${c.status === "In Progress" ? `<button class="btn-mini resolved" onclick="openResolveModal('${c._id}')" style="width:100%;justify-content:center;display:flex;align-items:center;gap:4px;"><i data-lucide="camera" style="width:12px;height:12px;"></i> Upload Proof</button>` : ""}`;
      } else if (c.status === "Awaiting Verification") {
        statusCell = `<span class="status-badge-admin awaiting-verification">⏳ Awaiting Verification</span>`;
      } else if (c.status === "Verified") {
        statusCell = `<span class="status-badge-admin verified"><i data-lucide="lock" style="width:12px;height:12px;"></i> Verified</span>`;
      } else if (c.status === "Disputed") {
        statusCell = `
          <span class="status-badge-admin disputed">🔴 Disputed</span>
          ${c.disputeReason ? `<div class="disputed-reason-box"><strong>Dispute Reason:</strong>${c.disputeReason}</div>` : ""}
          <button class="btn-mini" onclick="adminReopen('${c._id}')" style="margin-top:6px;color:#3558b0;border-color:rgba(53,88,176,0.3);width:100%;display:flex;align-items:center;gap:4px;justify-content:center;"><i data-lucide="rotate-ccw" style="width:12px;height:12px;"></i> Reopen</button>`;
      }

      return `<tr>
        <td>${imgCell}</td>
        <td><strong style="display:block">${c.location}</strong><span style="font-size:0.8rem;color:var(--text-muted)">${c.userEmail || "—"}</span></td>
        <td style="max-width:180px;font-size:0.88rem;color:var(--text-muted)">${(c.description || "").slice(0,80)}${(c.description||"").length>80?"…":""}</td>
        <td style="min-width:170px">${statusCell}</td>
        <td>${proofCell}</td>
      </tr>`;
    }).join("");

    if (window.lucide) window.lucide.createIcons();

    document.querySelectorAll(".status-select").forEach(sel => {
      sel.addEventListener("change", async function () {
        try {
          await fetch(`${API}/complaints/${this.dataset.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
            body: JSON.stringify({ status: this.value }),
          });
          showToast("Status updated to: " + this.value);
        } catch { showToast("Failed to update.", "error"); }
        loadAdminComplaints();
      });
    });

    renderAdminMap(all);
  }

  window.openResolveModal = function (id) {
    document.getElementById("resolveModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "ww-modal-overlay";
    overlay.id = "resolveModalOverlay";
    overlay.innerHTML = `
      <div class="ww-modal">
        <div class="ww-modal-title">
          <i data-lucide="camera" style="width:20px;height:20px;color:var(--green);"></i>
          Upload Proof of Resolution
        </div>
        <div class="upload-zone" id="resolveUploadZone" style="padding:1.5rem 1rem;position:relative;">
          <input type="file" id="resolveProofInput" accept="image/*" style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;">
          <div class="upload-icon"><i data-lucide="image" style="width:30px;height:30px;color:var(--text-muted);"></i></div>
          <h4>Click or drag proof photo</h4>
          <p>Shows the completed cleanup work</p>
          <img id="resolveProofPreview" class="upload-preview">
        </div>
        <div class="form-group" style="margin-top:1rem;margin-bottom:0;">
          <label for="resolveNote">Resolution Note <span style="font-weight:400;color:var(--text-muted)">(optional)</span></label>
          <textarea id="resolveNote" class="form-control" style="min-height:68px;" placeholder="Describe what was done…"></textarea>
        </div>
        <div class="ww-modal-actions">
          <button id="resolveSubmitBtn" class="btn btn-primary">Submit Resolution</button>
          <button id="resolveCancelBtn" class="btn btn-outline">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons();
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.remove(); });
    document.getElementById("resolveCancelBtn").addEventListener("click", () => overlay.remove());
    document.getElementById("resolveProofInput").addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const p = document.getElementById("resolveProofPreview");
        p.src = ev.target.result; p.style.display = "block";
      };
      reader.readAsDataURL(file);
    });
    document.getElementById("resolveSubmitBtn").addEventListener("click", async () => {
      const fileInput = document.getElementById("resolveProofInput");
      const note = document.getElementById("resolveNote").value.trim();
      const btn = document.getElementById("resolveSubmitBtn");
      if (!fileInput.files[0]) { showToast("Please upload a proof photo first.", "error"); return; }
      btn.textContent = "Submitting…"; btn.disabled = true;
      const fd = new FormData();
      fd.append("proof", fileInput.files[0]);
      if (note) fd.append("resolutionNote", note);
      try {
        const res = await fetch(`${API}/complaints/${id}/resolve`, {
          method: "POST", headers: { Authorization: "Bearer " + getToken() }, body: fd,
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Failed.", "error"); btn.textContent = "Submit Resolution"; btn.disabled = false; return; }
        showToast("Resolution submitted — awaiting user verification.");
        overlay.remove(); loadAdminComplaints();
      } catch { showToast("Network error.", "error"); btn.textContent = "Submit Resolution"; btn.disabled = false; }
    });
  };

  window.adminReopen = async function (id) {
    if (!confirm("Reopen this complaint and set it back to In Progress?")) return;
    try {
      const res = await fetch(`${API}/complaints/${id}/reopen`, {
        method: "POST", headers: { Authorization: "Bearer " + getToken() },
      });
      if (!res.ok) throw new Error();
      showToast("Complaint reopened to In Progress.");
    } catch { showToast("Failed to reopen.", "error"); }
    loadAdminComplaints();
  };

  function renderAdminMap(complaints) {
    const mapEl = document.getElementById("adminMapContainer");
    if (!mapEl || !window.L) return;
    if (adminMap) { adminMap.remove(); adminMap = null; }
    const HDMC_CENTER = [15.3647, 75.1240];
    const HDMC_BOUNDS = L.latLngBounds([15.28, 74.98], [15.46, 75.27]);
    adminMap = L.map("adminMapContainer", {
      minZoom: 11,
      maxZoom: 18,
      maxBounds: HDMC_BOUNDS,
      maxBoundsViscosity: 1.0,
    }).setView(HDMC_CENTER, 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(adminMap);
    const cache = {};
    complaints.forEach((c) => {
      getComplaintCoords(c, cache).then((coords) => {
        if (!coords) return;
        const color = c.status === "Verified" ? "#2d8a4e" : c.status === "In Progress" ? "#3558b0" : "#e05252";
        L.marker(coords, { icon: L.divIcon({ className: "", html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`, iconSize: [14, 14] }) })
          .addTo(adminMap)
          .bindPopup(`<b>${c.location}</b><br>${c.category || ""}<br><span style="color:${color};font-weight:700">${c.status}</span>`);
      });
    });
  }

  async function initAdminPage() {
    const user = await verifyAdminPageAccess();
    if (!user) return;
    setupMakeAdminForm();
    loadAdminComplaints();
  }
  initAdminPage();
}

// ─────────────────────────────────────────────────────────────────
//  CITY STATUS PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("citySummaryCards")) {
  fetch(`${API}/complaints/all`)
    .then((r) => r.json())
    .then((raw) => {
      const all = raw.filter(c => c.status !== "Verified");
      const pending = all.filter((c) => c.status === "Pending").length;
      const inProg = all.filter((c) => c.status === "In Progress").length;
      const resolved = raw.filter((c) => c.status === "Verified").length;

      const summaryEl = document.getElementById("citySummaryCards");
      summaryEl.innerHTML = `
        <div class="admin-card"><span>Total Reports</span><strong>${all.length}</strong></div>
        <div class="admin-card pending"><span>Pending</span><strong>${pending}</strong></div>
        <div class="admin-card"><span>In Progress</span><strong style="color:#3558b0">${inProg}</strong></div>
        <div class="admin-card resolved"><span>Resolved</span><strong>${resolved}</strong></div>`;

      const areaMap = {};
      all.forEach((c) => {
        const area = (c.location || "Unknown").split(",")[0].trim();
        if (!areaMap[area]) areaMap[area] = { total: 0, resolved: 0 };
        areaMap[area].total++;
        if (c.status === "Resolved") areaMap[area].resolved++;
      });

      const areaEl = document.getElementById("areaWiseList");
      const areas = Object.entries(areaMap).sort((a, b) => b[1].total - a[1].total);
      areaEl.innerHTML = areas.slice(0, 8).map(([name, d]) => `
        <div class="area-row">
          <span style="display:flex;align-items:center;gap:0.3rem;"><i data-lucide="map-pin" style="width:16px;height:16px;color:var(--primary);"></i> ${name}</span>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <strong>${d.total} report${d.total !== 1 ? "s" : ""}</strong>
            <span class="status-pill" style="background:rgba(45,138,78,0.1);color:var(--green-dark);font-size:0.75rem">${d.resolved} resolved</span>
          </div>
        </div>`).join("") || `<p class="city-empty">No area data yet.</p>`;

      const recentEl = document.getElementById("recentComplaintsList");
      recentEl.innerHTML = all.slice(0, 6).map((c) => `
        <div class="recent-item">
          <div>
            <strong style="display:flex;align-items:center;gap:0.3rem;"><i data-lucide="map-pin" style="width:16px;height:16px;color:var(--primary);"></i> ${c.location}</strong>
            <p>${(c.description || "").slice(0, 80)}${(c.description || "").length > 80 ? "…" : ""}</p>
            <small>${new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</small>
          </div>
          <span class="status-badge status-${statusClass(c.status)}">${c.status}</span>
        </div>`).join("") || `<p class="city-empty">No recent complaints.</p>`;

      if (window.lucide) window.lucide.createIcons();
      if (window.L && document.getElementById("cityStatusMap")) initLeafletMap("cityStatusMap", all);
    })
    .catch(() => showToast("Could not load city data.", "error"));
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
      const color = c.status === "Verified" ? "#2d8a4e" : c.status === "In Progress" ? "#3558b0" : "#e05252";
      L.marker(coords, {
        icon: L.divIcon({ className: "", html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })
      }).addTo(map).bindPopup(`<div style="min-width:160px;font-family:'Poppins',sans-serif"><b>${c.location}</b><br><span style="font-size:0.8rem;color:#5a7060">${c.category || ""}</span><br><span style="color:${color};font-weight:700">${c.status}</span><p style="font-size:0.8rem;margin-top:4px;color:#5a7060">${(c.description || "").slice(0, 80)}</p></div>`);
    }));
  Promise.all(promises).then(() => {
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    else if (bounds.length === 1) map.setView(bounds[0], 14);
  });
  return map;
}
