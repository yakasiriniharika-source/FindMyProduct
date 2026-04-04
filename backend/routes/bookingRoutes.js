const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const User = require("../models/User");
const auth = require("../middleware/auth");

const db = () => mongoose.connection.db;
const toObjId = (id) => { try { return new mongoose.Types.ObjectId(id); } catch { return null; } };

// ─── SHARED HELPER: notify all users waiting for a product ───────────────────
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

    // Clear so they don't get notified again until they re-subscribe
    await User.updateMany(
      { notifyWhenAvailable: productOid },
      { $pull: { notifyWhenAvailable: productOid } }
    );
  } catch (err) {
    console.error("Restock notification error:", err);
  }
};

// ─── SHARED HELPER: restore stock + fire restock notifications ───────────────
// Restores booking.quantity units (defaults to 1 for old bookings without quantity)
const restoreStock = async (booking) => {
  const oid      = toObjId(booking.productId);
  const storeOid = toObjId(booking.storeId);
  if (!oid || !storeOid) return;

  const restoreQty = booking.quantity || 1;

  // Read current stock before restoring so we can detect transition back to available
  const before = await db().collection("stock").findOne({
    productId: oid,
    $or: [{ storeId: storeOid }, { storeId: storeOid.toString() }],
  });
  const qtyBefore = before?.quantity ?? 0;

  await db().collection("stock").updateOne(
    { productId: oid, $or: [{ storeId: storeOid }, { storeId: storeOid.toString() }] },
    { $inc: { quantity: restoreQty } }
  );

  // If stock was 0 before restore → it's now positive → notify waiting customers
  if (qtyBefore === 0 && restoreQty > 0) {
    await fireRestockNotifications(oid, booking.productName);
  }
};

// ─── SHARED HELPER: expire overdue accepted bookings → cancelled ──────────────
const expireBookings = async (query) => {
  const expired = await Booking.find({
    ...query,
    status: "accepted",
    holdExpiry: { $lt: new Date() },
  });

  await Promise.all(expired.map(async (b) => {
    b.status = "cancelled";
    await b.save();

    await restoreStock(b);

    await Notification.create({
      user:    b.user,
      type:    "booking_cancelled",
      message: `⏰ Your booking for "${b.productName}" at ${b.storeName} has expired as it was not picked up in time.`,
    }).catch(() => {});
  }));
};

// ─── CREATE BOOKING ───────────────────────────────────────────────────────────
router.post("/", auth, async (req, res) => {
  try {
    const {
      productId, storeId, pickupDate, notes,
      productName, productPrice, storeName,
      quantity,   // ← NEW: number of units customer wants to book
    } = req.body;

    if (!productId) return res.status(400).json({ message: "productId required" });

    // Clamp quantity: must be at least 1
    const bookQty = Math.max(1, Number(quantity) || 1);

    const oid = toObjId(productId);
    const stockEntry = oid ? await db().collection("stock").findOne({ productId: oid }) : null;

    // Validate: enough stock for the requested quantity
    if (!stockEntry || stockEntry.quantity < bookQty)
      return res.status(400).json({
        message: bookQty > 1
          ? `Only ${stockEntry?.quantity || 0} unit(s) available. Please reduce quantity.`
          : "Product out of stock",
      });

    const finalStoreId = storeId?.toString() || stockEntry?.storeId?.toString();
    const holdExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const booking = await Booking.create({
      user:         req.user.id,
      productId,
      storeId:      finalStoreId,
      productName:  productName || "",
      productPrice: productPrice || null,
      storeName:    storeName || "",
      quantity:     bookQty,            // ← save quantity
      pickupDate:   pickupDate || null,
      notes:        notes || "",
      holdExpiry,
      status:       "pending",
    });

    await Notification.create({
      user: req.user.id, type: "general",
      message: `📦 Booking request for ${bookQty > 1 ? `${bookQty}× ` : ""}"${booking.productName}" sent to ${booking.storeName}. Waiting for approval.`,
    });

    if (finalStoreId) {
      const owner = await User.findOne({ storeId: toObjId(finalStoreId), role: "store_owner" });
      if (owner) {
        const customer = await User.findById(req.user.id).select("name phone");
        await Notification.create({
          user: owner._id, type: "general",
          message: `🛒 New booking! ${bookQty > 1 ? `${bookQty}× ` : ""}"${booking.productName}" by ${customer?.name}${customer?.phone ? ` (${customer.phone})` : ""}. Check dashboard.`,
        });
      }
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Booking failed" });
  }
});

// ─── GET MY BOOKINGS (customer) ───────────────────────────────────────────────
router.get("/my", auth, async (req, res) => {
  try {
    await expireBookings({ user: req.user.id });

    const bookings = await Booking.find({ user: req.user.id }).sort({ createdAt: -1 });
    const enriched = await Promise.all(bookings.map(async (b) => {
      const obj = b.toObject();
      try {
        const oid = toObjId(b.productId);
        if (oid) {
          const product = await db().collection("products").findOne(
            { _id: oid }, { projection: { name: 1, brand: 1, category: 1, price: 1, imageUrl: 1 } }
          );
          if (product) obj.product = product;
        }
        if (b.storeId) {
          const storeOid = toObjId(b.storeId);
          const store = storeOid ? await db().collection("stores").findOne({ _id: storeOid }) : null;
          if (store) {
            obj.storeContact = store.contact;
            obj.storeAddress = store.address;
            obj.storeLat = store.location?.coordinates?.[1];
            obj.storeLng = store.location?.coordinates?.[0];
          }
          const owner = await User.findOne({ storeId: toObjId(b.storeId), role: "store_owner" }).select("phone name");
          if (owner) obj.ownerPhone = owner.phone;
        }
      } catch {}
      return obj;
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: "Failed" });
  }
});

// ─── CANCEL BOOKING (customer) ────────────────────────────────────────────────
router.patch("/:id/cancel", auth, async (req, res) => {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, user: req.user.id });
    if (!booking) return res.status(404).json({ message: "Not found" });

    const wasAccepted = booking.status === "accepted";

    booking.status = "cancelled";
    await booking.save();

    if (wasAccepted) {
      await restoreStock(booking); // restores booking.quantity units + fires restock notifications if needed
    }

    await Notification.create({
      user: req.user.id, type: "booking_cancelled",
      message: `🚫 Booking for "${booking.productName}" cancelled.`,
    });

    res.json(booking);
  } catch {
    res.status(500).json({ message: "Failed" });
  }
});

// ─── GET STORE BOOKINGS (owner) ───────────────────────────────────────────────
router.get("/store", auth, async (req, res) => {
  try {
    const owner = await User.findById(req.user.id);
    if (owner.role !== "store_owner" || !owner.storeId)
      return res.status(403).json({ message: "Not a store owner" });

    await expireBookings({ storeId: owner.storeId.toString() });

    const bookings = await Booking.find({ storeId: owner.storeId.toString() }).sort({ createdAt: -1 });
    const enriched = await Promise.all(bookings.map(async (b) => {
      const obj = b.toObject();
      try {
        const customer = await User.findById(b.user).select("name email phone");
        if (customer) obj.customer = customer;
        const oid = toObjId(b.productId);
        if (oid) {
          const product = await db().collection("products").findOne(
            { _id: oid }, { projection: { name: 1, brand: 1, category: 1, price: 1, imageUrl: 1 } }
          );
          if (product) obj.product = product;
        }
      } catch {}
      return obj;
    }));
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ message: "Failed" });
  }
});

// ─── ACCEPT / DECLINE (owner) ─────────────────────────────────────────────────
router.patch("/:id/respond", auth, async (req, res) => {
  try {
    const { status, ownerNote } = req.body;
    if (!["accepted", "declined"].includes(status))
      return res.status(400).json({ message: "Invalid status" });

    const owner = await User.findById(req.user.id);
    if (owner.role !== "store_owner") return res.status(403).json({ message: "Not owner" });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Not found" });

    if (status === "accepted") {
      const oid      = toObjId(booking.productId);
      const storeOid = toObjId(owner.storeId.toString());
      const bookQty  = booking.quantity || 1;   // ← use booking quantity

      if (oid && storeOid) {
        const stock = await db().collection("stock").findOne({
          productId: oid,
          $or: [{ storeId: storeOid }, { storeId: storeOid.toString() }],
        });

        // Validate enough stock for the booked quantity
        if (!stock || stock.quantity < bookQty)
          return res.status(400).json({
            message: `Not enough stock to accept — need ${bookQty}, have ${stock?.quantity || 0}`,
          });

        // Deduct the exact booked quantity
        await db().collection("stock").updateOne(
          { productId: oid, $or: [{ storeId: storeOid }, { storeId: storeOid.toString() }] },
          { $inc: { quantity: -bookQty } }
        );
      }
    }

    booking.status = status;
    booking.ownerNote = ownerNote || "";
    booking.respondedAt = new Date();
    await booking.save();

    const qtyLabel = (booking.quantity || 1) > 1 ? ` (×${booking.quantity})` : "";
    const msg = status === "accepted"
      ? `✅ Your booking for "${booking.productName}"${qtyLabel} at ${booking.storeName} was ACCEPTED! Visit before ${new Date(booking.holdExpiry).toLocaleDateString()}.`
      : `❌ Your booking for "${booking.productName}" was DECLINED.${ownerNote ? ` Reason: ${ownerNote}` : ""}`;

    await Notification.create({
      user: booking.user,
      type: status === "accepted" ? "booking_confirmed" : "booking_cancelled",
      message: msg,
    });

    res.json(booking);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed" });
  }
});

// ─── MARK COMPLETED (owner) ───────────────────────────────────────────────────
router.patch("/:id/complete", auth, async (req, res) => {
  try {
    const owner = await User.findById(req.user.id);
    if (!owner || owner.role !== "store_owner")
      return res.status(403).json({ message: "Not owner" });

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    if (booking.storeId.toString() !== owner.storeId.toString())
      return res.status(403).json({ message: "This booking does not belong to your store" });

    if (booking.status !== "accepted")
      return res.status(400).json({ message: "Only accepted bookings can be marked as completed" });

    booking.status = "completed";
    booking.completedAt = new Date();
    await booking.save();

    await Notification.create({
      user: booking.user,
      type: "general",
      message: `🎉 Your pickup of "${booking.productName}" from ${booking.storeName} is marked as completed. Thank you!`,
    });

    res.json(booking);
  } catch (err) {
    console.error("Complete booking error:", err);
    res.status(500).json({ message: "Failed to complete booking" });
  }
});

module.exports = router;