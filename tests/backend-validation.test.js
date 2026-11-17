const path = require('node:path');
const fs = require('node:fs/promises');
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.A2S_DATA_DIR = path.join(__dirname, '.tmp-data');
process.env.PAYMENT_PROOF_STORAGE_DIR = path.join(__dirname, '.tmp-proof-data');

const db = require('../db');
const server = require('../server');

function makeJsonRequest(body) {
  return {
    headers: { 'content-type': 'application/json' },
    async *[Symbol.asyncIterator]() {
      yield Buffer.from(JSON.stringify(body));
    },
  };
}

function makeResponse() {
  const headers = {};
  const response = {
    statusCode: 200,
    headersSent: false,
    writeHead(status, extra = {}) {
      this.statusCode = status;
      Object.assign(headers, extra);
      this.headersSent = true;
    },
    setHeader(name, value) {
      headers[name] = value;
    },
    end(payload) {
      this.body = payload;
      this.headersSent = true;
    },
    getHeaders() {
      return headers;
    },
  };
  return response;
}

test('database initialization stays disabled until PostgreSQL environment is configured', async () => {
  delete process.env.DATABASE_URL;
  delete process.env.PGHOST;
  delete process.env.PGUSER;
  delete process.env.PGDATABASE;
  assert.equal(db.isDatabaseConfigured(), false);
  assert.equal(await db.initializeDatabase(), false);
});

test('local account and booking stores initialize to empty valid structures', async () => {
  await fs.mkdir(process.env.A2S_DATA_DIR, { recursive: true });
  const accounts = await server.readAccountStore();
  const bookings = await server.readBookingStore();

  assert.equal(accounts.format, 'a2s-yard-accounts');
  assert.deepEqual(accounts.accounts, []);
  assert.equal(bookings.format, 'a2s-yard-bookings');
  assert.deepEqual(bookings.bookings, []);
});

test('signup validation rejects malformed or weak data but accepts valid values', () => {
  assert.match(server.validateSignup({
    name: 'A',
    company: 'North Yard',
    email: 'user@example.com',
    password: 'short',
    termsAccepted: true,
  }).error, /between 2 and 100/);

  const valid = server.validateSignup({
    name: 'Alicia Turner',
    company: 'North Yard',
    email: 'alicia@example.com',
    password: 'StrongPassword123',
    termsAccepted: true,
  });

  assert.equal(valid.error, undefined);
  assert.equal(valid.email, 'alicia@example.com');
});

test('booking validation accepts valid booking shape and rejects invalid statuses', () => {
  const valid = server.validateBooking({
    container: 'CNI-100',
    driver: 'Bryan Lee',
    contact: '09171234567',
    plate: 'ABC1234',
    cargo: 'Machinery parts',
    company: 'North Yard',
    size: '40FT',
    date: '2026-12-01',
    time: '08:00 AM',
    slot: 'A-01',
  });

  assert.equal(valid.error, undefined);
  assert.equal(valid.booking.slot, 'A-01');

  const invalid = server.validateBooking({
    container: 'CNI-100',
    driver: 'Bryan Lee',
    contact: '09171234567',
    plate: 'ABC1234',
    cargo: 'Machinery parts',
    company: 'North Yard',
    size: 'invalid',
    date: '2026-12-01',
    time: '08:00 AM',
    slot: 'A-01',
  });

  assert.match(invalid.error, /valid container size/i);
});

test('signup and signin flow work with local JSON fallback for a fresh user', async () => {
  const uniqueEmail = `tester-${Date.now()}@example.com`;
  const signupRequest = makeJsonRequest({
    name: 'Test User',
    company: 'Test Company',
    email: uniqueEmail,
    password: 'StrongPassword123',
    termsAccepted: true,
  });
  const signupResponse = makeResponse();

  await server.handleSignup(signupRequest, signupResponse);
  assert.equal(signupResponse.statusCode, 201);

  const signinRequest = makeJsonRequest({
    email: uniqueEmail,
    password: 'StrongPassword123',
  });
  const signinResponse = makeResponse();

  await server.handleSignin(signinRequest, signinResponse);
  assert.equal(signinResponse.statusCode, 200);
  const payload = JSON.parse(signinResponse.body);
  assert.equal(payload.email, uniqueEmail);
  assert.equal(payload.role, 'Customer');
});
