// ─────────────────────────────────────────────────────────────────
//  WasteWatch — js/profile.js
//  Citizen Profile Dashboard SPA Logic
// ─────────────────────────────────────────────────────────────────

if (document.getElementById("profilePage")) {
  if (!getUser() || !getToken()) {
    window.location.href = "login.html";
  }

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

  function renderCard(c) {
    const date = new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    const imgHtml = c.imagePath
      ? `<div class="prof-c-img"><img src="${getThumbnailUrl(c.imagePath, 150, 150)}" alt="complaint"></div>`
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
        console.error("Failed to load children in user detail:", err);
      }
    })();
  }

  async function loadMyComplaints() {
    const body = document.getElementById("complaintsBody");
    // Show Pulse Skeleton Loader
    body.innerHTML = Array(3).fill(`
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
