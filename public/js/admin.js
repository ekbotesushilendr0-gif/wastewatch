// ─────────────────────────────────────────────────────────────────
//  WasteWatch — js/admin.js
//  Admin Dashboard Logic
// ─────────────────────────────────────────────────────────────────

if (document.getElementById("adminComplaintsBody")) {
  const adminWrap = document.querySelector(".admin-wrap");
  const adminComplaintsBody = document.getElementById("adminComplaintsBody");
  let adminMap = null;

  function getAdminOverlay() {
    return document.getElementById("adminDetailOverlay");
  }

  function removeAdminOverlay() {
    const overlay = getAdminOverlay();
    if (overlay) overlay.remove();
    if (window.adminDetailMapInstance) {
      try { window.adminDetailMapInstance.remove(); } catch (e) {}
      window.adminDetailMapInstance = null;
    }
    if (window.activeRouteLayer && window.adminDetailMapInstance) {
      try { window.adminDetailMapInstance.removeLayer(window.activeRouteLayer); } catch (e) {}
    }
    window.activeRouteLayer = null;
    document.body.style.overflow = "";
  }

  function initAdminDetailMap(complaint) {
    const mapEl = document.getElementById("adminDetailMap");
    const lat = Number(complaint.lat);
    const lng = Number(complaint.lng);
    if (!mapEl || !window.L || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    if (window.adminDetailMapInstance) {
      try { window.adminDetailMapInstance.remove(); } catch (e) {}
      window.adminDetailMapInstance = null;
    }

    const map = L.map(mapEl, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false,
    });
    window.adminDetailMapInstance = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    const color =
      complaint.status === "Verified" ? "#2d8a4e" :
      complaint.status === "In Progress" ? "#3558b0" :
      complaint.status === "Awaiting Verification" ? "#f5a623" :
      complaint.status === "Disputed" ? "#e05252" :
      "#e05252";

    L.marker([lat, lng], {
      icon: L.divIcon({
        className: "",
        html: `<div style="background:${color};width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 0 0 5px rgba(224,82,82,0.2),0 3px 10px rgba(0,0,0,0.3);animation:map-pulse 1.8s ease-in-out infinite;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(map).bindPopup(`<b>${complaint.location}</b>`).openPopup();

    requestAnimationFrame(() => map.invalidateSize());
    setTimeout(() => map.invalidateSize(), 180);
    return map;
  }

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
    const listEl = adminComplaintsBody;
    // Show Pulse Skeleton Loader
    listEl.innerHTML = Array(3).fill(`
      <div class="skeleton-card">
        <div class="skeleton-img skeleton-pulse"></div>
        <div class="skeleton-body">
          <div class="skeleton-line skeleton-pulse" style="width: 70%;"></div>
          <div class="skeleton-line skeleton-pulse short" style="width: 50%;"></div>
          <div class="skeleton-line skeleton-pulse short" style="width: 30%;"></div>
        </div>
      </div>
    `).join("");

    let all = [];
    try {
      const res = await fetch(`${API}/complaints/all`);
      const raw = await res.json();
      all = raw.filter(c => c.status !== "Verified");
    } catch { 
      showToast("Could not load complaints.", "error"); 
    }

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

      // Use Optimized Cloudinary Thumbnails in List Cards
      const imgHtml = c.imagePath
        ? `<img src="${getThumbnailUrl(c.imagePath, 150, 150)}" class="admin-c-thumb" alt="complaint">`
        : `<div class="admin-c-thumb-empty"><i data-lucide="image" style="width:20px;height:20px;"></i></div>`;

      const proofHtml = c.proofImagePath
        ? `<img src="${getThumbnailUrl(c.proofImagePath, 150, 150)}" class="admin-c-thumb" alt="proof" style="border-color:rgba(45,138,78,0.3);">`
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
        <div class="admin-c-card" data-id="${c._id}" style="cursor:pointer;" role="button" tabindex="0" aria-label="Open complaint details">
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

    // Click handling done via event delegation at the bottom of this block

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
        } catch { 
          showToast('Failed to update.', 'error'); 
        }
        loadAdminComplaints();
      });
    });

    async function assignWorkerByEmail(id, email, btn, row = null) {
      if (!email) { showToast("Enter a worker email", "error"); return false; }
      if (btn) btn.disabled = true;
      try {
        const res = await fetch(`${API}/complaints/${id}/assign-worker`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
          body: JSON.stringify({ workerEmail: email }),
        });
        const data = await res.json();
        if (!res.ok) { 
          showToast(data.error || "Failed to assign.", "error"); 
          if (btn) btn.disabled = false; 
          return false; 
        }
        showToast("Worker assigned successfully.");
        loadAdminComplaints();

        // Update current local cache/list so it is accurate if the modal stays open
        if (window.adminAllComplaints) {
          const comp = window.adminAllComplaints.find(x => x._id === id);
          if (comp) {
            comp.workerEmail = email;
            comp.status = "In Progress";
          }
        }

        // Live update the open modal elements
        const overlay = getAdminOverlay();
        if (overlay) {
          // Update worker value in detail grid
          const labelElements = overlay.querySelectorAll('.ww-detail-info-lbl');
          labelElements.forEach(lbl => {
            if (lbl.textContent.trim() === "Assigned Worker") {
              const valEl = lbl.nextElementSibling;
              if (valEl) valEl.textContent = email;
            }
          });

          // Update current assigned status div
          let statusDiv = row?.nextElementSibling;
          if (statusDiv && statusDiv.textContent.includes("Currently assigned to")) {
            statusDiv.innerHTML = `<i data-lucide="check-circle" style="width:14px;height:14px;"></i> Currently assigned to ${email}`;
          } else if (row) {
            const newStatusDiv = document.createElement('div');
            newStatusDiv.style.cssText = "font-size:0.8rem;color:var(--green);margin-top:6px;display:flex;align-items:center;gap:4px;font-weight:600;";
            newStatusDiv.innerHTML = `<i data-lucide="check-circle" style="width:14px;height:14px;"></i> Currently assigned to ${email}`;
            row.parentNode.appendChild(newStatusDiv);
          }

          // Update header status badge
          const headerBadge = overlay.querySelector('.ww-detail-header .status-badge-admin');
          if (headerBadge) {
            headerBadge.textContent = "In Progress";
            headerBadge.className = `status-badge-admin ${statusSlugAdmin("In Progress")}`;
          }

          // Update state of Update Status dropdown in modal
          const modalStatusSelect = overlay.querySelector('.admin-status-select');
          if (modalStatusSelect) {
            modalStatusSelect.value = "In Progress";
          }

          if (window.lucide) window.lucide.createIcons();
        }
        return true;
      } catch (err) { 
        console.error(err);
        showToast("Network error.", "error"); 
        if (btn) btn.disabled = false; 
        return false;
      }
    }

    window.assignWorker = async function(id, btn) {
      const row = btn.closest(".worker-assign-row");
      const input = row.querySelector(".worker-assign-input");
      const email = input.value.trim().toLowerCase();
      await assignWorkerByEmail(id, email, btn, row);
    };

    renderAdminMap(all);
  }

  window.adminReopen = async function (id) {
    if (!confirm("Reopen this complaint and set it back to In Progress?")) return;
    try {
      const res = await fetch(`${API}/complaints/${id}/reopen`, {
        method: "POST", 
        headers: { Authorization: "Bearer " + getToken() },
      });
      if (!res.ok) throw new Error();
      showToast("Complaint reopened to In Progress.");
    } catch { 
      showToast("Failed to reopen.", "error"); 
    }
    loadAdminComplaints();
  };

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
        L.marker(coords, { 
          icon: L.divIcon({ 
            className: "", 
            html: `<div style="background:${color};width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`, 
            iconSize: [14, 14] 
          }) 
        })
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
      removeAdminOverlay();

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
      overlay.id = 'adminDetailOverlay';
      overlay.className = 'ww-detail-overlay';
      
      overlay.innerHTML = `
        <div class="ww-detail-panel">
          <div class="ww-detail-header">
            <button class="ww-detail-close" id="adminDetailClose"><i data-lucide="arrow-left" style="width:20px;height:20px;"></i></button>
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
              <button class="btn-directions" id="adminDirectionsBtn" style="flex:1;">
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
                          ? `<img src="${getThumbnailUrl(child.imagePath, 100, 100)}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid var(--border);" alt="duplicate">`
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
          const newStatus = this.value;
          try {
            await fetch(`${API}/complaints/${this.dataset.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
              body: JSON.stringify({ status: newStatus }),
            });
            showToast('Status updated to: ' + newStatus);
            loadAdminComplaints();

            // Update current cache
            if (window.adminAllComplaints) {
              const comp = window.adminAllComplaints.find(x => x._id === this.dataset.id);
              if (comp) comp.status = newStatus;
            }

            // Live update status badge in modal header
            const headerBadge = overlay.querySelector('.ww-detail-header .status-badge-admin');
            if (headerBadge) {
              headerBadge.textContent = newStatus === "In Progress" ? "In Progress" : newStatus;
              headerBadge.className = `status-badge-admin ${statusSlugAdmin(newStatus)}`;
            }
          } catch (err) { 
            console.error(err);
            showToast('Failed to update.', 'error'); 
          }
        });
      }

      // Close button — use addEventListener to avoid inline onclick escaping issues
      function closeAdminDetail() {
        removeAdminOverlay();
        loadAdminComplaints();
      }

      document.getElementById('adminDetailClose').addEventListener('click', closeAdminDetail);

      document.body.style.overflow = 'hidden';
      overlay.addEventListener('click', e => {
        if (e.target === overlay) closeAdminDetail();
      });

      // Use double-rAF to ensure the element is painted before triggering CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          overlay.classList.add('open');
        });
      });

      if (hasCoords && window.L) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            initAdminDetailMap(c);
          });
        });

        document.getElementById("adminDirectionsBtn")?.addEventListener("click", () => {
          if (!window.adminDetailMapInstance) {
            initAdminDetailMap(c);
          }
          openDirections(lat, lng, c.location || "Complaint location");
        });
      }
    } catch(err) {
      alert("Error opening modal: " + err.message);
      console.error(err);
    }
  };

  initAdminPage();

  adminComplaintsBody.addEventListener("click", (event) => {
    const card = event.target.closest(".admin-c-card");
    if (!card || !adminComplaintsBody.contains(card)) return;
    const id = card.dataset.id;
    if (id) window.openAdminDetail(id);
  });

  adminComplaintsBody.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".admin-c-card");
    if (!card || !adminComplaintsBody.contains(card)) return;
    event.preventDefault();
    const id = card.dataset.id;
    if (id) window.openAdminDetail(id);
  });
}
