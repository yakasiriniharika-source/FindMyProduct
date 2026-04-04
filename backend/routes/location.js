const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

router.get("/pincode/:pin", async (req, res) => {
  try {
    const pin = req.params.pin?.trim();
    if (!/^[1-9][0-9]{5}$/.test(pin))
      return res.status(400).json({ message: "Invalid pincode format" });

    const postRes = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const postData = await postRes.json();

    if (!postData || postData[0].Status !== "Success" || !postData[0].PostOffice)
      return res.status(404).json({ message: "Pincode not found" });

    const postOffice = postData[0].PostOffice[0];
    const { District: district, State: state } = postOffice;

    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${district},${state},India&format=json&limit=1`,
      { headers: { "User-Agent": "FindMyProductApp/1.0" } }
    );
    const geoData = await geoRes.json();

    if (!geoData || geoData.length === 0)
      return res.status(404).json({ message: "Coordinates not found" });

    res.json({
      lat: parseFloat(geoData[0].lat),
      lng: parseFloat(geoData[0].lon),
      district,
      state,
      area: postOffice.Name,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch location" });
  }
});

module.exports = router;