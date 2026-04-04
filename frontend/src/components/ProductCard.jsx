import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { saveProduct } from "../services/api";
import { useState } from "react";
import "./ProductCard.css";
import { toggleCompare, isInCompareList } from "../utils/compareUtils"; // ✅ use isInCompareList

const CATEGORY_ICONS = {
  mobile: "📱", Mobile: "📱",
  laptop: "💻", Laptop: "💻",
  tv: "📺", TV: "📺",
  refrigerator: "🧊", Refrigerator: "🧊",
  smartwatch: "⌚", "smart watch": "⌚", Smartwatch: "⌚",
  "washing machine": "🫧", "Washing Machine": "🫧",
  other: "📦",
};

function ProductCard({ product, isNearest, userLocation, onSave }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saved, setSaved] = useState(false);
  const [savingState, setSavingState] = useState(false);

  const discount =
    product.mrp && product.price && product.mrp > product.price
      ? Math.round(((product.mrp - product.price) / product.mrp) * 100)
      : 0;

  const avgRating =
    product.ratings?.length
      ? (product.ratings.reduce((s, r) => s + r.score, 0) / product.ratings.length).toFixed(1)
      : null;

  const handleClick = () => {
    navigate(`/product/${product._id}`, {
      state: { userLocation, storeId: product.storeId },
    });
  };

  // ✅ FIXED: was reading from localStorage — now uses sessionStorage via compareUtils
  const [inCompare, setInCompare] = useState(() => isInCompareList(product._id));

  // ✅ FIXED: was writing only IDs to localStorage — now writes full product objects to sessionStorage
  const handleCompare = (e) => {
    e.stopPropagation();
    const nowInList = toggleCompare(product);
    setInCompare(nowInList);
    window.dispatchEvent(new Event("compareUpdate"));
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    if (!user) return navigate("/login");
    setSavingState(true);
    try {
      const res = await saveProduct(product._id);
      setSaved(res.saved);
      onSave?.(product._id, res.saved);
    } catch {}
    setSavingState(false);
  };

  const categoryIcon = CATEGORY_ICONS[product.category] || "📦";

  return (
    <div className="pcard" onClick={handleClick}>
      {/* Image area */}
      <div className="pcard-top">
        <div className="pcard-img-wrap">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="pcard-img" />
          ) : (
            <div className="pcard-img-placeholder">{categoryIcon}</div>
          )}
        </div>

        <button
          className={`save-btn ${saved ? "saved" : ""}`}
          onClick={handleSave}
          disabled={savingState}
          title={saved ? "Unsave" : "Save"}
        >
          {saved ? "❤️" : "🤍"}
        </button>
        {isNearest && <span className="nearest-tag">Nearest</span>}
        {discount > 0 && <span className="discount-tag">{discount}% off</span>}
      </div>

      {/* Info */}
      <div className="pcard-info">
        <div className="pcard-meta">
          <span className="pcard-brand">{product.brand || "—"}</span>
          <span className="pcard-category">{categoryIcon} {product.category}</span>
        </div>

        <h3 className="pcard-name">{product.name}</h3>

        {product.storeName && (
          <p className="pcard-store">🏬 {product.storeName}</p>
        )}

        <div className="pcard-bottom">
          <div className="pcard-price-wrap">
            {product.price ? (
              <>
                <span className="pcard-price">₹{product.price.toLocaleString("en-IN")}</span>
                {product.mrp && product.mrp > product.price && (
                  <span className="pcard-mrp">₹{product.mrp.toLocaleString("en-IN")}</span>
                )}
              </>
            ) : (
              <span className="pcard-price-na">Price on request</span>
            )}
          </div>

          <div className="pcard-right-meta">
            {product.distance != null && (
              <span className="pcard-dist">📍 {product.distance} km</span>
            )}
            {avgRating && (
              <span className="pcard-rating">⭐ {avgRating}</span>
            )}
          </div>
        </div>

        <div className="pcard-footer">
          <span className={`badge ${product.inStock ? "badge-green" : "badge-red"}`}>
            {product.inStock
              ? `✓ In Stock${product.quantity ? ` (${product.quantity})` : ""}`
              : "✗ Out of Stock"}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button
              className={`compare-btn ${inCompare ? "active" : ""}`}
              onClick={handleCompare}
              title={inCompare ? "Remove from compare" : "Add to compare"}
            >
              {inCompare ? "✓ Compare" : "+ Compare"}
            </button>
            <span className="view-arrow">View →</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;