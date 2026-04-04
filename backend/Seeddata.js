// ============================================================
//  FindMyProduct - MongoDB Seed Script
//  Run: node seedData.js
//  Place this file in your project root folder
// ============================================================

const mongoose = require("mongoose");

// ✅ Change this to your MongoDB connection string if different
const MONGO_URI = "mongodb://localhost:27017/findmyproduct";

// ─────────────────────────────────────────────
//  SCHEMAS
// ─────────────────────────────────────────────

const productSchema = new mongoose.Schema({
  name: String,
  brand: String,
  category: String,
  price: Number,
  stock: Number,
  description: String,
  imageUrl: String,
});

const storeSchema = new mongoose.Schema({
  name: String,
  owner: String,
  phone: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  location: {
    type: { type: String, default: "Point" },
    coordinates: [Number], // [longitude, latitude]
  },
  categories: [String],
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  rating: Number,
  isOpen: Boolean,
});

storeSchema.index({ location: "2dsphere" });

const Product = mongoose.model("Product", productSchema);
const Store = mongoose.model("Store", storeSchema);

// ─────────────────────────────────────────────
//  PRODUCT DATA  (10 per category)
// ─────────────────────────────────────────────

const productsData = [
  // ── Mobiles ──
  { name: "iPhone 15", brand: "Apple", category: "Mobiles", price: 79999, stock: 15, description: "Apple iPhone 15 128GB", imageUrl: "https://via.placeholder.com/200?text=iPhone+15" },
  { name: "Galaxy S24", brand: "Samsung", category: "Mobiles", price: 74999, stock: 12, description: "Samsung Galaxy S24 256GB", imageUrl: "https://via.placeholder.com/200?text=Galaxy+S24" },
  { name: "OnePlus 12", brand: "OnePlus", category: "Mobiles", price: 64999, stock: 8, description: "OnePlus 12 256GB", imageUrl: "https://via.placeholder.com/200?text=OnePlus+12" },
  { name: "Redmi Note 13 Pro", brand: "Xiaomi", category: "Mobiles", price: 24999, stock: 20, description: "Redmi Note 13 Pro 128GB", imageUrl: "https://via.placeholder.com/200?text=Redmi+Note+13" },
  { name: "Realme 12 Pro+", brand: "Realme", category: "Mobiles", price: 27999, stock: 18, description: "Realme 12 Pro+ 256GB", imageUrl: "https://via.placeholder.com/200?text=Realme+12+Pro" },
  { name: "Vivo V30 Pro", brand: "Vivo", category: "Mobiles", price: 38999, stock: 10, description: "Vivo V30 Pro 256GB", imageUrl: "https://via.placeholder.com/200?text=Vivo+V30" },
  { name: "Oppo Reno 11 Pro", brand: "Oppo", category: "Mobiles", price: 34999, stock: 9, description: "Oppo Reno 11 Pro 256GB", imageUrl: "https://via.placeholder.com/200?text=Oppo+Reno+11" },
  { name: "Pixel 8a", brand: "Google", category: "Mobiles", price: 52999, stock: 6, description: "Google Pixel 8a 128GB", imageUrl: "https://via.placeholder.com/200?text=Pixel+8a" },
  { name: "Moto G84", brand: "Motorola", category: "Mobiles", price: 18999, stock: 14, description: "Motorola Moto G84 256GB", imageUrl: "https://via.placeholder.com/200?text=Moto+G84" },
  { name: "POCO X6 Pro", brand: "POCO", category: "Mobiles", price: 22999, stock: 16, description: "POCO X6 Pro 256GB", imageUrl: "https://via.placeholder.com/200?text=POCO+X6+Pro" },

  // ── Laptops ──
  { name: "MacBook Air M2", brand: "Apple", category: "Laptops", price: 114900, stock: 5, description: "Apple MacBook Air M2 8GB 256GB", imageUrl: "https://via.placeholder.com/200?text=MacBook+Air" },
  { name: "Dell Inspiron 15", brand: "Dell", category: "Laptops", price: 62999, stock: 7, description: "Dell Inspiron 15 Intel i5 16GB", imageUrl: "https://via.placeholder.com/200?text=Dell+Inspiron" },
  { name: "HP Pavilion 14", brand: "HP", category: "Laptops", price: 57999, stock: 8, description: "HP Pavilion 14 Intel i5 8GB", imageUrl: "https://via.placeholder.com/200?text=HP+Pavilion" },
  { name: "Lenovo IdeaPad Slim 5", brand: "Lenovo", category: "Laptops", price: 54999, stock: 10, description: "Lenovo IdeaPad Slim 5 Ryzen 5", imageUrl: "https://via.placeholder.com/200?text=Lenovo+IdeaPad" },
  { name: "Asus VivoBook 16", brand: "Asus", category: "Laptops", price: 59999, stock: 6, description: "Asus VivoBook 16 Intel i7", imageUrl: "https://via.placeholder.com/200?text=Asus+VivoBook" },
  { name: "Acer Aspire Lite", brand: "Acer", category: "Laptops", price: 44999, stock: 9, description: "Acer Aspire Lite Ryzen 5 8GB", imageUrl: "https://via.placeholder.com/200?text=Acer+Aspire" },
  { name: "MSI Modern 14", brand: "MSI", category: "Laptops", price: 67999, stock: 4, description: "MSI Modern 14 Intel i5 16GB", imageUrl: "https://via.placeholder.com/200?text=MSI+Modern" },
  { name: "Samsung Galaxy Book3", brand: "Samsung", category: "Laptops", price: 84999, stock: 3, description: "Samsung Galaxy Book3 Intel i7", imageUrl: "https://via.placeholder.com/200?text=Galaxy+Book3" },
  { name: "Mi Notebook Pro 14", brand: "Xiaomi", category: "Laptops", price: 49999, stock: 7, description: "Mi Notebook Pro 14 Intel i5", imageUrl: "https://via.placeholder.com/200?text=Mi+Notebook" },
  { name: "Realme Book Prime", brand: "Realme", category: "Laptops", price: 46999, stock: 5, description: "Realme Book Prime Intel i5", imageUrl: "https://via.placeholder.com/200?text=Realme+Book" },

  // ── TVs ──
  { name: "55\" OLED C3", brand: "LG", category: "TVs", price: 149999, stock: 3, description: "LG 55 inch OLED 4K Smart TV", imageUrl: "https://via.placeholder.com/200?text=LG+OLED" },
  { name: "65\" QLED Q70C", brand: "Samsung", category: "TVs", price: 129999, stock: 4, description: "Samsung 65 inch QLED 4K", imageUrl: "https://via.placeholder.com/200?text=Samsung+QLED" },
  { name: "55\" X90L 4K", brand: "Sony", category: "TVs", price: 119999, stock: 3, description: "Sony Bravia 55 inch 4K HDR", imageUrl: "https://via.placeholder.com/200?text=Sony+Bravia" },
  { name: "43\" Fire TV", brand: "Redmi", category: "TVs", price: 29999, stock: 10, description: "Redmi 43 inch 4K Fire TV", imageUrl: "https://via.placeholder.com/200?text=Redmi+TV" },
  { name: "50\" Bezel-Less", brand: "Realme", category: "TVs", price: 34999, stock: 8, description: "Realme 50 inch 4K SUHD TV", imageUrl: "https://via.placeholder.com/200?text=Realme+TV" },
  { name: "55\" U-Series 4K", brand: "Hisense", category: "TVs", price: 44999, stock: 5, description: "Hisense 55 inch 4K ULED Smart TV", imageUrl: "https://via.placeholder.com/200?text=Hisense+TV" },
  { name: "43\" FHD Smart TV", brand: "TCL", category: "TVs", price: 24999, stock: 12, description: "TCL 43 inch FHD Android TV", imageUrl: "https://via.placeholder.com/200?text=TCL+TV" },
  { name: "55\" NanoCell", brand: "LG", category: "TVs", price: 69999, stock: 4, description: "LG 55 inch NanoCell 4K", imageUrl: "https://via.placeholder.com/200?text=LG+NanoCell" },
  { name: "65\" OLED X95L", brand: "Sony", category: "TVs", price: 249999, stock: 2, description: "Sony Bravia 65 inch OLED 4K", imageUrl: "https://via.placeholder.com/200?text=Sony+OLED" },
  { name: "40\" Smart FHD", brand: "VU", category: "TVs", price: 18999, stock: 15, description: "VU 40 inch FHD Smart TV", imageUrl: "https://via.placeholder.com/200?text=VU+TV" },

  // ── Home Appliances ──
  { name: "1.5T 5 Star Inverter AC", brand: "Voltas", category: "Home Appliances", price: 38999, stock: 6, description: "Voltas 1.5 Ton 5 Star Split AC", imageUrl: "https://via.placeholder.com/200?text=Voltas+AC" },
  { name: "570L French Door Fridge", brand: "LG", category: "Home Appliances", price: 89999, stock: 3, description: "LG 570L French Door Refrigerator", imageUrl: "https://via.placeholder.com/200?text=LG+Fridge" },
  { name: "7kg Front Load Washer", brand: "Samsung", category: "Home Appliances", price: 34999, stock: 5, description: "Samsung 7kg Front Load Washing Machine", imageUrl: "https://via.placeholder.com/200?text=Samsung+WM" },
  { name: "28L Convection Microwave", brand: "IFB", category: "Home Appliances", price: 14999, stock: 8, description: "IFB 28L Convection Microwave", imageUrl: "https://via.placeholder.com/200?text=IFB+Microwave" },
  { name: "1.5T 3 Star Split AC", brand: "Daikin", category: "Home Appliances", price: 35999, stock: 7, description: "Daikin 1.5 Ton 3 Star Inverter AC", imageUrl: "https://via.placeholder.com/200?text=Daikin+AC" },
  { name: "8kg Top Load Washer", brand: "Whirlpool", category: "Home Appliances", price: 22999, stock: 9, description: "Whirlpool 8kg Top Load Washing Machine", imageUrl: "https://via.placeholder.com/200?text=Whirlpool+WM" },
  { name: "500L Side-by-Side Fridge", brand: "Haier", category: "Home Appliances", price: 69999, stock: 4, description: "Haier 500L Side-by-Side Refrigerator", imageUrl: "https://via.placeholder.com/200?text=Haier+Fridge" },
  { name: "2000W Induction Cooktop", brand: "Philips", category: "Home Appliances", price: 3499, stock: 20, description: "Philips 2000W Induction Cooktop", imageUrl: "https://via.placeholder.com/200?text=Philips+Induction" },
  { name: "55L Oven Toaster Grill", brand: "Morphy Richards", category: "Home Appliances", price: 7999, stock: 11, description: "Morphy Richards 55L OTG", imageUrl: "https://via.placeholder.com/200?text=OTG" },
  { name: "750W Mixer Grinder", brand: "Bajaj", category: "Home Appliances", price: 2799, stock: 25, description: "Bajaj 750W 3 Jar Mixer Grinder", imageUrl: "https://via.placeholder.com/200?text=Bajaj+MG" },

  // ── Cameras ──
  { name: "EOS R50 Mirrorless", brand: "Canon", category: "Cameras", price: 74999, stock: 4, description: "Canon EOS R50 24.2MP Mirrorless", imageUrl: "https://via.placeholder.com/200?text=Canon+R50" },
  { name: "Z30 Mirrorless", brand: "Nikon", category: "Cameras", price: 69999, stock: 3, description: "Nikon Z30 20.9MP Mirrorless", imageUrl: "https://via.placeholder.com/200?text=Nikon+Z30" },
  { name: "Alpha ZV-E10", brand: "Sony", category: "Cameras", price: 64999, stock: 5, description: "Sony ZV-E10 24.2MP Mirrorless", imageUrl: "https://via.placeholder.com/200?text=Sony+ZVE10" },
  { name: "X-S20 Mirrorless", brand: "Fujifilm", category: "Cameras", price: 119999, stock: 2, description: "Fujifilm X-S20 26.1MP Mirrorless", imageUrl: "https://via.placeholder.com/200?text=Fujifilm+XS20" },
  { name: "OM-5 Micro 4/3", brand: "OM System", category: "Cameras", price: 99999, stock: 3, description: "OM System OM-5 20.4MP Weather-Sealed", imageUrl: "https://via.placeholder.com/200?text=OM+System" },
  { name: "EOS 1500D DSLR", brand: "Canon", category: "Cameras", price: 39999, stock: 6, description: "Canon EOS 1500D 24.1MP DSLR", imageUrl: "https://via.placeholder.com/200?text=Canon+1500D" },
  { name: "D3500 DSLR", brand: "Nikon", category: "Cameras", price: 34999, stock: 7, description: "Nikon D3500 24.2MP DSLR", imageUrl: "https://via.placeholder.com/200?text=Nikon+D3500" },
  { name: "Hero 12 Black", brand: "GoPro", category: "Cameras", price: 39999, stock: 8, description: "GoPro Hero 12 Black 5.3K Action Cam", imageUrl: "https://via.placeholder.com/200?text=GoPro+12" },
  { name: "Osmo Pocket 3", brand: "DJI", category: "Cameras", price: 44999, stock: 5, description: "DJI Osmo Pocket 3 4K Gimbal Camera", imageUrl: "https://via.placeholder.com/200?text=DJI+Pocket3" },
  { name: "Instax Mini 12", brand: "Fujifilm", category: "Cameras", price: 7999, stock: 15, description: "Fujifilm Instax Mini 12 Instant Camera", imageUrl: "https://via.placeholder.com/200?text=Instax+Mini" },
];

// ─────────────────────────────────────────────
//  STORES NEAR KADAPA, ANDHRA PRADESH
// ─────────────────────────────────────────────
// Coordinates: [longitude, latitude]

const storesData = [
  {
    name: "Sri Venkateswara Electronics",
    owner: "Ravi Kumar",
    phone: "9848012345",
    address: "Gandhi Nagar, Near Bus Stand",
    city: "Kadapa",
    state: "Andhra Pradesh",
    pincode: "516001",
    location: { type: "Point", coordinates: [78.8242, 14.4673] },
    categories: ["Mobiles", "Laptops", "TVs"],
    rating: 4.5,
    isOpen: true,
  },
  {
    name: "Balaji Digital World",
    owner: "Suresh Reddy",
    phone: "9849023456",
    address: "RTC Complex Road, Kadapa",
    city: "Kadapa",
    state: "Andhra Pradesh",
    pincode: "516001",
    location: { type: "Point", coordinates: [78.8198, 14.4712] },
    categories: ["Mobiles", "Home Appliances", "Cameras"],
    rating: 4.2,
    isOpen: true,
  },
  {
    name: "Sai Electronics & Mobiles",
    owner: "Nagaraju",
    phone: "9866034567",
    address: "Rajiv Nagar, Kadapa",
    city: "Kadapa",
    state: "Andhra Pradesh",
    pincode: "516002",
    location: { type: "Point", coordinates: [78.8267, 14.4650] },
    categories: ["Mobiles", "Laptops"],
    rating: 4.0,
    isOpen: true,
  },
  {
    name: "Lakshmi Home Appliances",
    owner: "Padmavathi",
    phone: "9876045678",
    address: "Beside Collectorate, Kadapa",
    city: "Kadapa",
    state: "Andhra Pradesh",
    pincode: "516001",
    location: { type: "Point", coordinates: [78.8221, 14.4695] },
    categories: ["Home Appliances", "TVs"],
    rating: 4.3,
    isOpen: true,
  },
  {
    name: "Hi-Tech Electronics",
    owner: "Venkat Rao",
    phone: "9912056789",
    address: "Mydukur Road, Kadapa",
    city: "Kadapa",
    state: "Andhra Pradesh",
    pincode: "516003",
    location: { type: "Point", coordinates: [78.8310, 14.4630] },
    categories: ["Laptops", "Cameras", "TVs"],
    rating: 4.1,
    isOpen: true,
  },
  {
    name: "Tirumala Mobile Hub",
    owner: "Krishnamurthy",
    phone: "9823067890",
    address: "Prakasam Road, Kadapa",
    city: "Kadapa",
    state: "Andhra Pradesh",
    pincode: "516001",
    location: { type: "Point", coordinates: [78.8255, 14.4680] },
    categories: ["Mobiles", "Cameras"],
    rating: 3.9,
    isOpen: false,
  },
  {
    name: "Andhra Digital Store",
    owner: "Sekhar",
    phone: "9800078901",
    address: "Proddatur Highway, Kadapa",
    city: "Kadapa",
    state: "Andhra Pradesh",
    pincode: "516004",
    location: { type: "Point", coordinates: [78.8180, 14.4720] },
    categories: ["TVs", "Home Appliances", "Laptops"],
    rating: 4.4,
    isOpen: true,
  },
  {
    name: "Smart Zone Electronics",
    owner: "Ramesh Babu",
    phone: "9988089012",
    address: "Gandhinagar Main Road, Kadapa",
    city: "Kadapa",
    state: "Andhra Pradesh",
    pincode: "516001",
    location: { type: "Point", coordinates: [78.8290, 14.4660] },
    categories: ["Mobiles", "Laptops", "Cameras", "TVs", "Home Appliances"],
    rating: 4.6,
    isOpen: true,
  },
];

// ─────────────────────────────────────────────
//  SEED FUNCTION
// ─────────────────────────────────────────────

async function seedDatabase() {
  try {
    console.log("🔌 Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Connected to MongoDB!\n");

    // Clear existing data
    console.log("🧹 Clearing existing data...");
    await Product.deleteMany({});
    await Store.deleteMany({});
    console.log("✅ Old data cleared!\n");

    // Insert products
    console.log("📦 Inserting products...");
    const insertedProducts = await Product.insertMany(productsData);
    console.log(`✅ ${insertedProducts.length} products inserted!\n`);

    // Group products by category for store assignment
    const productsByCategory = {};
    insertedProducts.forEach((p) => {
      if (!productsByCategory[p.category]) productsByCategory[p.category] = [];
      productsByCategory[p.category].push(p._id);
    });

    // Insert stores and assign relevant products
    console.log("🏪 Inserting stores...");
    for (const store of storesData) {
      let storeProductIds = [];
      store.categories.forEach((cat) => {
        if (productsByCategory[cat]) {
          storeProductIds = storeProductIds.concat(productsByCategory[cat]);
        }
      });
      store.products = storeProductIds;
      await Store.create(store);
      console.log(`  ✅ Store added: ${store.name}`);
    }

    console.log(`\n🎉 Seeding complete!`);
    console.log(`   Products : ${insertedProducts.length}`);
    console.log(`   Stores   : ${storesData.length}`);
    console.log(`   Location : Kadapa, Andhra Pradesh`);
  } catch (err) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    await mongoose.disconnect();
    console.log("\n🔌 Disconnected from MongoDB.");
  }
}

seedDatabase();