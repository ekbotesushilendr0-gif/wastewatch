// ─────────────────────────────────────────────────────────────────
//  WasteWatch — script.js
//  Pure real backend auth. No fake users. No localStorage tricks.
// ─────────────────────────────────────────────────────────────────

const API = "http://localhost:3000/api";

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
async function updateNav() {
  let user = getUser();
  if (getToken()) {
    try {
      user = await fetchCurrentUser();
    } catch {
      user = getUser();
    }
  }

  document.querySelectorAll(".nav-login-link").forEach((el) => {
    if (user) {
      el.textContent = "Logout";
      el.href = "#";
      el.onclick = (e) => { e.preventDefault(); logout(); };
    } else {
      el.textContent = "Login";
      el.href = "login.html";
      el.onclick = null;
    }
  });
}

// ── Toast ─────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  let t = document.getElementById("ww-toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "ww-toast";
    t.style.cssText = `position:fixed;bottom:2rem;right:2rem;z-index:9999;
      padding:13px 22px;border-radius:12px;font-family:'DM Sans',sans-serif;
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
  `;
  document.head.appendChild(s);
})();

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
  updateNav();
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
  updateNav();
  if (getUser() && getToken()) window.location.href = getRole() === "admin" ? "admin.html" : "complaints.html";

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
      window.location.href = data.role === "admin" ? "admin.html" : "complaints.html";
    } catch {
      showErr("formError", "Cannot reach server. Make sure it is running on port 3000.");
      setBtn(btn, "Sign In →", false);
    }
  });
}

// ─────────────────────────────────────────────────────────────────
//  REGISTER PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("registerForm")) {
  updateNav();
  if (getUser() && getToken()) window.location.href = "complaints.html";

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
    } catch {
      showErr("formError", "Cannot reach server. Make sure it is running on port 3000.");
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
      showToast("Email verified! Welcome to WasteWatch 🎉");
      setTimeout(() => (window.location.href = "complaints.html"), 800);
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
  updateNav();
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
        if (!res.ok) { showToast(data.error || "Failed to submit.", "error"); setBtn(btn, "🚀 Submit Report", false); return; }
        setBtn(btn, "✅ Submitted!", true);
        showToast("Report submitted successfully!");
        setTimeout(() => (window.location.href = "complaints.html"), 900);
      } catch {
        showToast("Cannot reach server.", "error");
        setBtn(btn, "🚀 Submit Report", false);
      }
    });
  }
}

// ─────────────────────────────────────────────────────────────────
//  MY COMPLAINTS PAGE
// ─────────────────────────────────────────────────────────────────
if (document.getElementById("complaintsBody")) {
  if (!getUser() || !getToken()) { window.location.href = "login.html"; }
  updateNav();

  let allComplaints = [];

  async function loadMyComplaints() {
    const tbody = document.getElementById("complaintsBody");
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted)">Loading…</td></tr>`;
    try {
      const res = await fetch(`${API}/complaints/me`, {
        headers: { Authorization: "Bearer " + getToken() },
      });
      if (res.status === 401) { logout(); return; }
      allComplaints = await res.json();
    } catch {
      allComplaints = [];
      showToast("Could not load complaints — is the server running?", "error");
    }
    renderComplaints(allComplaints);
  }

  function renderComplaints(list) {
    const tbody = document.getElementById("complaintsBody");
    const countEl = document.getElementById("complaintCount");
    if (countEl) countEl.textContent = `${allComplaints.length} complaint${allComplaints.length !== 1 ? "s" : ""}`;

    const summaryEl = document.getElementById("summaryCards");
    if (summaryEl) {
      const pending = allComplaints.filter((c) => c.status === "Pending").length;
      const resolved = allComplaints.filter((c) => c.status === "Resolved").length;
      summaryEl.innerHTML = `
        <div class="admin-card"><span>Total</span><strong>${allComplaints.length}</strong></div>
        <div class="admin-card pending"><span>Pending</span><strong>${pending}</strong></div>
        <div class="admin-card resolved"><span>Resolved</span><strong>${resolved}</strong></div>`;
    }

    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">
        <span class="empty-icon">📭</span><h3>No complaints yet</h3>
        <p>Submit your first waste report to get started.</p>
        <a href="report.html" class="btn btn-primary" style="margin-top:1rem">+ New Report</a>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = list.map((c) => `
      <tr>
        <td>${c.imagePath
          ? `<img src="${c.imagePath}" style="width:52px;height:40px;object-fit:cover;border-radius:7px;">`
          : `<div style="width:52px;height:40px;border-radius:7px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.3rem;border:1px solid var(--border);">📷</div>`}</td>
        <td><strong>${c.location}</strong></td>
        <td><span class="status-pill" style="background:rgba(45,138,78,0.1);color:var(--green-dark)">${c.category || "—"}</span></td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.description}">${c.description}</td>
        <td style="white-space:nowrap;color:var(--text-muted);font-size:0.85rem">${new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td>
        <td><span class="status-badge status-${statusClass(c.status)}">${c.status}</span></td>
      </tr>`).join("");
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const filter = btn.dataset.filter;
      const filtered = filter === "all" ? allComplaints : allComplaints.filter((c) => c.status === filter);
      renderComplaints(filtered);
    });
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
      all = await res.json();
    } catch { showToast("Could not load complaints.", "error"); }

    const summaryEl = document.getElementById("adminSummaryCards");
    if (summaryEl) {
      const pending = all.filter((c) => c.status === "Pending").length;
      const inProg = all.filter((c) => c.status === "In Progress").length;
      const resolved = all.filter((c) => c.status === "Resolved").length;
      summaryEl.innerHTML = `
        <div class="admin-card"><span>Total Reports</span><strong>${all.length}</strong></div>
        <div class="admin-card pending"><span>Pending</span><strong>${pending}</strong></div>
        <div class="admin-card"><span>In Progress</span><strong style="color:#3558b0">${inProg}</strong></div>
        <div class="admin-card resolved"><span>Resolved</span><strong>${resolved}</strong></div>`;
      summaryEl.style.gridTemplateColumns = "repeat(4,1fr)";
    }

    const tbody = document.getElementById("adminComplaintsBody");
    tbody.innerHTML = !all.length
      ? `<tr><td colspan="5"><div class="empty-state"><span class="empty-icon">📋</span><h3>No complaints yet</h3></div></td></tr>`
      : all.map((c) => `
          <tr>
            <td>${c.imagePath
              ? `<img src="${c.imagePath}" style="width:56px;height:44px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`
              : `<div style="width:56px;height:44px;border-radius:8px;background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.4rem;border:1px solid var(--border);">📷</div>`}</td>
            <td><strong style="display:block">${c.location}</strong><span style="font-size:0.8rem;color:var(--text-muted)">${c.userEmail || "—"}</span></td>
            <td style="max-width:200px;font-size:0.9rem;color:var(--text-muted)">${c.description}</td>
            <td>
              <select class="status-select" data-id="${c._id}" style="padding:7px 10px;border-radius:8px;border:1.5px solid var(--border);font-family:'DM Sans',sans-serif;font-size:0.85rem;background:var(--bg);cursor:pointer;">
                <option value="Pending" ${c.status === "Pending" ? "selected" : ""}>⏳ Pending</option>
                <option value="In Progress" ${c.status === "In Progress" ? "selected" : ""}>🔄 In Progress</option>
                <option value="Resolved" ${c.status === "Resolved" ? "selected" : ""}>✅ Resolved</option>
              </select>
            </td>
            <td><button class="btn-mini" onclick="adminDelete('${c._id}')" style="color:var(--danger);border-color:rgba(224,82,82,0.3)">🗑 Delete</button></td>
          </tr>`).join("");

    document.querySelectorAll(".status-select").forEach((sel) => {
      sel.addEventListener("change", async function () {
        try {
          await fetch(`${API}/complaints/${this.dataset.id}/status`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + getToken(),
            },
            body: JSON.stringify({ status: this.value }),
          });
          showToast("Status updated to: " + this.value);
        } catch { showToast("Failed to update.", "error"); }
        loadAdminComplaints();
      });
    });

    renderAdminMap(all);
  }

  window.adminDelete = async function (id) {
    if (!confirm("Delete this complaint?")) return;
    try {
      await fetch(`${API}/complaints/${id}`, {
        method: "DELETE",
        headers: { Authorization: "Bearer " + getToken() },
      });
      showToast("Complaint deleted.");
    } catch { showToast("Failed to delete.", "error"); }
    loadAdminComplaints();
  };

  function renderAdminMap(complaints) {
    const mapEl = document.getElementById("adminMapContainer");
    if (!mapEl || !window.L) return;
    if (adminMap) { adminMap.remove(); adminMap = null; }
    // Locked to Hubli-Dharwad Municipal Corporation
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
        const color = c.status === "Resolved" ? "#2d8a4e" : c.status === "In Progress" ? "#3558b0" : "#e05252";
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
  updateNav();

  fetch(`${API}/complaints/all`)
    .then((r) => r.json())
    .then((all) => {
      const pending = all.filter((c) => c.status === "Pending").length;
      const inProg = all.filter((c) => c.status === "In Progress").length;
      const resolved = all.filter((c) => c.status === "Resolved").length;

      const summaryEl = document.getElementById("citySummaryCards");
      summaryEl.innerHTML = `
        <div class="admin-card"><span>Total Reports</span><strong>${all.length}</strong></div>
        <div class="admin-card pending"><span>Pending</span><strong>${pending}</strong></div>
        <div class="admin-card"><span>In Progress</span><strong style="color:#3558b0">${inProg}</strong></div>
        <div class="admin-card resolved"><span>Resolved</span><strong>${resolved}</strong></div>`;
      summaryEl.style.gridTemplateColumns = "repeat(4,1fr)";

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
          <span>📍 ${name}</span>
          <div style="display:flex;align-items:center;gap:0.5rem">
            <strong>${d.total} report${d.total !== 1 ? "s" : ""}</strong>
            <span class="status-pill" style="background:rgba(45,138,78,0.1);color:var(--green-dark);font-size:0.75rem">${d.resolved} resolved</span>
          </div>
        </div>`).join("") || `<p class="city-empty">No area data yet.</p>`;

      const recentEl = document.getElementById("recentComplaintsList");
      recentEl.innerHTML = all.slice(0, 6).map((c) => `
        <div class="recent-item">
          <div>
            <strong>📍 ${c.location}</strong>
            <p>${(c.description || "").slice(0, 80)}${(c.description || "").length > 80 ? "…" : ""}</p>
            <small>${new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</small>
          </div>
          <span class="status-badge status-${statusClass(c.status)}">${c.status}</span>
        </div>`).join("") || `<p class="city-empty">No recent complaints.</p>`;

      if (window.L && document.getElementById("cityStatusMap")) initLeafletMap("cityStatusMap", all);
    })
    .catch(() => showToast("Could not load city data.", "error"));
}

// ─────────────────────────────────────────────────────────────────
//  LEAFLET MAP HELPERS
// ─────────────────────────────────────────────────────────────────
function getComplaintCoords(complaint, cache) {
  const lat = Number(complaint.lat);
  const lng = Number(complaint.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return Promise.resolve([lat, lng]);
  return geocodeLocation(complaint.location, cache);
}

function geocodeLocation(locationStr, cache) {
  if (cache && cache[locationStr]) return Promise.resolve(cache[locationStr]);
  // Bias geocoding to Hubli-Dharwad Municipal Corporation bounds
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
      const color = c.status === "Resolved" ? "#2d8a4e" : c.status === "In Progress" ? "#3558b0" : "#e05252";
      L.marker(coords, {
        icon: L.divIcon({ className: "", html: `<div style="background:${color};width:16px;height:16px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] })
      }).addTo(map).bindPopup(`<div style="min-width:160px;font-family:'DM Sans',sans-serif"><b>${c.location}</b><br><span style="font-size:0.8rem;color:#5a7060">${c.category || ""}</span><br><span style="color:${color};font-weight:700">${c.status}</span><p style="font-size:0.8rem;margin-top:4px;color:#5a7060">${(c.description || "").slice(0, 80)}</p></div>`);
    }));
  Promise.all(promises).then(() => {
    if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    else if (bounds.length === 1) map.setView(bounds[0], 14);
  });
  return map;
}
