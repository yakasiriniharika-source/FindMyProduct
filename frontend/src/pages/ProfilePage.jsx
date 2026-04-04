import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import { updateProfile } from "../services/api";
import "./ProfilePage.css";

function ProfilePage() {
  const { user, login } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updated = await updateProfile(form);
      login(localStorage.getItem("fmp_token"), { ...user, name: updated.name, phone: updated.phone });
      toast("Profile updated! ✅", "success");
    } catch {
      toast("Failed to update profile", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page page-wrapper">
      <div className="profile-card card">
        <div className="profile-header">
          <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || "U"}</div>
          <div>
            <h1 className="profile-name">{user?.name}</h1>
            <p className="profile-email">{user?.email}</p>
            <span className={`badge ${user?.role === "store_owner" ? "badge-amber" : "badge-accent"}`}>
              {user?.role === "store_owner" ? "🏬 Store Owner" : "👤 Customer"}
            </span>
          </div>
        </div>

        <div className="profile-divider" />

        <h2 className="profile-section-title">Edit Profile</h2>
        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Full Name</label>
            <input className="input" type="text" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>
              Phone Number
              {!user?.phone && <span className="phone-warning"> ⚠️ Add phone so stores can contact you</span>}
            </label>
            <input className="input" type="tel" placeholder="9876543210"
              value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Email <span style={{ color: "var(--text3)", fontWeight: 400 }}>(cannot change)</span></label>
            <input className="input" type="email" value={user?.email} disabled
              style={{ opacity: 0.6, cursor: "not-allowed" }} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <span className="spinner" /> : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ProfilePage;