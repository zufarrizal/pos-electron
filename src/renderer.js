const $ = (s) => document.querySelector(s);
const loginScreen = $("#login-screen");
const loginForm = $("#login-form");
const appHeader = $("#app-header");
const appMain = $("#app-main");
const toast = $("#toast");
const tabButtons = [...document.querySelectorAll(".tab-btn")];
const tabPanels = [...document.querySelectorAll(".tab-panel")];
const adminOnly = [...document.querySelectorAll(".admin-only")];

const loginError = $("#login-error");
const productError = $("#product-error");
const transactionError = $("#transaction-error");
const historyError = $("#history-error");

let currentUser = null;
let products = [];
let users = [];
let cart = [];
let editingSaleId = null;
let editBaseQtyByProduct = {};
let salesFilter = { type: "all", date: "", month: "" };
let appConfig = { appName: "POS Kasir", appDescription: "Electron + SQL" };
let dashboardTrendMode = "weekly";
let dashboardBestLimit = 10;

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

function isAdmin() { return currentUser?.role === "admin"; }
function toastMsg(msg) { toast.textContent = msg; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 1800); }
function friendlyError(error, fallback) { return String(error?.message || fallback || "Terjadi kesalahan.").replace(/Error invoking remote method '[^']+':\s*/i, "").replace(/^Error:\s*/i, ""); }

function errorMap(section) {
  if (section === "login") return loginError;
  if (section === "product") return productError;
  if (section === "transaction") return transactionError;
  if (section === "history") return historyError;
  return null;
}
function showErr(section, msg) { const el = errorMap(section); if (!el) return; el.textContent = msg; el.style.display = ""; }
function clearErr(section) { const el = errorMap(section); if (!el) return; el.textContent = ""; el.style.display = "none"; }
function clearAllErr() { clearErr("login"); clearErr("product"); clearErr("transaction"); clearErr("history"); }

function switchTab(targetId) {
  tabPanels.forEach((p) => p.classList.toggle("active", p.id === targetId));
  tabButtons.forEach((b) => {
    const active = b.dataset.tabTarget === targetId;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function applyRoleUI() {
  const visible = isAdmin();
  adminOnly.forEach((el) => (el.style.display = visible ? "" : "none"));
  if (!visible && ($("#panel-dashboard").classList.contains("active") || $("#panel-users").classList.contains("active") || $("#panel-settings").classList.contains("active"))) {
    switchTab("panel-produk");
  }
  $("#reset-admin-password-btn").style.display = visible ? "" : "none";
}

function showLogin() { loginScreen.style.display = ""; appHeader.style.display = "none"; appMain.style.display = "none"; }
function showApp() {
  loginScreen.style.display = "none"; appHeader.style.display = ""; appMain.style.display = "";
  $("#current-user-text").textContent = `Login: ${currentUser.username} (${currentUser.role})`;
  applyRoleUI(); updateFullscreenButton();
}

function renderAppConfig() {
  $("#app-title").textContent = appConfig.appName || "POS Kasir";
  $("#app-description").textContent = appConfig.appDescription || "Electron + SQL";
  $("#app-config-name").value = appConfig.appName || "POS Kasir";
  $("#app-config-description").value = appConfig.appDescription || "Electron + SQL";
  document.title = appConfig.appName || "POS Kasir";
}

async function updateFullscreenButton() {
  try {
    const fs = await window.posApi.getFullscreen();
    $("#fullscreen-btn").textContent = fs ? "🗗 Normal" : "🖥 Layar";
  } catch {
    $("#fullscreen-btn").textContent = "🖥 Layar";
  }
}

function renderProductsTable() {
  const q = ($("#product-table-search").value || "").trim().toLowerCase();
  const rows = q ? products.filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)) : products;
  $("#products-table tbody").innerHTML = rows.map((p) => `
    <tr><td>${p.sku}</td><td>${p.name}</td><td>${money.format(p.price)}</td><td>${p.stock}</td>
      <td><button data-action="edit" data-id="${p.id}" class="secondary">✏ Edit</button>
      <button data-action="delete" data-id="${p.id}" class="danger">🗑 Hapus</button></td></tr>`).join("");
}

function renderProductPicker() {
  const query = ($("#product-search").value || "").trim().toLowerCase();
  const list = products.filter((p) => p.stock > 0);
  const filtered = query ? list.filter((p) => p.sku.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)) : list;
  $("#product-options").innerHTML = filtered.map((p) => `<option value="${p.sku}" label="${p.name} - ${money.format(p.price)} (stok: ${p.stock})"></option>`).join("");
  $("#product-picker-list").innerHTML = filtered.map((p) => `<button type="button" class="picker-item" data-product-id="${p.id}">${p.sku} | ${p.name} | ${money.format(p.price)} | stok ${p.stock}</button>`).join("");
}

function findProductBySearch(v) {
  const value = String(v || "").trim().toLowerCase();
  if (!value) return null;
  const avail = products.filter((p) => p.stock > 0);
  return avail.find((p) => p.sku.toLowerCase() === value) ||
    avail.find((p) => p.name.toLowerCase() === value) ||
    avail.find((p) => p.sku.toLowerCase().includes(value) || p.name.toLowerCase().includes(value)) || null;
}

function renderCart() {
  $("#cart-table tbody").innerHTML = cart.map((x) => `<tr><td>${x.name}</td><td>${money.format(x.price)}</td><td>${x.qty}</td><td>${money.format(x.price * x.qty)}</td><td><button class="danger" data-remove="${x.productId}">🗑 Hapus</button></td></tr>`).join("");
  $("#total-text").textContent = money.format(cart.reduce((s, x) => s + x.price * x.qty, 0));
}

function renderSalesSummary(s) {
  const x = s || { transactionCount: 0, totalSales: 0, totalPayment: 0, totalChange: 0 };
  $("#history-summary").innerHTML = `
    <div class="summary-chip"><span>Jumlah Transaksi</span><strong>${x.transactionCount}</strong></div>
    <div class="summary-chip"><span>Total Penjualan</span><strong>${money.format(x.totalSales)}</strong></div>
    <div class="summary-chip"><span>Total Pembayaran</span><strong>${money.format(x.totalPayment)}</strong></div>
    <div class="summary-chip"><span>Total Kembalian</span><strong>${money.format(x.totalChange)}</strong></div>`;
}

function renderSalesTable(rows) {
  $("#sales-table tbody").innerHTML = rows.map((r) => {
    const print = `<button data-sale-action="print" data-sale-id="${r.id}" class="secondary">🖨 Print</button>`;
    const status = r.isFinalized === 1 ? `<span class="status-done">Selesai</span>` : `<button data-sale-action="finalize" data-sale-id="${r.id}">✅ Selesai</button>`;
    const canEdit = isAdmin() || r.isFinalized !== 1;
    const edit = canEdit ? `<button data-sale-action="edit" data-sale-id="${r.id}" class="secondary">✏ Edit</button>` : `<button class="secondary" disabled>🔒 Terkunci</button>`;
    const del = isAdmin() ? `<button data-sale-action="delete" data-sale-id="${r.id}" class="danger">🗑 Hapus</button>` : "";
    return `<tr><td>${r.invoiceNo}</td><td>${r.cashierName || "-"}</td><td>${money.format(r.total)}</td><td>${money.format(r.payment)}</td><td>${money.format(r.changeAmount)}</td><td>${new Date(r.createdAt + "Z").toLocaleString("id-ID")}</td><td><div class="sale-actions">${print}${edit}${status}${del}</div></td></tr>`;
  }).join("");
}

function renderUsersTable() {
  if (!isAdmin()) return;
  $("#users-table tbody").innerHTML = users.map((u) => `<tr><td>${u.username}</td><td>${u.role}</td><td>${new Date(u.createdAt + "Z").toLocaleString("id-ID")}</td><td><button data-user-action="edit" data-user-id="${u.id}" class="secondary">✏ Edit</button><button data-user-action="delete" data-user-id="${u.id}" class="danger">🗑 Hapus</button></td></tr>`).join("");
}

function renderDashboard(data) {
  const t = data?.totals || {};
  $("#dash-tx-daily").textContent = String(t.transactions?.daily || 0);
  $("#dash-tx-weekly").textContent = String(t.transactions?.weekly || 0);
  $("#dash-tx-monthly").textContent = String(t.transactions?.monthly || 0);
  $("#dash-rev-daily").textContent = money.format(t.revenue?.daily || 0);
  $("#dash-rev-weekly").textContent = money.format(t.revenue?.weekly || 0);
  $("#dash-rev-monthly").textContent = money.format(t.revenue?.monthly || 0);
  $("#dash-item-daily").textContent = String(t.productsSold?.daily || 0);
  $("#dash-item-weekly").textContent = String(t.productsSold?.weekly || 0);
  $("#dash-item-monthly").textContent = String(t.productsSold?.monthly || 0);
  $("#dash-total-users").textContent = String(t.users || 0);
  $("#dash-total-products").textContent = String(t.products || 0);
  $("#dash-total-products-available").textContent = String(t.productsAvailable || 0);
  $("#dash-total-products-empty").textContent = String(t.productsEmpty || 0);
  const labels = data?.trend?.labels || [];
  const values = data?.trend?.values || [];
  const max = Math.max(1, ...values);
  const pts = labels.map((_, i) => ({
    x: 40 + (i * 700 / Math.max(1, labels.length - 1)),
    y: 240 - ((values[i] || 0) / max) * 180,
    value: values[i] || 0,
    label: labels[i] || ""
  }));

  let curvePath = "";
  if (pts.length === 1) {
    curvePath = `M ${pts[0].x} ${pts[0].y}`;
  } else if (pts.length > 1) {
    curvePath = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i += 1) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cx1 = prev.x + (curr.x - prev.x) * 0.4;
      const cy1 = prev.y;
      const cx2 = prev.x + (curr.x - prev.x) * 0.6;
      const cy2 = curr.y;
      curvePath += ` C ${cx1} ${cy1}, ${cx2} ${cy2}, ${curr.x} ${curr.y}`;
    }
  }

  const circles = pts
    .map(
      (p) =>
        `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#0d9488"><title>${p.label}: ${money.format(p.value)}</title></circle>`
    )
    .join("");

  $("#dashboard-chart").innerHTML = `
    <path d="${curvePath}" fill="none" stroke="#0d9488" stroke-width="3" stroke-linecap="round"></path>
    ${circles}
  `;
  $("#dashboard-best-table tbody").innerHTML = (data?.bestProducts || []).map((x, i) => `<tr><td>${i + 1}</td><td>${x.productName}</td><td>${x.totalQty}</td><td>${money.format(x.totalRevenue)}</td></tr>`).join("");
}

function resetSaleEditMode() {
  editingSaleId = null; editBaseQtyByProduct = {};
  $("#sale-mode").textContent = "";
  $("#cancel-sale-edit").style.display = "none";
  $("#checkout").textContent = "💳 Bayar";
}

async function reloadProducts() { products = await window.posApi.listProducts(); renderProductsTable(); renderProductPicker(); }
async function reloadSales() { const r = await window.posApi.listSales(salesFilter); renderSalesTable(r.rows || []); renderSalesSummary(r.summary); }
async function reloadUsers() { if (!isAdmin()) return; users = await window.posApi.listUsers(); renderUsersTable(); }
async function reloadDashboard() { if (!isAdmin()) return; renderDashboard(await window.posApi.getDashboard({ trendMode: dashboardTrendMode, topLimit: dashboardBestLimit })); }
async function reloadAll() { appConfig = await window.posApi.getAppConfig(); renderAppConfig(); await reloadDashboard(); await reloadProducts(); await reloadSales(); await reloadUsers(); renderCart(); }

async function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    $("#confirm-title").textContent = options.title || "Konfirmasi";
    $("#confirm-message").textContent = message;
    $("#confirm-ok").textContent = options.okText || "🗑 Hapus";
    $("#confirm-cancel").textContent = options.cancelText || "✖ Batal";
    $("#confirm-modal").style.display = "";
    const close = (v) => { $("#confirm-modal").style.display = "none"; resolve(v); };
    $("#confirm-cancel").onclick = () => close(false);
    $("#confirm-ok").onclick = () => close(true);
    $("#confirm-modal").onclick = (e) => { if (e.target.id === "confirm-modal") close(false); };
  });
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault(); clearErr("login");
  try {
    currentUser = await window.posApi.login({ username: $("#login-username").value, password: $("#login-password").value });
    $("#login-password").value = ""; showApp(); switchTab(isAdmin() ? "panel-dashboard" : "panel-produk"); await reloadAll(); toastMsg("Login berhasil.");
  } catch (error) { const m = friendlyError(error, "Login gagal."); showErr("login", m); toastMsg(m); }
});

$("#logout-btn").addEventListener("click", async () => {
  await window.posApi.logout(); currentUser = null; cart = []; resetSaleEditMode(); clearAllErr(); showLogin(); toastMsg("Logout berhasil.");
});
$("#fullscreen-btn").addEventListener("click", async () => {
  try { const fs = await window.posApi.toggleFullscreen(); $("#fullscreen-btn").textContent = fs ? "🗗 Normal" : "🖥 Layar"; } catch (e) { toastMsg(friendlyError(e, "Gagal fullscreen.")); }
});
$("#reset-admin-password-btn").addEventListener("click", async () => {
  const ok = await confirmDialog("Reset password ADMIN menjadi 7890?", { title: "Reset", okText: "🔁 Reset", cancelText: "✖ Batal" });
  if (!ok) return;
  try { await window.posApi.resetAdminPassword(); toastMsg("Password ADMIN direset."); } catch (e) { toastMsg(friendlyError(e, "Gagal reset.")); }
});

$("#product-form").addEventListener("submit", async (e) => {
  e.preventDefault(); clearErr("product");
  const payload = { id: Number($("#product-id").value || 0), sku: $("#sku").value, name: $("#name").value, price: Number($("#price").value || 0), stock: Number($("#stock").value || 0) };
  try { if (payload.id) await window.posApi.updateProduct(payload); else await window.posApi.createProduct(payload); $("#product-form").reset(); $("#product-id").value = ""; await reloadProducts(); toastMsg("Produk disimpan."); }
  catch (error) { const m = friendlyError(error, "Gagal simpan produk."); showErr("product", m); toastMsg(m); }
});
$("#cancel-edit").addEventListener("click", () => { $("#product-form").reset(); $("#product-id").value = ""; });
$("#product-table-search").addEventListener("input", renderProductsTable);
$("#products-table tbody").addEventListener("click", async (e) => {
  const b = e.target.closest("button"); if (!b) return;
  const id = Number(b.dataset.id); const p = products.find((x) => x.id === id); if (!p) return;
  if (b.dataset.action === "edit") { $("#product-id").value = p.id; $("#sku").value = p.sku; $("#name").value = p.name; $("#price").value = p.price; $("#stock").value = p.stock; return; }
  const ok = await confirmDialog(`Hapus produk "${p.name}"?`); if (!ok) return;
  try { await window.posApi.deleteProduct(id); await reloadProducts(); toastMsg("Produk dihapus."); } catch (error) { const m = friendlyError(error, "Gagal hapus produk."); showErr("product", m); toastMsg(m); }
});

$("#product-search").addEventListener("input", () => { renderProductPicker(); const p = findProductBySearch($("#product-search").value); $("#selected-product").textContent = p ? `Dipilih: ${p.sku} | ${p.name} | ${money.format(p.price)} | stok ${p.stock}` : ""; });
$("#product-picker-list").addEventListener("click", (e) => { const b = e.target.closest("button[data-product-id]"); if (!b) return; const p = products.find((x) => x.id === Number(b.dataset.productId)); if (!p) return; $("#product-search").value = p.sku; $("#selected-product").textContent = `Dipilih: ${p.sku} | ${p.name} | ${money.format(p.price)} | stok ${p.stock}`; });
$("#add-cart").addEventListener("click", () => {
  clearErr("transaction");
  const p = findProductBySearch($("#product-search").value); const qty = Number($("#qty-input").value || 0);
  if (!p || !Number.isInteger(qty) || qty <= 0) { const m = "Pilih produk dan qty valid."; showErr("transaction", m); toastMsg(m); return; }
  const currentQty = cart.filter((x) => x.productId === p.id).reduce((s, x) => s + x.qty, 0);
  const allowedStock = p.stock + Number(editBaseQtyByProduct[p.id] || 0);
  if (currentQty + qty > allowedStock) { const m = `Stok ${p.name} tidak mencukupi.`; showErr("transaction", m); toastMsg(m); return; }
  const ex = cart.find((x) => x.productId === p.id); if (ex) ex.qty += qty; else cart.push({ productId: p.id, name: p.name, price: p.price, qty });
  $("#qty-input").value = "1"; $("#product-search").value = ""; $("#selected-product").textContent = ""; renderProductPicker(); renderCart();
});
$("#cart-table tbody").addEventListener("click", (e) => { const b = e.target.closest("button[data-remove]"); if (!b) return; cart = cart.filter((x) => x.productId !== Number(b.dataset.remove)); renderCart(); });
$("#checkout").addEventListener("click", async () => {
  clearErr("transaction");
  const items = cart.map((x) => ({ productId: x.productId, qty: x.qty })); const payment = Number($("#payment-input").value || 0);
  try {
    const result = editingSaleId ? await window.posApi.updateSale({ saleId: editingSaleId, items, payment }) : await window.posApi.createSale({ items, payment });
    $("#result-box").style.display = "block";
    $("#result-box").innerHTML = `<strong>${editingSaleId ? "Transaksi berhasil diubah" : "Transaksi berhasil"}</strong><br>Invoice: ${result.invoiceNo}<br>Total: ${money.format(result.total)}<br>Bayar: ${money.format(result.payment)}<br>Kembalian: ${money.format(result.changeAmount)}<br><button type="button" class="secondary" data-result-action="print" data-sale-id="${result.saleId}">🖨 Print</button>`;
    cart = []; $("#payment-input").value = "0"; resetSaleEditMode(); renderCart(); await reloadProducts(); await reloadSales();
  } catch (error) { const m = friendlyError(error, "Simpan transaksi gagal."); showErr("transaction", m); toastMsg(m); }
});

$("#result-box").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-result-action='print']");
  if (!btn) return;
  const saleId = Number(btn.dataset.saleId || 0);
  if (!saleId) return;
  try {
    await window.posApi.printSaleInvoice(saleId);
    toastMsg("Invoice dikirim ke printer.");
  } catch (error) {
    const m = friendlyError(error, "Gagal print invoice.");
    showErr("transaction", m);
    toastMsg(m);
  }
});
$("#cancel-sale-edit").addEventListener("click", () => { resetSaleEditMode(); cart = []; $("#payment-input").value = "0"; clearErr("transaction"); renderCart(); });

$("#history-filter-type").addEventListener("change", () => { $("#history-filter-date").style.display = $("#history-filter-type").value === "date" ? "" : "none"; $("#history-filter-month").style.display = $("#history-filter-type").value === "month" ? "" : "none"; });
$("#apply-history-filter").addEventListener("click", async () => {
  clearErr("history");
  try {
    const t = $("#history-filter-type").value; const d = $("#history-filter-date").value; const m = $("#history-filter-month").value;
    if (t === "date" && !d) throw new Error("Pilih tanggal terlebih dahulu.");
    if (t === "month" && !m) throw new Error("Pilih bulan terlebih dahulu.");
    salesFilter = { type: t, date: d, month: m }; await reloadSales();
  } catch (error) { const msg = friendlyError(error, "Gagal menerapkan filter."); showErr("history", msg); toastMsg(msg); }
});
$("#reset-history-filter").addEventListener("click", async () => { $("#history-filter-type").value = "daily"; $("#history-filter-date").value = ""; $("#history-filter-month").value = ""; salesFilter = { type: "daily", date: "", month: "" }; $("#history-filter-date").style.display = "none"; $("#history-filter-month").style.display = "none"; await reloadSales(); });
$("#export-history-excel").addEventListener("click", async () => { try { const r = await window.posApi.exportSales(salesFilter); toastMsg(r?.canceled ? "Export dibatalkan." : `Export berhasil (${r.count} transaksi).`); } catch (e) { const m = friendlyError(e, "Gagal export Excel."); showErr("history", m); toastMsg(m); } });
$("#sales-table tbody").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-sale-action]"); if (!b) return;
  const action = b.dataset.saleAction; const saleId = Number(b.dataset.saleId); if (!saleId) return;
  if (action === "print") {
    try {
      await window.posApi.printSaleInvoice(saleId);
      toastMsg("Invoice dikirim ke printer.");
    } catch (error) {
      const m = friendlyError(error, "Gagal print invoice.");
      showErr("history", m);
      toastMsg(m);
    }
    return;
  }
  if (action === "finalize") { const ok = await confirmDialog("Tandai transaksi sebagai selesai?", { title: "Selesai", okText: "✅ Selesai", cancelText: "✖ Batal" }); if (!ok) return; await window.posApi.finalizeSale(saleId); await reloadSales(); toastMsg("Transaksi selesai."); return; }
  if (action === "delete") { const ok = await confirmDialog("Hapus riwayat transaksi ini? Stok produk akan dikembalikan."); if (!ok) return; await window.posApi.deleteSale(saleId); await reloadProducts(); await reloadSales(); toastMsg("Riwayat transaksi dihapus."); return; }
  if (action === "edit") {
    try {
      const sale = await window.posApi.getSaleById(saleId); switchTab("panel-transaksi");
      editingSaleId = sale.id; $("#checkout").textContent = "💾 Simpan"; $("#cancel-sale-edit").style.display = "block"; $("#sale-mode").textContent = `Mode edit: ${sale.invoiceNo}`; $("#payment-input").value = String(sale.payment);
      editBaseQtyByProduct = {}; sale.items.forEach((x) => { editBaseQtyByProduct[x.productId] = Number(editBaseQtyByProduct[x.productId] || 0) + x.qty; });
      cart = sale.items.map((x) => { const p = products.find((z) => z.id === x.productId); return { productId: x.productId, name: p ? p.name : x.name, price: p ? p.price : x.price, qty: x.qty }; });
      renderCart(); toastMsg(`Transaksi ${sale.invoiceNo} siap diubah.`);
    } catch (error) { const m = friendlyError(error, "Gagal memuat transaksi."); showErr("history", m); toastMsg(m); }
  }
});

$("#dashboard-trend-mode").addEventListener("change", async () => { dashboardTrendMode = $("#dashboard-trend-mode").value; await reloadDashboard(); });
$("#dashboard-best-limit").addEventListener("change", async () => { dashboardBestLimit = Number($("#dashboard-best-limit").value || 10); await reloadDashboard(); });

$("#user-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const payload = { id: Number($("#user-id").value || 0), username: $("#user-username").value, role: $("#user-role").value, password: $("#user-password").value };
  try { if (payload.id) await window.posApi.updateUser(payload); else await window.posApi.createUser(payload); $("#user-form").reset(); $("#user-id").value = ""; await reloadUsers(); toastMsg("User disimpan."); }
  catch (error) { toastMsg(friendlyError(error, "Gagal simpan user.")); }
});
$("#cancel-user-edit").addEventListener("click", () => { $("#user-form").reset(); $("#user-id").value = ""; });
$("#users-table tbody").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-user-action]"); if (!b) return;
  const user = users.find((x) => x.id === Number(b.dataset.userId)); if (!user) return;
  if (b.dataset.userAction === "edit") { $("#user-id").value = user.id; $("#user-username").value = user.username; $("#user-role").value = user.role; $("#user-password").value = ""; return; }
  const ok = await confirmDialog(`Hapus user "${user.username}"?`); if (!ok) return;
  try { await window.posApi.deleteUser(user.id); await reloadUsers(); toastMsg("User dihapus."); } catch (error) { toastMsg(friendlyError(error, "Gagal menghapus user.")); }
});

$("#app-config-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  try { appConfig = await window.posApi.updateAppConfig({ appName: $("#app-config-name").value, appDescription: $("#app-config-description").value }); renderAppConfig(); toastMsg("Pengaturan aplikasi disimpan."); }
  catch (error) { toastMsg(friendlyError(error, "Gagal menyimpan pengaturan aplikasi.")); }
});

tabButtons.forEach((b) => b.addEventListener("click", () => { if (b.style.display === "none") return; switchTab(b.dataset.tabTarget); }));

async function bootstrap() {
  try {
    appConfig = await window.posApi.getAppConfig();
    renderAppConfig();
    $("#history-filter-date").style.display = "none";
    $("#history-filter-month").style.display = "none";
    const session = await window.posApi.getSession();
    if (!session) return showLogin();
    currentUser = session; showApp(); switchTab(isAdmin() ? "panel-dashboard" : "panel-produk"); await reloadAll();
  } catch (error) {
    showLogin(); toastMsg(friendlyError(error, "Gagal memuat aplikasi."));
  }
}

bootstrap();
