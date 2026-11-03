export function isAdminEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return normalized === "admin@gmail.com" || normalized === "admin@gamil.com";
}
