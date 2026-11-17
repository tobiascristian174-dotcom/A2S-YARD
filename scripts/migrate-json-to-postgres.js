require("dotenv").config();
const fs = require("node:fs/promises");
const path = require("node:path");
const { initializeDatabase, saveAccounts, saveBookings } = require("../db");

const rootDir = path.join(__dirname, "..");
const accountsPath = path.join(rootDir, "data", "accounts.json");
const bookingsPath = path.join(rootDir, "data", "bookings.json");

async function readJson(filePath, label) {
  let raw;
  try {
    raw = await fs.readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`No ${label} file found at ${filePath}; skipping migration.`);
      return null;
    }
    throw error;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`The ${label} file at ${filePath} contains invalid JSON: ${error.message}`);
  }
}

async function migrate() {
  const databaseReady = await initializeDatabase();
  if (!databaseReady) {
    throw new Error("PostgreSQL is not configured. Set DATABASE_URL or PG* environment variables before running the migration.");
  }

  const accountData = await readJson(accountsPath, "accounts");
  const bookingData = await readJson(bookingsPath, "bookings");

  if (!accountData && !bookingData) {
    console.log("No JSON data found to migrate.");
    return;
  }

  const accounts = accountData && Array.isArray(accountData.accounts) ? accountData.accounts : [];
  const bookings = bookingData && Array.isArray(bookingData.bookings) ? bookingData.bookings : [];

  const invalidAccount = accounts.find((account) => !account || typeof account !== "object" || typeof account.email !== "string");
  if (invalidAccount) {
    throw new Error("Invalid account entry found in accounts.json; every record must include an email field.");
  }

  const invalidBooking = bookings.find((booking) => !booking || typeof booking !== "object" || typeof booking.id !== "string");
  if (invalidBooking) {
    throw new Error("Invalid booking entry found in bookings.json; every record must include an id field.");
  }

  await saveAccounts(accounts);
  await saveBookings(bookings);

  console.log(`Migration complete: ${accounts.length} accounts and ${bookings.length} bookings processed.`);
}

migrate().catch((error) => {
  console.error("Migration failed.");
  console.error(error.message || error);
  process.exitCode = 1;
});
