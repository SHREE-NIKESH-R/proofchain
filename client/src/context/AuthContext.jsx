import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { connectWallet, getSigner } from "../lib/wallet";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("proofchain_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user: me } = await api.me();
      setUser(me);
    } catch {
      localStorage.removeItem("proofchain_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  async function register(email, password) {
    const { token, user: newUser } = await api.register(email, password);
    localStorage.setItem("proofchain_token", token);
    setUser(newUser);
  }

  async function login(email, password) {
    const { token, user: loggedInUser } = await api.login(email, password);
    localStorage.setItem("proofchain_token", token);
    setUser(loggedInUser);
  }

  function logout() {
    localStorage.removeItem("proofchain_token");
    setUser(null);
  }

  /**
   * Full wallet-linking flow: connect MetaMask, request a nonce, sign it,
   * and submit the signature so the backend can verify + link the wallet.
   */
  async function linkWallet() {
    const address = await connectWallet();
    const { message } = await api.walletNonce();
    const signer = await getSigner();
    const signature = await signer.signMessage(message);

    if (signer.address && signer.address.toLowerCase() !== address.toLowerCase()) {
      throw new Error("Connected account changed mid-flow. Please try again.");
    }

    const { user: updatedUser } = await api.linkWallet(address, signature);
    setUser(updatedUser);
    return updatedUser;
  }

  return (
    <AuthContext.Provider value={{ user, loading, register, login, logout, linkWallet, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
