import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { getNearbyProducts, getLatLngFromPincode } from "../services/api";
import ProductCard from "../components/ProductCard";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import { useAuth } from "../context/AuthContext";
import "./Home.css";

const getRecentStores = () => {
  try { return JSON.parse(localStorage.getItem("fmp_recent_stores") || "[]"); } catch { return []; }
};

const CATEGORIES = [
  { id: "mobile", label: "Mobiles", icon: "📱", color: "#6366f1" },
  { id: "laptop", label: "Laptops", icon: "💻", color: "#06b6d4" },
  { id: "tv", label: "Smart TVs", icon: "📺", color: "#10b981" },
  { id: "refrigerator", label: "Refrigerators", icon: "🧊", color: "#f59e0b" },
  { id: "smartwatch", label: "Smartwatches", icon: "⌚", color: "#8b5cf6" },
];

const FEATURES = [
  { icon: "📍", title: "Live Location Search", desc: "Products near you in real-time using GPS" },
  { icon: "🗺️", title: "Store Navigation", desc: "Get directions to the exact store with Leaflet maps" },
  { icon: "📦", title: "Reserve & Hold", desc: "Book a product and hold it for 24 hours" },
  { icon: "🔔", title: "Restock Alerts", desc: "Get notified the moment an item is back in stock" },
];

function Home() {
  const [location, setLocation] = useState(null);
  const [nearbyProducts, setNearbyProducts] = useState([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [heroLocation, setHeroLocation] = useState(null);
  const [heroPincode, setHeroPincode] = useState("");
  const [heroError, setHeroError] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect store owners to their dashboard
  useEffect(() => {
    if (user?.role === "store_owner") navigate("/owner-dashboard");
  }, [user, navigate]);
  const { items: recentlyViewed, clearItems } = useRecentlyViewed();
  const recentStores = getRecentStores();

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    if (!location) return;
    setLoadingNearby(true);
    getNearbyProducts(location.lat, location.lng)
      .then((data) => setNearbyProducts(Array.isArray(data) ? data.slice(0, 6) : []))
      .catch(() => {})
      .finally(() => setLoadingNearby(false));
  }, [location]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (heroPincode.trim()) {
      try {
        const loc = await getLatLngFromPincode(heroPincode.trim());
        navigate(`/search?${params.toString()}&lat=${loc.lat}&lng=${loc.lng}`);
        return;
      } catch {
        setHeroError("Invalid pincode");
        return;
      }
    }
    navigate(`/search?${params.toString()}`);
  };

  return (
    <div className="home">
      {/* HERO */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-glow hero-glow-1" />
          <div className="hero-glow hero-glow-2" />
          <div className="hero-grid" />
        </div>
        <div className="hero-content">
          <div className="hero-badge">
            <span>⚡</span> Real-time stock near you
          </div>
          <h1 className="hero-title">
            Find Electronics<br />
            <span className="hero-accent">Near You Instantly</span>
          </h1>
          <p className="hero-sub">
            Search mobiles, laptops, TVs and more — see live availability at local stores, get directions, book & hold.
          </p>

          <form className="hero-search" onSubmit={handleSearch}>
            <div className="hero-search-inner">
              <span className="hero-search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search iPhone 15, Samsung TV, MacBook..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="hero-search-input"
              />
              <div className="hero-divider" />
              <input
                type="text"
                placeholder="📮 Pincode (optional)"
                value={heroPincode}
                onChange={(e) => setHeroPincode(e.target.value)}
                className="hero-pincode-input"
                maxLength={6}
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </div>
            {heroError && <p className="hero-error">{heroError}</p>}
          </form>

          {/* Pincode fallback */}
          <div className="hero-pincode">
            <span className="hero-pincode-label">Or search by pincode:</span>
            <form className="hero-pincode-form" onSubmit={handleSearch}>
              <input
                type="text"
                className="hero-pincode-input"
                placeholder="Enter pincode (e.g. 516001)"
                value={heroPincode}
                onChange={e => { setHeroPincode(e.target.value); setSearchQuery(""); }}
                maxLength={6}
              />
              <button type="submit" className="btn btn-secondary btn-sm">
                "Go"
              </button>
            </form>
          </div>

          <div className="hero-stats">
            <div className="stat-item"><span className="stat-num">500+</span><span className="stat-label">Products</span></div>
            <div className="stat-divider" />
            <div className="stat-item"><span className="stat-num">50+</span><span className="stat-label">Stores</span></div>
            <div className="stat-divider" />
            <div className="stat-item"><span className="stat-num">5</span><span className="stat-label">Categories</span></div>
          </div>
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="home-section">
        <div className="home-section-inner">
          <h2 className="section-heading">Browse by <span>Category</span></h2>
          <div className="cat-grid">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                to={`/search?category=${cat.id}`}
                className="cat-card"
                style={{ "--cat-color": cat.color }}
              >
                <span className="cat-icon">{cat.icon}</span>
                <span className="cat-label">{cat.label}</span>
                <span className="cat-arrow">→</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* NEARBY */}
      {user?.role !== "store_owner" && (nearbyProducts.length > 0 || loadingNearby) && (
        <section className="home-section">
          <div className="home-section-inner">
            <div className="section-header-row">
              <h2 className="section-heading">Products <span>Near You</span></h2>
              <Link to="/search" className="btn btn-ghost btn-sm">See all →</Link>
            </div>
            {loadingNearby ? (
              <div className="nearby-loading">
                {[1,2,3].map(i => <div key={i} className="skeleton-card" />)}
              </div>
            ) : (
              <div className="products-grid">
                {nearbyProducts.map((p, i) => (
                  <ProductCard key={p._id} product={p} isNearest={i === 0} userLocation={location} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* RECENTLY VIEWED */}
      {user && user.role !== "store_owner" && recentlyViewed.length > 0 && (
        <section className="home-section">
          <div className="home-section-inner">
            <div className="section-header-row">
              <h2 className="section-heading">Recently <span>Viewed</span></h2>
              <button className="btn btn-ghost btn-sm" onClick={clearItems}>Clear</button>
            </div>
            <div className="recently-viewed-list">
              {recentlyViewed.map(p => (
                <Link key={p._id} to={`/product/${p._id}`} className="rv-item card">
                  <div className="rv-img">
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} />
                      : <span>{p.category === "Mobile" ? "📱" : p.category === "Laptop" ? "💻" : p.category === "TV" ? "📺" : "📦"}</span>
                    }
                  </div>
                  <div className="rv-info">
                    <p className="rv-brand">{p.brand}</p>
                    <p className="rv-name">{p.name}</p>
                    {p.price
                      ? <p className="rv-price">₹{p.price.toLocaleString("en-IN")}</p>
                      : <p className="rv-price" style={{color:"var(--text3)",fontStyle:"italic"}}>Price on request</p>
                    }
                    <span className={`badge ${p.inStock ? "badge-green" : "badge-red"}`} style={{fontSize:10}}>
                      {p.inStock ? "In Stock" : "Out of Stock"}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* RECENTLY VIEWED STORES */}
      {user && user.role !== "store_owner" && recentStores.length > 0 && (
        <section className="home-section" style={{ paddingTop: 0 }}>
          <div className="home-section-inner">
            <h2 className="section-heading">Recently Visited <span>Stores</span></h2>
            <div className="recent-stores-home">
              {recentStores.map(s => (
                <Link key={s._id} to={"/store/" + s._id} className="rvs-card card">
                  <div className="rvs-icon">🏬</div>
                  <div className="rvs-info">
                    <p className="rvs-name">{s.name}</p>
                    {s.address && <p className="rvs-addr">{s.address}</p>}
                    {s.city    && <p className="rvs-city">{s.city}</p>}
                  </div>
                  <span className="rvs-arrow">→</span>
                </Link>
              ))}
              <Link to="/stores" className="rvs-card rvs-all card">
                <div className="rvs-icon">🔍</div>
                <div className="rvs-info">
                  <p className="rvs-name">All Stores</p>
                  <p className="rvs-addr">Browse all locations</p>
                </div>
                <span className="rvs-arrow">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* FEATURES */}
      <section className="home-section features-section">
        <div className="home-section-inner">
          <h2 className="section-heading" style={{ textAlign: "center" }}>
            Why <span>FindMyProduct</span>?
          </h2>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="feature-card card">
                <div className="feature-icon">{f.icon}</div>
                <h3 className="feature-title">{f.title}</h3>
                <p className="feature-desc">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="home-section cta-section">
        <div className="cta-card card">
          <div className="cta-glow" />
          <h2>Start finding products near you</h2>
          <p>Sign up free — no credit card required.</p>
          <div className="flex gap-3 justify-center" style={{ marginTop: 24 }}>
            <Link to="/register" className="btn btn-primary btn-lg">Get Started Free</Link>
            <Link to="/search" className="btn btn-secondary btn-lg">Browse Products</Link>
          </div>
        </div>
      </section>
    </div>
  );
}

export default Home;