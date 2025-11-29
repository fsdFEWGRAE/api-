/**
 * GLOM Auth API
 *  - Simple login + HWID check using JSON file storage (no database).
 *  - Designed to be hosted on any Node.js hosting (Render Web Service, Railway, etc.).
 *
 *  ENDPOINTS:
 *    POST /login
 *      body: { username, password, hwid }
 *      responses:
 *        { success: true, code: "OK" }                    -> login allowed, HWID already matched
 *        { success: true, code: "HWID_REGISTERED" }       -> first login, HWID saved
 *        { success: false, code: "INVALID_CREDENTIALS" }  -> wrong username or password
 *        { success: false, code: "HWID_REQUIRED" }        -> hwid missing
 *        { success: false, code: "HWID_MISMATCH" }        -> hwid doesn't match stored one
 *
 *    GET /health
 *      Simple health check.
 */

const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// ====== CONFIG ======
const DATA_FILE = path.join(__dirname, "users.json");

// Middleware to parse JSON bodies
app.use(express.json());

// Small helper to safely read users.json
function loadUsers() {
  if (!fs.existsSync(DATA_FILE)) {
    return { users: [] };
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read users.json:", err);
    return { users: [] };
  }
}

// Small helper to write users.json
function saveUsers(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Failed to write users.json:", err);
    return false;
  }
}

// ====== ROUTES ======

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "GLOM Auth API is running" });
});

// Login + HWID check
app.post("/login", (req, res) => {
  const { username, password, hwid } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      code: "MISSING_FIELDS",
      message: "username and password are required"
    });
  }

  if (!hwid || typeof hwid !== "string" || hwid.trim().length === 0) {
    return res.status(400).json({
      success: false,
      code: "HWID_REQUIRED",
      message: "HWID is required"
    });
  }

  const data = loadUsers();
  const user = data.users.find(u => u.username === username);

  if (!user || user.password !== password) {
    return res.status(401).json({
      success: false,
      code: "INVALID_CREDENTIALS",
      message: "Invalid username or password"
    });
  }

  // If user has no HWID yet -> register this HWID
  if (!user.hwid || user.hwid.trim().length === 0) {
    user.hwid = hwid;
    const ok = saveUsers(data);
    if (!ok) {
      return res.status(500).json({
        success: false,
        code: "SERVER_ERROR",
        message: "Failed to save HWID"
      });
    }

    return res.json({
      success: true,
      code: "HWID_REGISTERED",
      message: "First login on this account, HWID registered"
    });
  }

  // If HWID already exists -> check it
  if (user.hwid !== hwid) {
    return res.status(403).json({
      success: false,
      code: "HWID_MISMATCH",
      message: "This account is already bound to another device"
    });
  }

  // All good
  return res.json({
    success: true,
    code: "OK",
    message: "Login successful"
  });
});

// Root route (optional, just informational)
app.get("/", (req, res) => {
  res.json({
    name: "GLOM Auth API",
    status: "running",
    endpoints: {
      health: "/health",
      login: "/login"
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`GLOM Auth API listening on port ${PORT}`);
});
