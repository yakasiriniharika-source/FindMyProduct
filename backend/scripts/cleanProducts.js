const fs = require("fs");
const path = require("path");

const inputPath = path.join(__dirname, "../data/products.json");
const outputPath = path.join(__dirname, "../data/cleanProducts.json");

const rawData = JSON.parse(fs.readFileSync(inputPath));

const cleaned = rawData.slice(0, 20).map((item) => ({
  name: item.Name,
  brand: item.Brand,
  category: "mobile", // later auto cheddam

  price: Number(item["Selling Price"]),
  mrp: Number(item.MRP),

  specs: {
    model: item.Model || "",
    storage: item.storage || null,
    color: item.Color || null,
    details: item.Details
      ? item.Details.replace(/[\[\]']/g, "").split("  ")
      : []
  }
}));

fs.writeFileSync(outputPath, JSON.stringify(cleaned, null, 2));
console.log("Clean products created ✅");
