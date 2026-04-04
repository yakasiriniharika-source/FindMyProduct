import { useParams, useLocation, useNavigate, Link } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-routing-machine";
import "leaflet-routing-machine/dist/leaflet-routing-machine.css";
import { getProductById, createBooking, notifyMe, addReview } from "../services/api";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import "./ProductDetails.css";

// Fix leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
});
const userIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

function FitBounds({ userLocation, storeLat, storeLng }) {
  const map = useMap();
  useEffect(() => {
    if (!map || !storeLat || !storeLng) return;
    const bounds = L.latLngBounds([[storeLat, storeLng]]);
    if (userLocation) bounds.extend([userLocation.lat, userLocation.lng]);
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [60, 60] });
  }, [map, userLocation, storeLat, storeLng]);
  return null;
}

function Routing({ storeLat, storeLng, userLocation, setRouteInfo }) {
  const map = useMap();
  const routingRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!map || !userLocation || !storeLat || !storeLng) return;

    let ctrl;
    try {
      ctrl = L.Routing.control({
        router: L.Routing.osrmv1({
          serviceUrl: "https://router.project-osrm.org/route/v1",
          profile: "driving",
        }),
        waypoints: [
          L.latLng(userLocation.lat, userLocation.lng),
          L.latLng(storeLat, storeLng),
        ],
        lineOptions: { styles: [{ color: "#2563eb", weight: 5, opacity: 0.8 }] },
        addWaypoints:       false,
        draggableWaypoints: false,
        routeWhileDragging: false,
        show:               false,
        createMarker:       () => null,
      });

      // Monkey-patch _clearLines so it never crashes if map is gone
      const origClearLines = ctrl._clearLines.bind(ctrl);
      ctrl._clearLines = function () {
        try { origClearLines(); } catch {}
      };

      ctrl.on("routesfound", (e) => {
        if (!mountedRef.current) return;
        const r = e.routes[0];
        setRouteInfo({
          distance: (r.summary.totalDistance / 1000).toFixed(2),
          time:     Math.round(r.summary.totalTime / 60),
        });
      });

      ctrl.on("routingerror", () => {});
      ctrl.addTo(map);
      routingRef.current = ctrl;
    } catch {}

    return () => {
      // 1. Mark unmounted so routesfound is ignored
      mountedRef.current = false;

      // 2. Abort in-flight XHR before anything else
      try {
        const xhr = ctrl?._router?._xhr;
        if (xhr) { xhr.abort(); }
      } catch {}

      // 3. Detach line layers safely
      try { if (ctrl?._line) { ctrl._line._map = null; ctrl._line = null; } } catch {}
      try { if (ctrl) ctrl._alternatives = []; } catch {}

      // 4. Remove control only if map is still alive
      try {
        if (ctrl && map && map._container && !map._removed) {
          map.removeControl(ctrl);
        }
      } catch {}

      // 5. Sever the ctrl→map link last
      try { if (ctrl) ctrl._map = null; } catch {}

      routingRef.current = null;
    };
  }, [map, storeLat, storeLng, userLocation]);

  return null;
}

const CATEGORY_ICONS = { mobile: "📱", laptop: "💻", tv: "📺", refrigerator: "🧊", smartwatch: "⌚", other: "📦" };

function StarInput({ value, onChange }) {
  return (
    <div className="star-input">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button" className={`star-btn ${s <= value ? "active" : ""}`} onClick={() => onChange(s)}>★</button>
      ))}
    </div>
  );
}

function ProductDetails() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [userLocation, setUserLocation] = useState(location.state?.userLocation || null);
  const storeId = location.state?.storeId || null;

  useEffect(() => {
    if (userLocation) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  const { addItem } = useRecentlyViewed();
  const [product,          setProduct]          = useState(null);
  const [routeInfo,        setRouteInfo]        = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [booking,          setBooking]          = useState(false);
  const [notifying,        setNotifying]        = useState(false);
  const [isNotified,       setIsNotified]       = useState(false);
  const [activeTab,        setActiveTab]        = useState("info");
  const [reviewScore,      setReviewScore]      = useState(5);
  const [reviewComment,    setReviewComment]    = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [alreadyReviewed,  setAlreadyReviewed]  = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [pickupDate,       setPickupDate]       = useState("");
  // ── NEW: quantity the customer wants to book ──────────────────────────────
  const [bookQty,          setBookQty]          = useState(1);
  // ── Track if a pending booking exists for this product ───────────────────
  const [pendingBooking,   setPendingBooking]   = useState(false);

  useEffect(() => {
    getProductById(id, storeId)
      .then((data) => {
        setProduct(data);
        setLoading(false);
        addItem(data);

        // Reset quantity to 1 whenever product loads/changes
        setBookQty(1);

        // Check if the logged-in user already reviewed this product
        if (user && data.ratings?.length) {
          const already = data.ratings.some(r => r.user?.toString() === user._id?.toString());
          setAlreadyReviewed(already);
        }
      })
      .catch(() => setLoading(false));
  }, [id]);

  // Fetch notify subscription status when user is logged in
  useEffect(() => {
    if (!user || !id) return;
    fetch(`/api/products/${id}/notify-status`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fmp_token")}` },
    })
      .then(r => r.json())
      .then(data => setIsNotified(data.subscribed || false))
      .catch(() => {});
  }, [user, id]);

  // Check if user already has a pending/accepted booking for this product
  useEffect(() => {
    if (!user || !id) return;
    fetch(`/api/bookings/my`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("fmp_token")}` },
    })
      .then(r => r.json())
      .then(data => {
        if (!Array.isArray(data)) return;
        const hasPending = data.some(
          b => b.productId?.toString() === id?.toString() &&
               ["pending", "confirmed", "accepted"].includes(b.status)
        );
        setPendingBooking(hasPending);
      })
      .catch(() => {});
  }, [user, id]);

  const handleBook = async () => {
    if (!user) return navigate("/login");
    if (!product.inStock) return toast("Product is out of stock", "error");

    // Guard: don't allow more than available stock
    if (bookQty > product.quantity) {
      return toast(`Only ${product.quantity} unit(s) available.`, "error");
    }

    try {
      setBooking(true);
      await createBooking({
        productId:    product._id,
        storeId:      product.storeId,
        pickupDate,
        notes:        "",
        productName:  product.name,
        productPrice: product.price,
        storeName:    product.storeName,
        quantity:     bookQty,           // ← send quantity to backend
      });
      toast(
        bookQty > 1
          ? `📦 Booking request for ${bookQty}× "${product.name}" sent! Waiting for approval.`
          : `📦 Booking request sent! Waiting for store owner approval.`,
        "success"
      );
      setShowBookingModal(false);
      setPendingBooking(true); // ← mark as pending so button updates
    } catch {
      toast("Booking failed. Try again.", "error");
    } finally {
      setBooking(false);
    }
  };

  // handleNotify toggles and reflects subscribed state
  const handleNotify = async () => {
    if (!user) return navigate("/login");
    try {
      setNotifying(true);
      const res = await notifyMe(product._id);
      setIsNotified(res.subscribed);
      toast(res.message, "success");
    } catch {
      toast("Failed to set notification.", "error");
    } finally {
      setNotifying(false);
    }
  };

  const handleReview = async (e) => {
    e.preventDefault();
    if (!user) return navigate("/login");
    try {
      setSubmittingReview(true);
      await addReview(product._id, { score: reviewScore, comment: reviewComment });
      toast("Review submitted!", "success");
      setReviewComment("");
      setAlreadyReviewed(true);
      const updated = await getProductById(id);
      setProduct(updated);
    } catch (err) {
      toast(err?.response?.data?.message || "Failed to submit review.", "error");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return (
    <div className="pd-loading">
      <div className="spinner" style={{ width: 40, height: 40 }} />
      <p>Loading product...</p>
    </div>
  );
  if (!product) return (
    <div className="pd-loading">
      <p>Product not found.</p>
      <button className="btn btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  );

  const storeLat = product.location?.coordinates?.[1];
  const storeLng = product.location?.coordinates?.[0];
  const discount = (product.mrp && product.price && product.mrp > product.price)
    ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  const avgRating = product.ratings?.length
    ? (product.ratings.reduce((s, r) => s + r.score, 0) / product.ratings.length).toFixed(1)
    : null;

  return (
    <div className="pd-page">
      {/* MAP */}
      <div className="pd-map">
        {storeLat && storeLng ? (
          <MapContainer key={product._id} center={[storeLat, storeLng]} zoom={14} style={{ height: "100%", width: "100%" }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
            <FitBounds userLocation={userLocation} storeLat={storeLat} storeLng={storeLng} />
            <Marker position={[storeLat, storeLng]}><Popup>🏬 {product.storeName || "Store"}</Popup></Marker>
            {userLocation && (
              <>
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}><Popup>📍 You</Popup></Marker>
                <Routing storeLat={storeLat} storeLng={storeLng} userLocation={userLocation} setRouteInfo={setRouteInfo} />
              </>
            )}
          </MapContainer>
        ) : (
          <div className="pd-no-map">📍 Store location unavailable</div>
        )}
      </div>

      {/* PANEL */}
      <div className="pd-panel">
        <div className="pd-back-bar">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>← Back</button>
        </div>

        {/* Product Header */}
        <div className="pd-header-section">
          <div className="pd-cat-icon">{CATEGORY_ICONS[product.category]}</div>
          <div className="pd-header-text">
            <div className="pd-brand">{product.brand}</div>
            <h1 className="pd-name">{product.name}</h1>
            {avgRating && (
              <div className="pd-rating">
                <span className="pd-rating-stars">{"★".repeat(Math.round(avgRating))}{"☆".repeat(5 - Math.round(avgRating))}</span>
                <span className="pd-rating-count">{avgRating} ({product.ratings.length} reviews)</span>
              </div>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="pd-price-section">
          <div className="pd-price-left">
            {product.price
              ? <div className="pd-price">₹{product.price.toLocaleString("en-IN")}</div>
              : <div className="pd-price-na">Price on request</div>}
            <div className="pd-price-row-sub">
              {product.mrp && product.mrp > product.price && (
                <span className="pd-mrp">₹{product.mrp.toLocaleString("en-IN")}</span>
              )}
              {discount > 0 && <span className="badge badge-green">{discount}% off</span>}
            </div>
          </div>
          <span className={`badge pd-stock-badge ${product.inStock ? "badge-green" : "badge-red"}`} style={{ fontSize: 13, padding: "6px 14px" }}>
            {product.inStock ? `✓ In Stock (${product.quantity || ""})` : "✗ Out of Stock"}
          </span>
        </div>

        {/* Store */}
        {product.storeName && (
          <div className="pd-store-section">
            <span className="pd-store-icon">🏬</span>
            <div>
              <div className="pd-store-name">{product.storeName}</div>
              {product.storeAddress && <div className="pd-store-addr">{product.storeAddress}</div>}
            </div>
          </div>
        )}

        {/* View more from store */}
        {product.storeId && (
          <Link to={"/store/" + product.storeId} className="view-store-btn">
            <span>🏬</span>
            <div>
              <div className="vsb-title">View all products from</div>
              <div className="vsb-name">{product.storeName}</div>
            </div>
            <span className="vsb-arrow">→</span>
          </Link>
        )}

        {/* Route info */}
        {routeInfo && (
          <div className="pd-route-section">
            <div className="pd-route-stat"><span>🚗</span>{routeInfo.distance} km</div>
            <div className="pd-route-stat"><span>⏱️</span>{routeInfo.time} min away</div>
            <button
              className="btn btn-primary btn-sm pd-route-nav"
              onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${storeLat},${storeLng}`, "_blank")}
            >
              🗺️ Navigate
            </button>
          </div>
        )}

        {/* Actions */}
        <div className="pd-actions-section">
          {product.inStock ? (
            <>
              {pendingBooking ? (
                <button className="btn btn-full" disabled style={{
                  background: "linear-gradient(135deg, #f59e0b, #d97706)",
                  color: "white",
                  cursor: "not-allowed",
                  opacity: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  fontWeight: 700,
                  fontSize: 14,
                }}>
                  ⏳ Waiting for Approval
                </button>
              ) : (
                <button className="btn btn-primary btn-full" onClick={() => setShowBookingModal(true)} disabled={booking}>
                  {booking ? <span className="spinner" /> : "📦 Request Booking"}
                </button>
              )}
              {/* Notify bell visible for in-stock too (for price drops etc.) */}
              <button
                className={`btn btn-sm ${isNotified ? "btn-ghost" : "btn-secondary"}`}
                onClick={handleNotify}
                disabled={notifying}
                title={isNotified ? "Remove notification" : "Notify me if stock changes"}
              >
                {notifying ? <span className="spinner" /> : isNotified ? "🔔 Notified" : "🔔"}
              </button>
            </>
          ) : (
            // Out of stock: prominent notify section
            <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
              <div style={{
                background: "#fff7ed",
                border: "1px solid #fed7aa",
                borderRadius: "var(--radius-sm)",
                padding: "8px 12px",
                fontSize: 13,
                color: "#c2410c",
                fontWeight: 600,
                textAlign: "center",
              }}>
                ✗ Out of Stock — Get notified when it's back!
              </div>
              <button
                className="btn btn-full"
                onClick={handleNotify}
                disabled={notifying}
                style={isNotified ? {
                  background: "#f0fdf4",
                  color: "#16a34a",
                  border: "1.5px solid #86efac",
                  fontWeight: 700,
                } : {
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  color: "white",
                  fontWeight: 700,
                  border: "none",
                }}
              >
                {notifying
                  ? <span className="spinner" />
                  : isNotified
                    ? "🔔 You'll be notified — tap to cancel"
                    : "🔔 Notify Me When Available"}
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="pd-tabs-section">
          <button className={`pd-tab ${activeTab === "info" ? "active" : ""}`} onClick={() => setActiveTab("info")}>
            📋 Info
          </button>
          <button className={`pd-tab ${activeTab === "specs" ? "active" : ""}`} onClick={() => setActiveTab("specs")}>
            ⚙️ Specs
          </button>
          <button className={`pd-tab ${activeTab === "reviews" ? "active" : ""}`} onClick={() => setActiveTab("reviews")}>
            ⭐ Reviews {product.ratings?.length > 0 && <span className="pd-tab-count">{product.ratings.length}</span>}
          </button>
        </div>

        <div className="pd-tab-content">
          {activeTab === "info" && (
            <div className="pd-info-section">
              {product.description && (
                <div className="pd-desc-box">
                  <p className="pd-desc">{product.description}</p>
                </div>
              )}
              <div className="pd-info-grid">
                <div className="pd-info-item"><span>Brand</span><strong>{product.brand || "—"}</strong></div>
                <div className="pd-info-item"><span>Category</span><strong style={{ textTransform: "capitalize" }}>{product.category}</strong></div>
                <div className="pd-info-item"><span>Price</span><strong>{product.price ? `₹${product.price.toLocaleString("en-IN")}` : "On request"}</strong></div>
                {product.mrp && product.mrp > product.price && (
                  <div className="pd-info-item">
                    <span>MRP</span>
                    <strong style={{ textDecoration: "line-through", color: "var(--text3)" }}>
                      ₹{product.mrp.toLocaleString("en-IN")}
                    </strong>
                  </div>
                )}
                <div className="pd-info-item">
                  <span>Availability</span>
                  <strong>
                    <span className={`badge ${product.inStock ? "badge-green" : "badge-red"}`}>
                      {product.inStock ? `✓ In Stock (${product.quantity})` : "✗ Out of Stock"}
                    </span>
                  </strong>
                </div>
                {product.storeName && <div className="pd-info-item"><span>Store</span><strong>{product.storeName}</strong></div>}
                {product.storeAddress && <div className="pd-info-item"><span>Address</span><strong>{product.storeAddress}</strong></div>}
              </div>
            </div>
          )}

          {activeTab === "specs" && (
            <div className="pd-specs-section">
              {product.specs && Object.keys(product.specs).length > 0 ? (
                <div className="pd-specs-grid">
                  {Object.entries(product.specs).map(([k, v]) => (
                    Array.isArray(v) ? (
                      <div key={k} className="pd-spec-row pd-spec-full">
                        <span className="pd-spec-key">{k}</span>
                        <ul className="pd-spec-list">{v.map((item, i) => <li key={i}>{String(item)}</li>)}</ul>
                      </div>
                    ) : (
                      <div key={k} className="pd-spec-row">
                        <span className="pd-spec-key">{k}</span>
                        <span className="pd-spec-val">{String(v)}</span>
                      </div>
                    )
                  ))}
                </div>
              ) : (
                <div className="pd-no-specs"><span>⚙️</span><p>No specifications available for this product.</p></div>
              )}
            </div>
          )}

          {activeTab === "reviews" && (
            <div className="pd-reviews-section">
              {product.ratings?.length > 0 ? (
                <div className="pd-reviews">
                  {product.ratings.map((r, i) => (
                    <div key={i} className="pd-review-item">
                      <div className="pd-review-header">
                        <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>
                          {r.user?.name?.[0] || "U"}
                        </div>
                        <span className="pd-review-user">{r.user?.name || "User"}</span>
                        <span className="pd-review-stars">{"★".repeat(r.score)}{"☆".repeat(5 - r.score)}</span>
                      </div>
                      {r.comment && <p className="pd-review-comment">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pd-no-reviews">⭐ No reviews yet — be the first to review!</div>
              )}

              {/* Hide form if user already reviewed */}
              {user && !alreadyReviewed && (
                <form onSubmit={handleReview} className="pd-review-form">
                  <p className="pd-review-form-title">✍️ Write a Review</p>
                  <StarInput value={reviewScore} onChange={setReviewScore} />
                  <textarea
                    className="input"
                    placeholder="Your comment (optional)"
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={3}
                    style={{ marginTop: 10, resize: "vertical" }}
                  />
                  <button type="submit" className="btn btn-primary btn-sm" style={{ marginTop: 10 }} disabled={submittingReview}>
                    {submittingReview ? <span className="spinner" /> : "Submit Review"}
                  </button>
                </form>
              )}

              {/* Show message if already reviewed */}
              {user && alreadyReviewed && (
                <div className="pd-already-reviewed" style={{ marginTop: 16, color: "var(--green)", fontSize: 13, fontWeight: 600 }}>
                  ✅ You have already reviewed this product.
                </div>
              )}

              {!user && (
                <p style={{ marginTop: 16, fontSize: 13, color: "var(--text3)" }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => navigate("/login")}>Log in</button> to write a review.
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* BOOKING MODAL */}
      {showBookingModal && (
        <div className="modal-overlay" onClick={() => setShowBookingModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontFamily: "var(--font-display)", marginBottom: 6 }}>Confirm Booking</h2>
            <p style={{ color: "var(--text2)", fontSize: 14, marginBottom: 20 }}>
              Product will be held for <strong>24 hours</strong>. Visit the store before it expires.
            </p>

            {/* Product summary */}
            <div className="pd-info-grid" style={{ marginBottom: 20 }}>
              <div className="pd-info-item"><span>Product</span><strong>{product.name}</strong></div>
              <div className="pd-info-item">
                <span>Price</span>
                <strong>
                  {product.price
                    ? `₹${(product.price * bookQty).toLocaleString("en-IN")}${bookQty > 1 ? ` (${bookQty} × ₹${product.price.toLocaleString("en-IN")})` : ""}`
                    : "On request"}
                </strong>
              </div>
              {product.storeName && <div className="pd-info-item"><span>Store</span><strong>{product.storeName}</strong></div>}
            </div>

            {/* ── QUANTITY PICKER ── */}
            <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 6, fontWeight: 600 }}>
              Quantity
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setBookQty(q => Math.max(1, q - 1))}
                disabled={bookQty <= 1}
                style={{ width: 36, height: 36, padding: 0, fontSize: 18, fontWeight: 700 }}
              >
                −
              </button>
              <span style={{ fontWeight: 700, fontSize: 20, minWidth: 28, textAlign: "center" }}>
                {bookQty}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setBookQty(q => Math.min(product.quantity, q + 1))}
                disabled={bookQty >= product.quantity}
                style={{ width: 36, height: 36, padding: 0, fontSize: 18, fontWeight: 700 }}
              >
                +
              </button>
              <span style={{ fontSize: 13, color: "var(--text3)" }}>
                {product.quantity} unit{product.quantity !== 1 ? "s" : ""} available
              </span>
            </div>

            {/* Pickup date */}
            <label style={{ fontSize: 13, color: "var(--text2)", display: "block", marginBottom: 6 }}>
              Pickup date (optional)
            </label>
            <input
              type="date"
              className="input"
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              style={{ marginBottom: 20 }}
            />

            <div className="flex gap-3">
              <button className="btn btn-primary flex-1" onClick={handleBook} disabled={booking}>
                {booking ? <span className="spinner" /> : `📦 Send Booking Request${bookQty > 1 ? ` (×${bookQty})` : ""}`}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowBookingModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProductDetails;