const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

async function request(
  path,
  { method = "GET", body, token, auth = true, isFormData = false } = {},
) {
  const headers = {};
  if (!isFormData) headers["Content-Type"] = "application/json";
  const jwt = token || localStorage.getItem("proofchain_token");
  if (auth && jwt) headers.Authorization = `Bearer ${jwt}`;

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    // FormData sets its own multipart Content-Type (with boundary) — must not be JSON.stringify'd.
    body: isFormData ? body : body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  register: (email, password) =>
    request("/auth/register", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),
  login: (email, password) =>
    request("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    }),
  me: () => request("/auth/me"),
  walletNonce: () => request("/auth/wallet/nonce"),
  linkWallet: (walletAddress, signature) =>
    request("/auth/wallet/link", {
      method: "POST",
      body: { walletAddress, signature },
    }),
  unlinkWallet: () => request("/auth/wallet/unlink", { method: "POST" }),

  prepareAsset: (contentType, textContent) =>
    request("/assets/prepare", {
      method: "POST",
      body: { contentType, textContent },
    }),
  registerAsset: (payload) =>
    request("/assets/register", { method: "POST", body: payload }),

  prepareFileAsset: (contentType, file) => {
    const form = new FormData();
    form.append("contentType", contentType);
    form.append("file", file);
    return request("/assets/prepare-file", {
      method: "POST",
      body: form,
      isFormData: true,
    });
  },
  registerFileAsset: (fields, file) => {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    form.append("file", file);
    return request("/assets/register-file", {
      method: "POST",
      body: form,
      isFormData: true,
    });
  },
  verifyContent: (textContent) =>
    request("/assets/verify", {
      method: "POST",
      body: { textContent },
      auth: false,
    }),
  verifyFileContent: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/assets/verify-file", {
      method: "POST",
      body: form,
      isFormData: true,
      auth: false,
    });
  },
  checkSimilarity: (textContent, contentType) =>
    request("/assets/similarity-check", {
      method: "POST",
      body: { textContent, contentType },
      auth: false,
    }),
  checkFileSimilarity: (contentType, file) => {
    const form = new FormData();
    form.append("contentType", contentType);
    form.append("file", file);
    return request("/assets/similarity-check-file", {
      method: "POST",
      body: form,
      isFormData: true,
      auth: false,
    });
  },
  listMyAssets: () => request("/assets"),
  getAsset: (assetId) => request(`/assets/${assetId}`, { auth: false }),
  transferAsset: (assetId, toWallet, txHash) =>
    request(`/assets/${assetId}/transfer`, {
      method: "POST",
      body: { toWallet, txHash },
    }),
  publicVerify: (assetId) =>
    request(`/public/verify/${assetId}`, { auth: false }),
  publicSearch: (query) =>
    request(`/public/search?query=${encodeURIComponent(query)}`, {
      auth: false,
    }),

  getMyProfile: () => request("/profiles/me"),
  updateMyProfile: (displayName, bio) =>
    request("/profiles/me", { method: "PUT", body: { displayName, bio } }),
  getPublicProfile: (wallet) => request(`/profiles/${wallet}`, { auth: false }),
};
