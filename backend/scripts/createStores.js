const mongoose = require("mongoose");
const Store = require("../models/Store");

mongoose.connect("mongodb://127.0.0.1:27017/findmyproduct");

const stores = [
  {
    name: "Reliance Digital - Vizag",
    city: "Visakhapatnam",
    address: "Dwaraka Nagar",
    location: {
      type: "Point",
      coordinates: [83.3095, 17.7253]
    }
  },
  {
    name: "Croma - Vijayawada",
    city: "Vijayawada",
    address: "MG Road",
    location: {
      type: "Point",
      coordinates: [80.6480, 16.5062]
    }
  }
];

Store.insertMany(stores).then(() => {
  console.log("Stores added ✅");
  mongoose.connection.close();
});
