import { pool } from "./pool.js";

async function checkDatabase() {
  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS username,
        to_regclass('public.cars') AS cars_table
    `);

    console.log("Database connection successful:");
    console.table(result.rows);
  } catch (error) {
    console.error("Database connection failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void checkDatabase();
