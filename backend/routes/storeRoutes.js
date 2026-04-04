const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

const db = () => mongoose.connection.db;
const toObjId = (id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } };

// ─── GET ALL STORES ───
router.get("/", async (req, res) => {
  try {
    const stores = await db().collection("stores").find({}).toArray();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

// ─── GET STORE BY ID with products ───
router.get("/:id", async (req, res) => {
  try {
    const oid = toObjId(req.params.id);
    if (!oid) return res.status(400).json({ message: "Invalid store ID" });

    const store = await db().collection("stores").findOne({ _id: oid });
    if (!store) return res.status(404).json({ message: "Store not found" });

    // Clean ObjectId query
    const stockEntries = await db().collection("stock").find({
      storeId: oid,
    }).toArray();

    if (stockEntries.length === 0) {
      return res.json({ store, products: [] });
    }

    // Get product IDs from stock
    const productIds = stockEntries
      .map(s => s.productId)
      .filter(Boolean);

    // Fetch products
    const products = await db().collection("products").find({
      _id: { $in: productIds },
    }).toArray();

    // Attach stock info to each product
    const productsWithStock = products.map(p => {
      const stock = stockEntries.find(
        s => s.productId.toString() === p._id.toString()
      );
      return {
        ...p,
        quantity:     stock?.quantity || 0,
        inStock:      (stock?.quantity || 0) > 0,
        storeName:    store.name,
        storeAddress: store.address,
        storeId:      store._id,
        location:     store.location,
        distance:     0,
      };
    });

    console.log(`Store ${store.name}: ${productsWithStock.length} products`);
    res.json({ store, products: productsWithStock });
  } catch (err) {
    console.error("Store error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;