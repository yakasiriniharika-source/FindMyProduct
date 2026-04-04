import { createContext, useContext, useState, useEffect } from "react";
import { getMe } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("fmp_token");
    if (token) {
      // Always fetch fresh user data including role from backend
      getMe()
        .then((data) => {
          if (data._id) {
            setUser({
              id:      data._id,
              name:    data.name,
              email:   data.email,
              phone:   data.phone || "",
              role:    data.role || "customer",
              storeId: data.storeId || null,
              savedProducts: data.savedProducts || [],
            });
          } else {
            logout();
          }
        })
        .catch(logout)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData) => {
    localStorage.setItem("fmp_token", token);
    setUser({
      id:      userData.id || userData._id,
      name:    userData.name,
      email:   userData.email,
      phone:   userData.phone || "",
      role:    userData.role || "customer",
      storeId: userData.storeId || null,
    });
  };

  const logout = () => {
    localStorage.removeItem("fmp_token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);