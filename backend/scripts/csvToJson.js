const csv = require("csvtojson");
const fs = require("fs");
const path = require("path");

const csvFilePath = path.join(__dirname, "../data/flipkart_mobiles.csv");
const jsonFilePath = path.join(__dirname, "../data/products.json");

csv()
  .fromFile(csvFilePath)
  .then((jsonArray) => {
    fs.writeFileSync(jsonFilePath, JSON.stringify(jsonArray, null, 2));
    console.log("CSV → JSON conversion done ✅");
  })
  .catch((err) => {
    console.error("Error:", err);
  });
