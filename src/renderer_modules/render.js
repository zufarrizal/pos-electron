import { $, state, refs, money, isAdmin } from "./shared.js";

function renderProductsTable() {
  const q = ($("#product-table-search").value || "").trim().toLowerCase();
  const rows = q
    ? state.products.filter((p) => p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    : state.products;

  $("#products-table tbody").innerHTML = rows
    .map((p) => `
    <tr><td>${p.sku}</td><td>${p.name}</td><td>${money.format(p.price)}</td><td>${p.stock}</td>
      <td><button data-action="edit" data-id="${p.id}" class="secondary">✏ Ubah</button>
      <button data-action="delete" data-id="${p.id}" class="danger">🗑 Hapus</button></td></tr>`)
    .join("");
}

function renderProductPicker() {
  const query = ($("#product-search").value || "").trim().toLowerCase();
  const list = state.products.filter((p) => p.stock > 0);
  const filtered = query
    ? list.filter((p) => p.sku.toLowerCase().includes(query) || p.name.toLowerCase().includes(query))
    : list;

  $("#product-options").innerHTML = filtered
    .map((p) => `<option value="${p.sku}" label="${p.name} - ${money.format(p.price)} (stok: ${p.stock})"></option>`)
    .join("");

  if (refs.productPickerList) {
    refs.productPickerList.innerHTML = filtered
      .map((p) => `<button type="button" class="picker-item" data-product-id="${p.id}">${p.sku} | ${p.name} | ${money.format(p.price)} | stok ${p.stock}</button>`)
      .join("");
  }
}

function findProductBySearch(v) {
  const value = String(v || "").trim().toLowerCase();
  if (!value) return null;

  const avail = state.products.filter((p) => p.stock > 0);
  return avail.find((p) => p.sku.toLowerCase() === value)
    || avail.find((p) => p.name.toLowerCase() === value)
    || avail.find((p) => p.sku.toLowerCase().includes(value) || p.name.toLowerCase().includes(value))
    || null;
}

function renderCart() {
  $("#cart-table tbody").innerHTML = state.cart
    .map((x) => `<tr><td>${x.name}</td><td>${money.format(x.price)}</td><td><input type="number" min="1" step="1" value="${x.qty}" data-qty-product-id="${x.productId}" class="cart-qty-input" /></td><td>${money.format(x.price * x.qty)}</td><td><button class="danger" data-remove="${x.productId}">🗑 Hapus</button></td></tr>`)
    .join("");

  $("#total-text").textContent = money.format(state.cart.reduce((s, x) => s + x.price * x.qty, 0));
}

function renderTransactionRecommendations(rows) {
  const list = (rows || []).filter((p) => Number(p.stock || 0) > 0);
  if (!list.length) {
    $("#transaction-recommendations").innerHTML = `<div class="helper-text">Belum ada rekomendasi untuk periode ini.</div>`;
    return;
  }
  $("#transaction-recommendations").innerHTML = list
    .map((p, i) => `
      <button type="button" class="reco-item" data-reco-sku="${p.sku}" title="Pilih produk ${p.name}">
        <span class="reco-rank">#${i + 1}</span>
        <span class="reco-main">${p.name}</span>
        <span class="reco-meta">${p.sku} • ${money.format(p.price)}</span>
        <span class="reco-stock">Stok ${p.stock}</span>
      </button>
    `)
    .join("");
}

function renderSalesSummary(s) {
  const x = s || {
    transactionCount: 0,
    totalSales: 0,
    totalPayment: 0,
    totalChange: 0,
    totalTunai: 0,
    totalQris: 0
  };

  $("#history-summary").innerHTML = `
    <div class="summary-chip"><span>Jumlah Transaksi</span><strong>${x.transactionCount}</strong></div>
    <div class="summary-chip"><span>Total Penjualan</span><strong>${money.format(x.totalSales)}</strong></div>
    <div class="summary-chip"><span>Total Pembayaran</span><strong>${money.format(x.totalPayment)}</strong></div>
    <div class="summary-chip"><span>Total Kembalian</span><strong>${money.format(x.totalChange)}</strong></div>
    <div class="summary-chip"><span>Total Tunai</span><strong>${money.format(x.totalTunai || 0)}</strong></div>
    <div class="summary-chip"><span>Total QRIS</span><strong>${money.format(x.totalQris || 0)}</strong></div>`;
}

function renderSalesTable(rows) {
  $("#sales-table tbody").innerHTML = rows
    .map((r) => {
      const print = `<button data-sale-action="print" data-sale-id="${r.id}" class="secondary" title="Cetak">🖨</button>`;
      const view = `<button data-sale-action="view" data-sale-id="${r.id}" class="secondary" title="Lihat">👁</button>`;
      const status = r.isFinalized === 1
        ? `<span class="status-done" title="Selesai">✅</span>`
        : `<button data-sale-action="finalize" data-sale-id="${r.id}" title="Selesai">✅</button>`;
      const canEdit = isAdmin() || r.isFinalized !== 1;
      const edit = canEdit
        ? `<button data-sale-action="edit" data-sale-id="${r.id}" class="secondary" title="Ubah">✏</button>`
        : `<button class="secondary" disabled title="Terkunci">🔒</button>`;
      const del = isAdmin()
        ? `<button data-sale-action="delete" data-sale-id="${r.id}" class="danger" title="Hapus">🗑</button>`
        : "";

      return `<tr><td>${r.invoiceNo}</td><td>${r.cashierName || "-"}</td><td>${money.format(r.total)}</td><td>${money.format(r.payment)}</td><td>${money.format(r.changeAmount)}</td><td>${new Date(`${r.createdAt}Z`).toLocaleString("id-ID")}</td><td><div class="sale-actions">${print}${view}${edit}${status}${del}</div></td></tr>`;
    })
    .join("");
}

function renderUsersTable() {
  if (!isAdmin()) return;

  $("#users-table tbody").innerHTML = state.users
    .map((u) => `<tr><td>${u.username}</td><td>${u.role === "admin" ? "admin" : "pengguna"}</td><td>${new Date(`${u.createdAt}Z`).toLocaleString("id-ID")}</td><td><button data-user-action="edit" data-user-id="${u.id}" class="secondary">✏ Ubah</button><button data-user-action="delete" data-user-id="${u.id}" class="danger">🗑 Hapus</button></td></tr>`)
    .join("");
}

function renderAuditLogsTable(rows) {
  const list = Array.isArray(rows) ? rows : [];
  $("#audit-table tbody").innerHTML = list
    .map((r) => `
      <tr>
        <td>${new Date(`${r.createdAt}Z`).toLocaleString("id-ID")}</td>
        <td>${r.username || "-"}</td>
        <td>${r.role || "-"}</td>
        <td>${r.action || "-"}</td>
        <td>${r.entity || "-"}</td>
        <td>${r.entityId || "-"}</td>
        <td>${r.details || "-"}</td>
      </tr>
    `)
    .join("");
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
    .map((p) => `<circle cx="${p.x}" cy="${p.y}" r="3.5" fill="#0d9488"><title>${p.label}: ${money.format(p.value)}</title></circle>`)
    .join("");

  $("#dashboard-chart").innerHTML = `
    <path d="${curvePath}" fill="none" stroke="#0d9488" stroke-width="3" stroke-linecap="round"></path>
    ${circles}
  `;

  $("#dashboard-best-table tbody").innerHTML = (data?.bestProducts || [])
    .map((x, i) => `<tr><td>${i + 1}</td><td>${x.productName}</td><td>${x.totalQty}</td><td>${money.format(x.totalRevenue)}</td></tr>`)
    .join("");
}

export {
  renderProductsTable,
  renderProductPicker,
  findProductBySearch,
  renderCart,
  renderTransactionRecommendations,
  renderSalesSummary,
  renderSalesTable,
  renderUsersTable,
  renderAuditLogsTable,
  renderDashboard
};
