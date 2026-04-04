import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginUser, registerUser, registerOwner } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import "./Auth.css";

// ══════════════════════════════════════════
//  LOGIN PAGE
// ══════════════════════════════════════════
export function LoginPage() {
  const [activeRole, setActiveRole] = useState("customer"); // "customer" | "owner"
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginUser(form);
      if (res.token) {
        // Validate role matches selected tab
        const userRole = res.user?.role || "customer";
        if (activeRole === "owner" && userRole !== "store_owner") {
          toast("This account is not a store owner account.", "error");
          setLoading(false);
          return;
        }
        if (activeRole === "customer" && userRole === "store_owner") {
          toast("This is a store owner account. Switch to Owner tab.", "error");
          setLoading(false);
          return;
        }
        login(res.token, res.user);
        toast(`Welcome back, ${res.user.name}! 👋`, "success");
        navigate(userRole === "store_owner" ? "/owner-dashboard" : "/");
      } else {
        toast(res.message || "Invalid credentials", "error");
      }
    } catch {
      toast("Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg"><div className="auth-glow" /></div>
      <div className="auth-card card">

        {/* Logo */}
        <div className="auth-logo">⚡ FindMyProduct</div>

        {/* Role Selector */}
        <div className="auth-role-selector">
          <button
            className={`auth-role-btn ${activeRole === "customer" ? "active" : ""}`}
            onClick={() => setActiveRole("customer")}
            type="button"
          >
            👤 Customer
          </button>
          <button
            className={`auth-role-btn ${activeRole === "owner" ? "active" : ""}`}
            onClick={() => setActiveRole("owner")}
            type="button"
          >
            🏬 Store Owner
          </button>
        </div>

        <h1 className="auth-title">
          {activeRole === "customer" ? "Customer Login" : "Owner Login"}
        </h1>
        <p className="auth-sub">
          {activeRole === "customer"
            ? "Sign in to find and book products near you"
            : "Sign in to manage your store and bookings"}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>
          <button
            type="submit"
            className={`btn btn-full btn-lg ${activeRole === "owner" ? "btn-owner" : "btn-primary"}`}
            disabled={loading}
          >
            {loading ? <span className="spinner" /> : `Sign In as ${activeRole === "customer" ? "Customer" : "Store Owner"}`}
          </button>
        </form>

        <div className="auth-divider"><span>Don't have an account?</span></div>

        {activeRole === "customer" ? (
          <Link to="/register" className="btn btn-secondary btn-full" style={{ textAlign: "center" }}>
            Create Customer Account
          </Link>
        ) : (
          <Link to="/register-owner" className="btn btn-secondary btn-full" style={{ textAlign: "center" }}>
            Register as Store Owner
          </Link>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  CUSTOMER REGISTER PAGE
// ══════════════════════════════════════════
export function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password.length < 6) return toast("Password must be at least 6 characters.", "error");
    setLoading(true);
    try {
      const res = await registerUser(form);
      if (res.token) {
        login(res.token, res.user);
        toast("Account created! Welcome 🎉", "success");
        navigate("/");
      } else {
        toast(res.message || "Registration failed", "error");
      }
    } catch {
      toast("Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg"><div className="auth-glow" /></div>
      <div className="auth-card card">
        <div className="auth-logo">⚡ FindMyProduct</div>
        <div className="auth-type-badge customer-badge">👤 Customer Registration</div>
        <h1 className="auth-title">Create Account</h1>
        <p className="auth-sub">Find and book electronics near you</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" className="input" placeholder="John Doe"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" className="input" placeholder="you@example.com"
              value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input type="tel" className="input" placeholder="9876543210"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="input" placeholder="Min 6 characters"
              value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
              required minLength={6} />
          </div>
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : "Create Customer Account"}
          </button>
        </form>

        <div className="auth-divider"><span>Already have an account?</span></div>
        <Link to="/login" className="btn btn-secondary btn-full" style={{ textAlign: "center" }}>
          Sign In
        </Link>

        <p className="auth-switch" style={{ marginTop: 16 }}>
          Are you a store owner?{" "}
          <Link to="/register-owner">Register here →</Link>
        </p>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════
//  STORE OWNER REGISTER PAGE
// ══════════════════════════════════════════
export function RegisterOwnerPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [storeMode, setStoreMode] = useState("existing"); // "existing" | "new"
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [newStore, setNewStore] = useState({ storeName: "", address: "", city: "", contact: "", lat: "", lng: "" });
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetch("http://localhost:5000/api/stores")
      .then(r => r.json())
      .then(data => setStores(Array.isArray(data) ? data : []));
  }, []);

  const getMyLocation = () => {
    if (!navigator.geolocation) return toast("Geolocation not supported", "error");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewStore(s => ({ ...s, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) }));
        setLocating(false);
        toast("Location captured!", "success");
      },
      () => { toast("Location denied", "error"); setLocating(false); }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.phone) return toast("Phone number is required.", "error");
    if (form.password.length < 6) return toast("Password must be at least 6 characters.", "error");
    if (storeMode === "existing" && !selectedStoreId) return toast("Please select your store.", "error");
    if (storeMode === "new") {
      if (!newStore.storeName) return toast("Store name is required.", "error");
      if (!newStore.lat || !newStore.lng) return toast("Store location is required. Use 'Get My Location' or enter manually.", "error");
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        storeId: storeMode === "existing" ? selectedStoreId : null,
        newStore: storeMode === "new" ? newStore : null,
      };
      const res = await registerOwner(payload);
      if (res.token) {
        login(res.token, res.user);
        toast("Store owner account created! 🎉", "success");
        navigate("/owner-dashboard");
      } else {
        toast(res.message || "Registration failed", "error");
      }
    } catch {
      toast("Something went wrong.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-bg"><div className="auth-glow" /></div>
      <div className="auth-card card" style={{ maxWidth: 500 }}>
        <div className="auth-logo">⚡ FindMyProduct</div>
        <div className="auth-type-badge owner-badge">🏬 Store Owner Registration</div>
        <h1 className="auth-title">Owner Portal</h1>
        <p className="auth-sub">Manage your store, inventory and bookings</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {/* Personal Info */}
          <div className="form-group">
            <label>Full Name</label>
            <input type="text" className="input" placeholder="Store Manager Name"
              value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Email</label>
            <input type="email" className="input" placeholder="store@email.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Phone <span style={{ color: "var(--red)" }}>*</span> <span style={{ color: "var(--text3)", fontWeight: 400 }}>(shown to customers)</span></label>
            <input type="tel" className="input" placeholder="9876543210"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className="input" placeholder="Min 6 characters"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              required minLength={6} />
          </div>

          {/* Store Selection */}
          <div className="store-mode-section">
            <label className="store-mode-label">Your Store</label>
            <div className="store-mode-tabs">
              <button type="button" className={`store-mode-btn ${storeMode === "existing" ? "active" : ""}`}
                onClick={() => setStoreMode("existing")}>
                📋 Select Existing Store
              </button>
              <button type="button" className={`store-mode-btn ${storeMode === "new" ? "active" : ""}`}
                onClick={() => setStoreMode("new")}>
                ➕ Add New Store
              </button>
            </div>

            {storeMode === "existing" && (
              <select className="input" value={selectedStoreId}
                onChange={e => setSelectedStoreId(e.target.value)} required>
                <option value="">-- Select Your Store --</option>
                {stores.map(s => (
                  <option key={s._id} value={s._id}>{s.name} — {s.city || s.address}</option>
                ))}
              </select>
            )}

            {storeMode === "new" && (
              <div className="new-store-fields">
                <div className="form-group">
                  <label>Store Name <span style={{ color: "var(--red)" }}>*</span></label>
                  <input type="text" className="input" placeholder="e.g. Sri Electronics Nellore"
                    value={newStore.storeName} onChange={e => setNewStore({ ...newStore, storeName: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Address</label>
                  <input type="text" className="input" placeholder="Street / Area"
                    value={newStore.address} onChange={e => setNewStore({ ...newStore, address: e.target.value })} />
                </div>
                <div className="reg-row">
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" className="input" placeholder="City"
                      value={newStore.city} onChange={e => setNewStore({ ...newStore, city: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Contact</label>
                    <input type="text" className="input" placeholder="Phone"
                      value={newStore.contact} onChange={e => setNewStore({ ...newStore, contact: e.target.value })} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Store Location <span style={{ color: "var(--red)" }}>*</span></label>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={getMyLocation} disabled={locating}
                    style={{ marginBottom: 8, width: "100%" }}>
                    {locating ? <span className="spinner spinner-dark" /> : "📍 Get My Current Location"}
                  </button>
                  <div className="reg-row">
                    <input type="text" className="input" placeholder="Latitude (e.g. 14.4673)"
                      value={newStore.lat} onChange={e => setNewStore({ ...newStore, lat: e.target.value })} required={storeMode === "new"} />
                    <input type="text" className="input" placeholder="Longitude (e.g. 78.8242)"
                      value={newStore.lng} onChange={e => setNewStore({ ...newStore, lng: e.target.value })} required={storeMode === "new"} />
                  </div>
                  {newStore.lat && newStore.lng && (
                    <p style={{ fontSize: 11, color: "var(--green)", marginTop: 4 }}>
                      ✓ Location set: {newStore.lat}, {newStore.lng}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn btn-owner btn-full btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : "Create Store Owner Account"}
          </button>
        </form>

        <div className="auth-divider"><span>Already registered?</span></div>
        <Link to="/login" className="btn btn-secondary btn-full" style={{ textAlign: "center" }}>
          Sign In as Owner
        </Link>
        <p className="auth-switch" style={{ marginTop: 16 }}>
          Are you a customer? <Link to="/register">Register here →</Link>
        </p>
      </div>
    </div>
  );
}