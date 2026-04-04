const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const auth = require("../middleware/auth");
const User = require("../models/User");
const Notification = require("../models/Notification");

const db = () => mongoose.connection.db;
const toObjId = (id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } };

const CATEGORY_MAP = {
  "mobile":          ["Mobile"],
  "laptop":          ["Laptop"],
  "tv":              ["TV"],
  "refrigerator":    ["Refrigerator"],
  "smartwatch":      ["smart watch"],
  "washing machine": ["Washing Machine"],
  "washing+machine": ["Washing Machine"],
};

// ─── SEARCH ───────────────────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  try {
    const { q, lat, lng, distance = 60000, category } = req.query;

    if (!lat || !lng) return res.status(400).json({ message: "Missing coordinates" });

    const latitude  = Number(lat);
    const longitude = Number(lng);
    if (isNaN(latitude) || isNaN(longitude))
      return res.status(400).json({ message: "Invalid coordinates" });

    const nearbyStores = await db().collection("stores").aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [longitude, latitude] },
          distanceField: "distance",
          maxDistance: Number(distance),
          spherical: true,
        },
      },
      { $project: { _id: 1, name: 1, address: 1, location: 1, distance: 1 } },
    ]).toArray();

    if (nearbyStores.length === 0) return res.json([]);

    const storeMap = {};
    nearbyStores.forEach(s => { storeMap[s._id.toString()] = s; });
    const nearbyStoreIds = nearbyStores.map(s => s._id);

    const stockEntries = await db().collection("stock").find({
      storeId: { $in: nearbyStoreIds },
    }).toArray();

    if (stockEntries.length === 0) return res.json([]);

    const productIds = [...new Set(stockEntries.map(s => s.productId.toString()))]
      .map(id => toObjId(id))
      .filter(Boolean);

    const productFilter = { _id: { $in: productIds } };

    if (q && q.trim() && q !== "undefined") {
      productFilter.name = { $regex: q.trim(), $options: "i" };
    }

    if (category && category !== "all" && category !== "undefined") {
      const decoded = decodeURIComponent(category).toLowerCase();
      const dbCategories = CATEGORY_MAP[decoded] || CATEGORY_MAP[category];
      if (dbCategories) productFilter.category = { $in: dbCategories };
    }

    const products = await db().collection("products").find(productFilter).toArray();
    if (products.length === 0) return res.json([]);

    const results = [];

    for (const product of products) {
      const pidStr = product._id.toString();
      const stockForProduct = stockEntries.filter(s => s.productId.toString() === pidStr);
      if (stockForProduct.length === 0) continue;

      let bestStock = null;
      let bestStore = null;
      let bestDist  = Infinity;

      for (const stock of stockForProduct) {
        const store = storeMap[stock.storeId.toString()];
        if (store && store.distance < bestDist) {
          bestDist  = store.distance;
          bestStock = stock;
          bestStore = store;
        }
      }

      if (!bestStore) continue;

      results.push({
        _id:          product._id,
        name:         product.name,
        brand:        product.brand,
        category:     product.category,
        price:        product.price,
        mrp:          product.mrp,
        specs:        product.specs,
        imageUrl:     product.imageUrl,
        ratings:      product.ratings || [],
        inStock:      bestStock.quantity > 0,
        quantity:     bestStock.quantity,
        storeName:    bestStore.name,
        storeAddress: bestStore.address,
        storeId:      bestStore._id,
        location:     bestStore.location,
        distance:     parseFloat((bestDist / 1000).toFixed(2)),
      });
    }

    results.sort((a, b) => a.distance - b.distance);
    console.log(`Search q="${q}" cat="${category}" → ${results.length} results`);
    res.json(results);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ message: "Search failed", error: err.message });
  }
});

// ─── SEARCH SUGGESTIONS ───────────────────────────────────────────────────────
router.get("/suggestions", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const products = await db().collection("products").find(
      { name: { $regex: q.trim(), $options: "i" } },
      { projection: { name: 1, brand: 1, category: 1 } }
    ).limit(6).toArray();
    res.json(products);
  } catch { res.json([]); }
});

router.get("/suggest", async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) return res.json([]);
    const suggestions = await db().collection("products").find(
      { name: { $regex: q.trim(), $options: "i" } },
      { projection: { name: 1, brand: 1, category: 1 } }
    ).limit(6).toArray();
    res.json(suggestions);
  } catch {
    res.status(500).json([]);
  }
});

// ─── GET ALL ──────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const products = await db().collection("products").find({}).toArray();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});


// ─── GET REVIEWS FOR OWNER ────────────────────────────────────────────────────
// Returns all reviews for all products owned by the authenticated store owner.
router.get("/owner/reviews", auth, async (req, res) => {
  try {
    const owner = await User.findById(req.user.id);
    if (!owner || owner.role !== "store_owner")
      return res.status(403).json({ message: "Not a store owner" });

    // Find all stock entries for this store → get product IDs
    const stockEntries = await db().collection("stock").find({
      storeId: owner.storeId,
    }).toArray();

    const productIds = stockEntries
      .map(s => toObjId(s.productId.toString()))
      .filter(Boolean);

    if (productIds.length === 0) return res.json([]);

    // Fetch those products and pull their ratings
    const products = await db().collection("products").find(
      { _id: { $in: productIds }, "ratings.0": { $exists: true } }, // only products with reviews
      { projection: { name: 1, brand: 1, imageUrl: 1, category: 1, ratings: 1 } }
    ).toArray();

    // Enrich each review with the reviewer's name
    const userIds = [
      ...new Set(
        products.flatMap(p => (p.ratings || []).map(r => r.user?.toString()).filter(Boolean))
      ),
    ].map(id => toObjId(id)).filter(Boolean);

    const users = await User.find({ _id: { $in: userIds } }).select("name").lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id.toString()] = u.name; });

    // Shape the response: flat list of reviews with product info attached
    const reviews = products.flatMap(p =>
      (p.ratings || []).map(r => ({
        productId:   p._id,
        productName: p.name,
        productBrand: p.brand,
        productImage: p.imageUrl,
        category:    p.category,
        score:       r.score,
        comment:     r.comment || "",
        createdAt:   r.createdAt,
        userName:    userMap[r.user?.toString()] || "Anonymous",
      }))
    ).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first

    res.json(reviews);
  } catch (err) {
    console.error("Owner reviews error:", err);
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

// ─── GET BY ID ────────────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const oid = toObjId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid product ID" });

    const product = await db().collection("products").findOne({ _id: oid });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const preferredStoreId = toObjId(req.query.storeId);
    const stockQuery = preferredStoreId
      ? { productId: oid, storeId: preferredStoreId }
      : { productId: oid };

    let stockEntry = await db().collection("stock").findOne(stockQuery);
    if (!stockEntry && preferredStoreId) {
      stockEntry = await db().collection("stock").findOne({ productId: oid });
    }

    if (stockEntry) {
      const store = await db().collection("stores").findOne({ _id: stockEntry.storeId });
      if (store) {
        product.storeName    = store.name;
        product.storeAddress = store.address;
        product.location     = store.location;
        product.inStock      = stockEntry.quantity > 0;
        product.quantity     = stockEntry.quantity;
        product.storeId      = store._id;
      }
    }

    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── ADD REVIEW (customer) ────────────────────────────────────────────────────
router.post("/:id/review", auth, async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5)
      return res.status(400).json({ message: "Score must be between 1 and 5" });

    const oid = toObjId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid ID" });

    // Prevent duplicate reviews from the same user
    const product = await db().collection("products").findOne({ _id: oid });
    if (!product) return res.status(404).json({ message: "Product not found" });

    const alreadyReviewed = (product.ratings || []).some(
      r => r.user?.toString() === req.user.id.toString()
    );
    if (alreadyReviewed)
      return res.status(400).json({ message: "You have already reviewed this product" });

    await db().collection("products").updateOne(
      { _id: oid },
      {
        $push: {
          ratings: {
            user:      toObjId(req.user.id),
            score:     Number(score),
            comment:   comment || "",
            createdAt: new Date(),
          },
        },
      }
    );

    // Notify the store owner that a new review was posted
    try {
      const stockEntry = await db().collection("stock").findOne({ productId: oid });
      if (stockEntry?.storeId) {
        const owner = await User.findOne({
          storeId: stockEntry.storeId,
          role: "store_owner",
        });
        if (owner) {
          const reviewer = await User.findById(req.user.id).select("name");
          await Notification.create({
            user:    owner._id,
            type:    "general",
            message: `⭐ New review on "${product.name}" by ${reviewer?.name || "a customer"} — ${score}/5 stars.`,
          });
        }
      }
    } catch {} // non-critical — don't fail the review if notification fails

    res.json({ message: "Review added" });
  } catch {
    res.status(500).json({ message: "Failed to add review" });
  }
});


// ─── NOTIFY ME WHEN BACK IN STOCK ────────────────────────────────────────────
// Toggles the user's notifyWhenAvailable list for a product.
router.post("/:id/notify", auth, async (req, res) => {
  try {
    const oid = toObjId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid product ID" });

    const user = await User.findById(req.user.id);
    const alreadySubscribed = user.notifyWhenAvailable.some(
      pid => pid.toString() === oid.toString()
    );

    if (alreadySubscribed) {
      // Toggle off
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { notifyWhenAvailable: oid },
      });
      return res.json({ subscribed: false, message: "Notification removed." });
    }

    // Check product exists
    const product = await db().collection("products").findOne(
      { _id: oid },
      { projection: { name: 1, inStock: 1 } }
    );
    if (!product) return res.status(404).json({ message: "Product not found" });

    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { notifyWhenAvailable: oid },
    });

    res.json({
      subscribed: true,
      message: `🔔 We'll notify you when "${product.name}" is back in stock!`,
    });
  } catch (err) {
    console.error("Notify error:", err);
    res.status(500).json({ message: "Failed to set notification" });
  }
});

// ─── CHECK NOTIFY STATUS ──────────────────────────────────────────────────────
// So the frontend can show the correct button state on load.
router.get("/:id/notify-status", auth, async (req, res) => {
  try {
    const oid = toObjId(req.params.id);
    if (!oid) return res.status(400).json({ subscribed: false });
    const user = await User.findById(req.user.id).select("notifyWhenAvailable");
    const subscribed = user.notifyWhenAvailable.some(pid => pid.toString() === oid.toString());
    res.json({ subscribed });
  } catch {
    res.json({ subscribed: false });
  }
});

module.exports = router;