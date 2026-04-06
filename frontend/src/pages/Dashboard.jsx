import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getMyBookings, getNotifications, markAllRead, getSavedProducts, cancelBooking, saveProduct } from "../services/api";
import { useToast } from "../components/Toast";
import "./Dashboard.css";

const STATUS_COLORS = {
  pending:   "badge-amber",
  confirmed: "badge-amber",
  accepted:  "badge-green",
  declined:  "badge-red",
  cancelled: "badge-red",
  completed: "badge-cyan",
};
const STATUS_ICONS = {
  pending:   "⏳",
  confirmed: "⏳",
  accepted:  "✅",
  declined:  "❌",
  cancelled: "🚫",
  completed: "🎉",
};
const STATUS_LABELS = {
  pending:   "⏳ Waiting for store approval",
  confirmed: "📋 Booking received",
  accepted:  "✅ Accepted by store",
  declined:  "❌ Declined by store",
  cancelled: "🚫 Cancelled",
  completed: "🎉 Completed",
};

const CATEGORY_ICONS = {
  mobile: "📱", Mobile: "📱",
  laptop: "💻", Laptop: "💻",
  tv: "📺", TV: "📺",
  refrigerator: "🧊", Refrigerator: "🧊",
  smartwatch: "⌚", "smart watch": "⌚",
  "washing machine": "🫧", "Washing Machine": "🫧",
};

function StatCard({ icon, label, value, color }) {
  return (
    <div className="stat-card card" style={{ "--sc": color }}>
      <div className="sc-icon">{icon}</div>
      <div className="sc-value">{value}</div>
      <div className="sc-label">{label}</div>
    </div>
  );
}

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [savedProducts, setSavedProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    Promise.all([getMyBookings(), getNotifications(), getSavedProducts()])
      .then(([b, n, s]) => {
        setBookings(Array.isArray(b) ? b : []);
        setNotifications(Array.isArray(n) ? n : []);
        setSavedProducts(Array.isArray(s) ? s : []);
      })
      .catch(() => toast("Failed to load dashboard data", "error"))
      .finally(() => setLoading(false));
  }, [user, navigate, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const unreadCount = notifications.filter((n) => !n.read).length;
  const activeBookings = bookings.filter((b) => b.status === "confirmed");

  const handleMarkRead = () => {
    markAllRead().then(() => {
      setNotifications((n) => n.map((x) => ({ ...x, read: true })));
      toast("All notifications marked as read", "success");
    });
  };

  const handleCancelBooking = async (bookingId) => {
    try {
      await cancelBooking(bookingId);
      setBookings((prev) =>
        prev.map((b) => b._id === bookingId ? { ...b, status: "cancelled" } : b)
      );
      toast("Booking cancelled", "info");
    } catch {
      toast("Failed to cancel booking", "error");
    }
  };

  const handleUnsave = async (productId) => {
    try {
      await saveProduct(productId);
      setSavedProducts((prev) => prev.filter((p) => p._id.toString() !== productId.toString()));
      toast("Removed from saved", "info");
    } catch {
      toast("Failed to remove", "error");
    }
  };

  if (!user) return null;

  return (
    <div className="dashboard page-wrapper">
      {/* Header */}
      <div className="dash-header">
        <div>
          <h1 className="section-heading" style={{ marginBottom: 4 }}>
            Hey, <span>{user.name?.split(" ")[0]}</span> 👋
          </h1>
          <p style={{ color: "var(--text3)", fontSize: 14 }}>{user.email}</p>
        </div>
        <div className="dash-header-actions">
          <Link to="/search" className="btn btn-primary">🔍 Search Products</Link>
          <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate("/"); }}>
            Logout
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="dash-stats">
        <StatCard icon="📋" label="Total Bookings"  value={bookings.length}        color="var(--accent)" />
        <StatCard icon="✅" label="Active Holds"    value={activeBookings.length}  color="var(--green)"  />
        <StatCard icon="🔔" label="Unread Alerts"   value={unreadCount}            color="var(--amber)"  />
        <StatCard icon="❤️" label="Saved Products"  value={savedProducts.length}   color="#ef4444"       />
      </div>

      {/* Tabs */}
      <div className="dash-tabs" style={{ display: "flex", justifyContent: "space-between", width: "100%" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "overview", label: "📊 Overview" },
            { id: "bookings", label: "📋 My Bookings", badge: activeBookings.length },
            { id: "saved",    label: "❤️ Saved",       badge: savedProducts.length },
          ].map((t) => (
            <button
              key={t.id}
              className={`pd-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
              {t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[
            { id: "notifications", label: "🔔 Notifications", badge: unreadCount },
          ].map((t) => (
            <button
              key={t.id}
              className={`pd-tab ${activeTab === t.id ? "active" : ""}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
              {t.badge > 0 && <span className="tab-badge">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="dash-loading">
          <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <>
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="dash-overview">
              <div className="dash-section">
                <h2 className="dash-section-title">Recent Bookings</h2>
                {bookings.length === 0 ? (
                  <div className="empty-state" style={{ padding: "30px 0" }}>
                    <div className="icon">📭</div>
                    <h3>No bookings yet</h3>
                    <p>Search and book a product to hold it at a store</p>
                    <Link to="/search" className="btn btn-primary" style={{ marginTop: 16 }}>
                      Find Products
                    </Link>
                  </div>
                ) : (
                  <div className="booking-list">
                    {bookings.slice(0, 3).map((b) => (
                      <BookingItem key={b._id} booking={b} onCancel={handleCancelBooking} />
                    ))}
                  </div>
                )}
                {bookings.length > 3 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab("bookings")} style={{ marginTop: 12 }}>
                    View all {bookings.length} bookings →
                  </button>
                )}
              </div>

              <div className="dash-section">
                <h2 className="dash-section-title">Saved Products</h2>
                {savedProducts.length === 0 ? (
                  <div className="empty-state" style={{ padding: "30px 0" }}>
                    <div className="icon">🤍</div>
                    <h3>No saved products</h3>
                    <p>Tap the heart on any product to save it</p>
                  </div>
                ) : (
                  <div className="saved-list">
                    {savedProducts.slice(0, 4).map((p) => (
                      <SavedItem key={p._id} product={p} onUnsave={handleUnsave} />
                    ))}
                  </div>
                )}
                {savedProducts.length > 4 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => setActiveTab("saved")} style={{ marginTop: 12 }}>
                    View all {savedProducts.length} saved →
                  </button>
                )}
              </div>
            </div>
          )}

          {/* BOOKINGS TAB */}
          {activeTab === "bookings" && (
            <div className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">My Bookings</h2>
                <span style={{ fontSize: 13, color: "var(--text3)" }}>{bookings.length} total</span>
              </div>
              {bookings.length === 0 ? (
                <div className="empty-state" style={{ padding: "40px 0" }}>
                  <div className="icon">📭</div>
                  <h3>No bookings yet</h3>
                  <Link to="/search" className="btn btn-primary" style={{ marginTop: 16 }}>Search Products</Link>
                </div>
              ) : (
                <div className="booking-list">
                  {bookings.map((b) => (
                    <BookingItem key={b._id} booking={b} onCancel={handleCancelBooking} expanded />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* SAVED TAB */}
          {activeTab === "saved" && (
            <div className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">Saved Products</h2>
                <span style={{ fontSize: 13, color: "var(--text3)" }}>{savedProducts.length} items</span>
              </div>
              {savedProducts.length === 0 ? (
                <div className="empty-state" style={{ padding: "40px 0" }}>
                  <div className="icon">🤍</div>
                  <h3>No saved products</h3>
                  <p>Tap the heart icon on any product card to save it here</p>
                  <Link to="/search" className="btn btn-primary" style={{ marginTop: 16 }}>Browse Products</Link>
                </div>
              ) : (
                <div className="saved-grid">
                  {savedProducts.map((p) => (
                    <SavedItem key={p._id} product={p} onUnsave={handleUnsave} full />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === "notifications" && (
            <div className="dash-section">
              <div className="dash-section-header">
                <h2 className="dash-section-title">Notifications</h2>
                {unreadCount > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={handleMarkRead}>
                    Mark all read
                  </button>
                )}
              </div>
              {notifications.length === 0 ? (
                <p style={{ color: "var(--text3)", fontSize: 14 }}>No notifications yet</p>
              ) : (
                <div className="notif-list">
                  {notifications.map((n) => <NotifItem key={n._id} notif={n} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── BOOKING ITEM ───
function BookingItem({ booking, onCancel, expanded }) {
  const navigate = useNavigate();
  const p = booking.product;
  const productId = p?._id || booking.productId;
  const name = p?.name || booking.productName || "Product";
  const price = p?.price || booking.productPrice;
  const store = booking.storeName;
  const category = p?.category || "";
  const icon = CATEGORY_ICONS[category] || "📦";
  const isActive = booking.status === "pending" || booking.status === "confirmed" || booking.status === "accepted";

  const handleNavigate = () => {
    if (productId) navigate(`/product/${productId}`);
  };

  return (
    <div className="booking-item card" onClick={handleNavigate} style={{ cursor: productId ? "pointer" : "default" }}>
      <div className="bi-left">
        <div className="bi-icon">{icon}</div>
        <div className="bi-details">
          <h3 className="bi-name" title={name}>{name}</h3>
          {store && <p className="bi-store">🏬 {store}</p>}
          {expanded && booking.pickupDate && (
            <p className="bi-date">📅 Pickup: {new Date(booking.pickupDate).toLocaleDateString()}</p>
          )}
          {expanded && booking.holdExpiry && booking.status === "accepted" && (
            <p className="bi-expiry">⏱ Hold expires: {new Date(booking.holdExpiry).toLocaleString()}</p>
          )}
          {expanded && booking.storeContact && (
            <p className="bi-date">🏬 Store: {booking.storeContact}</p>
          )}
          {expanded && booking.ownerPhone && (
            <a href={"tel:" + booking.ownerPhone} className="bi-owner-phone">
              📞 Owner: {booking.ownerPhone}
            </a>
          )}
          {expanded && booking.ownerNote && (
            <p className="bi-owner-note">💬 Store note: {booking.ownerNote}</p>
          )}
          {/* Timeline */}
          {expanded && (
            <div className="bi-timeline">
              <div className={`tl-step done`}>
                <div className="tl-dot" />
                <span>Booking Requested</span>
                <span className="tl-date">{new Date(booking.createdAt).toLocaleDateString()}</span>
              </div>
              <div className={`tl-step ${["accepted","declined","completed","cancelled"].includes(booking.status) ? "done" : "pending"}`}>
                <div className="tl-dot" />
                <span>
                  {booking.status === "accepted" ? "✅ Accepted by Store" :
                   booking.status === "declined" ? "❌ Declined by Store" :
                   booking.status === "cancelled" ? "🚫 Cancelled" :
                   booking.status === "completed" ? "🎉 Completed" :
                   "⏳ Waiting for Approval"}
                </span>
                {booking.respondedAt && <span className="tl-date">{new Date(booking.respondedAt).toLocaleDateString()}</span>}
              </div>
              {booking.status === "accepted" && (
                <div className="tl-step pending">
                  <div className="tl-dot" />
                  <span>Visit Store to Pick Up</span>
                  {booking.holdExpiry && <span className="tl-date">Before {new Date(booking.holdExpiry).toLocaleDateString()}</span>}
                </div>
              )}
            </div>
          )}
          {/* Directions button */}
          {expanded && booking.status === "accepted" && booking.storeLat && booking.storeLng && (
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${booking.storeLat},${booking.storeLng}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary btn-sm bi-directions"
              onClick={e => e.stopPropagation()}
            >
              🗺️ Get Directions to Store
            </a>
          )}
        </div>
      </div>
      <div className="bi-right">
        {price && <span className="bi-price">₹{price.toLocaleString("en-IN")}</span>}
        <span className={`badge ${STATUS_COLORS[booking.status]}`}>
          {STATUS_ICONS[booking.status]} {booking.status}
        </span>
        {isActive && expanded && (
          <button
            className="btn btn-danger btn-sm"
            onClick={(e) => { e.stopPropagation(); onCancel(booking._id); }}
          >
            Cancel
          </button>
        )}
        {productId && (
          <span className="bi-view">View →</span>
        )}
      </div>
    </div>
  );
}

// ─── SAVED ITEM ───
function SavedItem({ product, onUnsave, full }) {
  const navigate = useNavigate();
  const icon = CATEGORY_ICONS[product.category] || "📦";

  return (
    <div className={`saved-item card ${full ? "saved-item-full" : ""}`}
      onClick={() => navigate(`/product/${product._id}`)}
      style={{ cursor: "pointer" }}
    >
      <div className="si-icon-wrap">{icon}</div>
      <div className="si-details">
        <h3 className="si-name" title={product.name}>{product.name}</h3>
        <p className="si-brand">{product.brand}</p>
        {product.price && (
          <p className="si-price">₹{product.price.toLocaleString("en-IN")}</p>
        )}
      </div>
      <button
        className="si-unsave"
        title="Remove from saved"
        onClick={(e) => { e.stopPropagation(); onUnsave(product._id); }}
      >
        ❤️
      </button>
    </div>
  );
}

// ─── NOTIFICATION ITEM ───
function NotifItem({ notif }) {
  const icons = {
    restock: "📦",
    booking_confirmed: "✅",
    booking_cancelled: "❌",
    price_drop: "💰",
    general: "🔔",
  };
  return (
    <div className={`notif-row ${!notif.read ? "unread" : ""}`}>
      <span className="ni-icon">{icons[notif.type] || "🔔"}</span>
      <div className="ni-body">
        <p className="ni-msg">{notif.message}</p>
        <span className="ni-time">{new Date(notif.createdAt).toLocaleString()}</span>
      </div>
    </div>
  );
}

export default Dashboard;