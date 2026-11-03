const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");

const authRoutes = require("./routes/authRoutes");
const assetRoutes = require("./routes/assetRoutes");
const publicRoutes = require("./routes/publicRoutes");
const profileRoutes = require("./routes/profileRoutes");
const disputeRoutes = require("./routes/disputeRoutes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  const configuredOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins = new Set(configuredOrigins);
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.add("http://localhost:5173");
    allowedOrigins.add("http://127.0.0.1:5173");
  }

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } })); // allow the client (different port) to load uploaded files
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Origin is not allowed by CORS"));
      },
    }),
  );
  app.use(express.json({ limit: "2mb" })); // generous for Phase 1 text content; file uploads use multipart, not this limit
  // Serves locally-stored uploads (StorageService's local-disk implementation, Section 12).
  // Swapping to a cloud storage provider later means this line goes away, nothing else changes.
  app.use("/uploads", express.static(path.join(__dirname, "uploads")));
  if (process.env.NODE_ENV !== "test") {
    app.use(morgan("dev"));
  }

  // Basic abuse protection — generous limits for local dev, revisited in Phase 7.
  const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
  app.use("/api", apiLimiter);

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/assets", assetRoutes);
  app.use("/api/public", publicRoutes);
  app.use("/api/profiles", profileRoutes);
  app.use("/api/disputes", disputeRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
