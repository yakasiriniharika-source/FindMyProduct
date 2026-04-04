const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user:         { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId:    { type: String, required: true },
    storeId:      { type: String },
    productName:  { type: String, default: "" },
    productPrice: { type: Number, default: null },
    storeName:    { type: String, default: "" },
    quantity:     { type: Number, default: 1 },   // ← NEW: how many units the customer wants
    status: {
      type: String,
      enum: ["pending", "confirmed", "accepted", "declined", "cancelled", "completed"],
      default: "confirmed",
    },
    pickupDate:   { type: Date, default: null },
    notes:        { type: String, default: "" },
    holdExpiry:   { type: Date },
    // Store owner response
    ownerNote:    { type: String, default: "" },
    respondedAt:  { type: Date, default: null },
    completedAt:  { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Booking || mongoose.model("Booking", bookingSchema);