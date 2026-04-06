import { useEffect, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import {
  getStoreBookings, respondBooking, completeBooking,
  getOwnerProducts, updateOwnerProduct, updateStock,
  getOwnerStore, addOwnerProduct, getOwnerReviews,
} from "../services/api";
import "./OwnerDashboard.css";

const STATUS_COLORS = {
  pending:   "badge-amber",
  confirmed: "badge-accent",
  accepted:  "badge-green",
  declined:  "badge-red",
  cancelled: "badge-red",
  completed: "badge-cyan",
};
const CATEGORY_ICONS = {
  Mobile: "📱", Laptop: "💻", TV: "📺",
  Refrigerator: "🧊", "smart watch": "⌚", "Washing Machine": "🫧",
};

const OWNER_CATEGORY_MAP = {
  "mobile":          "Mobile",
  "laptop":          "Laptop",
  "tv":              "TV",
  "refrigerator":    "Refrigerator",
  "smartwatch":      "smart watch",
  "washing+machine": "Washing Machine",
  "washing machine": "Washing Machine",
};

function OwnerDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  // ── Read URL params FIRST, before any useState that depends on them ──
  const [searchParams] = useSearchParams();
  const urlTab      = searchParams.get("tab");
  const urlCategory = searchParams.get("category"); // e.g. "laptop", "mobile", null

  // ── ALL useState hooks together ──
  const [activeTab, setActiveTab]         = useState(urlTab || "bookings");
  const [bookings, setBookings]           = useState([]);
  const [products, setProducts]           = useState([]);
  const [store, setStore]                 = useState(null);
  const [loading, setLoading]             = useState(true);
  const [respondingId, setRespondingId]   = useState(null);
  const [declineNote, setDeclineNote]     = useState("");
  const [showDeclineModal, setShowDeclineModal] = useState(null);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [addForm, setAddForm]             = useState({
    name: "", brand: "", category: "Mobile",
    price: "", mrp: "", description: "", imageUrl: "", quantity: 1,
  });
  const [editProduct, setEditProduct]     = useState(null);
  const [editForm, setEditForm]           = useState({});
  const [reviews,      setReviews]        = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // ── Derived: filtered products by URL category ──
  const filteredProducts = urlCategory
    ? products.filter(p => p.category === OWNER_CATEGORY_MAP[urlCategory.toLowerCase()])
    : products;

  // ── ALL useEffect hooks together, after all useState ──

  // Sync activeTab when URL changes (e.g. navbar click)
  useEffect(() => {
    if (urlTab) setActiveTab(urlTab);
  }, [urlTab]);

  // Fetch reviews when reviews tab is opened
  useEffect(() => {
    if (activeTab !== "reviews") return;
    setReviewsLoading(true);
    getOwnerReviews()
      .then(data => setReviews(Array.isArray(data) ? data : []))
      .catch(() => setReviews([]))
      .finally(() => setReviewsLoading(false));
  }, [activeTab]);

  // Load data on mount / user change
  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role && user.role !== "store_owner") { navigate("/dashboard"); return; }
    if (!user.role || user.role !== "store_owner") return;

    Promise.all([getStoreBookings(), getOwnerProducts(), getOwnerStore()])
      .then(([b, p, s]) => {
        setBookings(Array.isArray(b) ? b : []);
        setProducts(Array.isArray(p) ? p : []);
        setStore(s);
      })
      .catch(() => toast("Failed to load data", "error"))
      .finally(() => setLoading(false));
  }, [user, navigate, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──

  const handleRespond = async (bookingId, status, note = "") => {
    
    try {
      setRespondingId(bookingId);
      const updated = await respondBooking(bookingId, status, note);
      setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, ...updated } : b));
      toast(
        status === "accepted" ? "✅ Booking accepted!" : "❌ Booking declined",
        status === "accepted" ? "success" : "info"
      );
      setShowDeclineModal(null);
      setDeclineNote("");
    } catch {
      toast("Failed to respond", "error");
    } finally {
      setRespondingId(null);
    }
  };

  const handleAddProduct = async () => {
    try {
      const p = await addOwnerProduct(addForm);
      if (p._id) {
        setProducts(prev => [
          ...prev,
          { ...p, quantity: Number(addForm.quantity), inStock: Number(addForm.quantity) > 0 },
        ]);
        toast("✅ Product added!", "success");
        sessionStorage.removeItem("fmp_search_state"); // clear customer search cache so stock reflects
        setShowAddModal(false);
        setAddForm({ name: "", brand: "", category: "Mobile", price: "", mrp: "", description: "", imageUrl: "", quantity: 1 });
      } else {
        toast(p.message || "Failed to add product", "error");
      }
    } catch {
      toast("Failed to add product", "error");
    }
  };

  const handleEditProduct = (product) => {
    setEditProduct(product);
    setEditForm({
      name:        product.name        || "",
      price:       product.price       || "",
      mrp:         product.mrp         || "",
      description: product.description || "",
      imageUrl:    product.imageUrl    || "",
      quantity:    product.quantity    || 0,
    });
  };

  const handleSaveProduct = async () => {
    try {
      await updateOwnerProduct(editProduct._id, {
        name:        editForm.name,
        price:       editForm.price,
        mrp:         editForm.mrp,
        description: editForm.description,
        imageUrl:    editForm.imageUrl,
      });
      await updateStock(editProduct._id, editForm.quantity);
      setProducts(prev => prev.map(p =>
        p._id === editProduct._id
          ? { ...p, ...editForm, inStock: Number(editForm.quantity) > 0 }
          : p
      ));
      toast("✅ Product updated!", "success");
      sessionStorage.removeItem("fmp_search_state"); // clear customer search cache so stock reflects
      setEditProduct(null);
    } catch {
      toast("Failed to update product", "error");
    }
  };

  const handleComplete = async (bookingId) => {
    try {
      setRespondingId(bookingId);
      const updated = await completeBooking(bookingId);
      setBookings(prev => prev.map(b => b._id === bookingId ? { ...b, ...updated } : b));
      toast("🎉 Booking marked as completed! Stock updated.", "success");
    } catch {
      toast("Failed to mark as completed", "error");
    } finally {
      setRespondingId(null);
    }
  };

  // ── Derived stats ──
  const pendingCount   = bookings.filter(b => b.status === "pending").length;
  const acceptedCount  = bookings.filter(b => b.status === "accepted").length;
  const totalRevenue   = bookings
    .filter(b => b.status === "accepted" || b.status === "completed")
    .reduce((s, b) => s + (b.productPrice || 0), 0);

  const bookingGroups = [
    {
      key: "pending",
      label: "⏳ New Requests",
      color: "var(--amber)",
      bg: "#fffbeb",
      border: "#fde68a",
      items: bookings.filter(b => b.status === "pending"),
    },
    {
      key: "accepted",
      label: "✅ Confirmed — Waiting for Pickup",
      color: "var(--green)",
      bg: "#f0fdf4",
      border: "#86efac",
      items: bookings.filter(b => b.status === "accepted"),
    },
    {
      key: "completed",
      label: "🎉 Completed",
      color: "#0891b2",
      bg: "#ecfeff",
      border: "#67e8f9",
      items: bookings.filter(b => b.status === "completed"),
    },
    {
      key: "declined",
      label: "❌ Rejected by You",
      color: "var(--red)",
      bg: "#fff1f2",
      border: "#fca5a5",
      items: bookings.filter(b => b.status === "declined"),
    },
    {
      key: "cancelled",
      label: "🚫 Cancelled by Customer",
      color: "#6b7280",
      bg: "#f9fafb",
      border: "#d1d5db",
      items: bookings.filter(b => b.status === "cancelled"),
    },
  ];

  if (!user) return null;
  if (user.role && user.role !== "store_owner") return null;

  // ── Category label for display ──
  const categoryLabel = urlCategory
    ? OWNER_CATEGORY_MAP[urlCategory.toLowerCase()] || urlCategory
    : null;

  return (
    <div className="owner-dashboard page-wrapper">

      {/* ── HEADER ── */}
      <div className="owner-header">
        <div className="owner-header-left">
          <div className="owner-avatar">🏬</div>
          <div>
            <h1 className="owner-title">Store Dashboard</h1>
            <p className="owner-store-name">{store?.name || "Your Store"}</p>
            {store?.address && <p className="owner-store-addr">📍 {store.address}</p>}
          </div>
        </div>
        <div className="owner-header-actions">
          <Link to="/" className="btn btn-secondary btn-sm">← Home</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate("/"); }}>
            Logout
          </button>
        </div>
      </div>

      {/* ── STATS ── */}
      <div className="owner-stats">
        <div className="ostat-card" style={{ "--c": "var(--amber)" }}>
          <span className="ostat-icon">⏳</span>
          <span className="ostat-val">{pendingCount}</span>
          <span className="ostat-label">New Requests</span>
        </div>
        <div className="ostat-card" style={{ "--c": "var(--green)" }}>
          <span className="ostat-icon">✅</span>
          <span className="ostat-val">{acceptedCount}</span>
          <span className="ostat-label">Waiting Pickup</span>
        </div>
        <div className="ostat-card" style={{ "--c": "var(--accent)" }}>
          <span className="ostat-icon">📦</span>
          <span className="ostat-val">{products.length}</span>
          <span className="ostat-label">Products</span>
        </div>
        <div className="ostat-card" style={{ "--c": "#8b5cf6" }}>
          <span className="ostat-icon">💰</span>
          <span className="ostat-val">₹{totalRevenue.toLocaleString("en-IN")}</span>
          <span className="ostat-label">Total Value</span>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="owner-tabs">
        <button
          className={`owner-tab ${activeTab === "bookings" ? "active" : ""}`}
          onClick={() => setActiveTab("bookings")}
        >
          📋 Booking Requests
          {pendingCount > 0 && <span className="tab-badge">{pendingCount}</span>}
        </button>
        <button
          className={`owner-tab ${activeTab === "products" ? "active" : ""}`}
          onClick={() => setActiveTab("products")}
        >
          📦 Manage Products
        </button>
        <button
          className={`owner-tab ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
          📊 Analytics
        </button>
        <button
          className={`owner-tab ${activeTab === "reviews" ? "active" : ""}`}
          onClick={() => setActiveTab("reviews")}
        >
          ⭐ Reviews
        </button>
      </div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <>
          {/* BOOKINGS TAB */}
          {activeTab === "bookings" && (
            <div className="owner-bookings-section">
              {bookings.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">📭</div>
                  <h3>No booking requests yet</h3>
                  <p>Customer booking requests will appear here</p>
                </div>
              ) : (
                <div className="booking-sections">
                  {bookingGroups.map(group => (
                    <div key={group.key} className="booking-group">
                      <div
                        className="booking-group-header"
                        style={{ background: group.bg, borderColor: group.border }}
                      >
                        <span className="booking-group-label" style={{ color: group.color }}>
                          {group.label}
                        </span>
                        <span
                          className="booking-group-count"
                          style={{ background: group.color }}
                        >
                          {group.items.length}
                        </span>
                      </div>

                      {group.items.length === 0 ? (
                        <p className="booking-group-empty">
                          No {group.label.split(" ").slice(1).join(" ").toLowerCase()} bookings
                        </p>
                      ) : (
                        <div className="owner-booking-list">
                          {group.items.map(booking => (
                            <BookingCard
                              key={booking._id}
                              booking={booking}
                              onAccept={() => handleRespond(booking._id, "accepted")}
                              onDecline={() => setShowDeclineModal(booking._id)}
                              onComplete={() => handleComplete(booking._id)}
                              loading={respondingId === booking._id}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ANALYTICS TAB */}
          {activeTab === "analytics" && (
            <AnalyticsTab bookings={bookings} products={products} />
          )}

          {/* REVIEWS TAB */}
          {activeTab === "reviews" && (
            <div className="owner-reviews-section">
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontWeight: 800, fontSize: 18 }}>⭐ Customer Reviews</h2>
                <p style={{ color: "var(--text3)", fontSize: 13 }}>
                  Reviews left by customers on your products
                </p>
              </div>

              {reviewsLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
                  <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
                </div>
              ) : reviews.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">⭐</div>
                  <h3>No reviews yet</h3>
                  <p>Customer reviews on your products will appear here</p>
                </div>
              ) : (
                <div className="owner-reviews-list">
                  {reviews.map((review, i) => (
                    <div key={i} className="owner-review-card card">
                      <div className="orc-left">
                        {review.productImage ? (
                          <img src={review.productImage} alt={review.productName} className="orc-img" />
                        ) : (
                          <div className="orc-img-placeholder">📦</div>
                        )}
                      </div>
                      <div className="orc-body">
                        <div className="orc-product-name">{review.productName}</div>
                        <div className="orc-meta">
                          <span className="orc-brand">{review.productBrand}</span>
                          <span className="orc-category" style={{ color: "var(--text3)", fontSize: 12 }}>
                            {review.category}
                          </span>
                        </div>
                        <div className="orc-reviewer">
                          <span className="orc-user">👤 {review.userName}</span>
                          <span className="orc-stars">
                            {"★".repeat(review.score)}{"☆".repeat(5 - review.score)}
                          </span>
                          <span className={`badge ${
                            review.score >= 4 ? "badge-green" :
                            review.score === 3 ? "badge-amber" : "badge-red"
                          }`} style={{ fontSize: 11 }}>
                            {review.score}/5
                          </span>
                        </div>
                        {review.comment && (
                          <p className="orc-comment">"{review.comment}"</p>
                        )}
                        <div className="orc-date" style={{ color: "var(--text3)", fontSize: 12, marginTop: 6 }}>
                          {new Date(review.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric"
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PRODUCTS TAB */}
          {activeTab === "products" && (
            <div className="owner-products-section">
              <div className="owner-products-header">
                <p style={{ color: "var(--text3)", fontSize: 14 }}>
                  {categoryLabel
                    ? <>Showing <strong>{filteredProducts.length}</strong> {categoryLabel} products</>
                    : <><strong>{products.length}</strong> total products in your store</>
                  }
                </p>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAddModal(true)}
                >
                  ➕ Add New Product
                </button>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="empty-state">
                  <div className="icon">{CATEGORY_ICONS[categoryLabel] || "📦"}</div>
                  <h3>No {categoryLabel || ""} products found</h3>
                  <p>Add a new product or switch category from the top navigation</p>
                </div>
              ) : (
                <div className="owner-products-grid">
                  {filteredProducts.map(product => (
                    <OwnerProductCard
                      key={product._id}
                      product={product}
                      onEdit={() => handleEditProduct(product)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── ADD PRODUCT MODAL ── */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal edit-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 4, fontWeight: 800 }}>➕ Add New Product</h2>
            <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>
              Add a product to your store inventory
            </p>
            <div className="edit-form">
              <div className="edit-field">
                <label>Product Name *</label>
                <input
                  className="input"
                  placeholder="e.g. Samsung Galaxy A14"
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="edit-row">
                <div className="edit-field">
                  <label>Brand</label>
                  <input
                    className="input"
                    placeholder="e.g. Samsung"
                    value={addForm.brand}
                    onChange={e => setAddForm({ ...addForm, brand: e.target.value })}
                  />
                </div>
                <div className="edit-field">
                  <label>Category *</label>
                  <select
                    className="input"
                    value={addForm.category}
                    onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                  >
                    <option value="Mobile">Mobile</option>
                    <option value="Laptop">Laptop</option>
                    <option value="TV">TV</option>
                    <option value="Refrigerator">Refrigerator</option>
                    <option value="smart watch">Smart Watch</option>
                    <option value="Washing Machine">Washing Machine</option>
                  </select>
                </div>
              </div>
              <div className="edit-row">
                <div className="edit-field">
                  <label>Price (₹)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 15999"
                    value={addForm.price}
                    onChange={e => setAddForm({ ...addForm, price: e.target.value })}
                  />
                </div>
                <div className="edit-field">
                  <label>MRP (₹)</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="e.g. 18999"
                    value={addForm.mrp}
                    onChange={e => setAddForm({ ...addForm, mrp: e.target.value })}
                  />
                </div>
              </div>
              <div className="edit-field">
                <label>Stock Quantity</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={addForm.quantity}
                  onChange={e => setAddForm({ ...addForm, quantity: e.target.value })}
                />
              </div>
              <div className="edit-field">
                <label>Image URL</label>
                <input
                  className="input"
                  value={addForm.imageUrl}
                  onChange={e => setAddForm({ ...addForm, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="edit-field">
                <label>Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={addForm.description}
                  onChange={e => setAddForm({ ...addForm, description: e.target.value })}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button className="btn btn-primary flex-1" onClick={handleAddProduct}>
                ➕ Add Product
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── DECLINE MODAL ── */}
      {showDeclineModal && (
        <div className="modal-overlay" onClick={() => setShowDeclineModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 8, fontWeight: 800 }}>Decline Booking</h2>
            <p style={{ color: "var(--text3)", fontSize: 14, marginBottom: 20 }}>
              Optionally provide a reason for the customer.
            </p>
            <textarea
              className="input"
              rows={3}
              placeholder="Reason (optional)..."
              value={declineNote}
              onChange={e => setDeclineNote(e.target.value)}
              style={{ marginBottom: 16, resize: "vertical" }}
            />
            <div className="flex gap-3">
              <button
                className="btn btn-danger flex-1"
                onClick={() => handleRespond(showDeclineModal, "declined", declineNote)}
                disabled={respondingId === showDeclineModal}
              >
                {respondingId === showDeclineModal ? <span className="spinner" /> : "❌ Decline"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowDeclineModal(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT PRODUCT MODAL ── */}
      {editProduct && (
        <div className="modal-overlay" onClick={() => setEditProduct(null)}>
          <div className="modal edit-modal" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: 4, fontWeight: 800 }}>Edit Product</h2>
            <p style={{ color: "var(--text3)", fontSize: 13, marginBottom: 20 }}>
              {editProduct.name}
            </p>
            <div className="edit-form">
              <div className="edit-field">
                <label>Product Name</label>
                <input
                  className="input"
                  value={editForm.name}
                  onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="edit-row">
                <div className="edit-field">
                  <label>Price (₹)</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.price}
                    onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                  />
                </div>
                <div className="edit-field">
                  <label>MRP (₹)</label>
                  <input
                    className="input"
                    type="number"
                    value={editForm.mrp}
                    onChange={e => setEditForm({ ...editForm, mrp: e.target.value })}
                  />
                </div>
              </div>
              <div className="edit-field">
                <label>Stock Quantity</label>
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={editForm.quantity}
                  onChange={e => setEditForm({ ...editForm, quantity: e.target.value })}
                  style={Number(editForm.quantity) === 0 ? {
                    borderColor: "var(--red)", background: "var(--red-light)",
                    color: "var(--red)", fontWeight: 700,
                  } : {}}
                />
                {Number(editForm.quantity) === 0 && (
                  <span style={{ fontSize: 12, color: "var(--red)", fontWeight: 600, marginTop: 2 }}>
                    ⚠️ Out of stock — customers cannot book this product
                  </span>
                )}
              </div>
              <div className="edit-field">
                <label>Image URL</label>
                <input
                  className="input"
                  value={editForm.imageUrl}
                  onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="edit-field">
                <label>Description</label>
                <textarea
                  className="input"
                  rows={3}
                  value={editForm.description}
                  onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                  style={{ resize: "vertical" }}
                />
              </div>
            </div>
            <div className="flex gap-3" style={{ marginTop: 20 }}>
              <button className="btn btn-primary flex-1" onClick={handleSaveProduct}>
                ✅ Save Changes
              </button>
              <button className="btn btn-secondary" onClick={() => setEditProduct(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── BOOKING CARD ──
function BookingCard({ booking, onAccept, onDecline, onComplete, loading }) {
  const [expanded, setExpanded] = useState(false);
  const isPending   = booking.status === "pending";
  const isAccepted  = booking.status === "accepted";
  const isCompleted = booking.status === "completed";
  const isDeclined  = booking.status === "declined";
  const isCancelled = booking.status === "cancelled";
  const p = booking.product;

  const statusLabel = {
    pending:   "⏳ Waiting for your approval",
    accepted:  "✅ Confirmed — Awaiting pickup",
    completed: "🎉 Picked up & completed",
    declined:  "❌ Rejected by you",
    cancelled: "🚫 Cancelled by customer",
  }[booking.status] || booking.status;

  return (
    <div className={`owner-booking-card card ${isPending ? "pending-card" : ""}`}>
      <div className="obc-main" onClick={() => setExpanded(!expanded)}>
        <div className="obc-product">
          <div className="obc-icon">{CATEGORY_ICONS[p?.category] || "📦"}</div>
          <div className="obc-product-info">
            <h3 className="obc-name">{p?.name || booking.productName}</h3>
            <p className="obc-price">
              {booking.productPrice
                ? `₹${booking.productPrice.toLocaleString("en-IN")}`
                : "Price on request"}
            </p>
          </div>
        </div>

        <div className="obc-customer">
          <div className="obc-customer-name">👤 {booking.customer?.name || "Customer"}</div>
          {booking.customer?.phone && (
            <a
              href={`tel:${booking.customer.phone}`}
              className="obc-phone"
              onClick={e => e.stopPropagation()}
            >
              📞 {booking.customer.phone}
            </a>
          )}
          {booking.customer?.email && (
            <p className="obc-email">✉️ {booking.customer.email}</p>
          )}
        </div>

        <div className="obc-right">
          <span
            className={`badge ${STATUS_COLORS[booking.status]}`}
            style={{ fontSize: 12, padding: "4px 10px", whiteSpace: "nowrap" }}
          >
            {statusLabel}
          </span>
          <span className="obc-date">{new Date(booking.createdAt).toLocaleDateString()}</span>
          <span className="obc-expand">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div className="obc-expanded">
          {booking.pickupDate && (
            <p className="obc-detail">
              📅 Pickup date: {new Date(booking.pickupDate).toLocaleDateString()}
            </p>
          )}
          {booking.notes && (
            <p className="obc-detail">📝 Customer note: {booking.notes}</p>
          )}
          {booking.ownerNote && (
            <p className="obc-detail" style={{ color: "var(--red)" }}>
              🏬 Your response: {booking.ownerNote}
            </p>
          )}
          {isAccepted && booking.holdExpiry && (
            <p className="obc-detail" style={{ color: "var(--amber)" }}>
              ⏱️ Hold until: {new Date(booking.holdExpiry).toLocaleString()}
            </p>
          )}

          {isPending && (
            <div className="obc-actions">
              <button
                className="btn btn-green flex-1"
                onClick={e => { e.stopPropagation(); onAccept(); }}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : "✅ Accept"}
              </button>
              <button
                className="btn btn-danger flex-1"
                onClick={e => { e.stopPropagation(); onDecline(); }}
                disabled={loading}
              >
                ❌ Decline
              </button>
            </div>
          )}

          {isAccepted && (
            <div className="obc-actions">
              <div className="obc-waiting-banner">
                ⏳ Waiting for customer to come pick up the product
              </div>
              <button
                className="btn btn-primary flex-1"
                onClick={e => { e.stopPropagation(); onComplete(); }}
                disabled={loading}
                title="Only mark this when the customer has physically collected the product"
              >
                {loading ? <span className="spinner" /> : "🎉 Mark as Picked Up & Completed"}
              </button>
            </div>
          )}

          {isCompleted && (
            <div className="obc-completed-banner">
              🎉 Customer picked up the product. Booking complete!
            </div>
          )}

          {isDeclined && (
            <div className="obc-declined-banner">
              ❌ You declined this booking.
            </div>
          )}

          {isCancelled && (
            <div className="obc-cancelled-banner">
              🚫 This booking was cancelled by the customer.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── OWNER PRODUCT CARD ──
function OwnerProductCard({ product, onEdit }) {
  const isLowStock = product.quantity > 0 && product.quantity <= 3;
  return (
    <div className={`owner-product-card card ${isLowStock ? "low-stock-card" : ""} ${product.quantity === 0 ? "out-stock-card" : ""}`}>
      <div className="opc-img">
        {product.imageUrl
          ? <img src={product.imageUrl} alt={product.name} />
          : <span>{CATEGORY_ICONS[product.category] || "📦"}</span>
        }
      </div>
      <div className="opc-info">
        <p className="opc-brand">{product.brand}</p>
        <h3 className="opc-name">{product.name}</h3>
        <div className="opc-meta">
          <span className="opc-price">
            {product.price ? `₹${product.price.toLocaleString("en-IN")}` : "No price"}
          </span>
          <span className={`badge ${
            product.quantity === 0 ? "badge-red" : isLowStock ? "badge-amber" : "badge-green"
          }`}>
            {product.quantity === 0
              ? "✗ Out of Stock"
              : isLowStock
                ? `⚠️ Low: ${product.quantity}`
                : `✓ ${product.quantity} units`}
          </span>
        </div>
      </div>
      <button className="btn btn-secondary btn-sm opc-edit" onClick={onEdit}>
        ✏️ Edit
      </button>
    </div>
  );
}

// ── ANALYTICS TAB ──
function AnalyticsTab({ bookings, products }) {
  const statusCounts = bookings.reduce((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});

  const productCounts = bookings.reduce((acc, b) => {
    const name = b.product?.name || b.productName;
    if (name) acc[name] = (acc[name] || 0) + 1;
    return acc;
  }, {});
  const topProducts = Object.entries(productCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const revenue = bookings
    .filter(b => b.status === "accepted" || b.status === "completed")
    .reduce((s, b) => s + (b.productPrice || 0), 0);

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const label = d.toLocaleDateString("en-IN", { weekday: "short" });
    const count = bookings.filter(b => {
      const bd = new Date(b.createdAt);
      return bd.toDateString() === d.toDateString();
    }).length;
    return { label, count };
  });

  const maxCount = Math.max(...last7.map(d => d.count), 1);
  const lowStock = products.filter(p => p.quantity >= 0 && p.quantity <= 3);

  return (
    <div className="analytics-section">
      <div className="analytics-row">
        <div className="analytics-card card">
          <h3 className="analytics-title">💰 Total Revenue</h3>
          <div className="analytics-big">₹{revenue.toLocaleString("en-IN")}</div>
          <p className="analytics-sub">From accepted & completed bookings</p>
        </div>
        <div className="analytics-card card">
          <h3 className="analytics-title">📋 Booking Summary</h3>
          <div className="analytics-status-list">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="analytics-status-row">
                <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
                <div className="analytics-bar-wrap">
                  <div
                    className="analytics-bar"
                    style={{ width: `${(count / bookings.length) * 100}%` }}
                  />
                </div>
                <span className="analytics-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="analytics-card card" style={{ marginBottom: 20 }}>
        <h3 className="analytics-title">📅 Bookings — Last 7 Days</h3>
        <div className="day-chart">
          {last7.map(d => (
            <div key={d.label} className="day-col">
              <div className="day-bar-wrap">
                <div
                  className="day-bar"
                  style={{ height: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
              <div className="day-count">{d.count}</div>
              <div className="day-label">{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="analytics-row">
        <div className="analytics-card card">
          <h3 className="analytics-title">🏆 Most Booked Products</h3>
          {topProducts.length === 0 ? (
            <p style={{ color: "var(--text3)", fontSize: 13 }}>No bookings yet</p>
          ) : (
            <div className="top-products-list">
              {topProducts.map(([name, count], i) => (
                <div key={name} className="top-product-row">
                  <span className="tp-rank">#{i + 1}</span>
                  <span className="tp-name">{name}</span>
                  <span className="tp-count">{count} bookings</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="analytics-card card">
          <h3 className="analytics-title">⚠️ Low Stock Alert</h3>
          {lowStock.length === 0 ? (
            <p style={{ color: "var(--green)", fontSize: 13, fontWeight: 600 }}>
              ✓ All products are well stocked!
            </p>
          ) : (
            <div className="low-stock-list">
              {lowStock.map(p => (
                <div key={p._id} className="low-stock-row">
                  <span className="ls-name">{p.name}</span>
                  <span className={`badge ${p.quantity === 0 ? "badge-red" : "badge-amber"}`}>
                    {p.quantity === 0 ? "Out of Stock" : `${p.quantity} left`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OwnerDashboard;