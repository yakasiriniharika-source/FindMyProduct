import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { getStoreById, getAllStores } from "../services/api";
import ProductCard from "../components/ProductCard";
import "./StorePage.css";

const CATEGORY_ICONS = {
  Mobile: "📱", Laptop: "💻", TV: "📺",
  Refrigerator: "🧊", "smart watch": "⌚", "Washing Machine": "🫧",
};

// ── RECENTLY VIEWED STORES (localStorage) ──
const RVS_KEY = "fmp_recent_stores";
const saveRecentStore = (store) => {
  try {
    const prev = JSON.parse(localStorage.getItem(RVS_KEY) || "[]");
    const filtered = prev.filter(s => s._id !== store._id.toString());
    const updated = [{ _id: store._id.toString(), name: store.name, address: store.address, city: store.city }, ...filtered].slice(0, 5);
    localStorage.setItem(RVS_KEY, JSON.stringify(updated));
  } catch {}
};
const getRecentStores = () => {
  try { return JSON.parse(localStorage.getItem(RVS_KEY) || "[]"); } catch { return []; }
};

// ── STORE DETAIL PAGE ──
function StorePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [searchInStore, setSearchInStore] = useState("");

  useEffect(() => {
    setLoading(true);
    setActiveCategory("all");
    setSearchInStore("");
    getStoreById(id)
      .then((data) => {
        setStore(data.store);
        setProducts(data.products || []);
        if (data.store) saveRecentStore(data.store);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const categories = ["all", ...new Set(products.map(p => p.category).filter(Boolean))];

  const filtered = products
    .filter(p => activeCategory === "all" || p.category === activeCategory)
    .filter(p => !searchInStore || p.name?.toLowerCase().includes(searchInStore.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "price_asc")  return (a.price || 0) - (b.price || 0);
      if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
      if (sortBy === "name")       return a.name?.localeCompare(b.name);
      return 0;
    });

  const inStockCount = products.filter(p => p.inStock).length;

  if (loading) return (
    <div className="store-loading">
      <div className="spinner spinner-dark" style={{ width: 36, height: 36 }} />
      <p>Loading store...</p>
    </div>
  );

  if (!store) return (
    <div className="store-loading">
      <p>Store not found</p>
      <button className="btn btn-secondary" onClick={() => navigate(-1)}>Go Back</button>
    </div>
  );

  return (
    <div className="store-detail-page page-wrapper">
      {/* Back */}
      <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
        ← Back
      </button>

      {/* Store Header Card */}
      <div className="store-header-card card">
        <div className="store-header-top">
          <div className="store-avatar-wrap">
            <div className="store-avatar">🏬</div>
          </div>
          <div className="store-header-info">
            <h1 className="store-title">{store.name}</h1>
            <div className="store-meta-row">
              {store.address && <span className="store-meta-item">📍 {store.address}</span>}
              {store.city    && <span className="store-meta-item">🌆 {store.city}</span>}
              {store.contact && <span className="store-meta-item">📞 {store.contact}</span>}
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={() => window.open(
              `https://www.google.com/maps/dir/?api=1&destination=${store.location?.coordinates?.[1]},${store.location?.coordinates?.[0]}`,
              "_blank"
            )}
          >
            🗺️ Get Directions
          </button>
        </div>

        {/* Stats Row */}
        <div className="store-stats-row">
          <div className="store-stat-box">
            <span className="ssb-val">{products.length}</span>
            <span className="ssb-label">Total Products</span>
          </div>
          <div className="store-stat-box">
            <span className="ssb-val" style={{ color: "var(--green)" }}>{inStockCount}</span>
            <span className="ssb-label">In Stock</span>
          </div>
          <div className="store-stat-box">
            <span className="ssb-val" style={{ color: "var(--red)" }}>{products.length - inStockCount}</span>
            <span className="ssb-label">Out of Stock</span>
          </div>
          <div className="store-stat-box">
            <span className="ssb-val">{categories.length - 1}</span>
            <span className="ssb-label">Categories</span>
          </div>
        </div>
      </div>

      {/* Search + Sort + Filter */}
      <div className="store-toolbar card">
        <div className="store-search-wrap">
          <span>🔍</span>
          <input
            className="store-search-input"
            type="text"
            placeholder="Search in this store..."
            value={searchInStore}
            onChange={e => setSearchInStore(e.target.value)}
          />
          {searchInStore && (
            <button className="si-clear" onClick={() => setSearchInStore("")}>✕</button>
          )}
        </div>
        <select className="radius-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="name">Sort: A-Z</option>
          <option value="price_asc">Price: Low → High</option>
          <option value="price_desc">Price: High → Low</option>
        </select>
      </div>

      {/* Category Pills */}
      <div className="category-pills" style={{ marginBottom: 20 }}>
        {categories.map(cat => (
          <button
            key={cat}
            className={`category-pill ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat === "all" ? "🔍 All" : `${CATEGORY_ICONS[cat] || "📦"} ${cat}`}
            <span className="pill-count">
              {cat === "all" ? products.length : products.filter(p => p.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      {/* Results */}
      <p className="results-count" style={{ marginBottom: 16 }}>
        <strong>{filtered.length}</strong> products
        {activeCategory !== "all" && ` in ${activeCategory}`}
        {searchInStore && ` matching "${searchInStore}"`}
      </p>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <h3>No products found</h3>
          <p>Try a different category or search term</p>
        </div>
      ) : (
        <div className="products-grid">
          {filtered.map(product => (
            <ProductCard key={product._id} product={product} isNearest={false} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ALL STORES LIST PAGE ──
export function StoresListPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const recentStores = getRecentStores();

  useEffect(() => {
    getAllStores()
      .then(data => setStores(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="stores-list-page page-wrapper">
      <h1 className="section-heading">Browse <span>Stores</span></h1>
      <p style={{ color: "var(--text3)", fontSize: 14, marginBottom: 32 }}>
        Explore all stores and find products available near you
      </p>

      {/* Recently Visited Stores */}
      {recentStores.length > 0 && (
        <div className="recent-stores-section">
          <h2 className="stores-section-title">🕐 Recently Visited</h2>
          <div className="recent-stores-row">
            {recentStores.map(s => (
              <Link key={s._id} to={`/store/${s._id}`} className="recent-store-chip">
                🏬 {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Stores */}
      <h2 className="stores-section-title">🏬 All Stores</h2>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div className="stores-grid">
          {stores.map(store => (
            <Link key={store._id} to={`/store/${store._id}`} className="store-list-card card">
              <div className="slc-left">
                <div className="slc-icon">🏬</div>
                <div className="slc-info">
                  <h3 className="slc-name">{store.name}</h3>
                  {store.address && <p className="slc-addr">📍 {store.address}</p>}
                  {store.city    && <p className="slc-city">🌆 {store.city}</p>}
                  {store.contact && <p className="slc-contact">📞 {store.contact}</p>}
                </div>
              </div>
              <div className="slc-right">
                <span className="slc-arrow">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default StorePage;