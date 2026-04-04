const mongoose = require("mongoose");

// No required fields — products live in raw MongoDB collection
// This model is only used if needed; all queries use db().collection("products") directly
const productSchema = new mongoose.Schema({
  name:     { type: String },
  brand:    { type: String },
  category: { type: String },
  price:    { type: Number },
  mrp:      { type: Number },
  imageUrl: { type: String },
  inStock:  { type: Boolean, default: true },
  quantity: { type: Number, default: 0 },
  storeName:    { type: String },
  storeAddress: { type: String },
  description:  { type: String },
  specs:    { type: Object },
  ratings:  [
    {
      user:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      score:     Number,
      comment:   String,
      createdAt: { type: Date, default: Date.now },
    },
  ],
  location: {
    type:        { type: String },
    coordinates: { type: [Number] },
  },
});

// Only create index if location exists
productSchema.index({ location: "2dsphere" }, { sparse: true });

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema);