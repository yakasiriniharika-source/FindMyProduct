const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema({
  name: { type: String, required: true },

  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },

  address: String,
  city: String
});

// Geospatial index (VERY IMPORTANT)
storeSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Store", storeSchema);
