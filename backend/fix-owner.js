// fix-all-owners.js
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");

mongoose.connect("mongodb://localhost:27017/findmyproduct").then(async () => {
  const db = mongoose.connection.db;
  // Find users whose password doesn't look like a bcrypt hash
  const owners = await db.collection("users").find({
    password: { $not: /^\$2[ab]\$/ }
  }).toArray();

  console.log(`Found ${owners.length} unhashed passwords`);

  for (const owner of owners) {
    const hashed = await bcrypt.hash(owner.password, 10);
    await db.collection("users").updateOne(
      { _id: owner._id },
      { $set: { password: hashed, role: "store_owner" } }
    );
    console.log(`✅ Fixed: ${owner.email}`);
  }

  mongoose.disconnect();
});