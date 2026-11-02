const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/proofchain";

  try {
    await mongoose.connect(uri);
    console.log(`[db] Connected to MongoDB (${mongoose.connection.name})`);
  } catch (error) {
    console.error("[db] MongoDB connection failed:", error.message);
    // Fail fast in local dev — a running app with no DB is more confusing than a crash.
    process.exit(1);
  }
}

module.exports = connectDB;
