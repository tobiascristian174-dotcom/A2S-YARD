require("dotenv").config();

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { promisify } = require("node:util");
const QRCode = require("qrcode");
const {
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
} = require("./db");

const scrypt = promisify(crypto.scrypt);
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 8000);
const DATA_DIRECTORY = path.resolve(process.env.A2S_DATA_DIR || path.join(__dirname, "data"));
const ACCOUNTS_FILE = path.join(DATA_DIRECTORY, "accounts.json");
const BOOKINGS_FILE = path.join(DATA_DIRECTORY, "bookings.json");
const PAYMENT_PROOFS_DIRECTORY = path.resolve(process.env.PAYMENT_PROOF_STORAGE_DIR || path.join(DATA_DIRECTORY, "payment-proofs"));
const MAX_BODY_BYTES = 16 * 1024;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PASSWORD_HASH_BYTES = 64;
const SESSION_COOKIE = "a2s_session";
const ADMIN_SESSION_COOKIE = "a2s_admin_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const ACCOUNT_ROLES = ["Administrator", "Customer", "Yard Staff", "Gate Personnel"];

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

let accountMutationQueue = Promise.resolve();
let bookingMutationQueue = Promise.resolve();
const rateLimitStore = new Map();
const ARRIVAL_TIMES = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"];
const CONTAINER_STATUSES = ["Pending Payment", "Payment Verified", "Booking Confirmed", "Scheduled", "Arrived at Yard", "Inside Yard", "Released", "Completed"];
const PAYMENT_STATUSES = ["Unpaid", "Awaiting verification", "Approved", "Rejected"];
const PAYMENT_METHODS = ["GCash", "Maya", "QR Ph", "Bank Transfer"];

function isBookingStore(value) {
  return value !== null
    && typeof value === "object"
    && value.format === "a2s-yard-bookings"
    && value.version === 1
    && Array.isArray(value.bookings)
    && value.bookings.every((booking) => (
      booking !== null
      && typeof booking === "object"
      && typeof booking.id === "string"
      && typeof booking.customerEmail === "string"
      && typeof booking.container === "string"
      && typeof booking.date === "string"
      && typeof booking.time === "string"
      && typeof booking.slot === "string"
      && typeof booking.paymentStatus === "string"
      && typeof booking.status === "string"
    ));
}

async function writeBookingStore(store) {
  if (isDatabaseConfigured()) {
    await saveBookings(store.bookings || []);
    return;
  }

  const temporaryFile = `${BOOKINGS_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryFile, JSON.stringify(store, null, 2), { flag: "wx", mode: 0o600 });
    await fs.rename(temporaryFile, BOOKINGS_FILE);
  } catch (error) {
    await fs.rm(temporaryFile, { force: true }).catch(() => {});
    throw error;
  }
}

async function readBookingStore() {
  if (isDatabaseConfigured()) {
    const bookings = await listBookings();
    return { format: "a2s-yard-bookings", version: 1, bookings };
  }

  let contents;
  try {
    contents = await fs.readFile(BOOKINGS_FILE, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      const emptyStore = { format: "a2s-yard-bookings", version: 1, bookings: [] };
      await writeBookingStore(emptyStore);
      return emptyStore;
    }
    throw error;
  }
  let store;
  try {
    store = JSON.parse(contents);
  } catch (error) {
    throw new Error("The shared booking file contains invalid JSON.", { cause: error });
  }
  if (!isBookingStore(store)) throw new Error("The shared booking file has an unsupported format or invalid data.");
  return store;
}

function mutateBookingStore(mutation) {
  const operation = bookingMutationQueue.then(async () => {
    const store = await readBookingStore();
    const result = await mutation(store);
    await writeBookingStore(store);
    return result;
  });
  bookingMutationQueue = operation.then(() => undefined, () => undefined);
  return operation;
}

async function getAuthenticatedAccount(request, administratorOnly = false) {
  const current = await getSession(request, administratorOnly);
  if (!current) return null;
  const store = await readAccountStore();
  const account = store.accounts.find((entry) => entry.email === current.session.email);
  if (!account) {
    await deleteSessionRecord(current.sessionId);
  }
  return account || null;
}

function publicBooking(booking) {
  return { ...booking, sharedRecord: true };
}

function isAccountStore(value) {
  return value !== null
    && typeof value === "object"
    && value.format === "a2s-yard-accounts"
    && value.version === 1
    && Array.isArray(value.accounts)
    && value.accounts.every((account) => (
      account !== null
      && typeof account === "object"
      && typeof account.name === "string"
      && typeof account.company === "string"
      && typeof account.email === "string"
      && (account.role === undefined || ACCOUNT_ROLES.includes(account.role))
      && typeof account.passwordSalt === "string"
      && typeof account.passwordHash === "string"
      && typeof account.createdAt === "string"
    ));
}

async function writeAccountStore(store) {
  if (isDatabaseConfigured()) {
    await saveAccounts(store.accounts || []);
    return;
  }

  const temporaryFile = `${ACCOUNTS_FILE}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryFile, JSON.stringify(store, null, 2), { flag: "wx", mode: 0o600 });
    await fs.rename(temporaryFile, ACCOUNTS_FILE);
  } catch (error) {
    await fs.rm(temporaryFile, { force: true }).catch(() => {});
    throw error;
  }
}

async function readAccountStore() {
  if (isDatabaseConfigured()) {
    const accounts = await listAccounts();
    return { format: "a2s-yard-accounts", version: 1, accounts };
  }

  let contents;
  try {
    contents = await fs.readFile(ACCOUNTS_FILE, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") {
      const emptyStore = { format: "a2s-yard-accounts", version: 1, accounts: [] };
      await writeAccountStore(emptyStore);
      return emptyStore;
    }
    throw error;
  }

  let store;
  try {
    store = JSON.parse(contents);
  } catch (error) {
    throw new Error("The local account file contains invalid JSON.", { cause: error });
  }
  if (!isAccountStore(store)) {
    throw new Error("The local account file has an unsupported format or invalid data.");
  }
  return store;
}

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...extraHeaders,
  });
  response.end(JSON.stringify(body));
}

async function logActivitySafely(actorEmail, action, details = {}) {
  try {
    const stored = await addActivityLog({ actorEmail, action, details });
    if (!stored) {
      process.stderr.write(`Activity log was not stored for "${action}": PostgreSQL is not configured.\n`);
    }
  } catch {
    process.stderr.write(`Activity log write failed for "${action}".\n`);
  }
}

async function readRequestBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Please submit valid signup details.");
    error.status = 400;
    throw error;
  }
}

function validateSignup(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Please submit valid signup details." };
  }
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const company = typeof payload.company === "string" ? payload.company.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload.password === "string" ? payload.password : "";

  if (name.length < 2 || name.length > 100) {
    return { field: "name", error: "Enter a name between 2 and 100 characters." };
  }
  if (company.length < 2 || company.length > 120) {
    return { field: "company", error: "Enter a company name between 2 and 120 characters." };
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { field: "email", error: "Enter a valid email address." };
  }
  if (password.length < 8 || password.length > 128) {
    return { field: "password", error: "Use a password between 8 and 128 characters." };
  }
  if (payload.termsAccepted !== true) {
    return { error: "Please accept the Terms of Service and Privacy Policy." };
  }

  return { name, company, email, password };
}

async function createAccount(details) {
  const salt = crypto.randomBytes(16);
  const passwordHash = await scrypt(details.password, salt, PASSWORD_HASH_BYTES);
  const account = {
    name: details.name,
    company: details.company,
    email: details.email,
    role: "Customer",
    passwordSalt: salt.toString("hex"),
    passwordHash: passwordHash.toString("hex"),
    createdAt: new Date().toISOString(),
  };

  const mutation = accountMutationQueue.then(async () => {
    const store = await readAccountStore();
    if (store.accounts.some((entry) => entry.email === details.email)) {
      return false;
    }
    store.accounts.push(account);
    await writeAccountStore(store);
    return true;
  });
  accountMutationQueue = mutation.then(() => undefined, () => undefined);
  const created = await mutation;
  return created ? account : null;
}

async function provisionAdministrator() {
  const configuredEmail = process.env.A2S_ADMIN_EMAIL;
  const configuredPassword = process.env.A2S_ADMIN_PASSWORD;
  const configuredName = process.env.A2S_ADMIN_NAME?.trim();
  if (!configuredEmail && !configuredPassword) return;
  if (!configuredEmail || !configuredPassword) {
    throw new Error("Set both A2S_ADMIN_EMAIL and A2S_ADMIN_PASSWORD to provision the administrator account.");
  }

  if (configuredName && (configuredName.length < 2 || configuredName.length > 100)) {
    throw new Error("A2S_ADMIN_NAME must be between 2 and 100 characters.");
  }

  const email = configuredEmail.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A2S_ADMIN_EMAIL must be a valid email address.");
  }
  if (configuredPassword.length < 12 || configuredPassword.length > 128) {
    throw new Error("A2S_ADMIN_PASSWORD must be between 12 and 128 characters.");
  }

  const store = await readAccountStore();
  const existing = store.accounts.find((account) => account.email === email);
  if (existing?.role === "Administrator") return;

  const salt = crypto.randomBytes(16);
  const passwordHash = await scrypt(configuredPassword, salt, PASSWORD_HASH_BYTES);
  const administrator = {
    name: configuredName || existing?.name || "A2S Yard Administrator",
    company: existing?.company || "A2S Yard",
    email,
    role: "Administrator",
    passwordSalt: salt.toString("hex"),
    passwordHash: passwordHash.toString("hex"),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  if (existing) {
    store.accounts = store.accounts.map((account) => account.email === email ? administrator : account);
  } else {
    store.accounts.push(administrator);
  }
  await writeAccountStore(store);
  process.stdout.write(`Provisioned administrator account: ${email}\n`);
}

function getCookieValue(request, cookieName) {
  const cookies = request.headers.cookie || "";
  const cookie = cookies
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`));
  if (!cookie) return null;
  return decodeURIComponent(cookie.slice(cookieName.length + 1));
}

function getClientIp(request) {
  const forwarded = request.headers["x-forwarded-for"] || "";
  const remote = request.socket && request.socket.remoteAddress ? request.socket.remoteAddress : "unknown";
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim() || remote;
  return remote;
}

function checkRateLimit(request, pathKey, limit = 5, windowMs = 60 * 1000) {
  const key = `${getClientIp(request)}:${pathKey}`;
  const now = Date.now();
  const bucket = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (bucket.resetAt <= now) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateLimitStore.set(key, bucket);
  return bucket.count <= limit;
}

function getCookieOptions() {
  const secure = process.env.NODE_ENV === "production" || process.env.SECURE_COOKIES === "true";
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_LIFETIME_SECONDS}${secure ? "; Secure" : ""}`;
}

async function startSession(account, response, administratorOnly = false) {
  const sessionId = crypto.randomBytes(32).toString("hex");
  const csrfToken = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000).toISOString();
  await saveSessionRecord({
    id: sessionId,
    email: account.email,
    role: account.role || "Customer",
    csrfToken,
    expiresAt,
    data: { administratorOnly },
  });
  const cookieName = administratorOnly ? ADMIN_SESSION_COOKIE : SESSION_COOKIE;
  response.setHeader("Set-Cookie", `${cookieName}=${sessionId}; ${getCookieOptions()}`);
  response.setHeader("X-CSRF-Token", csrfToken);
}

async function getSession(request, administratorOnly = false) {
  const cookieName = administratorOnly ? ADMIN_SESSION_COOKIE : SESSION_COOKIE;
  const sessionId = getCookieValue(request, cookieName);
  if (!sessionId) return null;

  const session = await getSessionRecord(sessionId);
  if (!session) return null;

  const isAdminSession = Boolean(session.data?.administratorOnly);
  if (administratorOnly !== isAdminSession) return null;
  return { sessionId, session };
}

async function handleSignup(request, response) {
  if (!checkRateLimit(request, "signup", 8, 60 * 1000)) {
    sendJson(response, 429, { error: "Too many signup attempts. Please wait a minute and try again." });
    return;
  }

  if (!request.headers["content-type"]?.startsWith("application/json")) {
    sendJson(response, 415, { error: "Signup details must be sent as JSON." });
    return;
  }

  let payload;
  try {
    payload = await readRequestBody(request);
  } catch (error) {
    sendJson(response, error.status || 400, { error: error.message });
    return;
  }

  const details = validateSignup(payload);
  if (details.error) {
    sendJson(response, 400, { error: details.error, field: details.field });
    return;
  }

  const account = await createAccount(details);
  if (!account) {
    sendJson(response, 409, {
      error: "An account with this email already exists. Use a different email address.",
      field: "email",
      code: "EMAIL_EXISTS",
    });
    return;
  }

  sendJson(response, 201, { name: account.name, email: account.email });
}

async function handleSignin(request, response, administratorOnly = false) {
  if (!checkRateLimit(request, administratorOnly ? "admin-signin" : "signin", 6, 60 * 1000)) {
    sendJson(response, 429, { error: "Too many sign-in attempts. Please wait a minute and try again." });
    return;
  }

  if (!request.headers["content-type"]?.startsWith("application/json")) {
    sendJson(response, 415, { error: "Sign-in details must be sent as JSON." });
    return;
  }

  let payload;
  try {
    payload = await readRequestBody(request);
  } catch (error) {
    sendJson(response, error.status || 400, { error: error.message });
    return;
  }

  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const password = typeof payload?.password === "string" ? payload.password : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length === 0 || password.length > 128) {
    sendJson(response, 400, { error: "Enter a valid email address and password." });
    return;
  }

  const store = await readAccountStore();
  const account = store.accounts.find((entry) => entry.email === email);
  let passwordMatches = false;
  if (account) {
    const salt = Buffer.from(account.passwordSalt, "hex");
    const expectedHash = Buffer.from(account.passwordHash, "hex");
    if (salt.length === 16 && expectedHash.length === PASSWORD_HASH_BYTES) {
      const actualHash = await scrypt(password, salt, PASSWORD_HASH_BYTES);
      passwordMatches = crypto.timingSafeEqual(expectedHash, actualHash);
    }
  }

  if (!account || !passwordMatches) {
    sendJson(response, 401, { error: "Email or password is incorrect. Check your details or create an account with a new email." });
    return;
  }

  if (administratorOnly && account.role !== "Administrator") {
    sendJson(response, 403, { error: "This app is restricted to Administrator accounts." });
    return;
  }

  await startSession(account, response, administratorOnly);
  await logActivitySafely(account.email, "user_login", {
    role: account.role || "Customer",
    administratorSession: administratorOnly,
  });
  sendJson(response, 200, {
    name: account.name,
    company: account.company,
    email: account.email,
    role: account.role || "Customer",
  });
}

async function handleSession(request, response, administratorOnly = false) {
  const current = await getSession(request, administratorOnly);
  if (!current) {
    sendJson(response, 200, { authenticated: false });
    return;
  }

  const store = await readAccountStore();
  const account = store.accounts.find((entry) => entry.email === current.session.email);
  if (!account) {
    await deleteSessionRecord(current.sessionId);
    sendJson(response, 200, { authenticated: false });
    return;
  }
  if (administratorOnly && account.role !== "Administrator") {
    sendJson(response, 200, { authenticated: false });
    return;
  }
  sendJson(response, 200, {
    authenticated: true,
    user: {
      name: account.name,
      company: account.company,
      email: account.email,
      role: account.role || "Customer",
    },
  });
}

async function handleSignout(request, response, administratorOnly = false) {
  const current = await getSession(request, administratorOnly);
  if (current) {
    await deleteSessionRecord(current.sessionId);
    await logActivitySafely(current.session.email, "user_logout", {
      role: current.session.role || "Customer",
      administratorSession: administratorOnly,
    });
  }
  const cookieName = administratorOnly ? ADMIN_SESSION_COOKIE : SESSION_COOKIE;
  const secure = process.env.NODE_ENV === "production" || process.env.SECURE_COOKIES === "true";
  sendJson(response, 200, { signedOut: true }, {
    "Set-Cookie": `${cookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secure ? "; Secure" : ""}`,
  });
}

function validateBooking(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "Please submit valid booking details." };
  }
  const fields = ["container", "driver", "contact", "plate", "cargo", "company", "size", "date", "time", "slot"];
  const booking = Object.fromEntries(fields.map((field) => [field, typeof payload[field] === "string" ? payload[field].trim() : ""]));
  const limits = { container: 20, driver: 100, contact: 20, plate: 15, cargo: 120, company: 100, slot: 12 };
  for (const [field, limit] of Object.entries(limits)) {
    if (!booking[field] || booking[field].length > limit) return { error: `Enter a valid ${field} (maximum ${limit} characters).` };
  }
  if (!["20FT", "40FT"].includes(booking.size)) return { error: "Choose a valid container size." };
  const parsedDate = new Date(`${booking.date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== booking.date) {
    return { error: "Choose a valid arrival date." };
  }
  if (!ARRIVAL_TIMES.includes(booking.time)) return { error: "Choose a valid arrival time." };
  if (!/^[A-Z0-9]{1,6}-[A-Z0-9]{1,6}$/i.test(booking.slot)) return { error: "Choose a valid yard slot." };
  booking.container = booking.container.toUpperCase();
  booking.slot = booking.slot.toUpperCase();
  return { booking };
}

async function handleBookingRequest(request, response, url) {
  const administratorOnly = url.pathname.startsWith("/api/admin/");
  const routePath = administratorOnly ? `/api${url.pathname.slice("/api/admin".length)}` : url.pathname;
  const account = await getAuthenticatedAccount(request, administratorOnly);
  if (!account) {
    sendJson(response, 401, { error: "Sign in before accessing bookings." });
    return;
  }

  if (routePath === "/api/bookings" && request.method === "GET") {
    const store = await readBookingStore();
    const bookings = account.role === "Administrator"
      ? store.bookings
      : store.bookings.filter((booking) => booking.customerEmail === account.email);
    sendJson(response, 200, { bookings: bookings.map(publicBooking) });
    return;
  }

  if (routePath === "/api/bookings" && request.method === "POST") {
    if (account.role !== "Customer") {
      sendJson(response, 403, { error: "Only customer accounts can create bookings." });
      return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, { error: "Booking details must be sent as JSON." });
      return;
    }
    let payload;
    try {
      payload = await readRequestBody(request);
    } catch (error) {
      sendJson(response, error.status || 400, { error: error.message });
      return;
    }
    const validation = validateBooking(payload);
    if (validation.error) {
      sendJson(response, 400, { error: validation.error });
      return;
    }
    const booking = await mutateBookingStore((store) => {
      const conflict = store.bookings.some((existing) => (
        existing.customerEmail === account.email
        && existing.date === validation.booking.date
        && existing.time === validation.booking.time
        && existing.slot === validation.booking.slot
        && !["Rejected", "Cancelled"].includes(existing.paymentStatus)
      ));
      if (conflict) return null;
      const id = `BK-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      const created = {
        ...validation.booking,
        company: account.company,
        id,
        fee: validation.booking.size === "40FT" ? 2500 : 1800,
        customerEmail: account.email,
        status: "Pending Payment",
        paymentStatus: "Unpaid",
        method: "",
        reference: "",
        proof: "",
        proofFile: "",
        gatePass: `GP-${id.slice(3)}`,
        gatePassIssued: false,
        activity: "Booking created; payment required",
      };
      store.bookings.unshift(created);
      return created;
    });
    if (!booking) {
      sendJson(response, 409, { error: "That slot was just booked for this account. Choose another slot." });
      return;
    }
    await logActivitySafely(account.email, "booking_created", {
      bookingId: booking.id,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
    });
    sendJson(response, 201, { booking: publicBooking(booking) });
    return;
  }

  const bookingRoute = routePath.match(/^\/api\/bookings\/([A-Za-z0-9-]+)(?:\/(payment))?$/);
  if (!bookingRoute) {
    sendJson(response, 404, { error: "Booking endpoint not found." });
    return;
  }
  const [, id, subresource] = bookingRoute;
  if (subresource === "payment" && request.method === "POST") {
    if (account.role !== "Customer") {
      sendJson(response, 403, { error: "Only the booking customer can submit payment proof." });
      return;
    }
    const store = await readBookingStore();
    const booking = store.bookings.find((item) => item.id === id && item.customerEmail === account.email);
    if (!booking) {
      sendJson(response, 404, { error: "Booking record not found." });
      return;
    }
    let multipart;
    try {
      multipart = await readMultipartForm(request);
    } catch (error) {
      sendJson(response, error.status || 400, { error: error.message });
      return;
    }
    const method = multipart.fields.method;
    const reference = (multipart.fields.reference || "").trim();
    if (!PAYMENT_METHODS.includes(method) || !reference || reference.length > 80 || !multipart.file) {
      sendJson(response, 400, { error: "Select a payment method, enter a valid reference, and attach proof." });
      return;
    }
    if (!["Unpaid", "Rejected"].includes(booking.paymentStatus)) {
      sendJson(response, 409, { error: "This booking is not accepting a payment submission." });
      return;
    }
    const detected = detectProofType(multipart.file.data);
    if (!detected) {
      sendJson(response, 400, { error: "Proof must be a valid PDF, PNG, or JPEG file." });
      return;
    }
    const proofFile = `${crypto.randomUUID()}${detected.extension}`;
    const proofPath = path.join(PAYMENT_PROOFS_DIRECTORY, proofFile);
    await fs.writeFile(proofPath, multipart.file.data, { flag: "wx", mode: 0o600 });
    try {
      const updated = await mutateBookingStore((currentStore) => {
        const current = currentStore.bookings.find((item) => item.id === id && item.customerEmail === account.email);
        if (!current || !["Unpaid", "Rejected"].includes(current.paymentStatus)) return null;
        const oldProofFile = current.proofFile;
        Object.assign(current, {
          method,
          reference,
          proof: sanitizeOriginalFilename(multipart.file.filename),
          proofFile,
          proofContentType: detected.contentType,
          paymentStatus: "Awaiting verification",
          status: "Pending Payment",
          gatePassIssued: false,
          activity: "Proof of payment submitted for verification",
        });
        return { booking: current, oldProofFile };
      });
      if (!updated) {
        await fs.rm(proofPath, { force: true });
        sendJson(response, 409, { error: "This booking changed while payment proof was being submitted. Refresh and try again." });
        return;
      }
      if (updated.oldProofFile && updated.oldProofFile !== proofFile) {
        await fs.rm(path.join(PAYMENT_PROOFS_DIRECTORY, path.basename(updated.oldProofFile)), { force: true });
      }
      await logActivitySafely(account.email, "payment_proof_submitted", {
        bookingId: updated.booking.id,
        paymentStatus: updated.booking.paymentStatus,
      });
      sendJson(response, 200, { booking: publicBooking(updated.booking) });
    } catch (error) {
      await fs.rm(proofPath, { force: true });
      throw error;
    }
    return;
  }

  if (request.method === "PATCH") {
    if (account.role !== "Administrator") {
      sendJson(response, 403, { error: "Administrator access is required to update bookings." });
      return;
    }
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, { error: "Booking updates must be sent as JSON." });
      return;
    }
    let payload;
    try {
      payload = await readRequestBody(request);
    } catch (error) {
      sendJson(response, error.status || 400, { error: error.message });
      return;
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      sendJson(response, 400, { error: "Please submit a valid booking update." });
      return;
    }
    const updated = await mutateBookingStore((store) => {
      const booking = store.bookings.find((item) => item.id === id);
      if (!booking) return null;
      if (Object.keys(payload).some((key) => !["paymentStatus", "status", "gatePassIssued"].includes(key))) return false;
      let nextPaymentStatus = booking.paymentStatus;
      let nextStatus = booking.status;
      if (payload.paymentStatus !== undefined) {
        if (!PAYMENT_STATUSES.includes(payload.paymentStatus) || booking.paymentStatus !== "Awaiting verification") return false;
        nextPaymentStatus = payload.paymentStatus;
        nextStatus = payload.paymentStatus === "Approved" ? "Booking Confirmed" : "Pending Payment";
      }
      if (payload.status !== undefined) {
        if (!CONTAINER_STATUSES.includes(payload.status)) return false;
        nextStatus = payload.status;
      }
      if (["Booking Confirmed", "Scheduled", "Arrived at Yard", "Inside Yard", "Released", "Completed"].includes(nextStatus)
        && nextPaymentStatus !== "Approved") return false;
      if (payload.gatePassIssued !== undefined) {
        if (typeof payload.gatePassIssued !== "boolean") return false;
        if (payload.gatePassIssued
          && (nextPaymentStatus !== "Approved" || !["Booking Confirmed", "Scheduled"].includes(nextStatus))) return false;
        if (!payload.gatePassIssued && !["Booking Confirmed", "Scheduled"].includes(nextStatus)) return false;
      }
      if (payload.paymentStatus !== undefined) {
        booking.paymentStatus = payload.paymentStatus;
        booking.activity = payload.paymentStatus === "Approved"
          ? "Payment verified; booking confirmed"
          : "Payment proof rejected; resubmission required";
        if (payload.paymentStatus === "Approved") {
          booking.gatePass ||= `GP-${booking.id.slice(3)}`;
          booking.gatePassIssued = true;
          booking.gatePassIssuedAt = new Date().toISOString();
          delete booking.gatePassRevokedAt;
        } else {
          booking.gatePassIssued = false;
          booking.gatePassRevokedAt = new Date().toISOString();
        }
      }
      if (payload.status !== undefined) {
        booking.status = payload.status;
        booking.activity = `Status updated to ${payload.status}`;
      }
      if (payload.paymentStatus !== undefined && payload.status === undefined) booking.status = nextStatus;
      if (payload.gatePassIssued !== undefined) {
        booking.gatePassIssued = payload.gatePassIssued;
        if (payload.gatePassIssued) {
          booking.gatePass ||= `GP-${booking.id.slice(3)}`;
          booking.gatePassIssuedAt = new Date().toISOString();
          delete booking.gatePassRevokedAt;
        } else {
          booking.gatePassRevokedAt = new Date().toISOString();
        }
      }
      return booking;
    });
    if (updated === null) {
      sendJson(response, 404, { error: "Booking record not found." });
    } else if (updated === false) {
      sendJson(response, 409, { error: "That update is not valid for the booking's current payment or yard status." });
    } else {
      if (payload.paymentStatus === "Approved") {
        await logActivitySafely(account.email, "payment_verified", {
          bookingId: updated.id,
          paymentStatus: updated.paymentStatus,
          bookingStatus: updated.status,
          bookingApproved: updated.status === "Booking Confirmed",
        });
      } else if (payload.paymentStatus === "Rejected") {
        await logActivitySafely(account.email, "payment_rejected", {
          bookingId: updated.id,
          paymentStatus: updated.paymentStatus,
          bookingStatus: updated.status,
        });
      } else if (payload.status === "Booking Confirmed") {
        await logActivitySafely(account.email, "booking_approved", {
          bookingId: updated.id,
          status: updated.status,
        });
      }
      sendJson(response, 200, { booking: publicBooking(updated) });
    }
    return;
  }

  if (request.method === "DELETE") {
    if (account.role !== "Administrator") {
      sendJson(response, 403, { error: "Administrator access is required to remove bookings." });
      return;
    }
    const removed = await mutateBookingStore((store) => {
      const index = store.bookings.findIndex((item) => item.id === id);
      if (index < 0) return null;
      return store.bookings.splice(index, 1)[0];
    });
    if (!removed) {
      sendJson(response, 404, { error: "Booking record not found." });
      return;
    }
    if (removed.proofFile) {
      await fs.rm(path.join(PAYMENT_PROOFS_DIRECTORY, path.basename(removed.proofFile)), { force: true });
    }
    await logActivitySafely(account.email, "booking_removed", {
      bookingId: removed.id,
      previousStatus: removed.status,
      previousPaymentStatus: removed.paymentStatus,
    });
    sendJson(response, 200, { deleted: true });
    return;
  }
  sendJson(response, 405, { error: "Method not allowed." }, { Allow: subresource ? "POST" : "GET, POST, PATCH, DELETE" });
}

async function readMultipartForm(request) {
  const contentType = request.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!contentType.toLowerCase().startsWith("multipart/form-data") || !boundaryMatch) {
    const error = new Error("Payment proof must use multipart form data.");
    error.status = 415;
    throw error;
  }
  const boundary = boundaryMatch[1] || boundaryMatch[2].trim();
  const body = await readRequestBuffer(request, MAX_PROOF_BYTES + 64 * 1024);
  const delimiter = Buffer.from(`--${boundary}`);
  const separator = Buffer.from("\r\n\r\n");
  const fields = {};
  let file = null;
  let cursor = body.indexOf(delimiter);
  while (cursor >= 0) {
    cursor += delimiter.length;
    if (body.subarray(cursor, cursor + 2).toString() === "--") break;
    if (body.subarray(cursor, cursor + 2).toString() === "\r\n") cursor += 2;
    const headerEnd = body.indexOf(separator, cursor);
    if (headerEnd < 0) break;
    const headers = body.subarray(cursor, headerEnd).toString("latin1");
    const nextBoundary = body.indexOf(delimiter, headerEnd + separator.length);
    if (nextBoundary < 0) break;
    let contentEnd = nextBoundary;
    if (body.subarray(contentEnd - 2, contentEnd).toString() === "\r\n") contentEnd -= 2;
    const content = body.subarray(headerEnd + separator.length, contentEnd);
    const disposition = headers.match(/content-disposition:\s*form-data;([^\r\n]+)/i)?.[1] || "";
    const fieldName = disposition.match(/(?:^|;)\s*name="([^"]*)"/i)?.[1];
    const filename = disposition.match(/(?:^|;)\s*filename="([^"]*)"/i)?.[1];
    if (fieldName && filename !== undefined) {
      if (fieldName === "proof") {
        if (content.length > MAX_PROOF_BYTES) {
          const error = new Error("Payment proof must be 5 MB or smaller.");
          error.status = 413;
          throw error;
        }
        file = { filename, data: content };
      }
    } else if (fieldName) {
      fields[fieldName] = content.toString("utf8");
    }
    cursor = nextBoundary;
  }
  return { fields, file };
}

async function readRequestBuffer(request, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error("Request body is too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function detectProofType(buffer) {
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return { extension: ".pdf", contentType: "application/pdf" };
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: ".png", contentType: "image/png" };
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: ".jpg", contentType: "image/jpeg" };
  return null;
}

function sanitizeOriginalFilename(filename) {
  const basename = path.basename(String(filename || "").replace(/\\/g, "/"));
  const sanitized = basename.replace(/[\u0000-\u001f\u007f"<>]/g, "").trim().slice(0, 120);
  return sanitized || "payment-proof";
}

async function servePaymentProof(request, response, proofId, administratorOnly = false) {
  const account = await getAuthenticatedAccount(request, administratorOnly);
  if (!account) {
    sendJson(response, 401, { error: "Sign in to view payment proof." });
    return;
  }
  const store = await readBookingStore();
  const booking = store.bookings.find((item) => item.proofFile === proofId);
  if (!booking || (account.role !== "Administrator" && booking.customerEmail !== account.email)) {
    sendJson(response, 404, { error: "Payment proof not found." });
    return;
  }
  const filename = path.join(PAYMENT_PROOFS_DIRECTORY, path.basename(booking.proofFile));
  let contents;
  try {
    contents = await fs.readFile(filename);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "The stored payment proof is unavailable." });
      return;
    }
    throw error;
  }
  const contentType = booking.proofContentType;
  response.writeHead(200, {
    "Cache-Control": "private, no-store",
    "Content-Length": contents.length,
    "Content-Disposition": "inline",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  });
  response.end(contents);
}

async function serveGatePassQr(request, response, bookingId, administratorOnly = false) {
  const account = await getAuthenticatedAccount(request, administratorOnly);
  if (!account) {
    sendJson(response, 401, { error: "Sign in to view this gate pass." });
    return;
  }
  const store = await readBookingStore();
  const booking = store.bookings.find((item) => item.id === bookingId);
  if (!booking || (account.role !== "Administrator" && booking.customerEmail !== account.email)) {
    sendJson(response, 404, { error: "Gate pass not found." });
    return;
  }
  const active = booking.gatePassIssued !== false
    && Boolean(booking.gatePass)
    && booking.paymentStatus === "Approved"
    && ["Booking Confirmed", "Scheduled", "Arrived at Yard", "Inside Yard", "Released", "Completed"].includes(booking.status);
  if (!active) {
    sendJson(response, 404, { error: "No active gate pass is available for this booking." });
    return;
  }
  const image = await QRCode.toBuffer(booking.gatePass, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 280,
    color: { dark: "#10233f", light: "#ffffff" },
  });
  response.writeHead(200, {
    "Cache-Control": "private, no-store",
    "Content-Length": image.length,
    "Content-Type": "image/png",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(image);
}

async function serveStatic(pathname, response) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filename = path.resolve(__dirname, `.${decodeURIComponent(requestedPath)}`);
  if (!filename.startsWith(`${__dirname}${path.sep}`) || !contentTypes[path.extname(filename)]) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  let contents;
  try {
    contents = await fs.readFile(filename);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(response, 404, { error: "Not found." });
      return;
    }
    throw error;
  }
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": contents.length,
    "Content-Type": contentTypes[path.extname(filename)],
    "X-Content-Type-Options": "nosniff",
  });
  response.end(contents);
}

async function handleSharedRecords(request, response, url, kind) {
  const adminOnly = url.pathname.startsWith("/api/admin/");
  const account = await getAuthenticatedAccount(request, adminOnly);
  if (!account) {
    sendJson(response, 401, { error: "Sign in before accessing shared records." });
    return;
  }
  if (account.role !== "Administrator") {
    sendJson(response, 403, { error: "Administrator access is required for shared yard records." });
    return;
  }

  if (request.method === "GET") {
    const records = kind === "drivers"
      ? await listDrivers()
      : kind === "companies"
        ? await listCompanies()
        : kind === "slot-overrides"
          ? await listSlotOverrides()
          : await listActivityLogs();
    sendJson(response, 200, { [kind]: records });
    return;
  }

  if (request.method === "POST") {
    if (!request.headers["content-type"]?.startsWith("application/json")) {
      sendJson(response, 415, { error: "Record updates must use JSON." });
      return;
    }
    let payload;
    try {
      payload = await readRequestBody(request);
    } catch (error) {
      sendJson(response, error.status || 400, { error: error.message });
      return;
    }
    if (kind === "drivers") {
      const entries = Array.isArray(payload) ? payload : [payload];
      await saveDrivers(entries);
      sendJson(response, 201, { drivers: entries });
      return;
    }
    if (kind === "companies") {
      const entries = Array.isArray(payload) ? payload : [payload];
      await saveCompanies(entries);
      sendJson(response, 201, { companies: entries });
      return;
    }
    if (kind === "slot-overrides") {
      await saveSlotOverride(payload);
      sendJson(response, 201, { "slot-overrides": payload });
      return;
    }
    if (kind === "activity-logs") {
      const logRecord = payload && typeof payload === "object" ? payload : { action: "recorded" };
      await addActivityLog(logRecord);
      sendJson(response, 201, { "activity-logs": [logRecord] });
      return;
    }
  }

  sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET, POST" });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${HOST}:${PORT}`);
  const administratorGatePassRoute = url.pathname.match(/^\/api\/admin\/gatepasses\/([A-Za-z0-9-]+)\/qr$/);
  const gatePassRoute = url.pathname.match(/^\/api\/gatepasses\/([A-Za-z0-9-]+)\/qr$/);
  if ((administratorGatePassRoute || gatePassRoute) && (request.method === "GET" || request.method === "HEAD")) {
    await serveGatePassQr(request, response, (administratorGatePassRoute || gatePassRoute)[1], Boolean(administratorGatePassRoute));
    return;
  }
  if (url.pathname === "/api/bookings"
    || /^\/api\/bookings\/[A-Za-z0-9-]+(?:\/payment)?$/.test(url.pathname)
    || url.pathname === "/api/admin/bookings"
    || /^\/api\/admin\/bookings\/[A-Za-z0-9-]+(?:\/payment)?$/.test(url.pathname)) {
    await handleBookingRequest(request, response, url);
    return;
  }
  const administratorProofRoute = url.pathname.match(/^\/api\/admin\/proofs\/([a-f0-9-]+\.(?:pdf|png|jpg))$/i);
  const proofRoute = url.pathname.match(/^\/api\/proofs\/([a-f0-9-]+\.(?:pdf|png|jpg))$/i);
  if (administratorProofRoute && (request.method === "GET" || request.method === "HEAD")) {
    await servePaymentProof(request, response, administratorProofRoute[1], true);
    return;
  }
  if (proofRoute && (request.method === "GET" || request.method === "HEAD")) {
    await servePaymentProof(request, response, proofRoute[1]);
    return;
  }
  if (url.pathname === "/api/drivers" || url.pathname === "/api/admin/drivers") {
    await handleSharedRecords(request, response, url, "drivers");
    return;
  }
  if (url.pathname === "/api/companies" || url.pathname === "/api/admin/companies") {
    await handleSharedRecords(request, response, url, "companies");
    return;
  }
  if (url.pathname === "/api/slot-overrides" || url.pathname === "/api/admin/slot-overrides") {
    await handleSharedRecords(request, response, url, "slot-overrides");
    return;
  }
  if (url.pathname === "/api/activity-logs" || url.pathname === "/api/admin/activity-logs") {
    await handleSharedRecords(request, response, url, "activity-logs");
    return;
  }
  if (url.pathname === "/api/session" || url.pathname === "/api/admin/session") {
    if (request.method !== "GET") {
      sendJson(response, 405, { error: "Use GET to check your session." }, { Allow: "GET" });
      return;
    }
    await handleSession(request, response, url.pathname === "/api/admin/session");
    return;
  }
  if (url.pathname === "/api/signout" || url.pathname === "/api/admin/signout") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Use POST to sign out." }, { Allow: "POST" });
      return;
    }
    await handleSignout(request, response, url.pathname === "/api/admin/signout");
    return;
  }
  if (url.pathname === "/api/signup") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Use POST to create an account." }, { Allow: "POST" });
      return;
    }
    await handleSignup(request, response);
    return;
  }
  if (url.pathname === "/api/signin" || url.pathname === "/api/admin/signin") {
    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Use POST to sign in." }, { Allow: "POST" });
      return;
    }
    await handleSignin(request, response, url.pathname === "/api/admin/signin");
    return;
  }
  if (url.pathname === "/health") {
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Use GET to check service health." }, { Allow: "GET, HEAD" });
      return;
    }
    sendJson(response, 200, {
      ok: true,
      service: "A2S Yard",
      database: isDatabaseConfigured() ? "configured" : "json-fallback",
      timestamp: new Date().toISOString(),
    });
    return;
  }
  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Method not allowed." }, { Allow: "GET, HEAD" });
    return;
  }
  await serveStatic(url.pathname, response);
}

async function start() {
  await fs.mkdir(DATA_DIRECTORY, { recursive: true });
  await fs.mkdir(PAYMENT_PROOFS_DIRECTORY, { recursive: true });
  const databaseReady = await initializeDatabase();
  if (databaseReady) {
    process.stdout.write("PostgreSQL database initialized successfully.\n");
    await cleanupExpiredSessions();
  } else {
    process.stdout.write("No PostgreSQL environment detected; using JSON file fallback for local development.\n");
  }
  await provisionAdministrator();
  await readAccountStore();
  await readBookingStore();
  const server = http.createServer((request, response) => {
    void handleRequest(request, response).catch((error) => {
      process.stderr.write(`Request failed: ${error.message}\n`);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "The signup service encountered an error. Please try again." });
      } else {
        response.destroy(error);
      }
    });
  });
  server.listen(PORT, HOST, () => {
    process.stdout.write(`A2S Yard is running at http://${HOST}:${PORT}\n`);
  });
  const expiryTimer = setInterval(() => {
    void cleanupExpiredSessions().catch(() => {});
  }, 15 * 60 * 1000);
  expiryTimer.unref();
  server.on("close", () => clearInterval(expiryTimer));

  const shutdown = () => {
    server.close(() => {
      process.exit(0);
    });
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (require.main === module) {
  start().catch((error) => {
    process.stderr.write(`Could not start A2S Yard: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  start,
  getCookieValue,
  validateSignup,
  createAccount,
  handleSignup,
  handleSignin,
  handleSession,
  handleSignout,
  validateBooking,
  readAccountStore,
  readBookingStore,
  getSession,
  startSession,
};
