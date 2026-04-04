const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const auth = require("../middleware/auth");

const JWT_SECRET = process.env.JWT_SECRET || "secret123";
const db = () => mongoose.connection.db;
const toObjId = (id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } };

// ─── REGISTER ───
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, phone: phone || "" });
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone || "", role: user.role || "customer", storeId: null } });
  } catch (err) {
    res.status(500).json({ message: "Registration failed" });
  }
});

// ─── LOGIN ───
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone || "", role: user.role || "customer", storeId: user.storeId || null } });
  } catch {
    res.status(500).json({ message: "Login failed" });
  }
});

// ─── GET PROFILE ───
router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    const savedProducts = await Promise.all(
      (user.savedProducts || []).map(async (pid) => {
        const oid = toObjId(pid.toString());
        if (!oid) return null;
        return await db().collection("products").findOne({ _id: oid });
      })
    );
    const obj = user.toObject();
    obj.savedProducts = savedProducts.filter(Boolean);
    res.json(obj);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// ─── UPDATE PROFILE ───
router.patch("/profile", auth, async (req, res) => {
  try {
    const { name, phone } = req.body;
    const updates = {};
    if (name  !== undefined) updates.name  = name;
    if (phone !== undefined) updates.phone = phone;
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select("-password");
    res.json(user);
  } catch {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

// ─── SAVE / UNSAVE PRODUCT ───
router.post("/save-product/:productId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const pid = req.params.productId;
    const alreadySaved = user.savedProducts.map(String).includes(pid);
    if (alreadySaved) {
      user.savedProducts = user.savedProducts.filter(id => id.toString() !== pid);
      await user.save();
      return res.json({ saved: false, message: "Removed from saved" });
    }
    user.savedProducts.push(pid);
    await user.save();
    res.json({ saved: true, message: "Product saved" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update saved products" });
  }
});

// ─── GET SAVED PRODUCTS ───
router.get("/saved", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("savedProducts");
    const saved = await Promise.all(
      (user.savedProducts || []).map(async (pid) => {
        const oid = toObjId(pid.toString());
        if (!oid) return null;
        return await db().collection("products").findOne({ _id: oid });
      })
    );
    res.json(saved.filter(Boolean));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch saved products" });
  }
});

// ─── REGISTER OWNER ───
router.post("/register-owner", async (req, res) => {
  try {
    const { name, email, password, phone, storeId, newStore } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email and password required" });
    if (!storeId && !newStore)
      return res.status(400).json({ message: "Select a store or add a new one" });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });
    const dbConn = mongoose.connection.db;
    let finalStoreId;
    if (newStore) {
      const { storeName, address, city, contact, lat, lng } = newStore;
      if (!storeName || !lat || !lng)
        return res.status(400).json({ message: "Store name and location required" });
      const storeResult = await dbConn.collection("stores").insertOne({
        name: storeName, address: address || "", city: city || "",
        contact: contact || phone || "",
        location: { type: "Point", coordinates: [parseFloat(lng), parseFloat(lat)] },
      });
      await dbConn.collection("stores").createIndex({ location: "2dsphere" });
      finalStoreId = storeResult.insertedId;
    } else {
      const store = await dbConn.collection("stores").findOne({ _id: toObjId(storeId) });
      if (!store) return res.status(404).json({ message: "Store not found" });
      finalStoreId = store._id;
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, phone: phone || "", role: "store_owner", storeId: finalStoreId });
    const token = jwt.sign({ id: user._id }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, storeId: user.storeId } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

module.exports = router;