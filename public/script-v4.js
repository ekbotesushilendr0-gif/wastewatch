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

function statusSlugAdmin(s) {
  if (s === "Awaiting Verification") return "awaiting-verification";
  if (s === "Verified") return "verified";
  if (s === "Disputed") return "disputed";
  return (s || "pending").toLowerCase().replace(/\s+/g, "-");
}
function statusSlug(s) { return (s || "pending").toLowerCase().replace(/\s+/g, "-"); }

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
  ];
  if (role === "worker") {
    items.push({ href: "worker.html", icon: "hard-hat", label: "My Work" });
    if (isLoggedIn) items.push({ href: "profile.html", icon: "user-circle", label: "Profile" });
  } else {
    items.push({ href: "report.html", icon: "trash-2", label: "Report" });
    if (isLoggedIn) items.push({ href: "profile.html", icon: "user-circle", label: "Profile" });
    if (role === "admin") items.push({ href: "admin.html", icon: "shield", label: "Admin" });
  }

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
    .nav-links a[href="admin.html"], .nav-links a[href="profile.html"], .nav-links a[href="worker.html"] { display: none !important; }
    .nav-links a[href="admin.html"].show-nav, .nav-links a[href="profile.html"].show-nav, .nav-links a[href="worker.html"].show-nav { display: block !important; }

    /* Duplicate Modal Styles */
    .ww-modal-overlay {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s ease;
    }
    .ww-modal-overlay.open {
      opacity: 1;
      pointer-events: auto;
    }
    .ww-modal-container {
      background: #fff;
      width: 92%;
      max-width: 480px;
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.3);
      padding: 24px;
      transform: translateY(30px);
      transition: transform 0.3s ease;
      font-family: 'Poppins', sans-serif;
    }
    .ww-modal-overlay.open .ww-modal-container {
      transform: translateY(0);
    }
    .ww-modal-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 14px;
      color: #b86200;
    }
    .ww-modal-header h3 {
      font-size: 1.25rem;
      font-weight: 800;
      margin: 0;
    }
    .ww-dup-card {
      border: 1.5px solid var(--border);
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 20px;
      background: #fafafa;
    }
    .ww-dup-img {
      width: 100%;
      height: 170px;
      object-fit: cover;
      border-radius: 8px;
      margin-bottom: 12px;
      border: 1.5px solid var(--border);
      background: #eee;
    }
    .ww-dup-meta {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }
    .ww-dup-badge {
      background: rgba(0,0,0,0.05);
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      color: var(--text-muted);
    }
    .ww-dup-badge.urgency-high {
      background: rgba(224,82,82,0.12);
      color: var(--danger);
    }
    .ww-dup-badge.status-pending {
      background: rgba(245,166,35,0.12);
      color: #9b6a00;
    }
    .ww-dup-desc {
      font-size: 0.85rem;
      color: var(--text-muted);
      line-height: 1.45;
      margin: 0;
    }
    .ww-modal-actions {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn-confirm-issue {
      background: var(--green);
      color: #fff;
      border: none;
      padding: 12px;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: background 0.2s;
      font-size: 0.95rem;
      font-family: inherit;
    }
    .btn-confirm-issue:hover {
      background: var(--green-dark);
    }
    .btn-submit-anyway {
      background: transparent;
      color: var(--text-muted);
      border: 1.5px solid var(--border);
      padding: 12px;
      border-radius: 10px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 0.9rem;
      font-family: inherit;
      text-align: center;
    }
    .btn-submit-anyway:hover {
      background: #f3f3f3;
      color: var(--text-dark);
    }
    .ww-carousel-btn {
      transition: all 0.2s;
    }
    .ww-carousel-btn:hover {
      background: #f0f0f0 !important;
      border-color: #999 !important;
    }
    .ww-carousel-btn:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
    .ww-dup-card {
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .ww-dup-card.fade-out {
      opacity: 0;
      transform: translateY(5px);
    }
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

    // --- Camera Logic ---
    const btnCameraCapture = document.getElementById("btnCameraCaptureReport");
    const cameraPreviewContainer = document.getElementById("cameraPreviewContainer");
    const cameraVideo = document.getElementById("cameraVideo");
    const btnCapturePhoto = document.getElementById("btnCapturePhoto");
    let mediaStream = null;

    if (btnCameraCapture) {
      btnCameraCapture.addEventListener("click", async () => {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
          });
          cameraVideo.srcObject = mediaStream;
          cameraPreviewContainer.style.display = "flex";
          imagePreview.style.display = "none";
        } catch {
          showToast("Camera access denied", "error");
        }
      });

      btnCapturePhoto.addEventListener("click", () => {
        if (!mediaStream) return;
        const canvas = document.createElement("canvas");
        canvas.width = cameraVideo.videoWidth;
        canvas.height = cameraVideo.videoHeight;
        canvas.getContext("2d").drawImage(cameraVideo, 0, 0);
        
        canvas.toBlob(blob => {
          const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
          const dt = new DataTransfer();
          dt.items.add(file);
          imageInput.files = dt.files;
          
          const reader = new FileReader();
          reader.onload = (ev) => { 
            imagePreview.src = ev.target.result; 
            imagePreview.style.display = "block";
            cameraPreviewContainer.style.display = "none";
          };
          reader.readAsDataURL(file);
        }, "image/jpeg", 0.92);

        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
      });
    }

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
            getLocationBtn.innerHTML = `<i data-lucide="navigation" style="width:14px;height:14px;"></i> Location added`;
            if (window.lucide) window.lucide.createIcons();
          },
          () => {
            showToast("Location permission denied", "error");
            getLocationBtn.innerHTML = `<i data-lucide="navigation" style="width:14px;height:14px;"></i> Use My Location`;
            if (window.lucide) window.lucide.createIcons();
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
        const res = await fetch(`${API}/complaints/check`, {
          method: "POST",
          headers: { Authorization: "Bearer " + getToken() },
          body: formData,
        });
        const data = await res.json();
        if (!res.ok) { 
          showToast(data.error || "Failed to submit.", "error"); 
          setBtn(btn, "Submit Report", false); 
          return; 
        }

        if (data.isPotentialDuplicate) {
          setBtn(btn, "Submit Report", false);
          showDuplicateModal(data);
        } else {
          setBtn(btn, "Submitted!", true);
          showToast("Report submitted successfully!");
          setTimeout(() => (window.location.href = "profile.html"), 900);
        }
      } catch (err) {
        console.error("Submit error:", err);
        showToast("Cannot reach server.", "error");
        setBtn(btn, "Submit Report", false);
      }
    });

    function showDuplicateModal(data) {
      document.getElementById("wwDuplicateModal")?.remove();

      const modalOverlay = document.createElement("div");
      modalOverlay.id = "wwDuplicateModal";
      modalOverlay.className = "ww-modal-overlay";

      const candidates = data.candidates || [data.candidate];
      let currentIdx = 0;

      modalOverlay.innerHTML = `
        <div class="ww-modal-container">
          <div class="ww-modal-header">
            <i data-lucide="alert-triangle" style="width:22px;height:22px;"></i>
            <h3>Similar Issue Found Nearby</h3>
          </div>
          <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">
            A similar issue has been reported in this exact area. To help the municipality prioritize, you can confirm this issue instead.
          </p>

          <!-- Carousel Navigation Row -->
          <div id="wwCarouselNavRow" style="display:${candidates.length > 1 ? 'flex' : 'none'}; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-size:0.85rem; color:var(--text-muted); font-weight:700;" id="wwCarouselCount">Issue 1 of ${candidates.length}</span>
            <div style="display:flex; gap:6px;">
              <button id="btnPrevCandidate" class="ww-carousel-btn" style="padding:4px 8px; border-radius:6px; border:1.5px solid var(--border); background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i data-lucide="chevron-left" style="width:16px; height:16px;"></i></button>
              <button id="btnNextCandidate" class="ww-carousel-btn" style="padding:4px 8px; border-radius:6px; border:1.5px solid var(--border); background:#fff; cursor:pointer; display:flex; align-items:center; justify-content:center;"><i data-lucide="chevron-right" style="width:16px; height:16px;"></i></button>
            </div>
          </div>

          <div class="ww-dup-card" id="wwDupCard">
            <div id="wwDupImgContainer"></div>
            <div class="ww-dup-meta" id="wwDupMeta"></div>
            <p class="ww-dup-desc" id="wwDupDesc"></p>
          </div>

          <div class="ww-modal-actions">
            <button class="btn-confirm-issue" id="btnConfirmExisting">
              <i data-lucide="check-circle" style="width:16px;height:16px;"></i> Confirm This Issue
            </button>
            <button class="btn-submit-anyway" id="btnSubmitAnyway">
              Submit Anyway
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modalOverlay);

      const dupCard = document.getElementById("wwDupCard");
      const imgContainer = document.getElementById("wwDupImgContainer");
      const dupMeta = document.getElementById("wwDupMeta");
      const dupDesc = document.getElementById("wwDupDesc");
      const carouselCount = document.getElementById("wwCarouselCount");
      const btnPrev = document.getElementById("btnPrevCandidate");
      const btnNext = document.getElementById("btnNextCandidate");

      function renderCandidate(idx) {
        const cand = candidates[idx];
        const timeAgo = formatTimeAgo(new Date(cand.createdAt));
        const totalConfirmations = (cand.duplicateCount || 0) + (cand.supportCount || 0);

        if (cand.imagePath) {
          imgContainer.innerHTML = `<img src="${cand.imagePath}" class="ww-dup-img" alt="Existing issue">`;
        } else {
          imgContainer.innerHTML = `<div class="ww-dup-img" style="display:flex;align-items:center;justify-content:center;color:var(--text-muted);"><i data-lucide="image" style="width:36px;height:36px;"></i></div>`;
        }

        const distStr = cand.distance !== undefined ? `${cand.distance.toFixed(0)}m away` : "Nearby";
        dupMeta.innerHTML = `
          <span class="ww-dup-badge" style="background:rgba(53,88,176,0.08);color:#3558b0;">${distStr}</span>
          <span class="ww-dup-badge">Reported ${timeAgo}</span>
          <span class="ww-dup-badge status-${(cand.status || 'pending').toLowerCase()}">${cand.status}</span>
          <span class="ww-dup-badge" style="background:rgba(26,92,51,0.08);color:var(--green-dark);">${totalConfirmations} confirmations</span>
        `;

        dupDesc.textContent = `"${cand.description || 'No description provided.'}"`;

        if (candidates.length > 1) {
          carouselCount.textContent = `Issue ${idx + 1} of ${candidates.length}`;
          btnPrev.disabled = (idx === 0);
          btnNext.disabled = (idx === candidates.length - 1);
        }

        if (window.lucide) window.lucide.createIcons();
      }

      renderCandidate(currentIdx);
      if (window.lucide) window.lucide.createIcons();

      requestAnimationFrame(() => modalOverlay.classList.add("open"));

      function switchCandidate(newIdx) {
        if (newIdx < 0 || newIdx >= candidates.length) return;
        dupCard.classList.add("fade-out");
        setTimeout(() => {
          currentIdx = newIdx;
          renderCandidate(currentIdx);
          dupCard.classList.remove("fade-out");
        }, 200);
      }

      if (candidates.length > 1) {
        btnPrev.addEventListener("click", () => switchCandidate(currentIdx - 1));
        btnNext.addEventListener("click", () => switchCandidate(currentIdx + 1));
      }

      document.getElementById("btnConfirmExisting").addEventListener("click", async () => {
        const cBtn = document.getElementById("btnConfirmExisting");
        cBtn.disabled = true;
        cBtn.textContent = "Confirming...";
        const activeCand = candidates[currentIdx];
        try {
          const res = await fetch(`${API}/complaints/${activeCand._id}/support`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + getToken()
            },
            body: JSON.stringify({
              sessionId: data.sessionId,
              aiDuplicateConfidence: activeCand.aiDuplicateConfidence,
              aiDuplicateReason: activeCand.aiDuplicateReason
            })
          });
          const result = await res.json();
          if (!res.ok) {
            showToast(result.error || "Failed to confirm.", "error");
            cBtn.disabled = false;
            cBtn.innerHTML = `<i data-lucide="check-circle" style="width:16px;height:16px;"></i> Confirm This Issue`;
            if (window.lucide) window.lucide.createIcons();
            return;
          }
          showToast("Issue confirmed successfully!");
          modalOverlay.classList.remove("open");
          setTimeout(() => {
            modalOverlay.remove();
            window.location.href = "profile.html";
          }, 900);
        } catch {
          showToast("Network error.", "error");
          cBtn.disabled = false;
          cBtn.innerHTML = `<i data-lucide="check-circle" style="width:16px;height:16px;"></i> Confirm This Issue`;
          if (window.lucide) window.lucide.createIcons();
        }
      });

      document.getElementById("btnSubmitAnyway").addEventListener("click", async () => {
        const sBtn = document.getElementById("btnSubmitAnyway");
        sBtn.disabled = true;
        sBtn.textContent = "Submitting anyway...";
        try {
          const res = await fetch(`${API}/complaints/confirm`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + getToken()
            },
            body: JSON.stringify({ sessionId: data.sessionId })
          });
          const result = await res.json();
          if (!res.ok) {
            showToast(result.error || "Failed to submit.", "error");
            sBtn.disabled = false;
            sBtn.textContent = "Submit Anyway";
            return;
          }
          showToast("New report submitted successfully!");
          modalOverlay.classList.remove("open");
          setTimeout(() => {
            modalOverlay.remove();
            window.location.href = "profile.html";
          }, 900);
        } catch {
          showToast("Network error.", "error");
          sBtn.disabled = false;
          sBtn.textContent = "Submit Anyway";
        }
      });
    }

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
      return "just now";
    }
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
    badgeEl.textContent = user?.role === "admin" ? "Admin" : user?.role === "worker" ? "Worker" : "User";
    if (user?.role === "admin") badgeEl.classList.add("admin");
    if (user?.role === "worker") badgeEl.classList.add("worker");
  }

  // Inject a quick-link button into the profile summary section for special roles
  const profSummary = document.querySelector(".prof-summary");
  if (profSummary && !document.getElementById("roleQuickLink")) {
    if (user?.role === "admin") {
      profSummary.insertAdjacentHTML("beforeend", `<a href="admin.html" id="roleQuickLink" class="btn btn-outline" style="width:100%;justify-content:center;margin-top:1rem;background:#fff;"><i data-lucide="shield" style="width:18px;height:18px;"></i> Go to Admin Panel</a>`);
    } else if (user?.role === "worker") {
      profSummary.insertAdjacentHTML("beforeend", `<a href="worker.html" id="roleQuickLink" class="btn btn-outline" style="width:100%;justify-content:center;margin-top:1rem;background:#fff;"><i data-lucide="briefcase" style="width:18px;height:18px;"></i> Go to Worker Dashboard</a>`);
    }
  }

  if (mAvatarEl) mAvatarEl.textContent = initials;
  if (mEmailEl)  mEmailEl.textContent  = user?.email || "—";
  if (mNameEl)   mNameEl.textContent   = (user?.email || "User").split('@')[0];
  if (mBadgeEl) {
    mBadgeEl.textContent = user?.role === "admin" ? "Admin" : user?.role === "worker" ? "Worker" : "User";
    if (user?.role === "admin") mBadgeEl.classList.add("admin");
    if (user?.role === "worker") mBadgeEl.classList.add("worker");
  }

  if (infoEmailEl) infoEmailEl.textContent = user?.email || "—";
  if (infoRoleEl)  infoRoleEl.textContent  = user?.role === "admin" ? "Admin" : user?.role === "worker" ? "Worker" : "User";

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
      <div id="profileDetailChildrenPlaceholder"></div>
      ${timelineHtml}`;

    showTab("detail");
    if (window.lucide) window.lucide.createIcons();

    // Fetch and populate child duplicates asynchronously
    (async () => {
      try {
        const res = await fetch(`${API}/complaints/${c._id}/children`);
        if (!res.ok) return;
        const children = await res.json();
        const placeholder = document.getElementById("profileDetailChildrenPlaceholder");
        if (placeholder && children && children.length > 0) {
          placeholder.innerHTML = `
            <div style="margin-top:1.5rem;border-top:1.5px solid var(--border);padding-top:1.2rem;margin-bottom:1rem;">
              <p style="font-size:0.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:0.8rem;">Duplicate Reports from other citizens (${children.length})</p>
              <div style="display:flex;flex-direction:column;gap:12px;">
                ${children.map(child => {
                  const childDate = new Date(child.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
                  return `
                    <div style="display:flex;gap:12px;background:#fcfcfc;border:1px solid var(--border);border-radius:10px;padding:10px;align-items:center;">
                      ${child.imagePath
                        ? `<img src="${child.imagePath}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid var(--border);" alt="duplicate">`
                        : `<div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#eee;border-radius:6px;"><i data-lucide="image" style="width:16px;height:16px;color:#888;"></i></div>`
                      }
                      <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:between;align-items:center;margin-bottom:2px;font-size:0.75rem;">
                          <strong style="color:var(--text-dark);word-break:break-all;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;max-width:180px;">${child.userEmail}</strong>
                          <span style="color:var(--text-muted);font-size:0.7rem;margin-left:auto;flex-shrink:0;">${childDate}</span>
                        </div>
                        <p style="margin:0;font-size:0.78rem;color:var(--text-muted);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">"${child.description || 'No description'}"</p>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons();
        }
      } catch (err) {
        console.error("Failed to load children in user detail:", err);
      }
    })();
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

  function setupMakeWorkerForm() {
    const form = document.getElementById("makeWorkerForm");
    const input = document.getElementById("makeWorkerEmail");
    if (!form || !input) return;

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = input.value.trim().toLowerCase();
      if (!email) return;

      try {
        const res = await fetch(`${API}/admin/make-worker`, {
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

        showToast(`${data.email} is now a worker`);
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
        <div class="admin-stat-card">
          <div class="admin-stat-icon" style="background:rgba(45,138,78,0.12);color:var(--green-dark);">
            <i data-lucide="clipboard-list" style="width:20px;height:20px;"></i>
          </div>
          <div class="admin-stat-info">
            <div class="admin-stat-num">${counts.total}</div>
            <div class="admin-stat-lbl">Active Reports</div>
          </div>
        </div>

        <div class="admin-stat-card">
          <div class="admin-stat-icon" style="background:rgba(245,166,35,0.12);color:#9b6a00;">
            <i data-lucide="clock" style="width:20px;height:20px;"></i>
          </div>
          <div class="admin-stat-info">
            <div class="admin-stat-num" style="color:#9b6a00;">${counts.pending}</div>
            <div class="admin-stat-lbl">Pending</div>
          </div>
        </div>

        <div class="admin-stat-card">
          <div class="admin-stat-icon" style="background:rgba(53,88,176,0.12);color:#3558b0;">
            <i data-lucide="hard-hat" style="width:20px;height:20px;"></i>
          </div>
          <div class="admin-stat-info">
            <div class="admin-stat-num" style="color:#3558b0;">${counts.inProg}</div>
            <div class="admin-stat-lbl">Worker Assigned</div>
          </div>
        </div>

        <div class="admin-stat-card">
          <div class="admin-stat-icon" style="background:rgba(245,166,35,0.18);color:#7a4f00;">
            <i data-lucide="eye" style="width:20px;height:20px;"></i>
          </div>
          <div class="admin-stat-info">
            <div class="admin-stat-num" style="color:#7a4f00;">${counts.awaiting}</div>
            <div class="admin-stat-lbl">Awaiting Verification</div>
          </div>
        </div>

        <div class="admin-stat-card">
          <div class="admin-stat-icon" style="background:rgba(224,82,82,0.12);color:var(--danger);">
            <i data-lucide="alert-circle" style="width:20px;height:20px;"></i>
          </div>
          <div class="admin-stat-info">
            <div class="admin-stat-num" style="color:var(--danger);">${counts.disputed}</div>
            <div class="admin-stat-lbl">Disputed</div>
          </div>
        </div>`;
    }

    const listEl = document.getElementById('adminComplaintsBody');
    if (!all.length) {
      listEl.innerHTML = `<div class="empty-state">
        <span class="empty-icon"><i data-lucide="clipboard-list" style="width:40px;height:40px;color:var(--text-muted);"></i></span>
        <h3>No active complaints</h3>
        <p>All complaints have been resolved or none submitted yet.</p>
      </div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    window.adminAllComplaints = all;

    listEl.innerHTML = all.map(c => {
      const date = new Date(c.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

      const urgencyClass = (c.urgency || 'low').toLowerCase();
      const urgencyColors = {
        low:    { bg: 'rgba(45,138,78,0.1)',  color: 'var(--green-dark)' },
        medium: { bg: 'rgba(245,166,35,0.15)', color: '#8a5a00' },
        high:   { bg: 'rgba(224,82,82,0.15)', color: 'var(--danger)' },
      };
      const uc = urgencyColors[urgencyClass] || urgencyColors.low;

      const imgHtml = c.imagePath
        ? `<img src="${c.imagePath}" class="admin-c-thumb" alt="complaint">`
        : `<div class="admin-c-thumb-empty"><i data-lucide="image" style="width:20px;height:20px;"></i></div>`;

      const proofHtml = c.proofImagePath
        ? `<img src="${c.proofImagePath}" class="admin-c-thumb" alt="proof" style="border-color:rgba(45,138,78,0.3);">`
        : `<span style="font-size:0.78rem;color:var(--text-muted);">—</span>`;

      let cardStatusHtml = '';
      if (c.status === 'Pending' || c.status === 'In Progress') {
        cardStatusHtml = `<span class="status-badge-admin pending">${c.status === 'Pending' ? 'Pending' : 'Worker Assigned'}</span>`;
      } else if (c.status === 'Awaiting Verification') {
        cardStatusHtml = `<span class="status-badge-admin awaiting-verification">Awaiting Verification</span>`;
      } else if (c.status === 'Verified') {
        cardStatusHtml = `<span class="status-badge-admin verified">Verified</span>`;
      } else if (c.status === 'Disputed') {
        cardStatusHtml = `<span class="status-badge-admin disputed">Disputed</span>`;
      }

      return `
        <div class="admin-c-card" data-id="${c._id}" style="cursor:pointer;" onclick="openAdminDetail('${c._id}')">

          <!-- Top row: image + core info -->
          <div class="admin-c-card-top">
            <div class="admin-c-thumbs">
              <div>
                <div class="admin-c-thumb-label">Report</div>
                ${imgHtml}
              </div>
              ${c.proofImagePath ? `
              <div>
                <div class="admin-c-thumb-label">Proof</div>
                ${proofHtml}
              </div>` : ''}
            </div>

            <div class="admin-c-info">
              <div class="admin-c-info-top">
                <span class="admin-c-category">${c.category || 'Waste Report'}</span>
                <span class="urgency-badge ${urgencyClass}" style="background:${uc.bg};color:${uc.color};">
                  ${c.urgency || 'Low'}
                </span>
                ${cardStatusHtml}
              </div>
              <div class="admin-c-location">
                <i data-lucide="map-pin" style="width:13px;height:13px;color:var(--green);flex-shrink:0;"></i>
                ${c.location}
              </div>
              <div class="admin-c-desc">${(c.description || '').slice(0, 100)}${(c.description||'').length > 100 ? '…' : ''}</div>
              <div class="admin-c-meta">
                <span><i data-lucide="user" style="width:11px;height:11px;"></i> ${c.userEmail || '—'}</span>
                <span><i data-lucide="calendar" style="width:11px;height:11px;"></i> ${date}</span>
                <span style="font-weight:600;color:var(--green);"><i data-lucide="check-circle-2" style="width:11.5px;height:11.5px;color:var(--green);"></i> ${(c.duplicateCount || 0) + (c.supportCount || 0)} confirmations</span>
              </div>
            </div>
          </div>
        </div>`;
    }).join('');

    if (window.lucide) window.lucide.createIcons();

    // Re-attach status select listeners
    document.querySelectorAll('.admin-status-select').forEach(sel => {
      sel.addEventListener('change', async function() {
        try {
          await fetch(`${API}/complaints/${this.dataset.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
            body: JSON.stringify({ status: this.value }),
          });
          showToast('Status updated to: ' + this.value);
        } catch { showToast('Failed to update.', 'error'); }
        loadAdminComplaints();
      });
    });

    window.assignWorker = async function(id, btn) {
      const row = btn.closest(".worker-assign-row");
      const input = row.querySelector(".worker-assign-input");
      const email = input.value.trim().toLowerCase();
      if (!email) { showToast("Enter a worker email", "error"); return; }
      btn.disabled = true;
      try {
        const res = await fetch(`${API}/complaints/${id}/assign-worker`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
          body: JSON.stringify({ workerEmail: email }),
        });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || "Failed to assign.", "error"); btn.disabled = false; return; }
        showToast("Worker assigned successfully.");
        loadAdminComplaints();
      } catch { showToast("Network error.", "error"); btn.disabled = false; }
    };

    renderAdminMap(all);
  }



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
        const color = 
          c.status === "Verified" ? "#2d8a4e" : 
          c.status === "In Progress" ? "#3558b0" : 
          c.status === "Awaiting Verification" ? "#f5a623" : 
          c.status === "Disputed" ? "#e05252" : 
          "#e05252";
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
    setupMakeWorkerForm();
    loadAdminComplaints();
  }
  window.openAdminDetail = function(id) {
    try {
      console.log("openAdminDetail clicked for id:", id);
      const c = window.adminAllComplaints && window.adminAllComplaints.find(x => x._id === id);
      if (!c) {
        console.error("Complaint not found in window.adminAllComplaints");
        return;
      }

      // Clean up previous overlay and its map instance
      const existingOverlay = document.getElementById('workerDetailOverlay');
      if (existingOverlay) existingOverlay.remove();
      if (window.adminDetailMapInstance) {
        try { window.adminDetailMapInstance.remove(); } catch(e) {}
        window.adminDetailMapInstance = null;
      }

      const lat = Number(c.lat);
      const lng = Number(c.lng);
      const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
      const date = new Date(c.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

      let statusHtml = '';
    if (c.status === 'Pending' || c.status === 'In Progress') {
      statusHtml = `
        <div style="background:var(--surface);border:1.5px solid var(--border);border-radius:12px;padding:1.2rem;margin-bottom:1.5rem;">
          <p style="font-size:0.8rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:0.8rem;">Admin Actions</p>
          <div style="display:flex;flex-direction:column;gap:0.8rem;">
            <div>
              <label style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;display:block;">Update Status</label>
              <select class="status-select admin-status-select" data-id="${c._id}" style="width:100%;">
                <option value="Pending"     ${c.status === 'Pending'     ? 'selected' : ''}>Pending</option>
                <option value="In Progress" ${c.status === 'In Progress' ? 'selected' : ''}>Worker Assigned (In Progress)</option>
              </select>
            </div>
            <div>
              <label style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px;display:block;">Assign Worker</label>
              <div class="worker-assign-row" style="display:flex;gap:8px;">
                <input type="email" class="worker-assign-input form-control"
                  placeholder="worker@example.com"
                  value="${c.workerEmail || ''}"
                  style="flex:1;min-width:0;">
                <button class="btn btn-primary" onclick="assignWorker('${c._id}', this)" style="padding:0 1.2rem;white-space:nowrap;">Assign</button>
              </div>
              ${c.workerEmail ? `
                <div style="font-size:0.8rem;color:var(--green);margin-top:6px;display:flex;align-items:center;gap:4px;font-weight:600;">
                  <i data-lucide="check-circle" style="width:14px;height:14px;"></i> Currently assigned to ${c.workerEmail}
                </div>` : ''}
            </div>
          </div>
        </div>`;
    } else if (c.status === 'Awaiting Verification') {
      statusHtml = `
        <div style="background:rgba(245,166,35,0.08);border:1.5px solid rgba(245,166,35,0.3);border-radius:12px;padding:1.2rem;margin-bottom:1.5rem;display:flex;align-items:center;gap:12px;">
          <div style="background:rgba(245,166,35,0.15);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#7a4f00;">
            <i data-lucide="clock"></i>
          </div>
          <div>
            <h4 style="color:#7a4f00;margin:0;font-size:0.95rem;">Awaiting Verification</h4>
            <p style="margin:2px 0 0;font-size:0.8rem;color:#7a4f00;opacity:0.8;">The user needs to confirm the cleanup before it is fully resolved.</p>
          </div>
        </div>`;
    } else if (c.status === 'Disputed') {
      statusHtml = `
        <div style="background:rgba(224,82,82,0.08);border:1.5px solid rgba(224,82,82,0.3);border-radius:12px;padding:1.2rem;margin-bottom:1.5rem;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
            <div style="background:rgba(224,82,82,0.15);width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--danger);">
              <i data-lucide="alert-triangle"></i>
            </div>
            <div>
              <h4 style="color:var(--danger);margin:0;font-size:0.95rem;">User Disputed Resolution</h4>
              <p style="margin:2px 0 0;font-size:0.8rem;color:var(--danger);opacity:0.8;">The user claims the issue was not resolved properly.</p>
            </div>
          </div>
          ${c.disputeReason ? `<div style="background:#fff;border:1px solid rgba(224,82,82,0.2);padding:12px;border-radius:8px;font-size:0.85rem;color:var(--text);margin-bottom:12px;"><strong>User says:</strong> "${c.disputeReason}"</div>` : ''}
          <button class="btn btn-outline" onclick="adminReopen('${c._id}')" style="width:100%;color:#3558b0;border-color:rgba(53,88,176,0.3);display:flex;align-items:center;justify-content:center;gap:6px;">
            <i data-lucide="rotate-ccw" style="width:16px;height:16px;"></i> Reopen Complaint
          </button>
        </div>`;
    }

    const overlay = document.createElement('div');
    overlay.id = 'workerDetailOverlay';
    overlay.className = 'ww-detail-overlay';
    
    // Use workerDetailOverlay classes for consistency
    overlay.innerHTML = `
      <div class="ww-detail-panel">
        <div class="ww-detail-header">
          <button class="ww-detail-close" onclick="if(window.adminDetailMapInstance){try{window.adminDetailMapInstance.remove();}catch(e){} window.adminDetailMapInstance=null;} document.getElementById('workerDetailOverlay').remove(); document.body.style.overflow = ''; loadAdminComplaints();"><i data-lucide="arrow-left" style="width:20px;height:20px;"></i></button>
          <div class="ww-detail-header-text">
            <span class="section-label">Complaint Detail</span>
            <h2>${c.category || 'Waste Report'}</h2>
          </div>
          <span class="status-badge-admin ${statusSlugAdmin(c.status)}">${c.status}</span>
        </div>
        <div class="ww-detail-body">
          ${statusHtml}
          
          <div style="display:flex;gap:1rem;margin-bottom:1.5rem;overflow-x:auto;padding-bottom:8px;">
            <div style="flex:1;min-width:200px;">
              <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;font-weight:700;text-transform:uppercase;">Report Photo</p>
              ${c.imagePath
                ? `<img src="${c.imagePath}" class="ww-detail-photo" alt="Complaint photo" style="margin-bottom:0;">`
                : `<div class="ww-detail-photo-empty"><i data-lucide="image" style="width:36px;height:36px;"></i>No photo</div>`
              }
            </div>
            ${c.proofImagePath ? `
            <div style="flex:1;min-width:200px;">
              <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;font-weight:700;text-transform:uppercase;">Proof Photo</p>
              <img src="${c.proofImagePath}" class="ww-detail-photo" alt="Proof photo" style="margin-bottom:0;border:2px solid var(--green);">
            </div>` : ''}
          </div>
          
          <div class="ww-detail-info-grid">
            <div class="ww-detail-info-item">
              <div class="ww-detail-info-lbl">Date Reported</div>
              <div class="ww-detail-info-val">${date}</div>
            </div>
            <div class="ww-detail-info-item">
              <div class="ww-detail-info-lbl">Urgency</div>
              <div class="ww-detail-info-val"><span class="ww-task-urgency ${(c.urgency||'low').toLowerCase()}" style="position:static;font-size:0.75rem;">${c.urgency || 'Low'}</span></div>
            </div>
            <div class="ww-detail-info-item">
              <div class="ww-detail-info-lbl">Reported By</div>
              <div class="ww-detail-info-val" style="font-size:0.82rem;word-break:break-all;">${c.userEmail || '—'}</div>
            </div>
            <div class="ww-detail-info-item">
              <div class="ww-detail-info-lbl">Assigned Worker</div>
              <div class="ww-detail-info-val" style="font-size:0.82rem;word-break:break-all;">${c.workerEmail || 'Unassigned'}</div>
            </div>
            <div class="ww-detail-info-item" style="grid-column:1/-1;">
              <div class="ww-detail-info-lbl">Location</div>
              <div class="ww-detail-info-val" style="font-size:0.85rem;font-weight:500;">${c.location}</div>
            </div>
            <div class="ww-detail-info-item" style="grid-column:1/-1;">
              <div class="ww-detail-info-lbl">Description</div>
              <div class="ww-detail-info-val" style="font-weight:500;font-size:0.88rem;line-height:1.6;white-space:pre-wrap;">${c.description || '—'}</div>
            </div>
          </div>
          ${hasCoords ? `
            <div style="margin-bottom:1rem;">
              <div class="ww-detail-info-lbl" style="margin-bottom:8px;">Location on Map</div>
              <div id="adminDetailMap" style="height:220px;border-radius:16px;border:1.5px solid var(--border);position:relative;z-index:0;overflow:hidden;"></div>
            </div>` : ''}
          <div id="adminDetailChildrenPlaceholder"></div>
        </div>
        <div class="ww-detail-actions">
          ${hasCoords ? `
            <button class="btn-directions" style="flex:1;" onclick="openDirections(${lat}, ${lng}, '${c.location.replace(/'/g, "\\'")}')">
              <i data-lucide="navigation-2" style="width:16px;height:16px;"></i> Get Directions
            </button>` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons();

    // Fetch and populate child duplicates asynchronously
    (async () => {
      try {
        const res = await fetch(`${API}/complaints/${c._id}/children`);
        if (!res.ok) return;
        const children = await res.json();
        const placeholder = document.getElementById("adminDetailChildrenPlaceholder");
        if (placeholder && children && children.length > 0) {
          placeholder.innerHTML = `
            <div style="margin-top:1.5rem;border-top:1.5px solid var(--border);padding-top:1.2rem;margin-bottom:1rem;">
              <p style="font-size:0.75rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;margin-bottom:0.8rem;">Duplicate Submissions (${children.length})</p>
              <div style="display:flex;flex-direction:column;gap:12px;">
                ${children.map(child => {
                  const childDate = new Date(child.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
                  return `
                    <div style="display:flex;gap:12px;background:#fcfcfc;border:1px solid var(--border);border-radius:10px;padding:10px;align-items:center;">
                      ${child.imagePath
                        ? `<img src="${child.imagePath}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid var(--border);" alt="duplicate">`
                        : `<div style="width:50px;height:50px;display:flex;align-items:center;justify-content:center;background:#eee;border-radius:6px;"><i data-lucide="image" style="width:16px;height:16px;color:#888;"></i></div>`
                      }
                      <div style="flex:1;min-width:0;">
                        <div style="display:flex;justify-content:between;align-items:center;margin-bottom:2px;font-size:0.75rem;">
                          <strong style="color:var(--text-dark);word-break:break-all;text-overflow:ellipsis;overflow:hidden;white-space:nowrap;max-width:180px;">${child.userEmail}</strong>
                          <span style="color:var(--text-muted);font-size:0.7rem;margin-left:auto;flex-shrink:0;">${childDate}</span>
                        </div>
                        <p style="margin:0;font-size:0.78rem;color:var(--text-muted);line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">"${child.description || 'No description'}"</p>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
          if (window.lucide) window.lucide.createIcons();
        }
      } catch (err) {
        console.error("Failed to load children:", err);
      }
    })();

    // Attach listeners for modal actions
    const selectEl = overlay.querySelector('.admin-status-select');
    if (selectEl) {
      selectEl.addEventListener('change', async function() {
        try {
          await fetch(`${API}/complaints/${this.dataset.id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
            body: JSON.stringify({ status: this.value }),
          });
          showToast('Status updated to: ' + this.value);
          // Auto update the background data 
          loadAdminComplaints();
        } catch { showToast('Failed to update.', 'error'); }
      });
    }

    document.body.style.overflow = 'hidden';
    overlay.addEventListener('click', e => {
      if (e.target === overlay) {
        if (window.adminDetailMapInstance) {
          try { window.adminDetailMapInstance.remove(); } catch(e) {}
          window.adminDetailMapInstance = null;
        }
        overlay.remove();
        document.body.style.overflow = '';
        loadAdminComplaints();
      }
    });

    setTimeout(() => {
      overlay.classList.add('open');
      if (hasCoords && window.L) {
        window.adminDetailMapInstance = L.map('adminDetailMap').setView([lat, lng], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(window.adminDetailMapInstance);
        
        const color = 
          c.status === "Verified" ? "#2d8a4e" : 
          c.status === "In Progress" ? "#3558b0" : 
          c.status === "Awaiting Verification" ? "#f5a623" : 
          c.status === "Disputed" ? "#e05252" : 
          "#e05252";
          
        L.marker([lat, lng], {
          icon: L.divIcon({ className: "", html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`, iconSize: [16,16] })
        }).addTo(window.adminDetailMapInstance).bindPopup(c.location);
      }
    }, 10);
    } catch(err) {
      alert("Error opening modal: " + err.message);
      console.error(err);
    }
  };

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
      raw.forEach((c) => {
        const area = (c.location || "Unknown").split(",")[0].trim();
        if (!areaMap[area]) areaMap[area] = { total: 0, resolved: 0 };
        areaMap[area].total++;
        if (c.status === "Verified") areaMap[area].resolved++;
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
      const color = 
        c.status === "Verified" ? "#2d8a4e" : 
        c.status === "In Progress" ? "#3558b0" : 
        c.status === "Awaiting Verification" ? "#f5a623" : 
        c.status === "Disputed" ? "#e05252" : 
        "#e05252";
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

// ─────────────────────────────────────────────────────────────────
//  SHARED UTILITIES (available on ALL pages)
// ─────────────────────────────────────────────────────────────────
window.activeRouteLayer = null;

window.openDirections = function(lat, lng, locationName) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    showToast("Exact coordinates not available for routing.", "error");
    return;
  }

  // Pick the right Leaflet map — admin popup → worker popup → main worker map
  const map = window.adminDetailMapInstance
            || window.workerDetailMapInstance
            || window.workerMapInstance;

  if (!map) {
    showToast("Map not ready yet. Please wait a moment.", "error");
    return;
  }

  // If using main worker map, scroll to it so user sees the route
  if (map === window.workerMapInstance) {
    const mc = document.getElementById("workerMapContainer");
    if (mc) mc.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  showToast("Getting your location for route...");

  if (!navigator.geolocation) {
    showToast("Geolocation not supported by this browser.", "error");
    return;
  }

  navigator.geolocation.getCurrentPosition(async (pos) => {
    const userLat = pos.coords.latitude;
    const userLng = pos.coords.longitude;
    try {
      const res = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${userLng},${userLat};${lng},${lat}?overview=full&geometries=geojson`
      );
      const data = await res.json();
      if (data.code !== "Ok" || !data.routes.length) throw new Error("No route");

      const coords = data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

      if (window.activeRouteLayer) {
        try { map.removeLayer(window.activeRouteLayer); } catch(e) {}
      }

      window.activeRouteLayer = L.polyline(coords, {
        color: '#3558b0', weight: 5, opacity: 0.85
      }).addTo(map);

      L.marker([userLat, userLng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:16px;height:16px;background:#3558b0;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,0.3)"></div>`,
          iconSize: [16,16]
        })
      }).addTo(map).bindPopup("Your Location").openPopup();

      map.fitBounds(window.activeRouteLayer.getBounds(), { padding: [30, 30] });
      showToast("Route drawn on map!");
    } catch (err) {
      showToast("Could not fetch route. Check your connection.", "error");
    }
  }, () => {
    showToast("Location permission denied.", "error");
  });
};

// ─────────────────────────────────────────────────────────────────
//  WORKER PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("workerMain")) {
  async function initWorkerPage() {
    const token = getToken();
    if (!token) {
      window.location.href = "index.html";
      return;
    }

    try {
      const res = await fetch(`${API}/me`, {
        headers: { Authorization: "Bearer " + token },
      });
      if (!res.ok) throw new Error("Invalid session");

      const user = await res.json();
      if (user.role !== "worker") throw new Error("Not worker");

      setUser({ email: user.email, role: user.role });
      document.getElementById("workerMain").style.visibility = "visible";
      updateNav();
      loadWorkerComplaints();
    } catch {
      window.location.href = "index.html";
    }
  }

  let workerAllComplaints = [];

  async function loadWorkerComplaints() {
    const grid = document.getElementById("workerTasksGrid");
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">Loading your assignments…</div>`;
    
    try {
      const res = await fetch(`${API}/complaints/assigned`, {
        headers: { Authorization: "Bearer " + getToken() }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      workerAllComplaints = data;
      const user = getUser();
      if (document.getElementById("workerEmailDisplay")) {
        document.getElementById("workerEmailDisplay").textContent = user?.email || "";
      }
      updateWorkerSummary();
      renderWorkerTable(workerAllComplaints);
      
      if (window.L && document.getElementById("workerMapContainer")) {
        if (window.workerMapInstance) {
          window.workerMapInstance.remove();
        }
        window.workerMapInstance = initLeafletMap("workerMapContainer", workerAllComplaints);
      }
    } catch {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--danger);">Failed to load assigned tasks.</div>`;
    }
  }

  function updateWorkerSummary() {
    const summaryEl = document.getElementById("workerSummaryCards");
    if (!summaryEl) return;
    const total = workerAllComplaints.length;
    const inProg = workerAllComplaints.filter(c => c.status === "In Progress").length;
    const awaiting = workerAllComplaints.filter(c => c.status === "Awaiting Verification").length;
    const verified = workerAllComplaints.filter(c => c.status === "Verified").length;
    
    summaryEl.innerHTML = `
      <div class="admin-card"><span>Total Assigned</span><strong>${total}</strong></div>
      <div class="admin-card" style="border-color:rgba(53,88,176,0.3)"><span>In Progress</span><strong style="color:#3558b0">${inProg}</strong></div>
      <div class="admin-card" style="border-color:rgba(245,166,35,0.4)"><span>Submitted for Review</span><strong style="color:#7a4f00">${awaiting}</strong></div>
      <div class="admin-card resolved"><span>Verified</span><strong>${verified}</strong></div>`;
  }

  function renderWorkerTable(complaints) {
    const grid = document.getElementById("workerTasksGrid");
    if (!complaints.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><i data-lucide="inbox" style="width:40px;height:40px;color:var(--text-muted);"></i><h3>No tasks</h3><p>No complaints match this filter.</p></div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    grid.innerHTML = complaints.map(c => {
      let actionHtml = "";
      if (['Pending', 'In Progress', 'Disputed'].includes(c.status)) {
        actionHtml = `
          <button class="btn-directions" onclick="event.stopPropagation(); openDirections(${c.lat}, ${c.lng}, '${c.location.replace(/'/g, "\\'")}')">
            <i data-lucide="navigation-2" style="width:15px;height:15px;"></i> Directions
          </button>
          <button class="btn-upload-proof" onclick="event.stopPropagation(); openWorkerResolveModal('${c._id}')">
            <i data-lucide="camera" style="width:15px;height:15px;"></i> Upload Proof
          </button>`;
      } else if (c.status === "Awaiting Verification") {
        actionHtml = `
          <div class="ww-task-status-msg awaiting">
            <i data-lucide="clock" style="width:14px;height:14px;"></i> Waiting for user to verify
          </div>`;
      } else if (c.status === "Verified") {
        actionHtml = `
          <div class="ww-task-status-msg verified">
            <i data-lucide="check-circle" style="width:14px;height:14px;"></i> Completed & Verified
          </div>`;
      } else if (c.status === "Disputed") {
        actionHtml = `
          <div class="ww-task-status-msg disputed">
            <i data-lucide="alert-circle" style="width:14px;height:14px;"></i> Disputed — Admin will review
          </div>`;
      }

      return `
        <div class="ww-task-card" data-id="${c._id}">
          <div class="ww-task-img">
            ${c.imagePath
              ? `<img src="${c.imagePath}" alt="Complaint photo">`
              : `<div class="ww-task-img-empty"><i data-lucide="image" style="width:28px;height:28px;"></i><span>No photo</span></div>`
            }
            <span class="ww-task-urgency ${(c.urgency||'low').toLowerCase()}">${c.urgency || 'Low'}</span>
          </div>
          <div class="ww-task-body">
            <div class="ww-task-row-top">
              <span class="ww-task-category">${c.category || 'Waste Report'}</span>
              <span class="status-badge-admin ${statusSlugAdmin(c.status)}">${c.status}</span>
            </div>
            <div class="ww-task-location">
              <i data-lucide="map-pin" style="width:13px;height:13px;flex-shrink:0;color:var(--green);"></i>
              <span>${c.location}</span>
            </div>
            <div class="ww-task-desc">
              ${(c.description || '').slice(0, 90)}${(c.description||'').length > 90 ? '…' : ''}
            </div>
            <div class="ww-task-meta">
              <span><i data-lucide="calendar" style="width:12px;height:12px;"></i> ${new Date(c.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
              <span><i data-lucide="user" style="width:12px;height:12px;"></i> ${c.userEmail || '—'}</span>
            </div>
          </div>
          <div class="ww-task-actions">${actionHtml}</div>
        </div>`;
    }).join("");
    
    if (window.lucide) window.lucide.createIcons();

    document.querySelectorAll('.ww-task-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const complaint = workerAllComplaints.find(c => c._id === id);
        if (complaint) openWorkerDetail(complaint);
      });
    });
  }

    window.openWorkerDetail = function(c) {
    document.getElementById('workerDetailOverlay')?.remove();

    const lat = Number(c.lat);
    const lng = Number(c.lng);
    const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
    const date = new Date(c.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });

    const overlay = document.createElement('div');
    overlay.id = 'workerDetailOverlay';
    overlay.className = 'ww-detail-overlay';
    overlay.innerHTML = `
      <div class="ww-detail-panel">
        <div class="ww-detail-header">
          <button class="ww-detail-close" id="workerDetailClose"><i data-lucide="arrow-left" style="width:20px;height:20px;"></i></button>
          <div class="ww-detail-header-text">
            <span class="section-label">Task Detail</span>
            <h2>${c.category || 'Waste Report'}</h2>
          </div>
          <span class="status-badge-admin ${statusSlugAdmin(c.status)}">${c.status}</span>
        </div>
        <div class="ww-detail-body">
          ${c.imagePath
            ? `<img src="${c.imagePath}" class="ww-detail-photo" alt="Complaint photo">`
            : `<div class="ww-detail-photo-empty"><i data-lucide="image" style="width:36px;height:36px;"></i>No photo submitted</div>`
          }
          <div class="ww-detail-info-grid">
            <div class="ww-detail-info-item">
              <div class="ww-detail-info-lbl">Date Reported</div>
              <div class="ww-detail-info-val">${date}</div>
            </div>
            <div class="ww-detail-info-item">
              <div class="ww-detail-info-lbl">Urgency</div>
              <div class="ww-detail-info-val"><span class="ww-task-urgency ${(c.urgency||'low').toLowerCase()}" style="position:static;font-size:0.75rem;">${c.urgency || 'Low'}</span></div>
            </div>
            <div class="ww-detail-info-item">
              <div class="ww-detail-info-lbl">Reported By</div>
              <div class="ww-detail-info-val" style="font-size:0.82rem;">${c.userEmail || '—'}</div>
            </div>
            <div class="ww-detail-info-item">
              <div class="ww-detail-info-lbl">Category</div>
              <div class="ww-detail-info-val">${c.category || '—'}</div>
            </div>
            <div class="ww-detail-info-item" style="grid-column:1/-1;">
              <div class="ww-detail-info-lbl">Location</div>
              <div class="ww-detail-info-val" style="font-size:0.85rem;font-weight:500;">${c.location}</div>
            </div>
            <div class="ww-detail-info-item" style="grid-column:1/-1;">
              <div class="ww-detail-info-lbl">Description</div>
              <div class="ww-detail-info-val" style="font-weight:500;font-size:0.88rem;line-height:1.6;">${c.description || '—'}</div>
            </div>
          </div>
          ${hasCoords ? `
            <div style="margin-bottom:1rem;">
              <div class="ww-detail-info-lbl" style="margin-bottom:8px;">Location on Map</div>
              <div id="workerDetailMap" style="height:220px;border-radius:16px;border:1.5px solid var(--border);position:relative;z-index:0;overflow:hidden;"></div>
            </div>` : ''}
          ${c.status === 'Disputed' && c.disputeReason ? `
            <div class="disputed-reason-box" style="max-width:100%;margin-bottom:1rem;">
              <strong>Dispute Reason</strong>${c.disputeReason}
            </div>` : ''}
        </div>
        <div class="ww-detail-actions">
          ${hasCoords ? `
            <button class="btn-directions" style="flex:1;" onclick="openDirections(${lat}, ${lng}, '${c.location.replace(/'/g, "\\'")}')">
              <i data-lucide="navigation-2" style="width:16px;height:16px;"></i> Get Directions
            </button>` : ''}
          ${['Pending', 'In Progress', 'Disputed'].includes(c.status) ? `
            <button class="btn-upload-proof" style="flex:1;" onclick="document.getElementById('workerDetailOverlay').remove(); document.body.style.overflow=''; openWorkerResolveModal('${c._id}')">
              <i data-lucide="camera" style="width:16px;height:16px;"></i> Upload Proof
            </button>` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    if (window.lucide) window.lucide.createIcons();

    if (hasCoords) {
      setTimeout(() => {
        const mapEl = document.getElementById('workerDetailMap');
        if (!mapEl || !window.L) return;
        const map = L.map(mapEl, {
          center: [lat, lng], zoom: 16,
          zoomControl: true, scrollWheelZoom: true, attributionControl: false,
        });
        window.workerDetailMapInstance = map; // Save for routing
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:20px;height:20px;background:#e05252;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 5px rgba(224,82,82,0.2),0 3px 10px rgba(0,0,0,0.3);animation:map-pulse 1.8s ease-in-out infinite;"></div>`,
          iconSize: [20,20], iconAnchor: [10,10],
        });
        L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<b>${c.location}</b>`).openPopup();
        setTimeout(() => map.invalidateSize(), 100);
      }, 120);
    }

    document.getElementById('workerDetailClose').addEventListener('click', () => {
      overlay.remove();
      document.body.style.overflow = '';
    });
    overlay.addEventListener('click', e => { 
      if (e.target === overlay) {
        overlay.remove();
        document.body.style.overflow = '';
      }
    });

    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => overlay.classList.add('open'));
  }

  document.querySelectorAll("#workerFilterTabs .tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#workerFilterTabs .tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const status = btn.dataset.status;
      if (status === "All") renderWorkerTable(workerAllComplaints);
      else renderWorkerTable(workerAllComplaints.filter(c => c.status === status));
    });
  });

  window.openWorkerResolveModal = function (id) {
    document.getElementById("resolveModalOverlay")?.remove();
    const overlay = document.createElement("div");
    overlay.className = "ww-modal-overlay";
    overlay.id = "resolveModalOverlay";
    overlay.innerHTML = `
      <div class="ww-modal">
        <div class="ww-modal-title">
          <i data-lucide="camera" style="width:20px;height:20px;color:var(--green);"></i>
          Upload Cleanup Proof
        </div>
        <div class="upload-zone" id="resolveUploadZone" style="padding:1rem;display:flex;flex-direction:column;gap:1rem;">
          <div style="display:flex;gap:1rem;flex-wrap:wrap;">
            <button type="button" class="btn btn-outline btn-camera-capture" id="btnWorkerCamera" style="flex:1;justify-content:center;">
              <i data-lucide="camera" style="width:18px;height:18px;"></i> Take Photo
            </button>
            <label class="btn btn-outline btn-file-browse" style="flex:1;justify-content:center;margin:0;cursor:pointer;">
              <i data-lucide="folder-open" style="width:18px;height:18px;"></i> Browse Files
              <input type="file" id="resolveProofInput" accept="image/*" style="display:none;">
            </label>
          </div>
          <div id="workerCameraPreviewContainer" style="display:none;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
            <video id="workerCameraVideo" autoplay playsinline style="width:100%;max-height:300px;object-fit:cover;border-radius:10px;background:#000;"></video>
            <button type="button" class="btn btn-primary" id="btnWorkerCapturePhoto" style="justify-content:center;">Capture</button>
          </div>
          <img id="resolveProofPreview" class="upload-preview" alt="Preview" style="display:none;max-width:100%;border-radius:10px;margin-top:0.5rem;">
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
    
    let wMediaStream = null;
    const workerCameraBtn = document.getElementById("btnWorkerCamera");
    const workerCameraContainer = document.getElementById("workerCameraPreviewContainer");
    const workerVideo = document.getElementById("workerCameraVideo");
    const workerCaptureBtn = document.getElementById("btnWorkerCapturePhoto");
    const fileInput = document.getElementById("resolveProofInput");
    const previewImg = document.getElementById("resolveProofPreview");

    function stopStream() {
      if (wMediaStream) {
        wMediaStream.getTracks().forEach(t => t.stop());
        wMediaStream = null;
      }
    }

    overlay.addEventListener("click", e => { if (e.target === overlay) { stopStream(); overlay.remove(); } });
    document.getElementById("resolveCancelBtn").addEventListener("click", () => { stopStream(); overlay.remove(); });
    
    workerCameraBtn.addEventListener("click", async () => {
      try {
        wMediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        workerVideo.srcObject = wMediaStream;
        workerCameraContainer.style.display = "flex";
        previewImg.style.display = "none";
      } catch {
        showToast("Camera access denied", "error");
      }
    });

    workerCaptureBtn.addEventListener("click", () => {
      if (!wMediaStream) return;
      const canvas = document.createElement("canvas");
      canvas.width = workerVideo.videoWidth;
      canvas.height = workerVideo.videoHeight;
      canvas.getContext("2d").drawImage(workerVideo, 0, 0);
      
      canvas.toBlob(blob => {
        const file = new File([blob], "camera-proof.jpg", { type: "image/jpeg" });
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        
        const reader = new FileReader();
        reader.onload = (ev) => { 
          previewImg.src = ev.target.result; 
          previewImg.style.display = "block";
          workerCameraContainer.style.display = "none";
        };
        reader.readAsDataURL(file);
      }, "image/jpeg", 0.92);

      stopStream();
    });

    fileInput.addEventListener("change", function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        previewImg.src = ev.target.result; 
        previewImg.style.display = "block";
        workerCameraContainer.style.display = "none";
      };
      reader.readAsDataURL(file);
    });

    document.getElementById("resolveSubmitBtn").addEventListener("click", async () => {
      const note = document.getElementById("resolveNote").value.trim();
      const btn = document.getElementById("resolveSubmitBtn");
      if (!fileInput.files || !fileInput.files[0]) { showToast("Please provide a proof photo.", "error"); return; }
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
        showToast("Proof uploaded successfully!");
        stopStream();
        overlay.remove(); 
        loadWorkerComplaints();
      } catch { showToast("Network error.", "error"); btn.textContent = "Submit Resolution"; btn.disabled = false; }
    });
  };

  initWorkerPage();
}
