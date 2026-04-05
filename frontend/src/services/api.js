// Auto-detect backend URL
// In development: http://localhost:5000
// In production: same origin
const BASE = process.env.NODE_ENV === "production"
  ? "/api"
  : "https://findmyproduct-backend.onrender.com/api";

const getHeaders = () => {
  const token = localStorage.getItem("fmp_token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// AUTH
export const registerUser = (data) =>
  fetch(`${BASE}/auth/register`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then((r) => r.json());

export const loginUser = (data) =>
  fetch(`${BASE}/auth/login`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then((r) => r.json());

export const getMe = () =>
  fetch(`${BASE}/auth/me`, { headers: getHeaders() }).then((r) => r.json());

export const saveProduct = (productId) =>
  fetch(`${BASE}/auth/save-product/${productId}`, { method: "POST", headers: getHeaders() }).then((r) => r.json());

export const getSavedProducts = () =>
  fetch(`${BASE}/auth/saved`, { headers: getHeaders() }).then((r) => r.json());

// PRODUCTS
export const searchProducts = (q, lat, lng, distance = 60000, category = "") => {
  const params = new URLSearchParams();
  if (q && q.trim()) params.set("q", q.trim());
  params.set("lat", lat);
  params.set("lng", lng);
  params.set("distance", distance);
  if (category && category !== "all") params.set("category", category);
  return fetch(`${BASE}/products/search?${params.toString()}`, { headers: getHeaders() }).then((r) => r.json());
};

export const getProductById = (id, storeId) => {
  const url = storeId ? `${BASE}/products/${id}?storeId=${storeId}` : `${BASE}/products/${id}`;
  return fetch(url, { headers: getHeaders() }).then((r) => r.json());
};

export const getAllProducts = (category = "") =>
  fetch(`${BASE}/products${category ? `?category=${category}` : ""}`, { headers: getHeaders() }).then((r) => r.json());

export const addReview = (productId, data) =>
  fetch(`${BASE}/products/${productId}/review`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then((r) => r.json());

// LOCATION
export const getLatLngFromPincode = (pin) =>
  fetch(`${BASE}/location/pincode/${pin}`, { headers: getHeaders() }).then((r) => {
    if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.message)));
    return r.json();
  });

// BOOKINGS
export const createBooking = (data) =>
  fetch(`${BASE}/bookings`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then((r) => r.json());

export const getMyBookings = () =>
  fetch(`${BASE}/bookings/my`, { headers: getHeaders() }).then((r) => r.json());

export const cancelBooking = (id) =>
  fetch(`${BASE}/bookings/${id}/cancel`, { method: "PATCH", headers: getHeaders() }).then((r) => r.json());

// NOTIFICATIONS
export const getNotifications = () =>
  fetch(`${BASE}/notifications`, { headers: getHeaders() }).then((r) => r.json());

export const markAllRead = () =>
  fetch(`${BASE}/notifications/read-all`, { method: "PATCH", headers: getHeaders() }).then((r) => r.json());


// NEARBY
export const getNearbyProducts = (lat, lng) => {
  const params = new URLSearchParams({ lat, lng, distance: 10000 });
  return fetch(`${BASE}/products/search?${params.toString()}`, { headers: getHeaders() }).then((r) => r.json());
};

// STORES
export const getAllStores = () =>
  fetch(`${BASE}/stores`, { headers: getHeaders() }).then((r) => r.json());

export const getStoreById = (id) =>
  fetch(`${BASE}/stores/${id}`, { headers: getHeaders() }).then((r) => r.json());

// OWNER
export const registerOwner = (data) =>
  fetch(`${BASE}/auth/register-owner`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then(r => r.json());

export const getStoreBookings = () =>
  fetch(`${BASE}/bookings/store`, { headers: getHeaders() }).then(r => r.json());

export const respondBooking = (id, status, ownerNote = "") =>
  fetch(`${BASE}/bookings/${id}/respond`, { method: "PATCH", headers: getHeaders(), body: JSON.stringify({ status, ownerNote }) }).then(r => r.json());

export const getOwnerProducts = () =>
  fetch(`${BASE}/owner/products`, { headers: getHeaders() }).then(r => r.json());

export const updateOwnerProduct = (id, data) =>
  fetch(`${BASE}/owner/products/${id}`, { method: "PATCH", headers: getHeaders(), body: JSON.stringify(data) }).then(r => r.json());

export const updateStock = (productId, quantity) =>
  fetch(`${BASE}/owner/stock/${productId}`, { method: "PATCH", headers: getHeaders(), body: JSON.stringify({ quantity }) }).then(r => r.json());

export const getOwnerStore = () =>
  fetch(`${BASE}/owner/store`, { headers: getHeaders() }).then(r => r.json());

export const addOwnerProduct = (data) =>
  fetch(`${BASE}/owner/products`, { method: "POST", headers: getHeaders(), body: JSON.stringify(data) }).then(r => r.json());

// SUGGESTIONS
export const getSearchSuggestions = (q) =>
  fetch(`${BASE}/products/suggestions?q=${encodeURIComponent(q)}`, { headers: getHeaders() }).then(r => r.json());

// PROFILE UPDATE
export const updateProfile = (data) =>
  fetch(`${BASE}/auth/profile`, { method: "PATCH", headers: getHeaders(), body: JSON.stringify(data) }).then(r => r.json());

export const completeBooking = (id) =>
  fetch(`${BASE}/bookings/${id}/complete`, { method: "PATCH", headers: getHeaders() }).then(r => r.json());
// ─── ADD THESE to your existing services/api.js ───────────────────────────────

// Notify me when product is back in stock (toggles subscription)
export const notifyMe = (productId) =>
  fetch(`${BASE}/products/${productId}/notify`, { method: "POST", headers: getHeaders() }).then(r => r.json());

// Get all reviews for the owner's products (owner only)
export const getOwnerReviews = () =>
  fetch(`${BASE}/products/owner/reviews`, { headers: getHeaders() }).then(r => r.json());