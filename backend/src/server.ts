import "dotenv/config";
import { app } from "./app.js";
import { pool } from "./db/pool.js";

const PORT = Number(process.env.PORT || 3000);

async function start() {
  try {
    await pool.query("SELECT 1");

    app.listen(PORT, "127.0.0.1", () => {
      console.log(`Cars I Like API running at http://127.0.0.1:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    await pool.end();
    process.exit(1);
  }
}

void start();
