const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isDatabaseConfigured,
  initializeDatabase,
  saveAccounts,
  saveBookings,
  listAccounts,
  listBookings,
  saveSessionRecord,
  getSessionRecord,
  deleteSessionRecord,
  listDrivers,
  saveDrivers,
  listCompanies,
  saveCompanies,
  listSlotOverrides,
  saveSlotOverride,
  listActivityLogs,
  addActivityLog,
} = require("../db");

const dbConfigured = isDatabaseConfigured();

const runIfDb = dbConfigured ? test : test.skip;

runIfDb("database initialization creates the expected schema", async () => {
  await initializeDatabase();
  const accounts = await listAccounts();
  const bookings = await listBookings();
  assert.ok(Array.isArray(accounts));
  assert.ok(Array.isArray(bookings));
});

runIfDb("accounts and bookings can be migrated idempotently", async () => {
  const sampleAccounts = [{
    email: "migration.test@example.com",
    name: "Migration User",
    company: "Test Company",
    role: "Customer",
    passwordSalt: "abc123",
    passwordHash: "def456",
    createdAt: new Date().toISOString(),
  }];
  const sampleBookings = [{
    id: "BK-MIGRATION-01",
    customerEmail: "migration.test@example.com",
    customerName: "Migration User",
    container: "MSCU 123456-7",
    driver: "Driver One",
    contact: "+63 917 000 0000",
    plate: "ABC 1234",
    cargo: "Test cargo",
    company: "Test Company",
    size: "40FT",
    date: "2027-01-10",
    time: "09:00 AM",
    slot: "A-01",
    fee: 2500,
    status: "Pending Payment",
    paymentStatus: "Unpaid",
    method: "GCash",
    reference: "MIG-001",
    proof: "migration-proof.png",
    proofFile: "migration-proof.png",
    proofContentType: "image/png",
    gatePass: "GP-MIGRATION-01",
    gatePassIssued: false,
    activity: "migration test",
    createdAt: new Date().toISOString(),
  }];

  await saveAccounts(sampleAccounts);
  await saveBookings(sampleBookings);
  await saveAccounts(sampleAccounts);
  await saveBookings(sampleBookings);

  const persistedAccounts = await listAccounts();
  const persistedBookings = await listBookings();

  assert.ok(persistedAccounts.some((account) => account.email === sampleAccounts[0].email));
  assert.ok(persistedBookings.some((booking) => booking.id === sampleBookings[0].id));
});

runIfDb("sessions can be persisted and cleaned up", async () => {
  const sessionId = `session-${Date.now()}`;
  await saveSessionRecord({
    id: sessionId,
    email: "session.test@example.com",
    role: "Customer",
    expiresAt: Date.now() + 60_000,
  });

  const row = await getSessionRecord(sessionId);
  assert.ok(row);
  assert.equal(row.email, "session.test@example.com");

  await deleteSessionRecord(sessionId);
  const deleted = await getSessionRecord(sessionId);
  assert.equal(deleted, null);
});

runIfDb("drivers, companies, slot overrides, and activity logs create shared records", async () => {
  await saveDrivers([{ name: "Driver Alpha", contact: "+63 917 111 1111", plate: "ABC 9999", company: "Alpha Haulage" }]);
  await saveCompanies([{ name: "Alpha Haulage", contact: "sales@alphahaulage.test" }]);
  await saveSlotOverride({ slotKey: "A-99", status: "Occupied", note: "For test" });
  await addActivityLog({ actorEmail: "admin@example.com", action: "migration-test", details: { ok: true } });

  const drivers = await listDrivers();
  const companies = await listCompanies();
  const overrides = await listSlotOverrides();
  const logs = await listActivityLogs();

  assert.ok(drivers.some((entry) => entry.name === "Driver Alpha"));
  assert.ok(companies.some((entry) => entry.name === "Alpha Haulage"));
  assert.ok(overrides.some((entry) => entry.slotKey === "A-99"));
  assert.ok(logs.some((entry) => entry.action === "migration-test"));
});

if (!dbConfigured) {
  test("database-backed tests are skipped when PostgreSQL is not configured", () => {
    assert.equal(isDatabaseConfigured(), false);
  });
}
