import { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getNotifications, markAllRead } from "../services/api";
import "./Navbar.css";

const customerCategories = [
  { label: "All",           path: "/search",                          icon: "🔍" },
  { label: "Mobiles",       path: "/search?category=mobile",          icon: "📱" },
  { label: "Laptops",       path: "/search?category=laptop",          icon: "💻" },
  { label: "TVs",           path: "/search?category=tv",              icon: "📺" },
  { label: "Refrigerators", path: "/search?category=refrigerator",    icon: "🧊" },
  { label: "Watches",       path: "/search?category=smartwatch",      icon: "⌚" },
  { label: "Washing",       path: "/search?category=washing+machine", icon: "🫧" },
  { label: "Stores",        path: "/stores",                          icon: "🏬" },
];

// Owner categories route to their dashboard's Manage Products tab filtered by category
const ownerCategories = [
  { label: "All",           path: "/owner-dashboard?tab=products",                          icon: "📦" },
  { label: "Mobiles",       path: "/owner-dashboard?tab=products&category=mobile",          icon: "📱" },
  { label: "Laptops",       path: "/owner-dashboard?tab=products&category=laptop",          icon: "💻" },
  { label: "TVs",           path: "/owner-dashboard?tab=products&category=tv",              icon: "📺" },
  { label: "Refrigerators", path: "/owner-dashboard?tab=products&category=refrigerator",    icon: "🧊" },
  { label: "Watches",       path: "/owner-dashboard?tab=products&category=smartwatch",      icon: "⌚" },
  { label: "Washing",       path: "/owner-dashboard?tab=products&category=washing+machine", icon: "🫧" },
];

function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifCount, setNotifCount] = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [allNotifs, setAllNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showAllNotifs, setShowAllNotifs] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const notifRef = useRef();
  const userRef = useRef();

  const isOwner = user?.role === "store_owner";
  const categories = isOwner ? ownerCategories : customerCategories;

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    getNotifications().then((data) => {
      const list = Array.isArray(data) ? data : [];
      setAllNotifs(list);
      setNotifs(list.slice(0, 3));
      setNotifCount(list.filter((n) => !n.read).length);
    });
  }, [user, location.pathname]);

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (userRef.current && !userRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleMarkRead = () => {
    markAllRead().then(() => {
      setNotifCount(0);
      setNotifs((n) => n.map((x) => ({ ...x, read: true })));
      setAllNotifs((n) => n.map((x) => ({ ...x, read: true })));
    });
  };

  const isCatActive = (cat) => {
    if (isOwner) {
      const catParam = new URLSearchParams(cat.path.split("?")[1] || "").get("category");
      const currentCat = new URLSearchParams(location.search).get("category");
      const currentTab = new URLSearchParams(location.search).get("tab");
      if (cat.label === "All") return currentTab === "products" && !currentCat;
      return currentTab === "products" && currentCat === catParam;
    } else {
      if (cat.label === "All") return location.pathname === "/search" && !location.search.includes("category");
      return cat.path.includes("=") && location.search.includes(cat.path.split("=")[1]);
    }
  };

  return (
    <nav className={`navbar ${scrolled ? "scrolled" : ""}`}>
      <div className="navbar-inner">
        {/* Logo */}
        <Link to="/" className="nav-logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">Find<span>My</span>Product</span>
        </Link>

        {/* Category Nav — shown for both customers and owners */}
        <div className="nav-categories">
          {isOwner && (
            <span className="nav-cat-label">My Products:</span>
          )}
          {categories.map((cat) => (
            <Link
              key={cat.label}
              to={cat.path}
              className={`nav-cat ${isCatActive(cat) ? "active" : ""}`}
            >
              <span>{cat.icon}</span>
              {cat.label}
            </Link>
          ))}
        </div>

        {/* Right Side — bell + profile always pushed right */}
        <div className="nav-right">
          {user ? (
            <>
              {/* Notifications */}
              <div className="nav-notif" ref={notifRef}>
                <button
                  className="btn btn-icon btn-ghost notif-btn"
                  onClick={() => { setShowNotifs(!showNotifs); setShowAllNotifs(false); setShowUserMenu(false); }}
                >
                  🔔
                  {notifCount > 0 && <span className="notif-dot">{notifCount}</span>}
                </button>

                {showNotifs && (
                  <div className="notif-dropdown">
                    <div className="notif-header">
                      <span>Notifications</span>
                      <button className="btn btn-ghost btn-sm" onClick={handleMarkRead}>Mark all read</button>
                    </div>
                    {allNotifs.length === 0 ? (
                      <p className="notif-empty">No notifications</p>
                    ) : (
                      <>
                        <div className="notif-list">
                          {(showAllNotifs ? allNotifs : notifs).map((n) => (
                            <div key={n._id} className={`notif-item ${!n.read ? "unread" : ""}`}>
                              <span className="notif-type-icon">
                                {n.type === "restock" ? "📦" : n.type === "booking_confirmed" ? "✅" : "🔔"}
                              </span>
                              <p>{n.message}</p>
                            </div>
                          ))}
                        </div>
                        {!showAllNotifs && allNotifs.length > 3 && (
                          <button className="notif-see-all" onClick={() => setShowAllNotifs(true)}>
                            See all {allNotifs.length} notifications ↓
                          </button>
                        )}
                        {showAllNotifs && (
                          <button className="notif-see-all" onClick={() => setShowAllNotifs(false)}>
                            Show less ↑
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="nav-user-wrap" ref={userRef}>
                <button
                  className="nav-user-btn"
                  onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifs(false); }}
                >
                  <div className="avatar">{user.name?.[0]?.toUpperCase() || "U"}</div>
                  <span className="user-name">{user.name?.split(" ")[0]}</span>
                  <span>▾</span>
                </button>

                {showUserMenu && (
                  <div className="user-dropdown">
                    {isOwner ? (
                      <Link to="/owner-dashboard" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                        🏬 Store Dashboard
                      </Link>
                    ) : (
                      <Link to="/dashboard" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                        🏠 Dashboard
                      </Link>
                    )}

                    {/* Customer-only menu items */}
                    {!isOwner && (
                      <>
                        <Link to="/bookings" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                          📋 My Bookings
                        </Link>
                        <Link to="/saved" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                          ❤️ Saved Products
                        </Link>
                        <Link to="/compare" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                          ⚖️ Compare Products
                        </Link>
                      </>
                    )}

                    <Link to="/profile" className="dropdown-item" onClick={() => setShowUserMenu(false)}>
                      👤 Edit Profile
                    </Link>
                    <div className="divider" />
                    <button className="dropdown-item danger" onClick={() => { logout(); setShowUserMenu(false); navigate("/"); }}>
                      🚪 Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="nav-auth">
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/register" className="btn btn-primary btn-sm">Sign Up</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

export default Navbar;