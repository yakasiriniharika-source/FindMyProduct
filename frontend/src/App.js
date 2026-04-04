import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./components/Toast";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import SearchPage from "./pages/SearchPage";
import ProductDetails from "./pages/ProductDetails";
import { LoginPage, RegisterPage, RegisterOwnerPage } from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import StorePage, { StoresListPage } from "./pages/StorePage";
import OwnerDashboard from "./pages/OwnerDashboard";
import ProfilePage from "./pages/ProfilePage";
import ComparePage from "./pages/ComparePage";
import "./index.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Navbar />
          <Routes>
            <Route path="/"                element={<Home />} />
            <Route path="/search"          element={<SearchPage />} />
            <Route path="/product/:id"     element={<ProductDetails />} />
            <Route path="/login"           element={<LoginPage />} />
            <Route path="/register"        element={<RegisterPage />} />
            <Route path="/register-owner"  element={<RegisterOwnerPage />} />
            <Route path="/dashboard"       element={<Dashboard />} />
            <Route path="/bookings"        element={<Dashboard />} />
            <Route path="/stores"          element={<StoresListPage />} />
            <Route path="/store/:id"       element={<StorePage />} />
            <Route path="/owner-dashboard" element={<OwnerDashboard />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/compare" element={<ComparePage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;