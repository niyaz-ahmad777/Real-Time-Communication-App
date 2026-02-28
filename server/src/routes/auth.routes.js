const express = require("express");
const { signToken } = require("../utils/jwt");
const router = express.Router();

/**
 * Demo auth (no DB) — internship/assignment friendly.
 * Real project me MongoDB users table add kar do.
 */
router.post("/register", (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: "Missing fields" });

  const token = signToken({ sub: email, name, email, role: "user" });
  res.json({ token, user: { name, email, role: "user" } });
});

router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: "Missing fields" });

  const token = signToken({ sub: email, name: email.split("@")[0], email, role: "user" });
  res.json({ token, user: { name: email.split("@")[0], email, role: "user" } });
});

module.exports = router;
