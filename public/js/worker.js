// ─────────────────────────────────────────────────────────────────
//  WasteWatch — js/worker.js
//  Worker Dashboard Logic
// ─────────────────────────────────────────────────────────────────

if (document.getElementById("workerMain")) {
  let currentWorker = null;

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

      currentWorker = user;
      setUser({ email: user.email, role: user.role });
      document.getElementById("workerMain").style.visibility = "visible";
      updateNav();
      loadWorkerComplaints();
    } catch {
      window.location.href = "index.html";
    }
  }

  let workerAllComplaints = [];

  async function loadWorkerComplaintsFallback() {
    if (!currentWorker?.email) return [];
    const res = await fetch(`${API}/complaints/all`);
    if (!res.ok) throw new Error("Fallback complaint fetch failed");
    const allComplaints = await res.json();
    return allComplaints.filter((complaint) => {
      const workerEmail = (complaint.workerEmail || "").toLowerCase();
      const currentEmail = currentWorker.email.toLowerCase();
      return workerEmail === currentEmail;
    });
  }

  async function loadWorkerComplaints() {
    const grid = document.getElementById("workerTasksGrid");
    // Show Pulse Skeleton Loader
    grid.innerHTML = Array(3).fill(`
      <div class="skeleton-card">
        <div class="skeleton-img skeleton-pulse"></div>
        <div class="skeleton-body">
          <div class="skeleton-line skeleton-pulse" style="width: 70%;"></div>
          <div class="skeleton-line skeleton-pulse short" style="width: 50%;"></div>
          <div class="skeleton-line skeleton-pulse short" style="width: 30%;"></div>
        </div>
      </div>
    `).join("");
    
    try {
      const res = await fetch(`${API}/complaints/assigned`, {
        headers: { Authorization: "Bearer " + getToken() }
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Worker API error:", data);
        throw new Error(data.error || "Server error");
      }
      
      workerAllComplaints = Array.isArray(data) ? data : [];
      if (!workerAllComplaints.length) {
        workerAllComplaints = await loadWorkerComplaintsFallback();
      }

      const user = currentWorker || getUser();
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
    } catch (err) {
      console.error("loadWorkerComplaints error:", err);
      try {
        workerAllComplaints = await loadWorkerComplaintsFallback();
        const user = currentWorker || getUser();
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
      } catch (fallbackErr) {
        console.error("worker fallback error:", fallbackErr);
        grid.innerHTML = `
          <div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--text-muted);">
            <i data-lucide="inbox" style="width:48px;height:48px;margin-bottom:1rem;display:block;margin:0 auto 1rem;color:var(--border);"></i>
            <h3 style="font-size:1.1rem;font-weight:700;margin-bottom:0.4rem;">No assigned tasks</h3>
            <p style="font-size:0.88rem;">No complaints have been assigned to you yet. Check back later.</p>
          </div>`;
        if (window.lucide) window.lucide.createIcons();
      }
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
      grid.innerHTML = `
        <div style="grid-column:1/-1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3.5rem 2rem;text-align:center;">
          <div style="width:64px;height:64px;background:var(--bg);border:1.5px solid var(--border);border-radius:18px;display:flex;align-items:center;justify-content:center;margin-bottom:1.1rem;">
            <i data-lucide="inbox" style="width:28px;height:28px;color:var(--text-muted);"></i>
          </div>
          <h3 style="font-family:'Poppins',sans-serif;font-weight:700;font-size:1.05rem;color:var(--text);margin-bottom:0.35rem;">No tasks</h3>
          <p style="font-size:0.875rem;color:var(--text-muted);max-width:260px;line-height:1.5;">No complaints match this filter.</p>
        </div>`;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    grid.innerHTML = complaints.map(c => {
      let actionHtml = "";
      if (['Pending', 'In Progress', 'Disputed'].includes(c.status)) {
        actionHtml = `
          <button class="btn-directions" onclick="event.stopPropagation(); openDirectionsOnMap(window.workerMapInstance, ${c.lat}, ${c.lng}, '${c.location.replace(/'/g, "\\'")}')">
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

      // Convert image path to optimized thumbnail size 350x200 for task cards
      const thumbUrl = c.imagePath ? getThumbnailUrl(c.imagePath, 350, 200) : "";

      return `
        <div class="ww-task-card" data-id="${c._id}">
          <div class="ww-task-img">
            ${c.imagePath
              ? `<img src="${thumbUrl}" alt="Complaint photo">`
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

    document.querySelectorAll('.ww-task-actions button').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation();
      });
    });
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
        }).addTo(map).bindPopup(`<div style="min-width:160px;font-family:'Poppins',sans-serif"><b>${c.location}</b><br><span style="font-size:0.8rem;color:#5a7060">${c.category || ""}</span><br><span style="color:${color};font-weight:700">${c.status}</span></div>`);
      }));
    Promise.all(promises).then(() => {
      if (bounds.length > 1) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
      else if (bounds.length === 1) map.setView(bounds[0], 14);
    });
    return map;
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
            <button class="btn-directions" style="flex:1;" onclick="openDirectionsOnMap(window.workerDetailMapInstance, ${lat}, ${lng}, '${c.location.replace(/'/g, "\\'")}')">
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
    document.body.style.overflow = "hidden";
    if (window.lucide) window.lucide.createIcons();
    requestAnimationFrame(() => overlay.classList.add("open"));
    
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

    overlay.addEventListener("click", e => {
      if (e.target === overlay) {
        stopStream();
        overlay.remove();
        document.body.style.overflow = "";
      }
    });
    document.getElementById("resolveCancelBtn").addEventListener("click", () => {
      stopStream();
      overlay.remove();
      document.body.style.overflow = "";
    });
    
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
      
      setBtn(btn, "Compressing proof photo...", true);
      const fd = new FormData();
      if (note) fd.append("resolutionNote", note);
      
      try {
        const compressedBlob = await compressImage(fileInput.files[0]);
        fd.append("proof", compressedBlob, "proof.webp");
      } catch (err) {
        console.warn("Worker proof photo compression failed, uploading raw:", err);
        fd.append("proof", fileInput.files[0]);
      }
      
      setBtn(btn, "Submitting resolution...", true);
      try {
        const res = await fetch(`${API}/complaints/${id}/resolve`, {
          method: "POST", 
          headers: { Authorization: "Bearer " + getToken() }, 
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) { 
          showToast(data.error || "Failed.", "error"); 
          setBtn(btn, "Submit Resolution", false);
          return; 
        }
        showToast("Proof uploaded successfully!");
        stopStream();
        overlay.remove();
        document.body.style.overflow = "";
        loadWorkerComplaints();
      } catch { 
        showToast("Network error.", "error"); 
        setBtn(btn, "Submit Resolution", false);
      }
    });
  };

  initWorkerPage();
}
