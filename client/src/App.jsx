import { Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  FolderOpen,
  PlusCircle,
  ArrowLeftRight,
  User,
  LogOut,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useAuth } from "./context/AuthContext";
import { api } from "./lib/api";
import ProtectedRoute from "./context/ProtectedRoute";
import AmbientBackground from "./components/AmbientBackground";
import ThemeToggle from "./components/ThemeToggle";
import PageTransition from "./components/PageTransition";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import RegisterAccount from "./pages/RegisterAccount";
import Dashboard from "./pages/Dashboard";
import RegisterAsset from "./pages/RegisterAsset";
import MyAssets from "./pages/MyAssets";
import VerifyContent from "./pages/VerifyContent";
import AssetDetail from "./pages/AssetDetail";
import PublicExplorer from "./pages/PublicExplorer";
import OwnershipTransfer from "./pages/OwnershipTransfer";
import Profile from "./pages/Profile";
import Certificate from "./pages/Certificate";
import CreatorProfile from "./pages/CreatorProfile";

function NavLink({ to, children, icon: Icon }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link to={to} className={`nav-link ${isActive ? "active" : ""}`}>
      {Icon && <Icon size={15} strokeWidth={2} />}
      <span>{children}</span>
    </Link>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  const [displayName, setDisplayName] = useState(null);

  useEffect(() => {
    if (!user?.walletAddress) {
      setDisplayName(null);
      return;
    }
    api
      .getMyProfile()
      .then((res) => setDisplayName(res.profile.displayName))
      .catch(() => {});
  }, [user?.walletAddress]);

  return (
    <nav className="navbar">
      <Link to="/" className="brand">
        <ShieldCheck size={19} strokeWidth={2.3} />
        ProofChain
      </Link>
      <div className="nav-links">
        <NavLink to="/explorer" icon={Search}>
          Explorer
        </NavLink>
        <NavLink to="/verify" icon={ShieldCheck}>
          Verify
        </NavLink>
        {user ? (
          <>
            <NavLink to="/dashboard" icon={LayoutDashboard}>
              Dashboard
            </NavLink>
            <NavLink to="/assets" icon={FolderOpen}>
              My Assets
            </NavLink>
            <NavLink to="/register" icon={PlusCircle}>
              Register
            </NavLink>
            <NavLink to="/transfer" icon={ArrowLeftRight}>
              Transfer
            </NavLink>
            <Link
              to={
                user.walletAddress
                  ? `/creator/${user.walletAddress}`
                  : "/profile"
              }
              className="nav-identity-chip"
              title={
                user.walletAddress
                  ? "Edit your display name"
                  : "Link a wallet to set a display name"
              }
            >
              {displayName ? (
                <>
                  <User size={13} strokeWidth={2} /> {displayName}
                </>
              ) : user.walletAddress ? (
                <>
                  <UserPlus size={13} strokeWidth={2} /> Set your name
                </>
              ) : (
                <>
                  <User size={13} strokeWidth={2} /> Profile
                </>
              )}
            </Link>
            <ThemeToggle />
            <button
              onClick={logout}
              className="btn-tertiary-icon"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </>
        ) : (
          <>
            <ThemeToggle />
            <Link to="/login" className="nav-link">
              Login
            </Link>
            <Link to="/register-account" className="btn-primary btn-small">
              Sign up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route
          path="/"
          element={
            <PageTransition>
              <Landing />
            </PageTransition>
          }
        />
        <Route
          path="/login"
          element={
            <PageTransition>
              <Login />
            </PageTransition>
          }
        />
        <Route
          path="/register-account"
          element={
            <PageTransition>
              <RegisterAccount />
            </PageTransition>
          }
        />
        <Route
          path="/verify"
          element={
            <PageTransition>
              <VerifyContent />
            </PageTransition>
          }
        />
        <Route
          path="/explorer"
          element={
            <PageTransition>
              <PublicExplorer />
            </PageTransition>
          }
        />
        <Route
          path="/assets/:assetId"
          element={
            <PageTransition>
              <AssetDetail />
            </PageTransition>
          }
        />
        <Route
          path="/verify/:assetId"
          element={
            <PageTransition>
              <AssetDetail />
            </PageTransition>
          }
        />
        <Route
          path="/creator/:wallet"
          element={
            <PageTransition>
              <CreatorProfile />
            </PageTransition>
          }
        />
        <Route
          path="/assets/:assetId/certificate"
          element={
            <PageTransition>
              <Certificate />
            </PageTransition>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <PageTransition>
                <Dashboard />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/assets"
          element={
            <ProtectedRoute>
              <PageTransition>
                <MyAssets />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/register"
          element={
            <ProtectedRoute>
              <PageTransition>
                <RegisterAsset />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfer"
          element={
            <ProtectedRoute>
              <PageTransition>
                <OwnershipTransfer />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <PageTransition>
                <Profile />
              </PageTransition>
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <div className="app">
      <AmbientBackground />
      <Nav />
      <main>
        <AnimatedRoutes />
      </main>
    </div>
  );
}
