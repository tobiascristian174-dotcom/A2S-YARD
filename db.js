const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
const pgConfig = databaseUrl
  ? { connectionString: databaseUrl, ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.PGHOST || "localhost",
      port: Number(process.env.PGPORT || 5432),
      user: process.env.PGUSER || "postgres",
      password: process.env.PGPASSWORD || "postgres",
      database: process.env.PGDATABASE || "a2s_yard",
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(pgConfig);
pool.on("error", (error) => {
  process.stderr.write(`PostgreSQL pool error: ${error.message}\n`);
});

function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL || (process.env.PGHOST && process.env.PGUSER && process.env.PGDATABASE));
}

function normalizeAccountRow(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    name: row.name,
    company: row.company,
    email: row.email,
    role: row.role || metadata.role || "Customer",
    passwordSalt: row.password_salt || metadata.passwordSalt || "",
    passwordHash: row.password_hash || metadata.passwordHash || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : metadata.createdAt || new Date().toISOString(),
  };
}

function normalizeBookingRow(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    id: row.id,
    customerEmail: row.customer_email || metadata.customerEmail || "",
    customerName: row.customer_name || metadata.customerName || "",
    container: row.container || metadata.container || "",
    driver: row.driver || metadata.driver || "",
    contact: row.contact || metadata.contact || "",
    plate: row.plate || metadata.plate || "",
    cargo: row.cargo || metadata.cargo || "",
    company: row.company || metadata.company || "",
    size: row.size || metadata.size || "",
    date: row.date || metadata.date || "",
    time: row.time || metadata.time || "",
    slot: row.slot || metadata.slot || "",
    fee: row.fee ?? metadata.fee ?? 0,
    status: row.status || metadata.status || "Pending Payment",
    paymentStatus: row.payment_status || metadata.paymentStatus || "Unpaid",
    method: row.method || metadata.method || "",
    reference: row.reference || metadata.reference || "",
    proof: row.proof || metadata.proof || "",
    proofFile: row.proof_file || metadata.proofFile || "",
    proofContentType: row.proof_content_type || metadata.proofContentType || "",
    gatePass: row.gate_pass || metadata.gatePass || "",
    gatePassIssued: row.gate_pass_issued ?? metadata.gatePassIssued ?? false,
    activity: row.activity || metadata.activity || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : metadata.createdAt || new Date().toISOString(),
  };
}

function normalizeDriverRow(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    id: row.id,
    name: row.name,
    contact: row.contact || "",
    plate: row.plate || "",
    company: row.company || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : metadata.createdAt || new Date().toISOString(),
  };
}

function normalizeCompanyRow(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    id: row.id,
    name: row.name,
    contact: row.contact || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : metadata.createdAt || new Date().toISOString(),
  };
}

function normalizeSessionRow(row) {
  return {
    id: row.id,
    email: row.email,
    role: row.role || "Customer",
    csrfToken: row.csrf_token,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null,
    data: row.data || {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

function normalizeSlotOverrideRow(row) {
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    ...metadata,
    id: row.id,
    slotKey: row.slot_key,
    status: row.status,
    note: row.note || "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

function normalizeActivityLogRow(row) {
  return {
    id: row.id,
    actorEmail: row.actor_email || "",
    action: row.action,
    details: row.details || {},
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
  };
}

async function initializeDatabase() {
  if (!isDatabaseConfigured()) {
    return false;
  }

  try {
    await pool.query("SELECT 1");
  } catch (error) {
    throw new Error(`PostgreSQL connection failed: ${error.message}`);
  }

  const schema = `
    CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      email VARCHAR(254) NOT NULL UNIQUE,
      name VARCHAR(120) NOT NULL,
      company VARCHAR(160) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'Customer',
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id VARCHAR(64) PRIMARY KEY,
      customer_email VARCHAR(254) NOT NULL,
      customer_name VARCHAR(120),
      container VARCHAR(64) NOT NULL,
      driver VARCHAR(120) NOT NULL,
      contact VARCHAR(40),
      plate VARCHAR(40),
      cargo VARCHAR(200),
      company VARCHAR(160),
      size VARCHAR(10),
      date VARCHAR(12),
      time VARCHAR(20),
      slot VARCHAR(32),
      fee NUMERIC(12,2) DEFAULT 0,
      status VARCHAR(80) NOT NULL DEFAULT 'Pending Payment',
      payment_status VARCHAR(80) NOT NULL DEFAULT 'Unpaid',
      method VARCHAR(60),
      reference VARCHAR(120),
      proof VARCHAR(220),
      proof_file VARCHAR(220),
      proof_content_type VARCHAR(120),
      gate_pass VARCHAR(120),
      gate_pass_issued BOOLEAN NOT NULL DEFAULT FALSE,
      activity TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS drivers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      contact VARCHAR(40),
      plate VARCHAR(40),
      company VARCHAR(160),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (name, company, plate)
    );

    CREATE TABLE IF NOT EXISTS trucking_companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(160) NOT NULL UNIQUE,
      contact VARCHAR(160),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS yard_slot_overrides (
      id SERIAL PRIMARY KEY,
      slot_key VARCHAR(32) NOT NULL UNIQUE,
      status VARCHAR(50) NOT NULL DEFAULT 'Available',
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      actor_email VARCHAR(254),
      action VARCHAR(160) NOT NULL,
      details JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS session_store (
      id VARCHAR(255) PRIMARY KEY,
      email VARCHAR(254) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'Customer',
      csrf_token VARCHAR(128) NOT NULL,
      data JSONB NOT NULL DEFAULT '{}'::jsonb,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_session_store_expires ON session_store (expires_at);
  `;

  await pool.query(schema);
  await cleanupExpiredSessions();
  return true;
}

async function cleanupExpiredSessions() {
  if (!isDatabaseConfigured()) return;
  await pool.query("DELETE FROM session_store WHERE expires_at <= NOW()");
}

async function listAccounts() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await pool.query("SELECT * FROM accounts ORDER BY created_at ASC, email ASC");
  return rows.map(normalizeAccountRow);
}

async function saveAccounts(accounts) {
  if (!isDatabaseConfigured()) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const account of accounts) {
      const metadata = Object.fromEntries(
        Object.entries(account || {}).filter(([key]) => !["name", "company", "email", "role", "passwordSalt", "passwordHash", "createdAt"].includes(key)),
      );
      await client.query(
        `INSERT INTO accounts (email, name, company, role, password_salt, password_hash, created_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (email)
         DO UPDATE SET
           name = EXCLUDED.name,
           company = EXCLUDED.company,
           role = EXCLUDED.role,
           password_salt = EXCLUDED.password_salt,
           password_hash = EXCLUDED.password_hash,
           created_at = EXCLUDED.created_at,
           metadata = EXCLUDED.metadata`,
        [
          account.email,
          account.name,
          account.company,
          account.role || "Customer",
          account.passwordSalt || "",
          account.passwordHash || "",
          account.createdAt || new Date().toISOString(),
          JSON.stringify(metadata),
        ],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listBookings() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await pool.query("SELECT * FROM bookings ORDER BY created_at ASC, id ASC");
  return rows.map(normalizeBookingRow);
}

async function saveBookings(bookings) {
  if (!isDatabaseConfigured()) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const booking of bookings) {
      if (!booking || typeof booking !== "object" || !booking.id) continue;
      const metadata = Object.fromEntries(
        Object.entries(booking || {}).filter(([key]) => ![
          "id", "customerEmail", "customerName", "container", "driver", "contact", "plate", "cargo", "company",
          "size", "date", "time", "slot", "fee", "status", "paymentStatus", "method", "reference", "proof",
          "proofFile", "proofContentType", "gatePass", "gatePassIssued", "activity", "createdAt",
        ].includes(key)),
      );
      await client.query(
        `INSERT INTO bookings (
          id, customer_email, customer_name, container, driver, contact, plate, cargo, company, size, date, time,
          slot, fee, status, payment_status, method, reference, proof, proof_file, proof_content_type, gate_pass,
          gate_pass_issued, activity, created_at, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
         ON CONFLICT (id)
         DO UPDATE SET
           customer_email = EXCLUDED.customer_email,
           customer_name = EXCLUDED.customer_name,
           container = EXCLUDED.container,
           driver = EXCLUDED.driver,
           contact = EXCLUDED.contact,
           plate = EXCLUDED.plate,
           cargo = EXCLUDED.cargo,
           company = EXCLUDED.company,
           size = EXCLUDED.size,
           date = EXCLUDED.date,
           time = EXCLUDED.time,
           slot = EXCLUDED.slot,
           fee = EXCLUDED.fee,
           status = EXCLUDED.status,
           payment_status = EXCLUDED.payment_status,
           method = EXCLUDED.method,
           reference = EXCLUDED.reference,
           proof = EXCLUDED.proof,
           proof_file = EXCLUDED.proof_file,
           proof_content_type = EXCLUDED.proof_content_type,
           gate_pass = EXCLUDED.gate_pass,
           gate_pass_issued = EXCLUDED.gate_pass_issued,
           activity = EXCLUDED.activity,
           created_at = EXCLUDED.created_at,
           metadata = EXCLUDED.metadata`,
        [
          booking.id,
          booking.customerEmail || "",
          booking.customerName || "",
          booking.container || "",
          booking.driver || "",
          booking.contact || "",
          booking.plate || "",
          booking.cargo || "",
          booking.company || "",
          booking.size || "",
          booking.date || "",
          booking.time || "",
          booking.slot || "",
          Number(booking.fee || 0),
          booking.status || "Pending Payment",
          booking.paymentStatus || "Unpaid",
          booking.method || "",
          booking.reference || "",
          booking.proof || "",
          booking.proofFile || "",
          booking.proofContentType || "",
          booking.gatePass || "",
          booking.gatePassIssued === true,
          booking.activity || "",
          booking.createdAt || new Date().toISOString(),
          JSON.stringify(metadata),
        ],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function saveSessionRecord(session) {
  if (!isDatabaseConfigured()) return false;
  await pool.query(
    `INSERT INTO session_store (id, email, role, csrf_token, data, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (id)
     DO UPDATE SET
       email = EXCLUDED.email,
       role = EXCLUDED.role,
       csrf_token = EXCLUDED.csrf_token,
       data = EXCLUDED.data,
       expires_at = EXCLUDED.expires_at`,
    [
      session.id,
      session.email,
      session.role || "Customer",
      session.csrfToken || "",
      JSON.stringify(session.data || {}),
      session.expiresAt ? new Date(session.expiresAt) : new Date(Date.now() + 60 * 60 * 1000),
    ],
  );
  return true;
}

async function getSessionRecord(sessionId) {
  if (!isDatabaseConfigured()) return null;
  const { rows } = await pool.query(
    "SELECT * FROM session_store WHERE id = $1 AND expires_at > NOW()",
    [sessionId],
  );
  return rows[0] ? normalizeSessionRow(rows[0]) : null;
}

async function deleteSessionRecord(sessionId) {
  if (!isDatabaseConfigured()) return false;
  const result = await pool.query("DELETE FROM session_store WHERE id = $1", [sessionId]);
  return result.rowCount > 0;
}

async function listDrivers() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await pool.query("SELECT * FROM drivers ORDER BY created_at ASC, name ASC");
  return rows.map(normalizeDriverRow);
}

async function saveDrivers(drivers) {
  if (!isDatabaseConfigured()) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const driver of drivers || []) {
      if (!driver || typeof driver !== "object") continue;
      await client.query(
        `INSERT INTO drivers (name, contact, plate, company, metadata)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name, company, plate)
         DO UPDATE SET
           contact = EXCLUDED.contact,
           company = EXCLUDED.company,
           metadata = EXCLUDED.metadata`,
        [
          driver.name || "",
          driver.contact || "",
          driver.plate || "",
          driver.company || "",
          JSON.stringify(Object.fromEntries(Object.entries(driver).filter(([key]) => !["name", "contact", "plate", "company"].includes(key)))),
        ],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listCompanies() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await pool.query("SELECT * FROM trucking_companies ORDER BY created_at ASC, name ASC");
  return rows.map(normalizeCompanyRow);
}

async function saveCompanies(companies) {
  if (!isDatabaseConfigured()) return false;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const company of companies || []) {
      if (!company || typeof company !== "object") continue;
      await client.query(
        `INSERT INTO trucking_companies (name, contact, metadata)
         VALUES ($1, $2, $3)
         ON CONFLICT (name)
         DO UPDATE SET
           contact = EXCLUDED.contact,
           metadata = EXCLUDED.metadata`,
        [
          company.name || "",
          company.contact || "",
          JSON.stringify(Object.fromEntries(Object.entries(company).filter(([key]) => !["name", "contact"].includes(key)))),
        ],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function listSlotOverrides() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await pool.query("SELECT * FROM yard_slot_overrides ORDER BY slot_key ASC");
  return rows.map(normalizeSlotOverrideRow);
}

async function saveSlotOverride(slotOverride) {
  if (!isDatabaseConfigured()) return false;
  const entry = slotOverride || {};
  await pool.query(
    `INSERT INTO yard_slot_overrides (slot_key, status, note, updated_at, metadata)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (slot_key)
     DO UPDATE SET
       status = EXCLUDED.status,
       note = EXCLUDED.note,
       updated_at = NOW(),
       metadata = EXCLUDED.metadata`,
    [
      entry.slotKey || entry.slot_key || "",
      entry.status || "Available",
      entry.note || "",
      JSON.stringify(Object.fromEntries(Object.entries(entry).filter(([key]) => !["slotKey", "slot_key", "status", "note"].includes(key)))),
    ],
  );
  return true;
}

async function listActivityLogs() {
  if (!isDatabaseConfigured()) return [];
  const { rows } = await pool.query("SELECT * FROM activity_logs ORDER BY created_at DESC, id DESC");
  return rows.map(normalizeActivityLogRow);
}

async function addActivityLog(log) {
  if (!isDatabaseConfigured()) return false;
  const record = log || {};
  await pool.query(
    "INSERT INTO activity_logs (actor_email, action, details) VALUES ($1, $2, $3)",
    [record.actorEmail || "", record.action || "activity", JSON.stringify(record.details || {})],
  );
  return true;
}

module.exports = {
  pool,
  initializeDatabase,
  isDatabaseConfigured,
  listAccounts,
  saveAccounts,
  listBookings,
  saveBookings,
  saveSessionRecord,
  getSessionRecord,
  deleteSessionRecord,
  cleanupExpiredSessions,
  listDrivers,
  saveDrivers,
  listCompanies,
  saveCompanies,
  listSlotOverrides,
  saveSlotOverride,
  listActivityLogs,
  addActivityLog,
};
