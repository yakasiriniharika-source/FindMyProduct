const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name:     { type: String, required: true },
    email:    { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone:    { type: String, default: "" },
    role:     { type: String, enum: ["customer", "store_owner"], default: "customer" },
    storeId:  { type: mongoose.Schema.Types.ObjectId, default: null }, // for store owners
    avatar:   { type: String, default: "" },
    savedProducts:       [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    notifyWhenAvailable: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);