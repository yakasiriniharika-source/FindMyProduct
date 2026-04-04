const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const User = require("../models/User");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");

const db = () => mongoose.connection.db;
const toObjId = (id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } };

// ─── SHARED HELPER: notify all users waiting for a product ───────────────────
// Fires when owner manually restocks a product from 0 → positive quantity.
const fireRestockNotifications = async (productOid, productName) => {
  try {
    const waitingUsers = await User.find({
      notifyWhenAvailable: productOid,
    }).select("_id");

    if (waitingUsers.length === 0) return;

    await Promise.all(waitingUsers.map(u =>
      Notification.create({
        user:    u._id,
        type:    "restock",
        message: `✅ Good news! "${productName}" is back in stock. Book it before it's gone!`,
      }).catch(() => {})
    ));

    // Clear subscriptions so users aren't notified again until they re-subscribe
    await User.updateMany(
      { notifyWhenAvailable: productOid },
      { $pull: { notifyWhenAvailable: productOid } }
    );
  } catch (err) {
    console.error("Restock notification error:", err);
  }
};

const ownerOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.role !== "store_owner" || !user.storeId)
      return res.status(403).json({ message: "Store owner access only" });
    // Always ensure storeId is a proper ObjectId for consistent DB queries
    user.storeId = toObjId(user.storeId.toString());
    req.owner = user;
    next();
  } catch (err) {
    res.status(500).json({ message: "Auth error" });
  }
};

// ─── GET STORE PRODUCTS ───
router.get("/products", auth, ownerOnly, async (req, res) => {
  try {
    const storeOid = req.owner.storeId; // already ObjectId from ownerOnly
    // Query stock by both ObjectId and string storeId (handles mixed stored formats)
    const stockEntries = await db().collection("stock").find({
      $or: [{ storeId: storeOid }, { storeId: storeOid.toString() }]
    }).toArray();

    if (stockEntries.length === 0) return res.json([]);

    const productIds = stockEntries.map(s => toObjId(s.productId.toString())).filter(Boolean);
    const products = await db().collection("products").find({ _id: { $in: productIds } }).toArray();
    const result = products.map(p => {
      const stock = stockEntries.find(s => s.productId.toString() === p._id.toString());
      return {
        ...p,
        quantity: stock?.quantity ?? 0,
        inStock:  (stock?.quantity ?? 0) > 0,
      };
    });
    // Sort: out-of-stock last, then alphabetically
    result.sort((a, b) => {
      if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
      return (a.name || "").localeCompare(b.name || "");
    });
    res.json(result);
  } catch (err) {
    console.error("GET /owner/products error:", err);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

// ─── ADD NEW PRODUCT ───
router.post("/products", auth, ownerOnly, async (req, res) => {
  try {
    const { name, brand, category, price, mrp, description, imageUrl, quantity } = req.body;
    if (!name || !category) return res.status(400).json({ message: "Name and category required" });

    // Get store location for product location
    const store = await db().collection("stores").findOne({ _id: req.owner.storeId });

    const result = await db().collection("products").insertOne({
      name, brand: brand || "", category,
      price: price ? Number(price) : null,
      mrp: mrp ? Number(mrp) : null,
      description: description || "",
      imageUrl: imageUrl || null,
      location: store?.location || null,
      ratings: [],
      createdAt: new Date(),
    });

    const newProductId = result.insertedId;

    // Add to stock
    await db().collection("stock").insertOne({
      productId: newProductId,
      storeId: req.owner.storeId,
      quantity: Number(quantity) || 0,
    });

    const product = await db().collection("products").findOne({ _id: newProductId });
    res.status(201).json({ ...product, quantity: Number(quantity) || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to add product" });
  }
});

// ─── UPDATE PRODUCT ───
router.patch("/products/:id", auth, ownerOnly, async (req, res) => {
  try {
    const oid = toObjId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid ID" });
    const { name, price, mrp, description, imageUrl, category, brand } = req.body;
    const updates = {};
    if (name        !== undefined) updates.name        = name;
    if (price       !== undefined) updates.price       = Number(price);
    if (mrp         !== undefined) updates.mrp         = Number(mrp);
    if (description !== undefined) updates.description = description;
    if (imageUrl    !== undefined) updates.imageUrl    = imageUrl;
    if (category    !== undefined) updates.category    = category;
    if (brand       !== undefined) updates.brand       = brand;
    // Check for price drop and notify saved users
    const oldProduct = await db().collection("products").findOne({ _id: oid });
    const oldPrice = oldProduct?.price;

    await db().collection("products").updateOne({ _id: oid }, { $set: updates });

    if (price !== undefined && oldPrice && Number(price) < oldPrice) {
      // Find users who saved this product
      const savedUsers = await User.find({
        savedProducts: { $elemMatch: { $eq: oid.toString() } }
      }).select("_id");
      for (const u of savedUsers) {
        await Notification.create({
          user: u._id,
          type: "price_drop",
          message: `💰 Price drop! "${oldProduct.name}" is now ₹${Number(price).toLocaleString("en-IN")} (was ₹${oldPrice.toLocaleString("en-IN")}). Check it out!`,
        });
      }
    }

    const updated = await db().collection("products").findOne({ _id: oid });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: "Failed to update product" });
  }
});

// ─── UPDATE STOCK ───
router.patch("/stock/:productId", auth, ownerOnly, async (req, res) => {
  try {
    const oid = toObjId(req.params.productId);
    if (!oid) return res.status(400).json({ message: "Invalid ID" });
    const storeOid = req.owner.storeId;
    const newQty = Number(req.body.quantity);

    // Read the current stock BEFORE updating so we can detect 0 → positive transition
    const existing = await db().collection("stock").findOne({
      productId: oid,
      $or: [{ storeId: storeOid }, { storeId: storeOid.toString() }],
    });

    if (!existing)
      return res.status(404).json({ message: "Stock entry not found for this product in your store" });

    await db().collection("stock").updateOne(
      { productId: oid, $or: [{ storeId: storeOid }, { storeId: storeOid.toString() }] },
      { $set: { quantity: newQty } }
    );

    // Fire restock notifications if stock just went from 0 → positive
    if (existing.quantity === 0 && newQty > 0) {
      const product = await db().collection("products").findOne(
        { _id: oid },
        { projection: { name: 1 } }
      );
      if (product) {
        await fireRestockNotifications(oid, product.name);
      }
    }

    res.json({ message: "Stock updated", quantity: newQty });
  } catch {
    res.status(500).json({ message: "Failed" });
  }
});

// ─── GET STORE INFO ───
router.get("/store", auth, ownerOnly, async (req, res) => {
  try {
    const store = await db().collection("stores").findOne({ _id: req.owner.storeId });
    res.json(store);
  } catch {
    res.status(500).json({ message: "Failed" });
  }
});

module.exports = router;