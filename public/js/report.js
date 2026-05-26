// ─────────────────────────────────────────────────────────────────
//  WasteWatch — js/report.js
//  Report Waste Page Logic
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

      if (imageInput.files[0]) {
        setBtn(btn, "Compressing photo...", true);
        try {
          const compressedBlob = await compressImage(imageInput.files[0]);
          formData.append("image", compressedBlob, "report.webp");
        } catch (err) {
          console.warn("Client-side compression failed, uploading raw:", err);
          formData.append("image", imageInput.files[0]);
        }
      }

      setBtn(btn, "Checking for duplicates...", true);

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

        // Apply Cloudinary dynamic resizing transformations
        const thumbUrl = getThumbnailUrl(cand.imagePath, 350, 200);

        if (cand.imagePath) {
          imgContainer.innerHTML = `<img src="${thumbUrl}" class="ww-dup-img" alt="Existing issue">`;
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
  }
}
