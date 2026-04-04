import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ProductCard from "../components/ProductCard";
import { searchProducts, getLatLngFromPincode, getSearchSuggestions } from "../services/api";
import { useAuth } from "../context/AuthContext";
import "./SearchPage.css";

const CATEGORIES = [
  { id: "all",             label: "All",              icon: "🔍" },
  { id: "mobile",          label: "Mobiles",          icon: "📱" },
  { id: "laptop",          label: "Laptops",          icon: "💻" },
  { id: "tv",              label: "Smart TVs",        icon: "📺" },
  { id: "refrigerator",    label: "Refrigerators",    icon: "🧊" },
  { id: "smartwatch",      label: "Smartwatches",     icon: "⌚" },
  { id: "washing machine", label: "Washing Machines", icon: "🫧" },
];

const RADIUS_OPTIONS = [
  { label: "5 km",   value: 5000   },
  { label: "10 km",  value: 10000  },
  { label: "25 km",  value: 25000  },
  { label: "60 km",  value: 60000  },
  { label: "200 km", value: 200000 },
];

const cardVariants = {
  hidden:  { opacity: 0, y: 30, scale: 0.96 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.05, duration: 0.3, ease: "easeOut" },
  }),
};

// ── Helper: read/write the full search snapshot ──────────────────────────────
const SEARCH_STATE_KEY = "fmp_search_state";

const saveSearchState = (state) => {
  try { sessionStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({ ...state, savedAt: Date.now() })); } catch {}
};

const loadSearchState = () => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SEARCH_STATE_KEY) || "null");
    if (!raw) return null;
    // Expire cache after 5 minutes so stock changes reflect quickly
    if (raw.savedAt && Date.now() - raw.savedAt > 5 * 60 * 1000) {
      sessionStorage.removeItem(SEARCH_STATE_KEY);
      return null;
    }
    return raw;
  } catch { return null; }
};

function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Redirect store owners away
  useEffect(() => {
    if (user?.role === "store_owner") navigate("/owner-dashboard", { replace: true });
  }, [user, navigate]);

  const urlQuery    = searchParams.get("q")        || "";
  const urlCategory = searchParams.get("category") || "all";

  // ── Restore saved state immediately (before any effect runs) ─────────────
  // Lazy initializer so state is correct on first render.
  const savedState = useRef(loadSearchState());

  // FIX: Restore whenever we have saved results with products — no URL match
  // required. This ensures back-navigation from ProductDetails always restores
  // the previous search results without re-prompting for product/pincode.
  const isRestoringFromBack =
    savedState.current !== null &&
    Array.isArray(savedState.current.products) &&
    savedState.current.products.length > 0;

  const [userLocation, setUserLocation] = useState(
    isRestoringFromBack ? savedState.current.userLocation : null
  );
  const [query,        setQuery]        = useState(
    isRestoringFromBack ? savedState.current.query : urlQuery
  );
  const [pincode,      setPincode]      = useState(
    isRestoringFromBack ? savedState.current.pincode : ""
  );
  const [radius,       setRadius]       = useState(
    isRestoringFromBack ? savedState.current.radius : 60000
  );
  const [products,     setProducts]     = useState(
    isRestoringFromBack ? savedState.current.products : []
  );
  const [hasSearched,  setHasSearched]  = useState(isRestoringFromBack);
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState("");
  const [needsPincode, setNeedsPincode] = useState(false);
  const [sortBy,       setSortBy]       = useState(
    isRestoringFromBack ? (savedState.current.sortBy || "distance") : "distance"
  );
  const [inStockOnly,  setInStockOnly]  = useState(
    isRestoringFromBack ? (savedState.current.inStockOnly || false) : false
  );
  const [maxPrice,     setMaxPrice]     = useState(
    isRestoringFromBack ? (savedState.current.maxPrice || "") : ""
  );

  const [suggestions,     setSuggestions]     = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestRef    = useRef(null);
  const resultsRef    = useRef(null);
  const locationCache = useRef(
    isRestoringFromBack ? savedState.current.userLocation : null
  );

  // Track whether the current mount was a back-navigation restore.
  // When true we skip the auto-search effect so restored results stay visible.
  const didRestoreRef = useRef(isRestoringFromBack);

  // ── Suggestions ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim() || query.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(() => {
      getSearchSuggestions(query.trim())
        .then(data => {
          setSuggestions(Array.isArray(data) ? data : []);
          setShowSuggestions(true);
        })
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Close suggestions on outside click ───────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target))
        setShowSuggestions(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Auto-search when URL changes — but SKIP on back-navigation restore ───
  useEffect(() => {
    // If we just restored from sessionStorage, skip the auto-search this once.
    if (didRestoreRef.current) {
      didRestoreRef.current = false; // allow future URL changes to trigger normally
      return;
    }
    if (!urlQuery && urlCategory !== "all") {
      setQuery("");
    } else {
      setQuery(urlQuery);
    }
    triggerSearch(urlQuery, urlCategory);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery, urlCategory]);

  // ── Core search ──────────────────────────────────────────────────────────
  const doSearch = async (lat, lng, q, cat) => {
    try {
      setLoading(true);
      setError("");
      locationCache.current = { lat, lng };
      const data = await searchProducts(q, lat, lng, radius, cat === "all" ? "" : cat);
      const results = Array.isArray(data) ? data : [];
      setProducts(results);
      setUserLocation({ lat, lng });
      setHasSearched(true);

      // ── Save full state so back-navigation restores everything ──
      saveSearchState({
        products:     results,
        userLocation: { lat, lng },
        query:        q,
        urlQuery:     q,
        urlCategory:  cat,
        pincode,
        radius,
        sortBy,
        inStockOnly,
        maxPrice,
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const triggerSearch = (q = query, cat = urlCategory) => {
    setProducts([]);
    setError("");
    setNeedsPincode(false);

    if (user?.role === "store_owner") return;

    if (locationCache.current) {
      doSearch(locationCache.current.lat, locationCache.current.lng, q, cat);
      return;
    }

    if (!navigator.geolocation) {
      setNeedsPincode(true);
      setError("Geolocation not supported. Enter your pincode.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        if (accuracy <= 1000) {
          doSearch(latitude, longitude, q, cat);
        } else {
          setNeedsPincode(true);
          setError("Low GPS accuracy. Enter pincode for better results.");
        }
      },
      () => {
        setNeedsPincode(true);
        setError("Location denied. Enter your pincode.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  // ── Manual search button ─────────────────────────────────────────────────
  const handleSearch = () => {
    if (!query.trim() && urlCategory === "all") {
      setError("Enter a product name or select a category.");
      return;
    }
    const params = {};
    if (query.trim()) params.q = query.trim();
    if (urlCategory !== "all") params.category = urlCategory;
    setSearchParams(params);
  };

  // ── Pincode fallback ─────────────────────────────────────────────────────
  const handlePincodeSearch = async () => {
    if (!pincode.trim()) { setError("Enter a pincode."); return; }
    try {
      setLoading(true);
      setError("");
      const loc = await getLatLngFromPincode(pincode.trim());
      await doSearch(loc.lat, loc.lng, query, urlCategory);
      setNeedsPincode(false);
    } catch (e) {
      setError(e.message || "Invalid pincode.");
    } finally {
      setLoading(false);
    }
  };

  // ── Category pill click ──────────────────────────────────────────────────
  const handleCategoryChange = (cat) => {
    const params = {};
    if (query.trim()) params.q = query.trim();
    if (cat !== "all") params.category = cat;
    setSearchParams(params);
  };

  const handleKey = (e) => {
    if (e.key === "Enter") needsPincode ? handlePincodeSearch() : handleSearch();
  };

  useEffect(() => {
    if (products.length > 0 && resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [products]);

  // Apply sort and filters
  const displayProducts = [...products]
    .filter(p => !inStockOnly || p.inStock)
    .filter(p => !maxPrice || (p.price && p.price <= Number(maxPrice)))
    .sort((a, b) => {
      if (sortBy === "distance")   return (a.distance || 0) - (b.distance || 0);
      if (sortBy === "price_asc")  return (a.price || 0) - (b.price || 0);
      if (sortBy === "price_desc") return (b.price || 0) - (a.price || 0);
      if (sortBy === "name")       return a.name?.localeCompare(b.name);
      return 0;
    });

  return (
    <div className="search-page page-wrapper">
      <div className="search-header">
        <h1 className="section-heading" style={{ fontSize: 28 }}>
          {urlCategory !== "all" ? (
            <>
              {CATEGORIES.find(c => c.id === urlCategory)?.icon}{" "}
              <span>{CATEGORIES.find(c => c.id === urlCategory)?.label}</span>
              {" "}Near You
            </>
          ) : (
            <>Find Products <span>Near You</span></>
          )}
        </h1>
        <p style={{ color: "var(--text3)", fontSize: 14 }}>
          {urlCategory !== "all"
            ? `Showing ${CATEGORIES.find(c => c.id === urlCategory)?.label?.toLowerCase() || urlCategory} available at nearby stores`
            : "Real-time stock from stores in your area"}
        </p>
      </div>

      {/* Search Bar */}
      <div className="search-box card">
        <div className="search-row">
          <div className="search-input-wrap" ref={suggestRef} style={{ position: "relative" }}>
            <span className="si-icon">🔍</span>
            <input
              className="si-field"
              type="text"
              placeholder={urlCategory !== "all"
                ? `Search in ${CATEGORIES.find(c => c.id === urlCategory)?.label || urlCategory}...`
                : "Search product (e.g. Samsung TV, iPhone 15...)"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKey}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              autoComplete="off"
            />
            {query && (
              <button className="si-clear" onClick={() => {
                setQuery("");
                setSuggestions([]);
                setShowSuggestions(false);
                setSearchParams(urlCategory !== "all" ? { category: urlCategory } : {});
              }}>✕</button>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map(s => (
                  <button
                    key={s._id}
                    className="suggestion-item"
                    onClick={() => {
                      setQuery(s.name);
                      setShowSuggestions(false);
                      const params = { q: s.name };
                      if (urlCategory !== "all") params.category = urlCategory;
                      setSearchParams(params);
                    }}
                  >
                    <span className="sug-icon">🔍</span>
                    <span className="sug-name">{s.name}</span>
                    <span className="sug-brand">{s.brand}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <select
            className="radius-select"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          >
            {RADIUS_OPTIONS.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>

          <button
            className="btn btn-primary"
            onClick={needsPincode ? handlePincodeSearch : handleSearch}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : needsPincode ? "Search by Pincode" : "Search"}
          </button>
        </div>

        {needsPincode && (
          <div className="pincode-row">
            <span className="si-icon">📮</span>
            <input
              className="si-field"
              type="text"
              placeholder="Enter 6-digit pincode"
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              onKeyDown={handleKey}
              maxLength={6}
            />
          </div>
        )}
      </div>

      {/* Category Pills */}
      <div className="category-pills" style={{ marginBottom: 24 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-pill ${urlCategory === cat.id ? "active" : ""}`}
            onClick={() => handleCategoryChange(cat.id)}
          >
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      {hasSearched && products.length > 0 && (
        <div className="filter-bar">
          <div className="filter-left">
            <div className="filter-chip-group">
              <span className="filter-label">Sort</span>
              <div className="filter-chips">
                {[
                  { val: "distance", icon: "📍", label: "Nearest" },
                  { val: "price_asc", icon: "↑", label: "Price↑" },
                  { val: "price_desc", icon: "↓", label: "Price↓" },
                  { val: "name", icon: "A", label: "A-Z" },
                ].map(opt => (
                  <button
                    key={opt.val}
                    className={`fchip ${sortBy === opt.val ? "active" : ""}`}
                    onClick={() => setSortBy(opt.val)}
                  >
                    <span>{opt.icon}</span>{opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              className={`filter-stock-btn ${inStockOnly ? "active" : ""}`}
              onClick={() => setInStockOnly(!inStockOnly)}
            >
              {inStockOnly ? "✓ In Stock Only" : "☐ In Stock Only"}
            </button>
          </div>

          <div className="filter-right">
            <div className="filter-price-wrap">
              <span className="filter-price-icon">₹</span>
              <input
                type="number"
                className="filter-price-input"
                placeholder="Max price"
                value={maxPrice}
                onChange={e => setMaxPrice(e.target.value)}
              />
            </div>

            {(sortBy !== "distance" || inStockOnly || maxPrice) && (
              <button
                className="filter-clear-btn"
                onClick={() => { setSortBy("distance"); setInStockOnly(false); setMaxPrice(""); }}
              >
                ✕ Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="sp-error"><span>⚠️</span> {error}</div>}

      {/* Results */}
      <div ref={resultsRef}>
        {loading && (
          <div className="products-grid">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="skeleton-card" style={{ height: 300 }} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {!loading && hasSearched && (
            <>
              {products.length === 0 && !error && (
                <div className="empty-state">
                  <div className="icon">😔</div>
                  <h3>No products found</h3>
                  <p>Try a wider radius or different search term</p>
                </div>
              )}

              {products.length > 0 && (
                <>
                  <p className="results-count">
                    <strong>{displayProducts.length}</strong> of <strong>{products.length}</strong> product{products.length !== 1 ? "s" : ""} found
                    {userLocation && " near your location"}
                  </p>
                  <div className="products-grid">
                    {displayProducts.map((product, i) => (
                      <motion.div
                        key={`${product._id}-${product.storeId}`}
                        custom={i}
                        variants={cardVariants}
                        initial="hidden"
                        animate="visible"
                        layout
                      >
                        <ProductCard
                          product={product}
                          isNearest={i === 0}
                          userLocation={userLocation}
                        />
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default SearchPage;