const authScreen = document.querySelector("#auth-screen");
const authContent = document.querySelector("#auth-content");
const appShell = document.querySelector("#app-shell");
const pageContent = document.querySelector("#page-content");
const primaryNav = document.querySelector("#primary-nav");
const dialog = document.querySelector("#app-dialog");
const dialogContent = document.querySelector("#dialog-content");
const toast = document.querySelector("#toast");
const adminOnly = document.body.dataset.adminOnly === "true";
const roles = ["Customer", "Administrator", "Yard Staff", "Gate Personnel"];
const statuses = ["Pending Payment", "Payment Verified", "Booking Confirmed", "Scheduled", "Arrived at Yard", "Inside Yard", "Released", "Completed"];
const pages = {
  dashboard: "Dashboard",
  booking: "Book a Slot",
  track: "Track a Container",
  reservations: "My Reservations",
  payments: "Payment History",
  documents: "Documents",
  profile: "My Profile",
  admin: "Admin Dashboard",
  containers: "Container Management",
  drivers: "Driver Management",
  companies: "Trucking Companies",
  paymentAdmin: "Payment Management",
  slots: "Slot Management",
  gatepasses: "Gate Pass Management",
  reports: "Reports & Analytics",
  yard: "Yard Operations",
  gate: "Gate Personnel",
  landing: "Welcome to A2S Yard",
};
const navSets = {
  Customer: ["dashboard", "booking", "reservations", "payments", "documents", "profile"],
  Administrator: ["admin", "containers", "drivers", "companies", "paymentAdmin", "slots", "gatepasses", "reports", "documents", "profile"],
  "Yard Staff": ["yard", "containers", "slots", "track", "profile"],
  "Gate Personnel": ["gate", "track", "reservations", "profile"],
};
const navIcons = { dashboard: "⌂", booking: "＋", track: "⌕", reservations: "▤", payments: "₱", documents: "▧", profile: "◉", admin: "⌂", containers: "▦", drivers: "♙", companies: "▧", paymentAdmin: "₱", slots: "▥", gatepasses: "⇄", reports: "▤", yard: "▦", gate: "⇄" };
const slotNames = ["A-01", "A-02", "A-03", "A-04", "A-05", "A-06", "B-01", "B-02", "B-03", "B-04", "B-05", "B-06", "C-01", "C-02", "C-03", "C-04"];
const arrivalTimes = ["08:00 AM", "09:00 AM", "10:00 AM", "11:00 AM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM"];
const paymentMethods = ["GCash", "Maya", "QR Ph", "Bank Transfer"];
const storageKey = "a2s-yard-prototype-v2";

let currentUser = null;
let currentRole = "Customer";
let currentPage = "dashboard";
let authMode = "signin";
let authReturnPage = null;
let selectedSlot = "";
let toastTimer;
let bookingSyncTimer;
let data = loadData();

function apiPath(pathname) {
  return adminOnly ? pathname.replace(/^\/api\//, "/api/admin/") : pathname;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  })[character]);
}

function loadData() {
  const sample = [
    { id: "BK-2026-1048", container: "MSCU 728194-5", driver: "Juan Dela Cruz", contact: "+63 917 234 1102", plate: "ABC 1234", cargo: "General merchandise", company: "Northstar Logistics", size: "40FT", date: "2026-11-14", time: "09:00 AM", slot: "A-01", fee: 2500, status: "Booking Confirmed", paymentStatus: "Approved", method: "GCash", reference: "GC-98100428", proof: "gcash-receipt.jpg", gatePass: "GP-2026-1048", activity: "Payment verified; booking confirmed" },
    { id: "BK-2026-1047", container: "TLLU 492183-2", driver: "Maria Santos", contact: "+63 918 552 0160", plate: "NCD 2851", cargo: "Packaged food products", company: "Harborline Transport", size: "20FT", date: "2026-11-14", time: "10:00 AM", slot: "A-02", fee: 1800, status: "Pending Payment", paymentStatus: "Awaiting verification", method: "Maya", reference: "M-2551930", proof: "maya-proof.png", gatePass: "GP-2026-1047", activity: "Proof of payment submitted" },
    { id: "BK-2026-1046", container: "OOLU 183746-0", driver: "Carlo Reyes", contact: "+63 905 811 7644", plate: "RFG 4410", cargo: "Construction materials", company: "Crown Haulage", size: "40FT", date: "2026-11-15", time: "01:00 PM", slot: "B-01", fee: 2500, status: "Scheduled", paymentStatus: "Approved", method: "Bank Transfer", reference: "BT-771092", proof: "bank-confirmation.pdf", gatePass: "GP-2026-1046", activity: "Arrival slot scheduled" },
    { id: "BK-2026-1045", container: "MSKU 592831-1", driver: "Ana Garcia", contact: "+63 917 211 8344", plate: "KLM 1109", cargo: "Textile goods", company: "Pacific Freight", size: "20FT", date: "2026-11-13", time: "08:00 AM", slot: "C-02", fee: 1800, status: "Inside Yard", paymentStatus: "Approved", method: "QR Ph", reference: "QR-6671902", proof: "qrph-payment.png", gatePass: "GP-2026-1045", activity: "Container checked in at Gate 2" },
    { id: "BK-2026-1044", container: "CMAU 318027-9", driver: "Miguel Lim", contact: "+63 916 673 2230", plate: "TUV 9051", cargo: "Industrial equipment", company: "Northstar Logistics", size: "40FT", date: "2026-11-12", time: "11:00 AM", slot: "A-04", fee: 2500, status: "Completed", paymentStatus: "Approved", method: "GCash", reference: "GC-550191", proof: "receipt.png", gatePass: "GP-2026-1044", activity: "Container departed; transaction completed" },
    { id: "BK-2026-1043", container: "TEMU 912640-3", driver: "Rico Bautista", contact: "+63 920 883 4077", plate: "GHI 7213", cargo: "Retail merchandise", company: "Harborline Transport", size: "20FT", date: "2026-11-16", time: "02:00 PM", slot: "B-03", fee: 1800, status: "Pending Payment", paymentStatus: "Rejected", method: "Maya", reference: "M-1135902", proof: "proof.jpg", gatePass: "GP-2026-1043", activity: "Payment proof needs resubmission" },
  ];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved && Array.isArray(saved.bookings)) {
      return {
        ...saved,
        bookings: saved.bookings,
        slotOverrides: saved.slotOverrides || {},
        drivers: saved.drivers || [],
        companies: saved.companies || [],
      };
    }
  } catch {
    // Continue with the prototype's sample records when browser storage is unavailable or invalid.
  }
  return {
    bookings: sample,
    slotOverrides: {},
  };
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(data));
    return true;
  } catch {
    notify("Your browser could not save this prototype data. Check storage availability.", "error");
    return false;
  }
}

async function syncSharedBookings(shouldRender = false) {
  if (!currentUser) return false;
  const response = await fetch(apiPath("/api/bookings"), { credentials: "same-origin", cache: "no-store" });
  const result = await response.json();
  if (!response.ok || !Array.isArray(result.bookings)) {
    throw new Error(result.error || "Could not load shared bookings.");
  }
  const previous = JSON.stringify(data.bookings.filter((booking) => booking.sharedRecord).sort((a, b) => a.id.localeCompare(b.id)));
  const incoming = [...result.bookings].sort((a, b) => a.id.localeCompare(b.id));
  data.bookings = [...result.bookings, ...data.bookings.filter((booking) => !booking.sharedRecord)];
  const changed = previous !== JSON.stringify(incoming);
  if (changed) {
    persist();
    if (shouldRender && !dialog.open && document.visibilityState === "visible") render();
  }
  return changed;
}

async function updateSharedBooking(booking, changes) {
  const response = await fetch(apiPath(`/api/bookings/${encodeURIComponent(booking.id)}`), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    cache: "no-store",
    body: JSON.stringify(changes),
  });
  const result = await response.json();
  if (!response.ok || !result.booking) throw new Error(result.error || "Could not save booking changes.");
  Object.assign(booking, result.booking);
  persist();
  return booking;
}

function startBookingSync() {
  clearInterval(bookingSyncTimer);
  if (!currentUser) return;
  bookingSyncTimer = setInterval(() => {
    if (document.visibilityState !== "visible") return;
    syncSharedBookings(true).catch(() => notify("Could not refresh shared bookings. Check the server connection.", "error"));
  }, 10000);
}

function money(amount) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(amount) || 0);
}

function statusClass(value) {
  return `status status-${String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function badge(value) {
  return `<span class="${statusClass(value)}">${escapeHtml(value)}</span>`;
}

function shortDate(value) {
  if (!value) return "—";
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? escapeHtml(value) : parsed.toLocaleDateString("en-PH", { day: "2-digit", month: "short", year: "numeric" });
}

function visibleBookings() {
  if (currentRole === "Customer") {
    return data.bookings.filter((booking) => booking.customerEmail === currentUser?.email);
  }
  return data.bookings;
}

function availableBookings() {
  return currentRole === "Customer" ? visibleBookings() : data.bookings;
}

function statCard(label, value, caption, icon) {
  return `<article class="stat-card"><div class="stat-top"><span>${escapeHtml(label)}</span><span class="stat-icon">${icon}</span></div><strong class="stat-value">${escapeHtml(value)}</strong><div class="stat-caption">${escapeHtml(caption)}</div></article>`;
}

function heading(title, description, actions = "") {
  return `<div class="page-heading"><div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="heading-actions">${actions}</div></div>`;
}

function button(label, action, style = "button-primary", extra = "") {
  return `<button type="button" class="button ${style}" data-action="${escapeHtml(action)}" ${extra}>${label}</button>`;
}

function tableCard(title, subtitle, headers, rows, emptyText = "No records found.", tools = "") {
  const recordCount = (rows.match(/<tr\b/g) || []).length;
  return `<section class="table-card"><div class="table-card-header"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div></div><div class="table-toolbar">${tools}<label class="toolbar-search"><span class="search-mark">⌕</span><input type="search" data-table-search placeholder="Search records..." aria-label="Search records" /></label><select class="filter-select" data-status-filter aria-label="Filter by status"><option value="">All statuses</option>${statuses.map((status) => `<option>${escapeHtml(status)}</option>`).join("")}<option>Approved</option><option>Rejected</option><option>Awaiting verification</option><option>Available</option><option>Reserved</option><option>Occupied</option><option>Active</option><option>Suspended</option></select></div><div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody data-table-body>${rows || `<tr><td colspan="${headers.length}"><div class="empty-state">${escapeHtml(emptyText)}</div></td></tr>`}</tbody></table></div><div class="pagination"><span data-result-count>${recordCount} records</span><span>Prototype data</span></div></section>`;
}

function bookingRows(bookings, withActions = false) {
  return bookings.map((booking) => `<tr data-record-row data-search="${escapeHtml([booking.id, booking.container, booking.driver, booking.company, booking.status, booking.paymentStatus].join(" ").toLowerCase())}" data-status="${escapeHtml(booking.status)}"><td><strong>${escapeHtml(booking.id)}</strong><small>${escapeHtml(booking.company)}</small></td><td><strong>${escapeHtml(booking.container)}</strong><small>${escapeHtml(booking.size)} · ${escapeHtml(booking.cargo)}</small></td><td>${escapeHtml(booking.driver)}<small>${escapeHtml(booking.plate)}</small></td><td>${shortDate(booking.date)}<small>${escapeHtml(booking.time)} · ${escapeHtml(booking.slot)}</small></td><td>${badge(booking.status)}</td><td>${badge(booking.paymentStatus)}</td><td>${withActions ? `<span class="table-action"><button data-action="view-booking" data-id="${escapeHtml(booking.id)}">View</button>${booking.paymentStatus === "Awaiting verification" && currentRole === "Administrator" ? `<button data-action="approve-payment" data-id="${escapeHtml(booking.id)}">Verify payment</button>` : ""}${currentRole === "Administrator" && currentPage === "containers" ? `<button class="danger-action" data-action="remove-booking" data-id="${escapeHtml(booking.id)}" aria-label="Remove booking ${escapeHtml(booking.id)}" title="Remove booking">×</button>` : ""}</span>` : `<span class="mini-label">${escapeHtml(booking.gatePass)}</span>`}</td></tr>`).join("");
}

function renderNav() {
  const nav = navSets[currentRole] || navSets.Customer;
  primaryNav.innerHTML = nav.map((key) => `<button class="nav-item ${key === currentPage ? "active" : ""}" type="button" data-page="${key}"><span class="nav-icon">${navIcons[key] || "·"}</span><span>${escapeHtml(pages[key])}</span></button>`).join("");
  document.querySelector(".topbar-link")?.classList.toggle("hidden", adminOnly || (currentUser && currentRole === "Customer"));
  document.querySelector("#signout-button").classList.toggle("hidden", !currentUser);
  document.querySelector("#signin-button").classList.toggle("hidden", !!currentUser);
  document.querySelector("#user-name").textContent = currentUser?.name || "Account";
  document.querySelector("#user-role").textContent = currentRole;
  document.querySelector("#user-avatar").textContent = (currentUser?.name || "A").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  document.querySelector("#current-section").textContent = pages[currentPage] || "Dashboard";
}

function render() {
  const content = renderPage();
  renderNav();
  pageContent.innerHTML = content;
  document.querySelector("#sidebar").classList.remove("open");
}

function renderPage() {
  const renderers = {
    dashboard: renderCustomerDashboard,
    admin: renderAdminDashboard,
    booking: renderBooking,
    track: renderTracking,
    reservations: renderReservations,
    payments: renderPayments,
    documents: renderDocuments,
    profile: renderProfile,
    containers: renderContainers,
    paymentAdmin: renderAdminPayments,
    slots: renderSlots,
    drivers: renderDrivers,
    companies: renderCompanies,
    gatepasses: renderGatePasses,
    reports: renderReports,
    yard: renderYard,
    gate: renderGate,
    landing: renderLanding,
  };
  const allowed = navSets[currentRole] || navSets.Customer;
  if (currentPage !== "landing" && !(currentPage === "track" && !currentUser) && !allowed.includes(currentPage)) currentPage = allowed[0];
  return (renderers[currentPage] || renderCustomerDashboard)();
}

function recentActivity(bookings) {
  const recent = [...bookings].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 5);
  if (!recent.length) return `<div class="empty-state">No container activity yet.</div>`;
  return `<div class="activity-list">${recent.map((booking) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(booking.activity || booking.status)}</strong><small>${escapeHtml(booking.container)} · ${escapeHtml(booking.company)}</small><time>${shortDate(booking.date)} · ${escapeHtml(booking.time)}</time></div></div>`).join("")}</div>`;
}

function renderCustomerDashboard() {
  const list = visibleBookings();
  const pending = list.filter((booking) => booking.status === "Pending Payment").length;
  const confirmed = list.filter((booking) => ["Booking Confirmed", "Scheduled", "Inside Yard"].includes(booking.status)).length;
  const due = list.filter((booking) => booking.paymentStatus !== "Approved").reduce((sum, item) => sum + item.fee, 0);
  const recentRows = list.slice(0, 4).map((booking) => `<tr data-action="view-booking" data-id="${escapeHtml(booking.id)}" data-record-row data-search="${escapeHtml(`${booking.id} ${booking.container} ${booking.company} ${booking.status}`.toLowerCase())}" data-status="${escapeHtml(booking.status)}"><td><strong>${escapeHtml(booking.id)}</strong><small>${escapeHtml(booking.company)}</small></td><td><strong>${escapeHtml(booking.container)}</strong><small>${escapeHtml(booking.size)}</small></td><td>${shortDate(booking.date)}<small>${escapeHtml(booking.time)}</small></td><td>${badge(booking.status)}</td></tr>`).join("");
  return `${heading(`Good day, ${(currentUser?.name || "there").split(" ")[0]}`, "Here is an overview of your container yard activity.", button("＋ Book a slot", "goto-booking"))}
    <div class="stats-grid">${statCard("Total bookings", list.length, "Across your account", "▤")}${statCard("Pending reservations", pending, "Waiting for payment", "◷")}${statCard("Confirmed reservations", confirmed, "Ready for yard entry", "✓")}${statCard("Payment due", money(due), "PHP · Unverified payments", "₱")}</div>
    ${renderCustomerGatePasses(list)}
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>Recent reservations</h2><p>Your latest container bookings</p></div><button class="button button-link" type="button" data-page="reservations">View all →</button></div><div class="table-wrap"><table><thead><tr><th>Booking</th><th>Container</th><th>Arrival</th><th>Status</th></tr></thead><tbody>${recentRows || `<tr><td colspan="4"><div class="empty-state">Book your first yard slot to get started.</div></td></tr>`}</tbody></table></div></section><section class="panel"><div class="panel-header"><div><h2>Recent container activity</h2><p>Latest updates on your reservations</p></div></div><div class="panel-body">${recentActivity(list)}</div></section></div>
    <section class="panel" style="margin-top:16px"><div class="panel-header"><div><h2>Yard slot availability</h2><p>Sample live overview · slot availability is confirmed at submission</p></div><button class="button button-outline button-small" type="button" data-page="booking">View slots</button></div><div class="panel-body">${renderSlotOverview()}</div></section>`;
}

function renderCustomerGatePasses(bookings) {
  const issued = bookings.filter(isGatePassIssued);
  const rows = issued.map((booking) => `<tr data-record-row data-search="${escapeHtml(`${booking.id} ${booking.container} ${booking.date}`.toLowerCase())}" data-status="${escapeHtml(booking.status)}"><td><strong>${escapeHtml(booking.id)}</strong></td><td><strong>${escapeHtml(booking.container)}</strong></td><td>${shortDate(booking.date)}<small>${escapeHtml(booking.time)}</small></td><td>${badge(booking.status)}</td><td><button class="button button-primary button-small" data-action="customer-gatepass" data-id="${escapeHtml(booking.id)}">View gate-pass document</button></td></tr>`).join("");
  return `<section class="table-card customer-gatepasses"><div class="table-card-header"><div><h2>My gate passes</h2><p>Open the document to view your pass number, QR code, and full booking and payment details.</p></div></div><div class="table-wrap"><table><thead><tr><th>Booking</th><th>Container</th><th>Arrival</th><th>Status</th><th>Document</th></tr></thead><tbody>${rows || `<tr><td colspan="5"><div class="empty-state">No active gate passes yet. Your pass will appear here after the administrator approves your payment.</div></td></tr>`}</tbody></table></div></section>`;
}

function renderAdminBookingOverview() {
  const rows = [...data.bookings]
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
    .map((booking) => {
      const search = [
        booking.id, booking.customerEmail, booking.company, booking.container, booking.driver,
        booking.plate, booking.date, booking.time, booking.slot, booking.method,
        booking.reference, booking.paymentStatus, booking.status,
      ].join(" ").toLowerCase();
      const proofAction = booking.proofFile
        ? `<button class="button button-outline button-small" data-action="view-proof" data-proof-id="${escapeHtml(booking.proofFile)}">View proof</button>`
        : `<span class="mini-label">${escapeHtml(booking.proof || "No proof submitted")}</span>`;
      return `<tr data-record-row data-search="${escapeHtml(search)}" data-status="${escapeHtml(booking.paymentStatus)}"><td><strong>${escapeHtml(booking.id)}</strong><small>${escapeHtml(booking.customerEmail || booking.company)}</small></td><td><strong>${escapeHtml(booking.container)}</strong><small>${escapeHtml(booking.driver)} · ${escapeHtml(booking.plate)}</small></td><td>${shortDate(booking.date)}<small>${escapeHtml(booking.time)} · ${escapeHtml(booking.slot)}</small></td><td>${escapeHtml(booking.method || "—")}</td><td>${escapeHtml(booking.reference || "—")}</td><td><strong>${money(booking.fee)}</strong></td><td>${badge(booking.paymentStatus)}</td><td>${badge(booking.status)}</td><td>${proofAction}</td></tr>`;
    }).join("");
  return tableCard(
    "All customer bookings",
    `${data.bookings.length} bookings · customer, schedule, and payment details`,
    ["Booking / Customer", "Container / Driver", "Arrival / Slot", "Payment method", "Reference", "Amount", "Payment status", "Booking status", "Proof"],
    rows,
    "No customer bookings yet.",
  );
}

function renderSlotOverview() {
  return `<div class="slot-overview">${slotNames.slice(0, 10).map((slot) => {
    const status = slotStatus(slot, document.querySelector("#arrival-date")?.value);
    return `<span class="slot-chip ${status.toLowerCase()}">${escapeHtml(slot)}</span>`;
  }).join("")}</div><div class="slot-legend"><span><i class="legend-dot"></i>Available</span><span><i class="legend-dot reserved"></i>Reserved</span><span><i class="legend-dot occupied"></i>Occupied</span></div>`;
}

function renderAdminDashboard() {
  const bookings = data.bookings;
  const paidRevenue = bookings.filter((b) => b.paymentStatus === "Approved").reduce((sum, b) => sum + b.fee, 0);
  const pendingPayment = bookings.filter((b) => b.paymentStatus === "Awaiting verification").length;
  const occupied = bookings.filter((b) => ["Inside Yard", "Arrived at Yard"].includes(b.status)).length;
  const recentBookings = [...bookings].sort((a, b) => (
    Number(b.paymentStatus === "Awaiting verification") - Number(a.paymentStatus === "Awaiting verification")
    || `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)
  )).slice(0, 8);
  const controlRows = recentBookings.map((booking) => {
    const passAction = canIssueGatePass(booking)
      ? `<span class="table-action"><button data-action="issue-gatepass" data-id="${escapeHtml(booking.id)}">${isGatePassIssued(booking) ? "View pass" : "Issue pass"}</button>${isGatePassIssued(booking) ? `<button data-action="revoke-gatepass" data-id="${escapeHtml(booking.id)}">Revoke</button>` : ""}</span>`
      : `<span class="mini-label">${isGatePassIssued(booking) ? "Issued" : "Issue after payment approval"}</span>`;
    const paymentAction = booking.paymentStatus === "Awaiting verification"
      ? `<span class="table-action"><button data-action="approve-payment" data-id="${escapeHtml(booking.id)}">Approve</button><button data-action="reject-payment" data-id="${escapeHtml(booking.id)}">Reject</button></span>`
      : `<span class="mini-label">${escapeHtml(booking.paymentStatus)}</span>`;
    return `<tr><td><strong>${escapeHtml(booking.id)}</strong><small>${escapeHtml(booking.container)} · ${escapeHtml(booking.company)}</small></td><td>${shortDate(booking.date)}<small>${escapeHtml(booking.time)} · ${escapeHtml(booking.slot)}</small></td><td>${paymentAction}</td><td>${badge(booking.status)}</td><td>${passAction}</td></tr>`;
  }).join("");
  return `${heading("Administrator dashboard", "Yard-wide operations, reservations, and payment oversight.", button("Export report", "export-bookings", "button-outline"))}
    <div class="stats-grid six">${statCard("Total containers", bookings.length, "Recorded reservations", "▦")}${statCard("Available yard slots", slotNames.length - occupied, "Out of 16 sample slots", "▥")}${statCard("Occupied yard slots", occupied, "Currently in the yard", "▧")}${statCard("Pending bookings", bookings.filter((b) => b.status === "Pending Payment").length, "Payment not verified", "◷")}${statCard("Pending payments", pendingPayment, "Require review", "₱")}${statCard("Verified revenue", money(paidRevenue), "Prototype data", "↗")}</div>
    <section class="panel"><div class="panel-header"><div><h2>Yard occupancy</h2><p>Current sample allocation</p></div></div><div class="panel-body">${renderSlotOverview()}<div class="notice">Payment review is required before bookings can be confirmed.</div><button class="button button-outline button-small" data-page="paymentAdmin">Review payments</button></div></section>
    ${renderAdminBookingOverview()}
    ${tableCard("Booking and gate-pass controls", "Review payments, update booking status, and issue or revoke gate passes.", ["Booking", "Arrival", "Payment review", "Booking status", "Gate pass"], controlRows, "No bookings have been created.")}`;
}

function renderBooking() {
  selectedSlot = "";
  const today = new Date().toISOString().slice(0, 10);
  return `${heading("Book a yard slot", "Enter your container and driver details, then submit payment for verification.")}
    <form id="booking-form"><div class="booking-layout"><div class="panel">
      <section class="booking-section"><h2>Container information</h2><p>Enter details as shown on your shipping documents.</p><div class="form-grid">
        <div class="form-field"><label>Container number<input name="container" required placeholder="e.g. MSCU 728194-5" maxlength="20" /></label></div>
        <div class="form-field"><label>Container size<select name="size" required><option value="20FT">20FT</option><option value="40FT">40FT</option></select></label></div>
        <div class="form-field"><label>Cargo description<input name="cargo" required placeholder="e.g. General merchandise" maxlength="120" /></label></div>
        <div class="form-field"><label>Trucking company<input name="company" required value="${escapeHtml(currentUser?.company || "")}" placeholder="Company name" maxlength="100" /></label></div>
      </div></section>
      <section class="booking-section"><h2>Driver and vehicle</h2><p>Information used for gate verification.</p><div class="form-grid">
        <div class="form-field"><label>Driver full name<input name="driver" required placeholder="Full name" maxlength="100" /></label></div>
        <div class="form-field"><label>Driver contact number<input name="contact" required type="tel" placeholder="+63 9XX XXX XXXX" maxlength="20" /></label></div>
        <div class="form-field"><label>Truck plate number<input name="plate" required placeholder="ABC 1234" maxlength="15" /></label></div>
      </div></section>
      <section class="booking-section"><h2>Arrival schedule</h2><p>Slots are reserved per customer account for the selected date and time.</p><div class="form-grid">
        <div class="form-field"><label>Preferred arrival date<input name="date" id="arrival-date" type="date" min="${today}" required /></label></div>
        <div class="form-field"><label>Preferred arrival time<select name="time" id="arrival-time" required>${arrivalTimes.map((time) => `<option>${time}</option>`).join("")}</select></label></div>
      </div><div class="slot-picker" id="slot-picker">${renderSlotChoices()}</div><input type="hidden" name="slot" id="selected-slot" /></section>
    </div><aside class="panel"><div class="panel-header"><div><h2>Booking summary</h2><p>Fee based on container size</p></div></div><div class="panel-body"><div class="summary-row"><span>Container size</span><strong id="summary-size">20FT</strong></div><div class="summary-row"><span>Preferred date</span><strong id="summary-date">Select a date</strong></div><div class="summary-row"><span>Arrival time</span><strong id="summary-time">08:00 AM</strong></div><div class="summary-row"><span>Yard slot</span><strong id="summary-slot">Select an available slot</strong></div><div class="summary-total"><span>Booking fee</span><strong id="summary-fee">${money(1800)}</strong></div><div class="notice warning">Your reservation stays <strong>Pending Payment</strong> until an administrator verifies your payment.</div><button class="button button-primary" type="submit" style="width:100%">Continue to payment →</button><p class="mini-label" style="margin-top:10px">Prototype only: payment is not processed by a live gateway.</p></div></aside></div></form>`;
}

function bookingBlocksSlot(booking, date, time, slot) {
  const belongsToCurrentCustomer = currentRole !== "Customer"
    || Boolean(currentUser?.email && booking.customerEmail === currentUser.email);
  return belongsToCurrentCustomer
    && booking.date === date
    && booking.time === time
    && booking.slot === slot
    && !["Rejected", "Cancelled"].includes(booking.paymentStatus);
}

function slotStatus(slot, date, time = arrivalTimes[0]) {
  const override = data.slotOverrides[`${date || ""}|${time}|${slot}`];
  if (override === "Occupied") return override;
  if (!date) return override || "Available";
  const taken = data.bookings.some((booking) => bookingBlocksSlot(booking, date, time, slot));
  return taken ? "Reserved" : override || "Available";
}

function renderSlotChoices(date = "", time = arrivalTimes[0]) {
  return slotNames.map((slot) => {
    const finalState = slotStatus(slot, date, time);
    return `<button type="button" class="slot-choice ${finalState.toLowerCase()} ${selectedSlot === slot ? "selected" : ""}" data-slot="${escapeHtml(slot)}" ${finalState !== "Available" ? "disabled" : ""}>${escapeHtml(slot)}<br /><span>${escapeHtml(finalState)}</span></button>`;
  }).join("");
}

function renderTracking() {
  return `${heading("Track a container", "Search by container number or booking reference. Tracking results never expose customer contact details.", currentRole === "Customer" ? button("My reservations", "goto-reservations", "button-outline") : "")}
    <section class="panel tracking-card"><form class="tracking-form" id="tracking-form"><input name="trackingQuery" id="tracking-query" placeholder="Enter container number (e.g. MSCU 728194-5)" aria-label="Container number or booking reference" required /><button class="button button-primary" type="submit">Search container</button></form><div id="tracking-result"></div></section>
    <p class="mini-label" style="text-align:center;margin-top:12px">Public tracking shows only operational information. Driver contact and customer account information are private.</p>`;
}

function renderReservations() {
  const list = visibleBookings();
  return `${heading("My reservations", "Review booking details, payment status, and container arrival schedules.", button("＋ New booking", "goto-booking"))}${tableCard("Reservations", `${list.length} bookings on this account`, ["Booking", "Container", "Driver / Truck", "Arrival", "Booking status", "Payment", "Actions"], bookingRows(list, true), "No reservations yet. Create a booking to get started.")}`;
}

function renderPayments() {
  const list = visibleBookings();
  const rows = list.map((b) => `<tr data-record-row data-search="${escapeHtml(`${b.id} ${b.container} ${b.method} ${b.reference} ${b.paymentStatus}`.toLowerCase())}" data-status="${escapeHtml(b.paymentStatus)}"><td><strong>${escapeHtml(b.id)}</strong><small>${escapeHtml(b.container)}</small></td><td>${escapeHtml(b.method || "—")}</td><td>${escapeHtml(b.reference || "Not submitted")}</td><td><strong>${money(b.fee)}</strong></td><td>${badge(b.paymentStatus)}</td><td>${b.paymentStatus === "Rejected" || b.paymentStatus === "Unpaid" ? `<button class="button button-primary button-small" data-action="pay-booking" data-id="${escapeHtml(b.id)}">Submit payment</button>` : `<span class="mini-label">${b.paymentStatus === "Approved" ? "Receipt available" : "Under review"}</span>`}</td></tr>`).join("");
  return `${heading("Payment history", "Submit proof of payment and follow verification status.", button("Payment instructions", "payment-help", "button-outline"))}<div class="stats-grid">${statCard("Total fees", money(list.reduce((sum, b) => sum + b.fee, 0)), "Reservations on this account", "₱")}${statCard("Awaiting verification", list.filter((b) => b.paymentStatus === "Awaiting verification").length, "Usually reviewed by yard admin", "◷")}${statCard("Verified payments", list.filter((b) => b.paymentStatus === "Approved").length, "Confirmed receipts", "✓")}${statCard("Need attention", list.filter((b) => b.paymentStatus === "Rejected" || b.paymentStatus === "Unpaid").length, "Submit or update proof", "!")}</div>${tableCard("Payments", "One payment record per reservation", ["Booking", "Method", "Reference", "Amount", "Status", "Next step"], rows, "No payment records yet.")}`;
}

function renderAdminPayments() {
  const rows = data.bookings.map((b) => {
    const paymentActions = b.paymentStatus === "Awaiting verification"
      ? `<div class="payment-review-actions"><button class="button button-primary button-small" data-action="approve-payment" data-id="${escapeHtml(b.id)}">Approve</button><button class="button button-danger button-small" data-action="reject-payment" data-id="${escapeHtml(b.id)}">Reject</button></div>`
      : "";
    const proofDetails = `<div class="payment-proof-details"><span class="payment-reference">${escapeHtml(b.reference || "—")}</span><div class="payment-proof-file"><small>${escapeHtml(b.proof || "No file submitted")}</small>${b.proofFile ? `<button class="button button-outline button-small" data-action="view-proof" data-proof-id="${escapeHtml(b.proofFile)}">View proof</button>` : ""}</div></div>`;
    return `<tr data-record-row data-search="${escapeHtml(`${b.id} ${b.container} ${b.company} ${b.method} ${b.reference} ${b.paymentStatus}`.toLowerCase())}" data-status="${escapeHtml(b.paymentStatus)}"><td><strong>${escapeHtml(b.id)}</strong><small>${escapeHtml(b.container)}</small></td><td>${escapeHtml(b.company)}</td><td>${escapeHtml(b.method || "—")}</td><td>${proofDetails}</td><td><strong>${money(b.fee)}</strong></td><td><div class="payment-status-cell">${badge(b.paymentStatus)}${paymentActions}</div></td></tr>`;
  }).join("");
  return `${heading("Payment management", "Review customer-submitted proof. A booking is confirmed only after payment verification.", button("Export payments", "export-payments", "button-outline"))}<div class="notice warning">Do not approve based on uploaded screenshots alone in a production deployment. Verify the payment in your provider portal or integrate signed payment webhooks.</div><div class="payment-management-table">${tableCard("Payment review queue", `${data.bookings.filter((b) => b.paymentStatus === "Awaiting verification").length} submissions waiting for review`, ["Booking", "Customer", "Method", "Reference / proof", "Amount", "Payment status"], rows, "No payment submissions to review.")}</div>`;
}

function renderContainers() {
  const rows = bookingRows(data.bookings, true);
  return `${heading("Container management", "Search, review, and update container and reservation records.", `<button class="button button-outline" data-action="export-bookings">Export CSV</button>${button("＋ New booking", "goto-booking")}`)}${tableCard("Container and booking records", `${data.bookings.length} records`, ["Booking", "Container", "Driver / Truck", "Arrival", "Booking status", "Payment", "Actions"], rows)}`;
}

function renderDrivers() {
  const drivers = new Map(data.bookings.map((booking) => [booking.driver.toLowerCase(), { name: booking.driver, contact: booking.contact, plate: booking.plate, company: booking.company }]));
  for (const driver of (data.drivers || [])) drivers.set(driver.name.toLowerCase(), driver);
  const rows = [...drivers.values()].map((driver) => `<tr data-record-row data-search="${escapeHtml(`${driver.name} ${driver.contact || ""} ${driver.plate || ""} ${driver.company || ""}`.toLowerCase())}" data-status="Active"><td><strong>${escapeHtml(driver.name)}</strong></td><td>${escapeHtml(driver.contact || "—")}</td><td>${escapeHtml(driver.plate || "—")}</td><td>${escapeHtml(driver.company || "—")}</td><td>${badge("Active")}</td></tr>`).join("");
  return `${heading("Driver management", "Review driver and vehicle details from yard reservations.", button("＋ Add driver", "add-driver"))}${tableCard("Drivers", `${drivers.size} driver records from booking data`, ["Driver", "Contact", "Truck plate", "Trucking company", "Status"], rows)}`;
}

function renderCompanies() {
  const companies = new Map(data.bookings.map((booking) => [booking.company.toLowerCase(), { name: booking.company, bookings: 0 }]));
  for (const booking of data.bookings) companies.get(booking.company.toLowerCase()).bookings += 1;
  for (const company of (data.companies || [])) {
    if (!companies.has(company.name.toLowerCase())) companies.set(company.name.toLowerCase(), { ...company, bookings: 0 });
  }
  const rows = [...companies.values()].map((company) => `<tr data-record-row data-search="${escapeHtml(`${company.name} ${company.status || "Active"}`.toLowerCase())}" data-status="${escapeHtml(company.status || "Active")}"><td><strong>${escapeHtml(company.name)}</strong></td><td>${company.bookings}</td><td>${badge(company.status || "Active")}</td></tr>`).join("");
  return `${heading("Trucking companies", "Manage the carrier directory and review booking volume.", button("＋ Add company", "add-company"))}${tableCard("Company directory", `${companies.size} trucking company records`, ["Company", "Bookings", "Status"], rows)}`;
}

function renderGatePasses() {
  const rows = data.bookings.map((booking) => {
    const pass = isGatePassIssued(booking) ? booking.gatePass : "Not issued";
    const actions = canIssueGatePass(booking)
      ? `<button class="button button-outline button-small" data-action="issue-gatepass" data-id="${escapeHtml(booking.id)}">${isGatePassIssued(booking) ? "View pass" : "Issue pass"}</button>${isGatePassIssued(booking) ? `<button class="button button-outline button-small" data-action="revoke-gatepass" data-id="${escapeHtml(booking.id)}">Revoke</button>` : ""}`
      : `<button class="button button-outline button-small" data-action="view-booking" data-id="${escapeHtml(booking.id)}">View booking</button>`;
    return `<tr data-record-row data-search="${escapeHtml(`${pass} ${booking.id} ${booking.container} ${booking.driver} ${booking.plate} ${booking.status}`.toLowerCase())}" data-status="${escapeHtml(booking.status)}"><td><strong>${escapeHtml(pass)}</strong></td><td>${escapeHtml(booking.id)}</td><td>${escapeHtml(booking.container)}</td><td>${escapeHtml(booking.driver)}<small>${escapeHtml(booking.plate)}</small></td><td>${badge(booking.paymentStatus)}</td><td>${badge(booking.status)}</td><td>${actions}</td></tr>`;
  }).join("");
  return `${heading("Gate pass management", "Issue or revoke passes for confirmed, paid bookings. Gate entry requires an active pass.", button("Export gate passes", "export-bookings", "button-outline"))}${tableCard("Gate passes", `${data.bookings.filter(isGatePassIssued).length} issued passes · ${data.bookings.length} bookings`, ["Gate pass", "Booking", "Container", "Driver / truck", "Payment", "Container status", "Actions"], rows)}`;
}

function isGatePassIssued(booking) {
  if (!booking.gatePass || booking.gatePassIssued === false) return false;
  return booking.paymentStatus === "Approved"
    && ["Booking Confirmed", "Scheduled", "Arrived at Yard", "Inside Yard", "Released", "Completed"].includes(booking.status);
}

function canIssueGatePass(booking) {
  return booking.paymentStatus === "Approved"
    && ["Booking Confirmed", "Scheduled"].includes(booking.status);
}

function renderSlots() {
  const allSlots = slotNames.map((slot) => {
    const active = data.bookings.find((booking) => booking.slot === slot && booking.date === new Date().toISOString().slice(0, 10) && !["Rejected", "Cancelled"].includes(booking.paymentStatus));
    const state = data.slotOverrides[`${new Date().toISOString().slice(0, 10)}|${arrivalTimes[0]}|${slot}`] || (active ? "Reserved" : slot === "A-05" || slot === "C-03" ? "Occupied" : "Available");
    const assigned = active ? `${active.container} · ${active.time}` : "No container assigned";
    return `<tr data-record-row data-search="${escapeHtml(`${slot} ${state} ${assigned}`.toLowerCase())}" data-status="${escapeHtml(state)}"><td><strong>${escapeHtml(slot)}</strong></td><td>Standard yard position</td><td>${badge(state)}</td><td>${escapeHtml(assigned)}</td><td><span class="table-action"><button data-action="slot-toggle" data-slot="${escapeHtml(slot)}">${state === "Available" ? "Mark occupied" : "Mark available"}</button></span></td></tr>`;
  }).join("");
  return `${heading("Yard slot management", "Monitor availability and maintain sample yard slot statuses.", button("＋ Add yard slot", "add-slot", "button-outline"))}<div class="notice">Slot conflicts are prevented by date, time, and slot when a customer submits a booking. Manual slot overrides are for prototype demonstration.</div>${tableCard("Yard slots", "16 configured sample slots · date-specific availability", ["Slot", "Type", "Status", "Assignment", "Actions"], allSlots)}`;
}

function renderYard() {
  const scheduled = data.bookings.filter((b) => ["Booking Confirmed", "Scheduled", "Arrived at Yard", "Inside Yard"].includes(b.status));
  const rows = scheduled.map((b) => `<tr data-record-row data-search="${escapeHtml(`${b.container} ${b.driver} ${b.plate} ${b.slot} ${b.status}`.toLowerCase())}" data-status="${escapeHtml(b.status)}"><td><strong>${escapeHtml(b.container)}</strong><small>${escapeHtml(b.id)}</small></td><td>${escapeHtml(b.driver)}<small>${escapeHtml(b.plate)}</small></td><td>${shortDate(b.date)}<small>${escapeHtml(b.time)} · ${escapeHtml(b.slot)}</small></td><td>${badge(b.status)}</td><td><span class="table-action">${b.status === "Scheduled" || b.status === "Booking Confirmed" ? `<button data-action="yard-arrive" data-id="${escapeHtml(b.id)}">Record arrival</button>` : ""}${b.status === "Arrived at Yard" ? `<button data-action="yard-inside" data-id="${escapeHtml(b.id)}">Mark inside yard</button>` : ""}${b.status === "Inside Yard" ? `<button data-action="yard-release" data-id="${escapeHtml(b.id)}">Record departure</button>` : ""}</span></td></tr>`).join("");
  return `${heading("Yard staff operations", "View scheduled containers and record yard movements.", button("View slots", "goto-slots", "button-outline"))}<div class="stats-grid">${statCard("Scheduled today", scheduled.filter((b) => b.date === new Date().toISOString().slice(0, 10)).length, "Approved yard visits", "▤")}${statCard("Arrived at yard", data.bookings.filter((b) => b.status === "Arrived at Yard").length, "Awaiting yard placement", "↘")}${statCard("Inside yard", data.bookings.filter((b) => b.status === "Inside Yard").length, "On-site containers", "▦")}${statCard("Pending departure", data.bookings.filter((b) => b.status === "Inside Yard").length, "Update after exit", "↗")}</div>${tableCard("Scheduled containers", `${scheduled.length} scheduled or active records`, ["Container", "Driver / truck", "Arrival / assigned slot", "Status", "Yard action"], rows, "No scheduled containers.")}`;
}

function renderGate() {
  return `${heading("Gate personnel", "Verify a gate pass and record truck entry or exit.", button("Scan QR code", "qr-scan", "button-outline"))}<div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>Gate pass verification</h2><p>Search by gate pass or container number</p></div></div><form class="tracking-form" id="gate-search-form"><input name="gateQuery" placeholder="e.g. GP-2026-1048" required aria-label="Gate pass or container number" /><button class="button button-primary" type="submit">Find pass</button></form><div id="gate-result"></div></section><section class="panel"><div class="panel-header"><div><h2>Gate checklist</h2><p>Verify details before admitting a truck</p></div></div><div class="panel-body"><div class="activity-list"><div class="activity-item"><span class="activity-dot"></span><div><strong>Confirm the booking is paid and confirmed</strong><small>Pending-payment reservations cannot enter the yard.</small></div></div><div class="activity-item"><span class="activity-dot"></span><div><strong>Match driver and truck plate</strong><small>Compare the presented ID and vehicle with the booking.</small></div></div><div class="activity-item"><span class="activity-dot"></span><div><strong>Record entry and exit</strong><small>Keep the gate log and container status up to date.</small></div></div></div></div></section></div>`;
}

function renderDocuments() {
  const list = availableBookings();
  if (currentRole === "Customer") {
    const issuedPasses = list.filter(isGatePassIssued);
    if (!issuedPasses.length) {
      return `${heading("Gate Pass", "Your gate pass and full booking details will be available here after payment approval.")}<div class="empty-state">No active gate pass is available yet.</div>`;
    }
    return `${heading("Gate Pass", "Open your gate-pass document to view the QR code and all booking and payment information.")}<div class="data-grid"><article class="info-card document-card"><div><span class="stat-icon">▣</span><h3 style="margin-top:13px">Gate Pass</h3><p>Gate entry reference, QR code, booking details, and payment information.</p></div><div><label class="document-meta">Select booking <select class="filter-select document-booking" data-doc-type="Gate Pass">${issuedPasses.map((booking) => `<option value="${escapeHtml(booking.id)}">${escapeHtml(booking.id)} · ${escapeHtml(booking.container)}</option>`).join("")}</select></label><div class="document-actions"><button class="button button-outline button-small" data-action="preview-document" data-doc-type="Gate Pass">Preview</button><button class="button button-primary button-small" data-action="download-document" data-doc-type="Gate Pass">Print / Save PDF</button></div></div></article></div>`;
  }
  const types = ["Gate Pass", "Booking Confirmation", "Payment Receipt / Acknowledgment", "Container Information Sheet"];
  return `${heading("Documents", "Prepare printable prototype documents linked to your reservations.", button("Print document list", "print-page", "button-outline"))}<div class="notice">Documents are generated as printable browser pages. QR verification, signed PDFs, and official receipts require server-side document generation in a production integration.</div><div class="data-grid">${types.map((type, index) => `<article class="info-card document-card"><div><span class="stat-icon">${["▣", "✓", "₱", "▤"][index]}</span><h3 style="margin-top:13px">${type}</h3><p>${index === 0 ? "Gate entry and exit reference." : index === 1 ? "Reservation and schedule details." : index === 2 ? "Acknowledgment of submitted or verified payment." : "Container and driver information sheet."}</p></div><div><label class="document-meta">Select booking <select class="filter-select document-booking" data-doc-type="${escapeHtml(type)}">${list.map((b) => `<option value="${escapeHtml(b.id)}">${escapeHtml(b.id)} · ${escapeHtml(b.container)}</option>`).join("")}</select></label><div class="document-actions"><button class="button button-outline button-small" data-action="preview-document" data-doc-type="${escapeHtml(type)}">Preview</button><button class="button button-primary button-small" data-action="download-document" data-doc-type="${escapeHtml(type)}">Print / Save PDF</button></div></div></article>`).join("")}</div>`;
}

function renderProfile() {
  return `${heading("My profile", "Your signed-in profile and workspace preferences.")}
    <section class="panel" style="max-width:760px"><div class="panel-header"><div><h2>Account details</h2><p>Profile information associated with this session</p></div></div><form id="profile-form" class="panel-body"><div class="form-grid"><div class="form-field"><label>Full name<input name="name" required value="${escapeHtml(currentUser?.name || "")}" /></label></div><div class="form-field"><label>Company / organization<input name="company" value="${escapeHtml(currentUser?.company || "")}" /></label></div><div class="form-field"><label>Registered email<input value="${escapeHtml(currentUser?.email || "")}" disabled /></label></div><div class="form-field"><label>Account role<input value="${escapeHtml(currentRole)}" disabled /></label></div></div><div class="notice">Account roles are assigned by the A2S Yard administrator and cannot be changed from a customer profile.</div><div class="form-actions"><button class="button button-primary" type="submit">Save profile</button></div></form></section>`;
}

function renderReports() {
  const paid = data.bookings.filter((b) => b.paymentStatus === "Approved").reduce((sum, b) => sum + b.fee, 0);
  const statusesCount = ["Pending Payment", "Booking Confirmed", "Scheduled", "Inside Yard", "Completed"].map((status) => ({ status, count: data.bookings.filter((b) => b.status === status).length }));
  const max = Math.max(1, ...statusesCount.map((item) => item.count));
  return `${heading("Reports & analytics", "Yard transactions, revenue, company activity, and occupancy.", `<button class="button button-outline" data-action="export-bookings">Export Excel-compatible CSV</button>${button("Print reports", "print-page")}`)}
    <div class="stats-grid">${statCard("Daily transactions", data.bookings.filter((b) => b.date === new Date().toISOString().slice(0, 10)).length, "Bookings scheduled today", "▤")}${statCard("Monthly bookings", data.bookings.length, "Sample current period", "▦")}${statCard("Verified payments", money(paid), "PHP · approved only", "₱")}${statCard("Yard occupancy", `${Math.round(data.bookings.filter((b) => b.status === "Inside Yard").length / slotNames.length * 100)}%`, "Based on 16 sample slots", "◴")}</div>
    <div class="dashboard-grid"><section class="panel"><div class="panel-header"><div><h2>Bookings by status</h2><p>Prototype reservation distribution</p></div></div><div class="panel-body"><div class="report-bars">${statusesCount.map((item) => `<div class="bar-row"><span>${escapeHtml(item.status)}</span><div class="progress-track"><span style="width:${Math.max(3, item.count / max * 100)}%"></span></div><strong>${item.count}</strong></div>`).join("")}</div></div></section><section class="panel"><div class="panel-header"><div><h2>Trucking companies</h2><p>Booking activity by organization</p></div></div><div class="panel-body"><div class="activity-list">${[...new Set(data.bookings.map((b) => b.company))].map((company) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${escapeHtml(company)}</strong><small>${data.bookings.filter((b) => b.company === company).length} booking(s)</small></div></div>`).join("")}</div></div></section></div>
    <div class="heading-actions" style="margin-top:16px">${button("Daily transactions", "export-bookings", "button-outline")}${button("Payment report", "export-payments", "button-outline")}${button("Yard occupancy report", "export-slots", "button-outline")}</div>`;
}

function renderLanding() {
  return `${heading("A2S Yard container management", "One workspace for bookings, verified payments, tracking, and yard operations.", button("Return to dashboard", "goto-dashboard", "button-outline"))}<div class="stats-grid">${statCard("Secure access", "Role-based", "Customer and operations views", "◉")}${statCard("Yard bookings", "Online", "Reserve available arrival slots", "▦")}${statCard("Payment review", "Tracked", "Verification before confirmation", "₱")}${statCard("Container tracking", "Live view", "Public operational information", "⌕")}</div><div class="data-grid"><article class="info-card"><h3>Book and manage slots</h3><p>Create a reservation with driver, truck, container, and preferred arrival information.</p><button class="button button-primary" data-action="goto-booking">Book a slot</button></article><article class="info-card"><h3>Track a container</h3><p>Find your latest container status without exposing personal contact details.</p><button class="button button-outline" data-page="track">Open tracking</button></article><article class="info-card"><h3>Operations in one place</h3><p>Role-specific workspaces support yard and gate staff through the daily workflow.</p><button class="button button-outline" data-action="goto-dashboard">Open workspace</button></article></div>`;
}

function authTemplate(mode) {
  if (adminOnly && mode === "signup") mode = "signin";
  authMode = mode;
  const signinTitle = adminOnly ? "Administrator sign in" : "Welcome back";
  const signinDescription = adminOnly
    ? "Sign in with an Administrator account to open the yard management console."
    : "Sign in to continue to your A2S Yard workspace.";
  const authLinks = adminOnly ? "" : `<p class="auth-switch">New to A2S Yard? <button class="text-button" type="button" data-auth-mode="signup">Create an account</button></p>`;
  const forms = {
    signin: `<h2>${signinTitle}</h2><p class="subhead">${signinDescription}</p><form id="auth-form"><label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@company.com" /></label><label>Password<input name="password" type="password" autocomplete="current-password" required /></label><div class="forgot-row"><button type="button" class="text-button" data-auth-mode="forgot">Forgot password?</button></div><p class="auth-error" id="auth-message" aria-live="polite"></p><button class="button button-primary" type="submit" style="width:100%">Sign in</button></form>${authLinks}`,
    signup: `<h2>Create your account</h2><p class="subhead">Register a customer account to book and manage yard reservations.</p><form id="auth-form"><label>Full name<input name="name" autocomplete="name" required minlength="2" placeholder="Your full name" /></label><label>Company name<input name="company" autocomplete="organization" required minlength="2" placeholder="Your company" /></label><label>Email address<input name="email" type="email" autocomplete="email" required placeholder="you@company.com" /></label><label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8" placeholder="At least 8 characters" /></label><label style="display:flex;align-items:flex-start;grid-template-columns:16px 1fr;gap:8px;font-weight:400"><input type="checkbox" name="terms" required style="width:15px;min-height:15px;margin-top:2px" />I agree to the terms and privacy policy.</label><p class="auth-error" id="auth-message" aria-live="polite"></p><button class="button button-primary" type="submit" style="width:100%">Create account</button></form><p class="auth-switch">Already registered? <button class="text-button" type="button" data-auth-mode="signin">Sign in</button></p>`,
    forgot: `<h2>Reset your password</h2><p class="subhead">Enter your registered email. For this prototype, contact your yard administrator to reset your account password.</p><form id="auth-form"><label>Email address<input name="email" type="email" required placeholder="you@company.com" /></label><p class="auth-error" id="auth-message" aria-live="polite"></p><button class="button button-primary" type="submit" style="width:100%">Request password reset</button></form><p class="auth-switch"><button class="text-button" type="button" data-auth-mode="signin">← Back to sign in</button></p>`,
  };
  authContent.innerHTML = forms[mode] || forms.signin;
}

function showAuth(mode = "signin") {
  appShell.classList.add("hidden");
  authScreen.classList.remove("hidden");
  authTemplate(mode);
}

async function submitAuth(event) {
  event.preventDefault();
  const form = event.target;
  const formData = new FormData(form);
  const message = form.querySelector("#auth-message");
  const submit = form.querySelector('button[type="submit"]');
  if (authMode === "forgot") {
    message.textContent = "Password reset is not connected in this prototype. Please contact the yard administrator.";
    message.classList.add("auth-success");
    return;
  }
  const isSignup = authMode === "signup";
  const details = {
    email: String(formData.get("email") || "").trim(),
    password: String(formData.get("password") || ""),
  };
  if (isSignup) {
    details.name = String(formData.get("name") || "").trim();
    details.company = String(formData.get("company") || "").trim();
    details.termsAccepted = formData.has("terms");
  }
  submit.disabled = true;
  submit.textContent = isSignup ? "Creating account..." : "Signing in...";
  try {
    const endpoint = isSignup ? "/api/signup" : adminOnly ? "/api/admin/signin" : "/api/signin";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(details),
    });
    const result = await response.json();
    if (!response.ok) {
      message.textContent = result.error || "We couldn't complete the request.";
      return;
    }
    if (isSignup) {
      authTemplate("signin");
      const emailInput = authContent.querySelector('[name="email"]');
      if (emailInput) emailInput.value = details.email;
      const success = document.createElement("p");
      success.className = "auth-success";
      success.textContent = "Account created. Sign in with your new email and password.";
      authContent.querySelector("form").prepend(success);
      return;
    }
    currentUser = result;
    currentRole = roles.includes(result.role) ? result.role : "Customer";
    if (adminOnly && currentRole !== "Administrator") {
      currentUser = null;
      message.textContent = "This app is restricted to Administrator accounts.";
      return;
    }
    currentPage = authReturnPage && (navSets[currentRole] || []).includes(authReturnPage) ? authReturnPage : "dashboard";
    if (adminOnly) currentPage = "admin";
    authReturnPage = null;
    try {
      await syncSharedBookings(false);
    } catch {
      notify("Could not load shared bookings. Check the server connection.", "error");
    }
    authScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    render();
    startBookingSync();
  } catch {
    message.textContent = "The account service is unavailable. Start the A2S Yard server and try again.";
  } finally {
    const activeSubmit = authContent.querySelector('#auth-form button[type="submit"]');
    if (activeSubmit && authMode !== "signup") {
      activeSubmit.disabled = false;
      activeSubmit.textContent = authMode === "signin" ? "Sign in" : "Request password reset";
    }
    if (submit.isConnected) submit.disabled = false;
  }
}

function navigate(page) {
  if (page === "track-public" && !currentUser) {
    authScreen.classList.add("hidden");
    appShell.classList.remove("hidden");
    currentRole = "Customer";
    currentPage = "track";
    render();
    return;
  }
  if (!currentUser) {
    if (page !== "landing" && page !== "track") {
      authReturnPage = page;
      showAuth("signin");
      return;
    }
  }
  if (page !== "landing" && !(page === "track" && !currentUser) && !(navSets[currentRole] || []).includes(page)) {
    notify("This workspace role does not have access to that page.", "error");
    return;
  }
  currentPage = page;
  authScreen.classList.add("hidden");
  appShell.classList.remove("hidden");
  render();
}

function notify(text, type = "") {
  toast.textContent = text;
  toast.className = `toast visible ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3200);
}

function showDialog(title, body, footer = "") {
  dialog.classList.remove("gate-pass-dialog");
  dialogContent.innerHTML = `<div class="dialog-head"><h2>${escapeHtml(title)}</h2><button class="close-dialog" type="button" data-action="close-dialog" aria-label="Close">×</button></div><div class="dialog-body">${body}</div>${footer ? `<div class="dialog-foot">${footer}</div>` : ""}`;
  dialog.showModal();
}

function printPage() {
  if (dialog.classList.contains("gate-pass-dialog")) {
    document.body.classList.add("printing-gate-pass");
    window.addEventListener("afterprint", () => document.body.classList.remove("printing-gate-pass"), { once: true });
  }
  window.print();
}

function findBooking(id) {
  return data.bookings.find((booking) => booking.id === id);
}

function bookingDetails(booking) {
  const info = [
    ["Container", booking.container], ["Driver", booking.driver], ["Truck plate", booking.plate],
    ["Cargo", booking.cargo], ["Trucking company", booking.company], ["Container size", booking.size],
    ["Arrival", `${shortDate(booking.date)} · ${booking.time}`], ["Yard slot", booking.slot],
    ["Booking status", booking.status], ["Payment status", booking.paymentStatus],
  ];
  const gatePass = currentRole === "Customer"
    ? isGatePassIssued(booking)
      ? `<div class="notice">Your gate-pass number and QR code are available in the full document. <button class="button button-primary button-small" data-action="customer-gatepass" data-id="${escapeHtml(booking.id)}">Open gate-pass document</button></div>`
      : `<div class="tracking-field"><small>Gate pass</small><strong>Not issued</strong></div>`
    : `<div class="tracking-field"><small>Gate pass</small><strong>${escapeHtml(booking.gatePass || "—")}</strong></div>`;
  return `<div class="tracking-grid">${info.map(([label, value]) => `<div class="tracking-field"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div>${gatePass}`;
}

function showBookingDetails(id) {
  const booking = findBooking(id);
  if (!booking) return notify("Booking record not found.", "error");
  const payButton = booking.paymentStatus === "Rejected" || booking.paymentStatus === "Unpaid"
    ? `<button class="button button-primary" data-action="pay-booking" data-id="${escapeHtml(booking.id)}">Submit payment</button>` : "";
  showDialog(`Booking ${booking.id}`, `${bookingDetails(booking)}<div class="notice">Payment reference: ${escapeHtml(booking.reference || "Not submitted")} · ${money(booking.fee)}</div>`, `${payButton}<button class="button button-outline" data-action="close-dialog">Close</button>`);
}

function requestBookingRemoval(id) {
  const booking = findBooking(id);
  if (!booking) return notify("Booking record not found.", "error");
  if (currentRole !== "Administrator" || currentPage !== "containers") {
    return notify("Only administrators can remove records from Container Management.", "error");
  }
  showDialog(
    "Remove booking record?",
    `<div class="notice warning">This permanently removes the booking and its associated payment and gate-pass record from this browser.</div><div class="tracking-field"><small>Booking</small><strong>${escapeHtml(booking.id)}</strong></div><div class="tracking-field"><small>Container</small><strong>${escapeHtml(booking.container)}</strong></div><p class="subhead">This cannot be undone. Are you sure you want to remove this record?</p>`,
    `<button class="button button-outline" data-action="close-dialog">Keep record</button><button class="button button-danger" data-action="confirm-remove-booking" data-id="${escapeHtml(booking.id)}">Remove permanently</button>`,
  );
}

async function removeBooking(id) {
  if (currentRole !== "Administrator" || currentPage !== "containers") {
    return notify("Only administrators can remove records from Container Management.", "error");
  }
  const index = data.bookings.findIndex((booking) => booking.id === id);
  if (index < 0) return notify("Booking record not found.", "error");
  const booking = data.bookings[index];
  if (booking.sharedRecord) {
    try {
      const response = await fetch(apiPath(`/api/bookings/${encodeURIComponent(id)}`), {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok || result.deleted !== true) throw new Error(result.error || "Could not remove booking.");
    } catch (error) {
      return notify(error.message || "Could not remove booking. Check the server connection.", "error");
    }
  }
  const [removed] = data.bookings.splice(index, 1);
  if (!persist()) {
    if (!booking.sharedRecord) {
      data.bookings.splice(index, 0, removed);
      return;
    }
  }
  dialog.close();
  render();
  notify(`Booking ${removed.id} removed.`);
}

function openPayment(id) {
  const booking = findBooking(id);
  if (!booking) return notify("Booking record not found.", "error");
  showDialog("Submit payment proof", `<p class="subhead">Reservation <strong>${escapeHtml(booking.id)}</strong> · ${escapeHtml(booking.container)} · <strong>${money(booking.fee)}</strong></p><form id="payment-form" data-id="${escapeHtml(id)}"><div class="form-field"><label>Payment method<select name="method" required>${paymentMethods.map((method) => `<option ${booking.method === method ? "selected" : ""}>${escapeHtml(method)}</option>`).join("")}</select></label></div><div class="notice">Use the official A2S Yard payment instructions provided by your administrator. This prototype does not accept or transmit actual payments.</div><div class="form-grid"><div class="form-field full"><label>Transaction reference number<input name="reference" required maxlength="80" placeholder="Enter your payment transaction reference" /></label></div><div class="form-field full"><label>Proof of payment<input name="proof" type="file" accept=".jpg,.jpeg,.png,.pdf" required /></label></div></div><div class="notice warning">Uploaded files are not sent to a payment provider or securely stored. This demo records the file name only.</div></form>`, `<button class="button button-outline" data-action="close-dialog">Cancel</button><button class="button button-primary" form="payment-form" type="submit">Submit for verification</button>`);
}

function publicTrackingResult(query) {
  const normalized = query.trim().toLowerCase().replace(/\s+/g, "");
  const record = data.bookings.find((b) => b.container.toLowerCase().replace(/\s+/g, "") === normalized || b.id.toLowerCase() === query.trim().toLowerCase() || b.gatePass.toLowerCase() === query.trim().toLowerCase());
  const target = document.querySelector("#tracking-result");
  if (!target) return;
  if (!record) {
    target.innerHTML = `<div class="empty-state"><strong>No matching container found</strong>Check your container number or booking reference and try again.</div>`;
    return;
  }
  const progress = statuses.indexOf(record.status);
  const publicInfo = [
    ["Container number", record.container], ["Driver name", record.driver], ["Truck plate", record.plate],
    ["Cargo description", record.cargo], ["Trucking company", record.company], ["Container size", record.size],
    ["Arrival date and time", `${shortDate(record.date)} · ${record.time}`], ["Departure date and time", record.status === "Completed" || record.status === "Released" ? `${shortDate(record.date)} · Recorded by yard staff` : "Not departed"],
  ];
  target.innerHTML = `<div class="tracking-result"><h2>Tracking result · ${escapeHtml(record.container)} <span class="${statusClass(record.status)}">${escapeHtml(record.status)}</span></h2><div class="tracking-grid">${publicInfo.map(([label, value]) => `<div class="tracking-field"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div><div class="timeline">${statuses.slice(0, Math.max(progress + 1, 1)).map((status) => `<div class="timeline-item"><span class="timeline-point"></span><div><strong>${escapeHtml(status)}</strong><small>${status === record.status ? `${shortDate(record.date)} · Current status` : "Status completed"}</small></div></div>`).join("")}</div></div>`;
}

function gatePassResult(query) {
  const target = document.querySelector("#gate-result");
  const record = data.bookings.find((b) => b.gatePass.toLowerCase() === query.trim().toLowerCase() || b.container.toLowerCase().replace(/\s+/g, "") === query.trim().toLowerCase().replace(/\s+/g, ""));
  if (!target) return;
  if (!record) {
    target.innerHTML = `<div class="empty-state"><strong>No gate pass found</strong>Check the pass or container number.</div>`;
    return;
  }
  const eligible = isGatePassIssued(record)
    && ["Booking Confirmed", "Scheduled", "Arrived at Yard", "Inside Yard"].includes(record.status)
    && record.paymentStatus === "Approved";
  const message = eligible
    ? "Booking, payment, and gate pass are verified. Match the driver and vehicle before entry."
    : !isGatePassIssued(record)
      ? "Entry not authorized: an administrator has not issued an active gate pass."
      : "Entry not authorized: booking or payment is not verified.";
  target.innerHTML = `<div class="tracking-result"><div class="notice ${eligible ? "" : "warning"}">${message}</div>${bookingDetails(record)}<div class="form-actions">${record.status === "Scheduled" || record.status === "Booking Confirmed" ? `<button class="button button-primary" data-action="yard-arrive" data-id="${escapeHtml(record.id)}" ${eligible ? "" : "disabled"}>Confirm truck entry</button>` : ""}${record.status === "Inside Yard" ? `<button class="button button-primary" data-action="yard-release" data-id="${escapeHtml(record.id)}">Confirm truck exit</button>` : ""}</div></div>`;
}

async function issueGatePass(id) {
  const booking = findBooking(id);
  if (!booking) return notify("Booking record not found.", "error");
  if (!canIssueGatePass(booking)) return notify("Gate passes can only be issued for confirmed bookings with approved payment.", "error");
  const wasIssued = isGatePassIssued(booking);
  if (!wasIssued) {
    if (booking.sharedRecord) {
      try {
        await updateSharedBooking(booking, { gatePassIssued: true });
      } catch (error) {
        return notify(error.message || "Could not issue gate pass.", "error");
      }
    } else {
      booking.gatePass ||= `GP-${booking.id.slice(3)}`;
      booking.gatePassIssued = true;
      if (!persist()) {
        booking.gatePassIssued = false;
        return;
      }
    }
  }
  render();
  showDialog("Gate pass issued", `<div class="tracking-result"><div class="notice">This pass is active. The gate team must verify the driver, vehicle, booking status, and payment before entry.</div><div class="tracking-field"><small>Gate pass number</small><strong>${escapeHtml(booking.gatePass)}</strong></div>${bookingDetails(booking)}</div>`, `<button class="button button-outline" data-action="close-dialog">Close</button><button class="button button-primary" data-action="print-page">Print / Save PDF</button>`);
  if (!wasIssued) notify(`Gate pass ${booking.gatePass} issued.`);
}

async function confirmGatePassRevocation(id) {
  const booking = findBooking(id);
  if (!booking) return notify("Booking record not found.", "error");
  if (!canIssueGatePass(booking)) return notify("Only passes for confirmed bookings can be revoked here.", "error");
  if (booking.sharedRecord) {
    try {
      await updateSharedBooking(booking, { gatePassIssued: false });
    } catch (error) {
      return notify(error.message || "Could not revoke gate pass.", "error");
    }
  } else {
    booking.gatePassIssued = false;
    if (!persist()) {
      booking.gatePassIssued = true;
      return;
    }
  }
  dialog.close();
  render();
  notify(`Gate pass ${booking.gatePass} revoked.`);
}

function requestGatePassRevocation(id) {
  const booking = findBooking(id);
  if (!booking || !isGatePassIssued(booking)) return notify("No active gate pass is available to revoke.", "error");
  if (!canIssueGatePass(booking)) return notify("Gate passes cannot be revoked after yard entry or completion.", "error");
  showDialog("Revoke gate pass", `<p class="subhead">Revoke active pass <strong>${escapeHtml(booking.gatePass)}</strong> for booking ${escapeHtml(booking.id)}? The gate team will no longer be able to authorize entry.</p>`, `<button class="button button-outline" data-action="close-dialog">Cancel</button><button class="button button-primary" data-action="confirm-revoke-gatepass" data-id="${escapeHtml(booking.id)}">Revoke pass</button>`);
}

async function paymentReview(id, approved) {
  const booking = findBooking(id);
  if (!booking || booking.paymentStatus !== "Awaiting verification") return notify("This payment is no longer awaiting review.", "error");
  if (booking.sharedRecord) {
    try {
      await updateSharedBooking(booking, { paymentStatus: approved ? "Approved" : "Rejected" });
    } catch (error) {
      return notify(error.message || "Could not update payment review.", "error");
    }
    if (dialog.open) dialog.close();
    render();
    notify(approved ? "Payment verified. The booking is now confirmed." : "Payment rejected. Customer can submit updated proof.");
    return;
  }
  const previous = {
    paymentStatus: booking.paymentStatus,
    status: booking.status,
    activity: booking.activity,
    gatePassIssued: booking.gatePassIssued,
  };
  if (!isGatePassIssued(booking)) booking.gatePassIssued = false;
  booking.paymentStatus = approved ? "Approved" : "Rejected";
  if (approved) {
    booking.status = "Booking Confirmed";
    booking.activity = "Payment verified; booking confirmed";
  } else {
    booking.status = "Pending Payment";
    booking.activity = "Payment proof rejected; resubmission required";
  }
  if (!persist()) {
    Object.assign(booking, previous);
    render();
    return;
  }
  if (dialog.open) dialog.close();
  render();
  notify(approved ? "Payment verified. The booking is now confirmed." : "Payment rejected. Customer can submit updated proof.");
}

async function updateBookingStatus(id, status) {
  const booking = findBooking(id);
  if (!booking) return notify("Booking record not found.", "error");
  if (["Booking Confirmed", "Scheduled", "Arrived at Yard", "Inside Yard", "Released", "Completed"].includes(status) && booking.paymentStatus !== "Approved") {
    return notify("Verify payment before confirming or admitting this booking.", "error");
  }
  if (booking.sharedRecord) {
    try {
      await updateSharedBooking(booking, { status });
    } catch (error) {
      return notify(error.message || "Could not update booking status.", "error");
    }
    if (currentPage === "gate") {
      const input = document.querySelector('[name="gateQuery"]');
      if (input) gatePassResult(input.value);
    } else render();
    notify(`Container status updated: ${status}.`);
    return;
  }
  const previousStatus = booking.status;
  const previousActivity = booking.activity;
  booking.status = status;
  booking.activity = `Status updated to ${status}`;
  if (!persist()) {
    booking.status = previousStatus;
    booking.activity = previousActivity;
    if (currentPage !== "gate") render();
    return;
  }
  if (currentPage === "gate") {
    const input = document.querySelector('[name="gateQuery"]');
    if (input) gatePassResult(input.value);
  } else render();
  notify(`Container status updated: ${status}.`);
}

function openDocument(type, id) {
  const booking = findBooking(id);
  if (!booking) return notify("No booking is available for this document.", "error");
  if (type === "Gate Pass" && !isGatePassIssued(booking)) {
    return notify("The administrator has not issued a gate pass for this booking yet.", "error");
  }
  if (type === "Gate Pass") {
    const issuedAt = booking.gatePassIssuedAt ? new Date(booking.gatePassIssuedAt) : null;
    const paymentDate = issuedAt && !Number.isNaN(issuedAt.getTime())
      ? issuedAt.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })
      : "Verified";
    const fields = [
      ["Gate pass number", booking.gatePass],
      ["Arrival (booked)", `${shortDate(booking.date)} · ${booking.time}`],
      ["Checked in", booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleString("en-PH") : "Not checked in"],
      ["Truck", booking.plate],
      ["Driver", booking.driver],
      ["Container", booking.container],
      ["Container size", booking.size],
      ["Cargo", booking.cargo],
      ["Parking slot", booking.slot],
      ["Contact", booking.contact],
      ["Customer / company", booking.company],
    ];
    const body = `<article class="gate-pass-print">
      <header class="gate-pass-heading"><span class="gate-pass-brand-mark">A</span><div><strong>A2S YARD</strong><small>CONTAINER YARD · OFFICIAL GATE PASS</small></div></header>
      <div class="gate-pass-status"><span class="gate-pass-pill">${escapeHtml(booking.status)}</span><span class="gate-pass-pill paid">✓ Payment: ${escapeHtml(booking.paymentStatus)}</span></div>
      <section class="gate-pass-payment"><strong>▤ Yard booking fee — paid ${money(booking.fee)} via ${escapeHtml(booking.method || "—")}</strong><p>Payment verified · ${escapeHtml(paymentDate)}</p><small>Reference: ${escapeHtml(booking.reference || "—")}</small></section>
      <div class="gate-pass-content"><dl class="gate-pass-details">${fields.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "—")}</dd></div>`).join("")}</dl></div>
      <footer class="gate-pass-reminder"><strong>▣ Your parking slot: ${escapeHtml(booking.slot)}</strong><span>Show this gate pass on arrival. The gate officer will verify your booking and guide you to your assigned slot.</span></footer>
      <div class="gate-pass-reference">Booking ${escapeHtml(booking.id)} · ${escapeHtml(booking.company)}</div>
    </article>`;
    showDialog("Gate pass · A2S Yard", body, `<button class="button button-outline" data-action="close-dialog">Close</button><button class="button button-primary" data-action="print-page">Download / Print gate pass</button>`);
    dialog.classList.add("gate-pass-dialog");
    return;
  }
  const title = `${type} · A2S YARD`;
  const fields = [
    ["Document number", `${type.slice(0, 2).toUpperCase()}-${booking.id}`],
    ["Customer", booking.company], ["Booking reference", booking.id], ["Container number", booking.container],
    ["Driver", booking.driver], ["Truck plate", booking.plate], ["Trucking company", booking.company],
    ["Container size", booking.size], ["Booking date and time", `${shortDate(booking.date)} · ${booking.time}`],
    ["Gate pass", booking.gatePass], ["Assigned slot", booking.slot], ["Payment method", booking.method], ["Transaction reference", booking.reference],
    ["Payment status", booking.paymentStatus], ["Reservation status", booking.status],
  ];
  const body = `<div class="print-only"><strong>A2S YARD · CONTAINER MANAGEMENT</strong></div><p class="subhead">${escapeHtml(type)} · Prototype document preview</p><div class="tracking-grid">${fields.map(([label, value]) => `<div class="tracking-field"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value || "—")}</strong></div>`).join("")}</div><div class="notice">Verification QR code and official receipt are not generated in this prototype.</div>`;
  showDialog(title, body, `<button class="button button-outline" data-action="close-dialog">Close</button><button class="button button-primary" data-action="print-page">Print / Save PDF</button>`);
}

function csvEscape(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename, header, rows) {
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
  notify("CSV report downloaded.");
}

function exportBookings() {
  downloadCsv("a2s-yard-bookings.csv",
    ["Booking ID", "Container", "Driver", "Truck plate", "Cargo", "Trucking company", "Size", "Arrival date", "Arrival time", "Slot", "Fee PHP", "Booking status", "Payment status"],
    data.bookings.map((b) => [b.id, b.container, b.driver, b.plate, b.cargo, b.company, b.size, b.date, b.time, b.slot, b.fee, b.status, b.paymentStatus]));
}

function exportPayments() {
  downloadCsv("a2s-yard-payments.csv", ["Booking ID", "Container", "Company", "Method", "Reference", "Amount PHP", "Payment status"],
    data.bookings.map((b) => [b.id, b.container, b.company, b.method, b.reference, b.fee, b.paymentStatus]));
}

function filterCurrentTable() {
  const query = document.querySelector("[data-table-search]")?.value.trim().toLowerCase() || "";
  const filter = document.querySelector("[data-status-filter]")?.value || "";
  const rows = [...document.querySelectorAll("[data-record-row]")];
  let visible = 0;
  for (const row of rows) {
    const matchesText = !query || row.dataset.search.includes(query);
    const matchesStatus = !filter || row.dataset.status === filter;
    row.classList.toggle("hidden", !(matchesText && matchesStatus));
    if (matchesText && matchesStatus) visible += 1;
  }
  const count = document.querySelector("[data-result-count]");
  if (count) count.textContent = `${visible} of ${rows.length} records`;
}

function toggleSlot(slot) {
  const key = `${new Date().toISOString().slice(0, 10)}|${arrivalTimes[0]}|${slot}`;
  const current = data.slotOverrides[key] || "Available";
  data.slotOverrides[key] = current === "Available" ? "Occupied" : "Available";
  persist();
  render();
  notify(`${slot} marked ${data.slotOverrides[key].toLowerCase()}.`);
}

function setBookingScheduleOptions() {
  const date = document.querySelector("#arrival-date")?.value || "";
  const time = document.querySelector("#arrival-time")?.value || arrivalTimes[0];
  const picker = document.querySelector("#slot-picker");
  if (picker) picker.innerHTML = renderSlotChoices(date, time);
  if (selectedSlot && slotStatus(selectedSlot, date, time) !== "Available") {
    selectedSlot = "";
    document.querySelector("#selected-slot").value = "";
    const summarySlot = document.querySelector("#summary-slot");
    if (summarySlot) summarySlot.textContent = "Select an available slot";
  }
  const summaryDate = document.querySelector("#summary-date");
  const summaryTime = document.querySelector("#summary-time");
  if (summaryDate) summaryDate.textContent = date ? shortDate(date) : "Select a date";
  if (summaryTime) summaryTime.textContent = time;
}

function refreshBookingSummary() {
  const size = document.querySelector('[name="size"]')?.value || "20FT";
  const summarySize = document.querySelector("#summary-size");
  const summaryFee = document.querySelector("#summary-fee");
  if (summarySize) summarySize.textContent = size;
  if (summaryFee) summaryFee.textContent = money(size === "40FT" ? 2500 : 1800);
}

function addSlotDialog() {
  showDialog("Add yard slot", `<form id="add-slot-form"><div class="form-field"><label>Slot ID<input name="slot" required maxlength="12" placeholder="e.g. D-01" /></label></div><p class="mini-label">Prototype slots are stored locally in this browser.</p></form>`, `<button class="button button-outline" data-action="close-dialog">Cancel</button><button class="button button-primary" form="add-slot-form" type="submit">Add slot</button>`);
}

function addDirectoryDialog(kind) {
  const company = kind === "company";
  showDialog(company ? "Add trucking company" : "Add driver", `<form id="add-directory-form" data-kind="${kind}"><div class="form-grid">${company
    ? `<div class="form-field full"><label>Company name<input name="name" required maxlength="100" /></label></div>`
    : `<div class="form-field"><label>Driver full name<input name="name" required maxlength="100" /></label></div><div class="form-field"><label>Contact number<input name="contact" type="tel" required maxlength="20" /></label></div><div class="form-field"><label>Truck plate<input name="plate" required maxlength="15" /></label></div><div class="form-field"><label>Trucking company<input name="company" required maxlength="100" /></label></div>`}</div></form>`, `<button class="button button-outline" data-action="close-dialog">Cancel</button><button class="button button-primary" form="add-directory-form" type="submit">Save record</button>`);
}

async function submitBooking(event) {
  event.preventDefault();
  if (!currentUser) return navigate("booking");
  const formData = new FormData(event.target);
  const record = Object.fromEntries(formData.entries());
  if (!record.slot || slotStatus(record.slot, record.date, record.time) !== "Available") {
    return notify("Select an available slot. Another booking may have just reserved it.", "error");
  }
  const submit = event.target.querySelector('button[type="submit"]');
  if (submit) submit.disabled = true;
  try {
    const response = await fetch(apiPath("/api/bookings"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      body: JSON.stringify(record),
    });
    const result = await response.json();
    if (!response.ok || !result.booking) throw new Error(result.error || "Could not create booking.");
    data.bookings.unshift(result.booking);
    persist();
    selectedSlot = "";
    openPayment(result.booking.id);
  } catch (error) {
    notify(error.message || "Could not create booking. Check the server connection and try again.", "error");
  } finally {
    if (submit?.isConnected) submit.disabled = false;
  }
}

async function submitPayment(event) {
  event.preventDefault();
  const form = event.target;
  const id = form.dataset.id;
  const booking = findBooking(id);
  if (!booking) return notify("Booking record not found.", "error");
  const formData = new FormData(form);
  const reference = String(formData.get("reference") || "").trim();
  const file = formData.get("proof");
  if (!reference || !(file instanceof File) || file.size === 0) return notify("Enter a transaction reference and select proof of payment.", "error");
  const submit = document.querySelector('button[form="payment-form"]');
  if (submit) submit.disabled = true;
  try {
    const response = await fetch(apiPath(`/api/bookings/${encodeURIComponent(id)}/payment`), {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      cache: "no-store",
    });
    const result = await response.json();
    if (!response.ok || !result.booking) throw new Error(result.error || "Could not submit payment proof.");
    Object.assign(booking, result.booking);
    persist();
    currentPage = currentRole === "Administrator" ? "paymentAdmin" : "dashboard";
    render();
    if (currentRole === "Customer") {
      showDialog(
        "Booking submitted",
        `<div class="notice">Your booking <strong>${escapeHtml(booking.id)}</strong> has been submitted. Payment proof is awaiting administrator review.</div>`,
        `<button class="button button-primary" data-action="booking-done">Done</button>`,
      );
    } else {
      notify("Payment proof uploaded and submitted for administrator review.");
    }
  } catch (error) {
    notify(error.message || "Could not submit payment proof. Check the server connection and try again.", "error");
  } finally {
    if (submit?.isConnected) submit.disabled = false;
  }
}

function submitTracking(event) {
  event.preventDefault();
  publicTrackingResult(new FormData(event.target).get("trackingQuery"));
}

function submitGateSearch(event) {
  event.preventDefault();
  gatePassResult(new FormData(event.target).get("gateQuery"));
}

function submitProfile(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  currentUser = { ...currentUser, name: String(formData.get("name")).trim(), company: String(formData.get("company")).trim() };
  render();
  notify("Prototype profile updated.");
}

function handleAction(action, target) {
  const id = target.dataset.id;
  if (action === "close-dialog") dialog.close();
  else if (action === "goto-booking") navigate("booking");
  else if (action === "goto-dashboard") navigate(currentRole === "Administrator" ? "admin" : currentRole === "Yard Staff" ? "yard" : currentRole === "Gate Personnel" ? "gate" : "dashboard");
  else if (action === "goto-reservations") navigate("reservations");
  else if (action === "goto-slots") navigate("slots");
  else if (action === "booking-done") {
    dialog.close();
    navigate("dashboard");
  }
  else if (action === "view-booking") showBookingDetails(id);
  else if (action === "customer-gatepass") {
    const booking = findBooking(id);
    if (!booking || (currentRole === "Customer" && booking.customerEmail !== currentUser?.email)) {
      return notify("Gate pass not found for this account.", "error");
    }
    openDocument("Gate Pass", id);
  }
  else if (action === "view-proof") {
    const proofId = target.dataset.proofId;
    if (!proofId) return notify("Payment proof is not available.", "error");
    const proofWindow = window.open(apiPath(`/api/proofs/${encodeURIComponent(proofId)}`), "_blank", "noopener");
    if (!proofWindow) notify("Allow pop-ups to view the payment proof.", "error");
  }
  else if (action === "remove-booking") requestBookingRemoval(id);
  else if (action === "confirm-remove-booking") removeBooking(id);
  else if (action === "pay-booking") openPayment(id);
  else if (action === "approve-payment") paymentReview(id, true);
  else if (action === "reject-payment") paymentReview(id, false);
  else if (action === "issue-gatepass") issueGatePass(id);
  else if (action === "revoke-gatepass") requestGatePassRevocation(id);
  else if (action === "confirm-revoke-gatepass") confirmGatePassRevocation(id);
  else if (action === "yard-arrive") updateBookingStatus(id, "Arrived at Yard");
  else if (action === "yard-inside") updateBookingStatus(id, "Inside Yard");
  else if (action === "yard-release") updateBookingStatus(id, "Completed");
  else if (action === "slot-toggle") toggleSlot(target.dataset.slot);
  else if (action === "add-slot") addSlotDialog();
  else if (action === "add-driver") addDirectoryDialog("driver");
  else if (action === "add-company") addDirectoryDialog("company");
  else if (action === "payment-help") showDialog("Payment instructions", `<p class="subhead">Select the payment method shown in your reservation and follow the instructions provided by A2S Yard.</p><div class="activity-list">${paymentMethods.map((method) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>${method}</strong><small>Obtain the official account or QR details from the yard administrator. Enter the transaction reference when submitting proof.</small></div></div>`).join("")}</div><div class="notice warning">Never send funds to unverified accounts. This prototype does not provide active payment account details or process payment.</div>`, `<button class="button button-primary" data-action="close-dialog">Close</button>`);
  else if (action === "preview-document" || action === "download-document") {
    const type = target.dataset.docType;
    const selected = document.querySelector(`[data-doc-type="${CSS.escape(type)}"].document-booking`)?.value || availableBookings()[0]?.id;
    if (action === "preview-document") openDocument(type, selected);
    else { openDocument(type, selected); setTimeout(printPage, 100); }
  } else if (action === "print-page") {
    printPage();
  }
  else if (action === "export-bookings") exportBookings();
  else if (action === "export-payments") exportPayments();
  else if (action === "export-slots") downloadCsv("a2s-yard-slots.csv", ["Slot", "Status"], slotNames.map((slot) => [slot, slotStatus(slot, new Date().toISOString().slice(0, 10), arrivalTimes[0])]));
  else if (action === "qr-scan") showDialog("QR pass scanning", `<p class="subhead">Camera-based QR scanning is not enabled in this prototype. Enter the printed gate pass number or container number to verify the booking.</p><form id="gate-dialog-form" class="tracking-form"><input name="gateQuery" required placeholder="GP-2026-1048" /><button class="button button-primary" type="submit">Verify</button></form>`);
}

document.addEventListener("click", (event) => {
  const authModeButton = event.target.closest("[data-auth-mode]");
  if (authModeButton) {
    showAuth(authModeButton.dataset.authMode);
    return;
  }
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) {
    navigate(pageButton.dataset.page);
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (actionButton) handleAction(actionButton.dataset.action, actionButton);
});

document.addEventListener("submit", (event) => {
  if (event.target.id === "auth-form") submitAuth(event);
  else if (event.target.id === "booking-form") submitBooking(event);
  else if (event.target.id === "payment-form") submitPayment(event);
  else if (event.target.id === "tracking-form") submitTracking(event);
  else if (event.target.id === "gate-search-form" || event.target.id === "gate-dialog-form") {
    event.preventDefault();
    const query = new FormData(event.target).get("gateQuery");
    if (event.target.id === "gate-dialog-form") {
      dialog.close();
      currentPage = "gate";
      render();
      gatePassResult(query);
    } else submitGateSearch(event);
  } else if (event.target.id === "profile-form") submitProfile(event);
  else if (event.target.id === "add-slot-form") {
    event.preventDefault();
    const slot = String(new FormData(event.target).get("slot")).trim().toUpperCase();
    if (slotNames.includes(slot)) return notify("That slot already exists.", "error");
    slotNames.push(slot);
    dialog.close(); render(); notify(`${slot} added to prototype yard slots.`);
  } else if (event.target.id === "add-directory-form") {
    event.preventDefault();
    const formData = new FormData(event.target);
    if (event.target.dataset.kind === "driver") {
      data.drivers ||= [];
      data.drivers.push({ name: String(formData.get("name")), contact: String(formData.get("contact")), plate: String(formData.get("plate")), company: String(formData.get("company")) });
    } else {
      data.companies ||= [];
      data.companies.push({ name: String(formData.get("name")), status: "Active" });
    }
    persist(); dialog.close(); render(); notify("Directory record added.");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.matches("[data-table-search]")) filterCurrentTable();
  if (event.target.id === "arrival-date" || event.target.id === "arrival-time") setBookingScheduleOptions();
});

document.addEventListener("change", (event) => {
  if (event.target.matches("[data-status-filter]")) filterCurrentTable();
  if (event.target.matches('[name="size"]')) refreshBookingSummary();
  if (event.target.id === "arrival-date" || event.target.id === "arrival-time") setBookingScheduleOptions();
});

document.addEventListener("click", (event) => {
  const slot = event.target.closest("[data-slot]");
  if (slot && !slot.disabled) {
    selectedSlot = slot.dataset.slot;
    const input = document.querySelector("#selected-slot");
    if (input) input.value = selectedSlot;
    document.querySelectorAll(".slot-choice").forEach((item) => item.classList.toggle("selected", item === slot));
    const summary = document.querySelector("#summary-slot");
    if (summary) summary.textContent = selectedSlot;
  }
});

document.querySelector("#menu-toggle").addEventListener("click", () => document.querySelector("#sidebar").classList.toggle("open"));
document.querySelector("#signout-button").addEventListener("click", async () => {
  try {
    const response = await fetch(adminOnly ? "/api/admin/signout" : "/api/signout", { method: "POST", credentials: "same-origin", cache: "no-store" });
    const result = await response.json();
    if (!response.ok || result.signedOut !== true) throw new Error("Sign out failed.");
    currentUser = null;
    currentRole = "Customer";
    clearInterval(bookingSyncTimer);
    showAuth("signin");
    notify("You have signed out.");
  } catch {
    notify("Could not sign out. Check the account service and try again.", "error");
  }
});

document.querySelector("#signin-button").addEventListener("click", () => {
  authReturnPage = currentPage;
  showAuth("signin");
});

document.querySelector("#user-menu").addEventListener("click", () => navigate("profile"));
document.querySelector("#notification-button").addEventListener("click", () => showDialog("Notifications", `<p class="subhead">Prototype notifications</p><div class="activity-list">${data.bookings.filter((b) => b.paymentStatus === "Awaiting verification").map((b) => `<div class="activity-item"><span class="activity-dot"></span><div><strong>Payment awaiting verification</strong><small>${escapeHtml(b.id)} · ${escapeHtml(b.container)}</small></div></div>`).join("") || `<div class="empty-state">You are all caught up.</div>`}</div>`, `<button class="button button-primary" data-action="close-dialog">Close</button>`));

async function restoreSession() {
  showAuth("signin");
  try {
    const response = await fetch(adminOnly ? "/api/admin/session" : "/api/session", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) throw new Error("Session lookup failed");
    const result = await response.json();
    if (result.authenticated && result.user) {
      currentUser = result.user;
      currentRole = roles.includes(result.user.role) ? result.user.role : "Customer";
      if (adminOnly && currentRole !== "Administrator") {
        currentUser = null;
        const error = document.createElement("p");
        error.className = "auth-error";
        error.textContent = "This app is restricted to Administrator accounts.";
        authContent.append(error);
        return;
      }
      currentPage = adminOnly ? "admin" : "dashboard";
      authScreen.classList.add("hidden");
      appShell.classList.remove("hidden");
      try {
        await syncSharedBookings(false);
      } catch {
        notify("Could not load shared bookings. Check the server connection.", "error");
      }
      render();
      startBookingSync();
    }
  } catch {
    const error = document.createElement("p");
    error.className = "auth-error";
    error.textContent = "Account service is unavailable. Start the A2S Yard server to sign in.";
    authContent.append(error);
  }
}

restoreSession();
