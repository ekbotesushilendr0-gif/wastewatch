const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const nodemailer = require("nodemailer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
require("dotenv").config();

// .env example: ADMIN_EMAIL=admin@example.com

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// ─── MAIL CONFIGURATION ───────────────────────────────────────────
// Supports both naming conventions: GMAIL_USER or EMAIL_USER, etc.
const MAIL_USER = process.env.GMAIL_USER || process.env.EMAIL_USER;
const MAIL_PASS = process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS;

if (!MAIL_USER || !MAIL_PASS) {
  console.warn("⚠️  WARNING: Email credentials not set. OTP emails will fail.");
  console.warn("   Set GMAIL_USER and GMAIL_APP_PASSWORD in your .env file.");
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: MAIL_USER,
    pass: MAIL_PASS,
  },
});

async function sendOTP(userEmail, otpCode) {
  const mailOptions = {
    from: `"WasteWatch" <${MAIL_USER}>`,
    to: userEmail,
    subject: "WasteWatch — Your Verification Code",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f4f7f4;border-radius:12px;">
        <h2 style="color:#1a5c33;margin-bottom:8px;">WasteWatch ♻️</h2>
        <p style="color:#5a7060;margin-bottom:24px;">Your email verification code is:</p>
        <div style="background:#fff;border:2px solid #d4e4d8;border-radius:10px;padding:24px;text-align:center;">
          <span style="font-size:2.5rem;font-weight:800;letter-spacing:12px;color:#1a2e1e;">${otpCode}</span>
        </div>
        <p style="color:#5a7060;margin-top:24px;font-size:0.9rem;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </div>
    `,
  };
  await transporter.sendMail(mailOptions);
  console.log(`✅ OTP sent to ${userEmail}`);
}

// ─── CONNECT DB ───────────────────────────────────────────────────
if (!process.env.MONGO_URI) {
  console.error("❌ MONGO_URI not set in .env. Exiting.");
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected."))
  .then(() => promoteConfiguredAdmin())
  .catch((err) => {
    console.error("❌ Database connection failed:", err.message);
    process.exit(1);
  });

// ─── MODELS ───────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  email: { type: String, unique: true, lowercase: true, trim: true },
  password: String,
  role: { type: String, enum: ["user", "admin"], default: "user" },
  isVerified: { type: Boolean, default: false },
  otp: String,
  otpExpiresAt: Date,
});

const User = mongoose.model("User", userSchema);

async function promoteConfiguredAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return;

  const user = await User.findOne({ email: adminEmail.toLowerCase() });
  if (!user) {
    console.warn("⚠️ Admin email not found in DB. Register first then restart server.");
    return;
  }

  if (user.role !== "admin") {
    user.role = "admin";
    await user.save();
  }
}

const Complaint = mongoose.model("Complaint", {
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  userEmail: String,
  imagePath: String,
  location: String,
  lat: Number,
  lng: Number,
  category: String,
  description: String,
  urgency: String,
  status: { type: String, default: "Pending" },
  createdAt: { type: Date, default: Date.now },
});

// ─── MIDDLEWARE ───────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Access denied. No token provided." });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token. Please login again." });
  }
};

const verifyAdmin = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Access denied. Admins only." });
  next();
};

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "waste_reports",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
  },
});

const upload = multer({ storage });

function parseCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────

// REGISTER — sends OTP
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    if (password.length < 6)
      return res.status(400).json({ error: "Password must be at least 6 characters." });

    let user = await User.findOne({ email: email.toLowerCase() });
    if (user && user.isVerified)
      return res.status(400).json({ error: "An account with this email already exists. Please login." });

    const hashed = await bcrypt.hash(password, 10);
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    if (user && !user.isVerified) {
      // Update existing unverified user
      user.password = hashed;
      user.otp = otpCode;
      user.otpExpiresAt = otpExpiresAt;
    } else {
      user = new User({
        email: email.toLowerCase(),
        password: hashed,
        otp: otpCode,
        otpExpiresAt,
      });
    }

    await user.save();

    try {
      await sendOTP(email, otpCode);
    } catch (mailErr) {
      console.error("❌ Failed to send OTP email:", mailErr.message);
      return res.status(500).json({
        error: "Account created but failed to send OTP email. Check your GMAIL_USER and GMAIL_APP_PASSWORD in .env",
      });
    }

    res.json({ message: "OTP sent to your email. Please verify to complete registration." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// VERIFY OTP
app.post("/api/verify-otp", async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp)
      return res.status(400).json({ error: "Email and OTP are required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(400).json({ error: "No account found for this email." });

    if (user.otp !== otp)
      return res.status(400).json({ error: "Incorrect OTP. Please check your email." });

    if (user.otpExpiresAt && new Date() > user.otpExpiresAt)
      return res.status(400).json({ error: "OTP has expired. Please register again to get a new one." });

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpiresAt = undefined;
    await user.save();

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token, email: user.email, role: user.role || "user" });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ error: "Server error during OTP verification." });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required." });

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user)
      return res.status(400).json({ error: "No account found with this email." });

    if (!user.isVerified)
      return res.status(400).json({ error: "Email not verified. Please complete OTP verification." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ error: "Incorrect password." });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );
    res.json({ token, email: user.email, role: user.role || "user" });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Server error during login." });
  }
});

// GET current user info (used on page load to verify token is still valid)
app.get("/api/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("email role");
    if (!user) return res.status(404).json({ error: "User not found." });
    res.json({ id: user._id, email: user.email, role: user.role || "user" });
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

app.post("/api/admin/make-admin", verifyToken, verifyAdmin, async (req, res) => {
  const { email } = req.body;
  try {
    if (!email)
      return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ error: "No account found with this email" });

    if (user.role === "admin")
      return res.status(400).json({ error: "User is already an admin" });

    user.role = "admin";
    await user.save();

    res.json({ message: "User promoted to admin", email: user.email });
  } catch (err) {
    res.status(500).json({ error: "Failed to promote user." });
  }
});

// ─── COMPLAINT ROUTES ─────────────────────────────────────────────

app.post("/api/complaints", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { location, category, description, urgency } = req.body;
    const lat = parseCoordinate(req.body.lat);
    const lng = parseCoordinate(req.body.lng);
    if (!location || !description)
      return res.status(400).json({ error: "Location and description are required." });

    const imagePath = req.file ? req.file.path : null;

    const complaint = new Complaint({
      userId: req.user.id,
      userEmail: req.user.email,
      imagePath,
      location,
      lat,
      lng,
      category,
      description,
      urgency,
    });

    await complaint.save();
    res.status(201).json(complaint);
  } catch (err) {
    console.error("Complaint submit error:", err);
    res.status(500).json({ error: "Failed to submit report." });
  }
});

app.get("/api/complaints/me", verifyToken, async (req, res) => {
  try {
    const complaints = await Complaint.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch complaints." });
  }
});

app.get("/api/complaints/all", async (req, res) => {
  try {
    const complaints = await Complaint.find().sort({ createdAt: -1 });
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch complaints." });
  }
});

app.patch("/api/complaints/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Pending", "In Progress", "Resolved"];
    if (!allowed.includes(status))
      return res.status(400).json({ error: "Invalid status value." });

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!complaint)
      return res.status(404).json({ error: "Complaint not found." });

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: "Failed to update status." });
  }
});

app.delete("/api/complaints/:id", verifyToken, verifyAdmin, async (req, res) => {
  try {
    await Complaint.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete complaint." });
  }
});

// ─── START SERVER ─────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 WasteWatch server running on http://localhost:${PORT}`);
  console.log(`   MongoDB: ${process.env.MONGO_URI ? "✅ URI loaded" : "❌ Missing"}`);
  console.log(`   JWT:     ${process.env.JWT_SECRET ? "✅ Secret loaded" : "❌ Missing"}`);
  console.log(`   Email:   ${MAIL_USER ? `✅ ${MAIL_USER}` : "❌ Missing"}\n`);
});
