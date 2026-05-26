// ─────────────────────────────────────────────────────────────────
//  WasteWatch — js/auth.js
//  Auth page logic (Login, Signup, OTP)
// ─────────────────────────────────────────────────────────────────

// LOGIN PAGE
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

// REGISTER PAGE
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
