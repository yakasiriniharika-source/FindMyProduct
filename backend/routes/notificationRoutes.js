const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Notification = require("../models/Notification");
const User = require("../models/User");
const auth = require("../middleware/auth");

const db = () => mongoose.connection.db;
const toObjId = (id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } };

// ─── GET MY NOTIFICATIONS ───
router.get("/", auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ user: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifs);
  } catch {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

// ─── MARK ALL READ ───
router.patch("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user.id, read: false }, { read: true });
    res.json({ message: "All marked as read" });
  } catch {
    res.status(500).json({ message: "Failed" });
  }
});

// ─── NOTIFY WHEN AVAILABLE (toggle) ───
router.post("/notify-me/:productId", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const pid  = req.params.productId;
    const oid  = toObjId(pid);

    const alreadyAdded = user.notifyWhenAvailable.map(String).includes(pid);

    if (alreadyAdded) {
      user.notifyWhenAvailable = user.notifyWhenAvailable.filter(id => id.toString() !== pid);
      await user.save();
      return res.json({ notifying: false, message: "Notification removed" });
    }

    // Get product name using clean ObjectId query
    const product = oid
      ? await db().collection("products").findOne({ _id: oid }, { projection: { name: 1 } })
      : null;

    user.notifyWhenAvailable.push(pid);
    await user.save();

    await Notification.create({
      user:    req.user.id,
      type:    "restock",
      message: `We'll notify you when "${product?.name || "this product"}" is back in stock.`,
    });

    res.json({ notifying: true, message: "You'll be notified when available!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed" });
  }
});

module.exports = router;