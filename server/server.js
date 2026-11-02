require("dotenv").config();
const createApp = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.SERVER_PORT || 5000;

async function start() {
  await connectDB();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] ProofChain API running on http://localhost:${PORT}`);
  });
}

start();
