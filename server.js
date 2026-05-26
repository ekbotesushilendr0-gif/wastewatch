const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const SibApiV3Sdk = require("sib-api-v3-sdk");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("cloudinary").v2;
const { GoogleGenerativeAI } = require("@google/generative-ai");
const crypto = require("crypto");
const https = require("https");
const compression = require("compression");
require("dotenv").config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  WARNING: GEMINI_API_KEY not set. Smart duplicate detection will be bypassed or return error.");
}

// .env example: ADMIN_EMAIL=admin@example.com

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(compression());
app.use(cors());
app.use(express.json());

// Serve static frontend files — no JS/CSS caching so updates are always live
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html") || filePath.endsWith(".js") || filePath.endsWith(".css")) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    } else {
      // Cache images/fonts for 7 days — they change rarely
      res.setHeader('Cache-Control', 'public, max-age=604800');
    }
  }
}));

// ─── MAIL CONFIGURATION (Using Brevo) ───────────────────────────
const brevoClient = SibApiV3Sdk.ApiClient.instance;
brevoClient.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

if (!process.env.BREVO_API_KEY) {
  console.warn("⚠️  WARNING: BREVO_API_KEY not set. OTP emails will fail.");
}

async function sendOTP(userEmail, otpCode) {
  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const sendSmtpEmail = {
    sender: { name: "WasteWatch", email: "ekbotesushilendr0@gmail.com" }, // ✅ FIXED: use brevosend.com domain
    to: [{ email: userEmail }],
    subject: "WasteWatch — Your Verification Code",
    htmlContent: `
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
  await apiInstance.sendTransacEmail(sendSmtpEmail);
  console.log(`✅ OTP sent to ${userEmail} via Brevo`);
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
  role: { type: String, enum: ["user", "admin", "worker"], default: "user" },
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

const complaintSchema = new mongoose.Schema({
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
  // Worker assignment fields
  workerEmail: String,
  workerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  assignedAt: Date,
  // Verification flow fields
  proofImagePath: String,
  resolutionNote: String,
  disputeReason: String,
  resolvedAt: Date,
  verifiedAt: Date,
  disputedAt: Date,
  createdAt: { type: Date, default: Date.now },
  
  // Duplicate tracking
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint", default: null },
  duplicateCount: { type: Number, default: 0 },
  supportCount: { type: Number, default: 0 },
  
  // AI verification metadata
  aiDuplicateConfidence: Number,
  aiDuplicateReason: String,
  matchedComplaintId: { type: mongoose.Schema.Types.ObjectId, ref: "Complaint" },
  distanceToMatchedComplaint: { type: Number },
  
  // Supporters list
  supporters: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      supportedAt: { type: Date, default: Date.now }
    }
  ]
});

complaintSchema.index({ parentId: 1 });
complaintSchema.index({ status: 1 });
complaintSchema.index({ category: 1 });
complaintSchema.index({ createdAt: -1 });
complaintSchema.index({ lat: 1, lng: 1 });

const Complaint = mongoose.model("Complaint", complaintSchema);

const draftComplaintSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  userEmail: { type: String, required: true },
  imagePath: String,
  location: String,
  lat: Number,
  lng: Number,
  category: String,
  description: String,
  urgency: String,
  expiresAt: { type: Date, default: () => new Date(Date.now() + 10 * 60 * 1000) } // expires in 10 minutes
});

// TTL Index for auto-deletion
draftComplaintSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const DraftComplaint = mongoose.model("DraftComplaint", draftComplaintSchema);

// ─── MIDDLEWARE ───────────────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token)
    return res.status(401).json({ error: "Access denied. No token provided." });
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    const currentUser = await User.findById(verified.id).select("email role").lean();
    if (!currentUser) {
      return res.status(401).json({ error: "User not found. Please login again." });
    }
    req.user = {
      id: verified.id,
      email: currentUser.email,
      role: currentUser.role || "user",
    };
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

// Calculate Haversine distance in meters
function getHaversineDistance(lat1, lon1, lat2, lon2) {
  if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return Infinity;
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fetch image from URL as buffer (supports https)
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch image: ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", (err) => reject(err));
    }).on("error", (err) => reject(err));
  });
}

// Convert local file or remote URL to Gemini inlineData structure
async function getImagePart(filePathOrUrl) {
  if (!filePathOrUrl) return null;
  try {
    let buffer;
    let mimeType = "image/jpeg"; // default
    if (filePathOrUrl.toLowerCase().endsWith(".png")) mimeType = "image/png";
    else if (filePathOrUrl.toLowerCase().endsWith(".webp")) mimeType = "image/webp";

    if (filePathOrUrl.startsWith("http")) {
      buffer = await fetchImageBuffer(filePathOrUrl);
    } else {
      buffer = await fs.promises.readFile(filePathOrUrl);
    }
    return {
      inlineData: {
        data: buffer.toString("base64"),
        mimeType
      }
    };
  } catch (err) {
    console.error("Error preparing image for Gemini:", err.message);
    return null;
  }
}

// Simple Jaccard similarity fallback for description matching
function getWordOverlap(str1, str2) {
  const words1 = new Set((str1 || "").toLowerCase().match(/\b\w+\b/g) || []);
  const words2 = new Set((str2 || "").toLowerCase().match(/\b\w+\b/g) || []);
  if (words1.size === 0 && words2.size === 0) return 1.0; // both empty descriptions are a match
  if (words1.size === 0 || words2.size === 0) return 0.0;
  
  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  return intersection / Math.max(words1.size, words2.size);
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
        error: "Account created but failed to send OTP email. Check your RESEND_API_KEY in Render env.",
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

app.post("/api/admin/make-worker", verifyToken, verifyAdmin, async (req, res) => {
  const { email } = req.body;
  try {
    if (!email)
      return res.status(400).json({ error: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ error: "No account found with this email" });

    if (user.role === "worker")
      return res.status(400).json({ error: "User is already a worker" });

    user.role = "worker";
    await user.save();

    res.json({ message: "User promoted to worker", email: user.email });
  } catch (err) {
    res.status(500).json({ error: "Failed to promote user." });
  }
});

// ─── COMPLAINT ROUTES ─────────────────────────────────────────────

app.post("/api/complaints/check", verifyToken, upload.single("image"), async (req, res) => {
  try {
    const { location, category, description, urgency } = req.body;
    const lat = parseCoordinate(req.body.lat);
    const lng = parseCoordinate(req.body.lng);

    if (!location || !description || !category) {
      return res.status(400).json({ error: "Location, category, and description are required." });
    }

    // 1. Cooldown protection check (same user, same category, same area within 20m, within 5 minutes, AND similar description)
    if (lat !== undefined && lng !== undefined) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existingRecent = await Complaint.find({
        userId: req.user.id,
        category,
        createdAt: { $gte: fiveMinutesAgo }
      });
      for (const comp of existingRecent) {
        const dist = getHaversineDistance(lat, lng, comp.lat, comp.lng);
        const overlap = getWordOverlap(description, comp.description);
        if (dist <= 20 && overlap >= 0.35) {
          return res.status(429).json({ error: "You recently submitted a report for this category in this location with a similar description. Please wait a few minutes before submitting another." });
        }
      }
    }

    const imagePath = req.file ? req.file.path : null;

    // 2. Candidate Selection (Max 3)
    const activeStatuses = ["Pending", "In Progress", "Disputed", "Awaiting Verification"];
    const potentialCandidates = await Complaint.find({
      status: { $in: activeStatuses },
      category,
      parentId: null
    });

    const candidatesWithDistance = [];
    if (lat !== undefined && lng !== undefined) {
      for (const candidate of potentialCandidates) {
        if (candidate.lat !== undefined && candidate.lng !== undefined) {
          const dist = getHaversineDistance(lat, lng, candidate.lat, candidate.lng);
          if (dist <= 20) {
            candidatesWithDistance.push({ candidate, dist });
          }
        }
      }
    }

    // Sort by distance (closest first), then date (newest first)
    candidatesWithDistance.sort((a, b) => {
      if (a.dist !== b.dist) return a.dist - b.dist;
      return b.candidate.createdAt - a.candidate.createdAt;
    });

    const topCandidates = candidatesWithDistance.slice(0, 3);

    // 3. Gemini comparison or local fallback
    const matches = [];

    if (topCandidates.length > 0) {
      if (process.env.GEMINI_API_KEY) {
        const newImagePart = await getImagePart(imagePath);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        for (const item of topCandidates) {
          let candidateRecord = item.candidate;
          // Safeguard: If candidate has parentId, resolve to root parent
          if (candidateRecord.parentId) {
            const rootParent = await Complaint.findById(candidateRecord.parentId);
            if (rootParent) {
              candidateRecord = rootParent;
            }
          }

          const candidateImagePart = await getImagePart(candidateRecord.imagePath);
          const prompt = `
            You are an expert waste management and urban maintenance assistant.
            Analyze these two reported complaints to determine if they refer to the SAME PHYSICAL MUNICIPAL ISSUE at the SAME spot (e.g. the exact same pile of trash, garbage bin overflowing, sewage leak, dead animal).

            Do NOT classify as a duplicate merely because:
            - both contain garbage/trash
            - both are in the same category
            - both are nearby

            They must represent the same actual issue/location.

            Report 1 (Existing):
            - Category: ${candidateRecord.category}
            - Description: ${candidateRecord.description}

            Report 2 (New):
            - Category: ${category}
            - Description: ${description}

            Compare the photos if provided. Note that the photos might be taken from different angles, distances, or zoom levels, or in different lighting conditions.

            You must respond in strict JSON format. Use the following JSON schema:
            {
              "isDuplicate": boolean,
              "confidence": number, // value between 0.0 and 1.0
              "reason": "Explain why you think they are or are not the same physical issue."
            }
          `;

          const parts = [prompt];
          if (candidateImagePart) parts.push(candidateImagePart);
          if (newImagePart) parts.push(newImagePart);

          try {
            const result = await model.generateContent({
              contents: parts,
              generationConfig: { responseMimeType: "application/json" }
            });
            const responseText = result.response.text();
            
            let data;
            try {
              data = JSON.parse(responseText);
            } catch (jsonErr) {
              console.error("Gemini response JSON parsing failed:", responseText, jsonErr);
              data = { isDuplicate: false, confidence: 0, reason: "Failed to parse AI JSON response." };
            }

            if (data.isDuplicate && data.confidence >= 0.75) {
              const distanceScore = 1 - (item.dist / 20);
              const score = distanceScore * 0.3 + data.confidence * 0.7;
              matches.push({
                candidate: candidateRecord,
                confidence: data.confidence,
                reason: data.reason,
                distance: item.dist,
                score
              });
            }
          } catch (geminiErr) {
            console.error("Gemini API error during comparison, running fallback:", geminiErr);
            const overlap = getWordOverlap(description, candidateRecord.description);
            if (item.dist <= 15 || (item.dist <= 20 && overlap >= 0.40)) {
              const distanceScore = 1 - (item.dist / 20);
              const score = distanceScore * 0.5 + overlap * 0.5;
              matches.push({
                candidate: candidateRecord,
                confidence: item.dist <= 15 ? 0.90 : 0.75,
                reason: `[Local Fallback due to API Error] Found matching issue within ${item.dist.toFixed(1)}m.`,
                distance: item.dist,
                score
              });
            }
          }
        }
      } else {
        // Fallback: Local proximity and text comparison when Gemini Key is absent
        for (const item of topCandidates) {
          let candidateRecord = item.candidate;
          if (candidateRecord.parentId) {
            const rootParent = await Complaint.findById(candidateRecord.parentId);
            if (rootParent) {
              candidateRecord = rootParent;
            }
          }

          const overlap = getWordOverlap(description, candidateRecord.description);
          if (item.dist <= 15 || (item.dist <= 20 && overlap >= 0.40)) {
            const distanceScore = 1 - (item.dist / 20);
            const score = distanceScore * 0.5 + overlap * 0.5;
            matches.push({
              candidate: candidateRecord,
              confidence: item.dist <= 15 ? 0.90 : 0.75,
              reason: `[Local Fallback] Found matching issue within ${item.dist.toFixed(1)}m with category matching.`,
              distance: item.dist,
              score
            });
          }
        }
      }
    }

    if (matches.length > 0) {
      // Sort matches descending by score
      matches.sort((a, b) => b.score - a.score);

      // Create a secure DraftComplaint session in DB
      const sessionId = crypto.randomBytes(16).toString("hex");
      const draft = new DraftComplaint({
        sessionId,
        userId: req.user.id,
        userEmail: req.user.email,
        imagePath,
        location,
        lat,
        lng,
        category,
        description,
        urgency
      });
      await draft.save();

      return res.json({
        isPotentialDuplicate: true,
        sessionId,
        candidates: matches.map(m => ({
          _id: m.candidate._id,
          category: m.candidate.category,
          description: m.candidate.description,
          imagePath: m.candidate.imagePath,
          location: m.candidate.location,
          createdAt: m.candidate.createdAt,
          status: m.candidate.status,
          duplicateCount: m.candidate.duplicateCount || 0,
          supportCount: m.candidate.supportCount || 0,
          aiDuplicateConfidence: m.confidence,
          aiDuplicateReason: m.reason,
          distance: m.distance
        })),
        // Backward compatibility
        candidate: {
          _id: matches[0].candidate._id,
          category: matches[0].candidate.category,
          description: matches[0].candidate.description,
          imagePath: matches[0].candidate.imagePath,
          location: matches[0].candidate.location,
          createdAt: matches[0].candidate.createdAt,
          status: matches[0].candidate.status,
          duplicateCount: matches[0].candidate.duplicateCount || 0,
          supportCount: matches[0].candidate.supportCount || 0
        },
        aiDuplicateConfidence: matches[0].confidence,
        aiDuplicateReason: matches[0].reason
      });
    } else {
      // No duplicate found: Save as a regular parent complaint immediately
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
        parentId: null
      });
      await complaint.save();
      return res.status(201).json({
        isPotentialDuplicate: false,
        complaint
      });
    }
  } catch (err) {
    console.error("Duplicate check error:", err);
    res.status(500).json({ error: "Failed to process report." });
  }
});

app.post("/api/complaints/confirm", verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: "Session ID is required." });
    }

    const draft = await DraftComplaint.findOne({ sessionId, userId: req.user.id });
    if (!draft) {
      return res.status(404).json({ error: "Draft report not found or session expired." });
    }

    // Save as a parent complaint
    const complaint = new Complaint({
      userId: draft.userId,
      userEmail: draft.userEmail,
      imagePath: draft.imagePath,
      location: draft.location,
      lat: draft.lat,
      lng: draft.lng,
      category: draft.category,
      description: draft.description,
      urgency: draft.urgency,
      parentId: null
    });
    await complaint.save();

    // Clean up the draft
    await DraftComplaint.deleteOne({ _id: draft._id });

    res.status(201).json(complaint);
  } catch (err) {
    console.error("Confirm report error:", err);
    res.status(500).json({ error: "Failed to save report." });
  }
});

app.post("/api/complaints/:id/support", verifyToken, async (req, res) => {
  try {
    const { sessionId, aiDuplicateConfidence, aiDuplicateReason } = req.body;
    const parentId = req.params.id;

    const parentComplaint = await Complaint.findById(parentId);
    if (!parentComplaint) {
      return res.status(404).json({ error: "Parent complaint not found." });
    }

    // Check for self-support spam:
    // 1. Is user already a supporter?
    const alreadySupported = parentComplaint.supporters.some(s => s.userId && s.userId.toString() === req.user.id);
    if (alreadySupported) {
      return res.status(400).json({ error: "You have already confirmed/supported this issue." });
    }

    // 2. Did they already upload a child complaint?
    const alreadyUploadedChild = await Complaint.findOne({
      parentId,
      userId: req.user.id
    });
    if (alreadyUploadedChild) {
      return res.status(400).json({ error: "You have already submitted a duplicate report for this issue." });
    }

    // If sessionId is provided, they are uploading a child duplicate complaint
    if (sessionId) {
      const draft = await DraftComplaint.findOne({ sessionId, userId: req.user.id });
      if (!draft) {
        return res.status(404).json({ error: "Draft report not found or session expired." });
      }

      // Calculate distance for database logging
      let distanceToMatchedComplaint = null;
      if (draft.lat !== undefined && draft.lng !== undefined && parentComplaint.lat !== undefined && parentComplaint.lng !== undefined) {
        distanceToMatchedComplaint = getHaversineDistance(draft.lat, draft.lng, parentComplaint.lat, parentComplaint.lng);
      }

      // Create the child duplicate complaint
      const childComplaint = new Complaint({
        userId: draft.userId,
        userEmail: draft.userEmail,
        imagePath: draft.imagePath,
        location: draft.location,
        lat: draft.lat,
        lng: draft.lng,
        category: draft.category,
        description: draft.description,
        urgency: draft.urgency,
        parentId: parentComplaint._id,
        aiDuplicateConfidence: aiDuplicateConfidence || null,
        aiDuplicateReason: aiDuplicateReason || null,
        matchedComplaintId: parentComplaint._id,
        distanceToMatchedComplaint
      });
      await childComplaint.save();

      // Update parent counter
      parentComplaint.duplicateCount = (parentComplaint.duplicateCount || 0) + 1;

      // Clean up draft
      await DraftComplaint.deleteOne({ _id: draft._id });
    }

    // Add user to supporters array
    parentComplaint.supporters.push({
      userId: req.user.id,
      supportedAt: new Date()
    });
    parentComplaint.supportCount = (parentComplaint.supportCount || 0) + 1;
    await parentComplaint.save();

    res.json({ message: "Thank you for confirming this issue!", parentComplaint });
  } catch (err) {
    console.error("Support complaint error:", err);
    res.status(500).json({ error: "Failed to process support request." });
  }
});

// Fallback legacy endpoint (direct submit, bypasses duplicate modal but sets parentId null)
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
      parentId: null
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
    const complaints = await Complaint.find({ userId: req.user.id })
      .select("-supporters -aiDuplicateConfidence -aiDuplicateReason")
      .sort({ createdAt: -1 })
      .lean();
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch complaints." });
  }
});

app.delete("/api/complaints/me/all", verifyToken, async (req, res) => {
  try {
    await Complaint.deleteMany({ userId: req.user.id });
    res.json({ message: "All complaints deleted." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete complaints." });
  }
});

// Specialized map endpoint returning lightweight coordinate payload
app.get("/api/complaints/map", async (req, res) => {
  try {
    const complaints = await Complaint.find({ parentId: null })
      .select("_id lat lng status imagePath")
      .lean();
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch map data." });
  }
});

app.get("/api/complaints/all", async (req, res) => {
  try {
    const complaints = await Complaint.find({ parentId: null })
      .select("-supporters -aiDuplicateConfidence -aiDuplicateReason")
      .sort({ createdAt: -1 })
      .lean();
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch complaints." });
  }
});

app.get("/api/complaints/:id", async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id)
      .select("-supporters -aiDuplicateConfidence -aiDuplicateReason")
      .lean();
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch complaint details." });
  }
});

app.get("/api/complaints/:id/children", async (req, res) => {
  try {
    const children = await Complaint.find({ parentId: req.params.id })
      .select("imagePath userEmail description createdAt distanceToMatchedComplaint")
      .sort({ createdAt: -1 })
      .lean();
    res.json(children);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch child complaints." });
  }
});

// GET assigned complaints (Worker only)
app.get("/api/complaints/assigned", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "worker")
      return res.status(403).json({ error: "Access denied. Workers only." });

    const complaints = await Complaint.find({
      $or: [
        { workerId: req.user.id },
        { workerEmail: req.user.email }
      ]
    })
      .select("-supporters -aiDuplicateConfidence -aiDuplicateReason")
      .sort({ createdAt: -1 })
      .lean();
    res.json(complaints);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assigned complaints." });
  }
});

// ASSIGN WORKER (Admin only)
app.patch("/api/complaints/:id/assign-worker", verifyToken, verifyAdmin, async (req, res) => {
  const { workerEmail } = req.body;
  try {
    if (!workerEmail) return res.status(400).json({ error: "Worker email is required." });

    const worker = await User.findOne({ email: workerEmail.toLowerCase() });
    if (!worker || worker.role !== "worker") {
      return res.status(400).json({ error: "No worker account found with this email." });
    }

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { workerEmail: worker.email, workerId: worker._id, assignedAt: new Date(), status: "In Progress" },
      { new: true }
    );
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });

    // Sync child complaints
    await Complaint.updateMany(
      { parentId: req.params.id },
      { workerEmail: worker.email, workerId: worker._id, assignedAt: new Date(), status: "In Progress" }
    );

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign worker." });
  }
});

// Status PATCH — only Pending / In Progress (Resolved now requires proof via /resolve)
app.patch("/api/complaints/:id/status", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ["Pending", "In Progress"];
    if (!allowed.includes(status))
      return res.status(400).json({ error: "Use /resolve to mark as resolved, or pick Pending / In Progress." });

    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!complaint)
      return res.status(404).json({ error: "Complaint not found." });

    // Sync child complaints
    await Complaint.updateMany({ parentId: req.params.id }, { status });

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: "Failed to update status." });
  }
});

// RESOLVE — worker uploads proof photo; sets status → Awaiting Verification
app.post("/api/complaints/:id/resolve", verifyToken, upload.single("proof"), async (req, res) => {
  try {
    if (req.user.role !== "worker")
      return res.status(403).json({ error: "Access denied. Workers only." });

    const complaintToUpdate = await Complaint.findById(req.params.id);
    if (!complaintToUpdate) return res.status(404).json({ error: "Complaint not found." });
    
    if (!complaintToUpdate.workerId || complaintToUpdate.workerId.toString() !== req.user.id)
      return res.status(403).json({ error: "Not authorized to resolve this complaint." });

    const proofImagePath = req.file ? req.file.path : null;
    if (!proofImagePath)
      return res.status(400).json({ error: "Proof image is required." });

    const { resolutionNote } = req.body;
    complaintToUpdate.status = "Awaiting Verification";
    complaintToUpdate.proofImagePath = proofImagePath;
    complaintToUpdate.resolutionNote = resolutionNote || "";
    complaintToUpdate.resolvedAt = new Date();
    await complaintToUpdate.save();

    // Sync child complaints
    await Complaint.updateMany(
      { parentId: req.params.id },
      {
        status: "Awaiting Verification",
        proofImagePath,
        resolutionNote: resolutionNote || "",
        resolvedAt: new Date()
      }
    );

    res.json(complaintToUpdate);
  } catch (err) {
    console.error("Resolve error:", err);
    res.status(500).json({ error: "Failed to submit resolution." });
  }
});

// VERIFY — complaint owner confirms resolution; sets status → Verified
app.post("/api/complaints/:id/verify", verifyToken, async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    if (complaint.userId.toString() !== req.user.id)
      return res.status(403).json({ error: "Not authorized." });
    if (complaint.status !== "Awaiting Verification")
      return res.status(400).json({ error: "Complaint is not awaiting verification." });

    complaint.status = "Verified";
    complaint.verifiedAt = new Date();
    await complaint.save();

    // Sync child complaints
    await Complaint.updateMany(
      { parentId: req.params.id },
      { status: "Verified", verifiedAt: new Date() }
    );

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: "Failed to verify complaint." });
  }
});

// DISPUTE — complaint owner disputes resolution; sets status → Disputed (persistent)
app.post("/api/complaints/:id/dispute", verifyToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });
    if (complaint.userId.toString() !== req.user.id)
      return res.status(403).json({ error: "Not authorized." });
    if (complaint.status !== "Awaiting Verification")
      return res.status(400).json({ error: "Complaint is not awaiting verification." });

    complaint.status = "Disputed";
    complaint.disputeReason = reason || "";
    complaint.disputedAt = new Date();
    await complaint.save();

    // Sync child complaints
    await Complaint.updateMany(
      { parentId: req.params.id },
      { status: "Disputed", disputeReason: reason || "", disputedAt: new Date() }
    );

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: "Failed to dispute complaint." });
  }
});

// REOPEN — admin reviews disputed complaint and sends it back to In Progress
app.post("/api/complaints/:id/reopen", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndUpdate(
      req.params.id,
      { status: "In Progress" },
      { new: true }
    );
    if (!complaint) return res.status(404).json({ error: "Complaint not found." });

    // Sync child complaints
    await Complaint.updateMany({ parentId: req.params.id }, { status: "In Progress" });

    res.json(complaint);
  } catch (err) {
    res.status(500).json({ error: "Failed to reopen complaint." });
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
  console.log(`   Email:   ${process.env.BREVO_API_KEY ? "✅ Brevo ready" : "❌ BREVO_API_KEY missing"}\n`);
});