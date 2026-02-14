import {
  $, refs, state, money,
  isAdmin, toastMsg, friendlyError,
  showErr, clearErr, clearAllErr,
  switchTab, showLogin, showApp,
  initTheme, toggleTheme,
  renderAppConfig,
  resetSaleEditMode
} from "./shared.js";
import {
  renderProductsTable,
  renderProductPicker,
  findProductBySearch,
  renderCart
} from "./render.js";
import {
  reloadProducts,
  reloadSales,
  reloadRecommendations,
  reloadUsers,
  reloadAuditLogs,
  reloadDashboard,
  reloadAll,
  confirmDialog
} from "./services.js";

function isResetAdminShortcut(event) {
  const key = String(event.key || "").toLowerCase();
  const code = String(event.code || "");
  const hasModifier = event.ctrlKey || event.metaKey;
  return hasModifier && event.shiftKey && (key === "p" || code === "KeyP");
}

function bindEvents() {
  const closeSaleDetailModal = () => {
    $("#sale-detail-modal").style.display = "none";
  };

  const openSaleDetailModal = (sale) => {
    const methodLabel = String(sale.paymentMethod || "tunai").toLowerCase() === "qris" ? "QRIS" : "Tunai";
    $("#sale-detail-title").textContent = `Rincian ${sale.invoiceNo}`;
    $("#sale-detail-meta").textContent = `Kasir: ${sale.cashierName || "-"} | Metode: ${methodLabel} | Total: ${money.format(sale.total || 0)}`;
    $("#sale-detail-table tbody").innerHTML = (sale.items || [])
      .map((x) => `<tr><td>${x.name}</td><td>${x.qty}</td><td>${money.format(x.price)}</td><td>${money.format(x.subtotal)}</td></tr>`)
      .join("");
    $("#sale-detail-modal").style.display = "";
  };

  const handleTabChange = async (targetId) => {
    switchTab(targetId);
    try {
      if (targetId === "panel-dashboard") {
        await reloadDashboard();
        return;
      }
      if (targetId === "panel-produk") {
        await reloadProducts();
        return;
      }
      if (targetId === "panel-transaksi") {
        await reloadProducts();
        await reloadRecommendations();
        renderCart();
        return;
      }
      if (targetId === "panel-riwayat") {
        await reloadSales();
        return;
      }
      if (targetId === "panel-users") {
        await reloadUsers();
        return;
      }
      if (targetId === "panel-audit") {
        await reloadAuditLogs();
        return;
      }
      if (targetId === "panel-settings") {
        state.appConfig = await window.posApi.getAppConfig();
        renderAppConfig();
      }
    } catch (error) {
      toastMsg(friendlyError(error, "Gagal memuat data tab."));
    }
  };

  const addProductToCart = (product, qtyToAdd = 1) => {
    clearErr("transaction");
    const qty = Number(qtyToAdd || 0);
    if (!product || !Number.isInteger(qty) || qty <= 0) {
      const m = "Pilih produk dan qty valid.";
      showErr("transaction", m);
      toastMsg(m);
      return false;
    }

    const currentQty = state.cart
      .filter((x) => x.productId === product.id)
      .reduce((s, x) => s + x.qty, 0);
    const allowedStock = product.stock + Number(state.editBaseQtyByProduct[product.id] || 0);
    if (currentQty + qty > allowedStock) {
      const m = `Stok ${product.name} tidak mencukupi.`;
      showErr("transaction", m);
      toastMsg(m);
      return false;
    }

    const ex = state.cart.find((x) => x.productId === product.id);
    if (ex) ex.qty += qty;
    else state.cart.push({ productId: product.id, name: product.name, price: product.price, qty });
    renderCart();
    return true;
  };

  refs.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErr("login");
    try {
      state.currentUser = await window.posApi.login({
        username: $("#login-username").value,
        password: $("#login-password").value
      });
      $("#login-password").value = "";
      showApp();
      switchTab(isAdmin() ? "panel-dashboard" : "panel-produk");
      await reloadAll();
      toastMsg("Masuk berhasil.");
    } catch (error) {
      const m = friendlyError(error, "Masuk gagal.");
      showErr("login", m);
      toastMsg(m);
    }
  });

  document.addEventListener("keydown", (event) => {
    const onLoginScreen = refs.loginScreen.style.display !== "none";
    if (!onLoginScreen) return;
    if (isResetAdminShortcut(event)) {
      event.preventDefault();
      const show = refs.loginShortcutActions.style.display === "none";
      refs.loginShortcutActions.style.display = show ? "" : "none";
      toastMsg(show ? "Shortcut aktif: tombol reset admin ditampilkan." : "Shortcut disembunyikan.");
    }
  });

  refs.loginResetAdminBtn?.addEventListener("click", async () => {
    const ok = await confirmDialog("Atur ulang kata sandi ADMIN menjadi 7890?", {
      title: "Atur Ulang",
      okText: "🔁 Atur Ulang",
      cancelText: "✖ Batal"
    });
    if (!ok) return;

    try {
      await window.posApi.resetAdminPasswordQuick();
      showErr("login", "Password ADMIN direset ke 7890.");
      toastMsg("Password ADMIN direset.");
    } catch (error) {
      const m = friendlyError(error, "Gagal reset password ADMIN.");
      showErr("login", m);
      toastMsg(m);
    }
  });

  $("#logout-btn").addEventListener("click", async () => {
    await window.posApi.logout();
    state.currentUser = null;
    state.cart = [];
    resetSaleEditMode();
    clearAllErr();
    showLogin();
    toastMsg("Logout berhasil.");
  });

  $("#fullscreen-btn").addEventListener("click", async () => {
    try {
      const fs = await window.posApi.toggleFullscreen();
      $("#fullscreen-btn").textContent = fs ? "🗗 Jendela" : "🖥 Layar Penuh";
    } catch (e) {
      toastMsg(friendlyError(e, "Gagal mode layar penuh."));
    }
  });

  refs.themeToggleBtn?.addEventListener("click", () => {
    toggleTheme();
  });

  $("#product-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErr("product");
    const payload = {
      id: Number($("#product-id").value || 0),
      sku: $("#sku").value,
      name: $("#name").value,
      price: Number($("#price").value || 0),
      stock: Number($("#stock").value || 0)
    };

    try {
      if (payload.id) await window.posApi.updateProduct(payload);
      else await window.posApi.createProduct(payload);
      $("#product-form").reset();
      $("#product-id").value = "";
      await reloadProducts();
      toastMsg("Produk disimpan.");
    } catch (error) {
      const m = friendlyError(error, "Gagal simpan produk.");
      showErr("product", m);
      toastMsg(m);
    }
  });

  $("#cancel-edit").addEventListener("click", () => {
    $("#product-form").reset();
    $("#product-id").value = "";
  });

  $("#product-table-search").addEventListener("input", renderProductsTable);

  $("#products-table tbody").addEventListener("click", async (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const id = Number(b.dataset.id);
    const p = state.products.find((x) => x.id === id);
    if (!p) return;

    if (b.dataset.action === "edit") {
      $("#product-id").value = p.id;
      $("#sku").value = p.sku;
      $("#name").value = p.name;
      $("#price").value = p.price;
      $("#stock").value = p.stock;
      return;
    }

    const ok = await confirmDialog(`Hapus produk "${p.name}"?`);
    if (!ok) return;

    try {
      await window.posApi.deleteProduct(id);
      await reloadProducts();
      toastMsg("Produk dihapus.");
    } catch (error) {
      const m = friendlyError(error, "Gagal hapus produk.");
      showErr("product", m);
      toastMsg(m);
    }
  });

  $("#product-search").addEventListener("input", () => {
    renderProductPicker();
    const p = findProductBySearch($("#product-search").value);
    $("#selected-product").textContent = p
      ? `Dipilih: ${p.sku} | ${p.name} | ${money.format(p.price)} | stok ${p.stock}`
      : "";
  });

  refs.productPickerList?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-product-id]");
    if (!b) return;
    const p = state.products.find((x) => x.id === Number(b.dataset.productId));
    if (!p) return;
    const ok = addProductToCart(p, 1);
    if (!ok) return;
    $("#product-search").value = p.sku;
    $("#selected-product").textContent = `Ditambahkan: ${p.sku} | ${p.name} | ${money.format(p.price)} | stok ${p.stock}`;
  });

  $("#transaction-recommendations").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-reco-sku]");
    if (!btn) return;
    const sku = String(btn.dataset.recoSku || "");
    if (!sku) return;
    const p = findProductBySearch(sku);
    if (!p) return;
    const ok = addProductToCart(p, 1);
    if (!ok) return;
    $("#product-search").value = sku;
    $("#selected-product").textContent = `Ditambahkan: ${p.sku} | ${p.name} | ${money.format(p.price)} | stok ${p.stock}`;
  });

  $("#transaction-reco-mode").addEventListener("change", async () => {
    state.transactionRecoMode = $("#transaction-reco-mode").value || "monthly";
    await reloadRecommendations();
  });

  $("#transaction-reco-limit").addEventListener("change", async () => {
    state.transactionRecoLimit = Number($("#transaction-reco-limit").value || 4);
    await reloadRecommendations();
  });

  $("#add-cart").addEventListener("click", () => {
    const p = findProductBySearch($("#product-search").value);
    const qty = Number($("#qty-input").value || 0);
    const ok = addProductToCart(p, qty);
    if (!ok) return;

    $("#qty-input").value = "1";
    $("#product-search").value = "";
    $("#selected-product").textContent = "";
    renderProductPicker();
  });

  $("#cart-table tbody").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-remove]");
    if (!b) return;
    state.cart = state.cart.filter((x) => x.productId !== Number(b.dataset.remove));
    renderCart();
  });

  $("#cart-table tbody").addEventListener("change", (e) => {
    const input = e.target.closest("input[data-qty-product-id]");
    if (!input) return;
    clearErr("transaction");

    const productId = Number(input.dataset.qtyProductId || 0);
    const newQty = Number(input.value || 0);
    const item = state.cart.find((x) => x.productId === productId);
    const product = state.products.find((x) => x.id === productId);
    if (!item || !product) return;

    if (!Number.isInteger(newQty) || newQty <= 0) {
      input.value = String(item.qty);
      const m = "Qty harus angka minimal 1.";
      showErr("transaction", m);
      toastMsg(m);
      return;
    }

    const allowedStock = product.stock + Number(state.editBaseQtyByProduct[productId] || 0);
    if (newQty > allowedStock) {
      input.value = String(item.qty);
      const m = `Stok ${product.name} tidak mencukupi.`;
      showErr("transaction", m);
      toastMsg(m);
      return;
    }

    item.qty = newQty;
    renderCart();
  });

  $("#checkout").addEventListener("click", async () => {
    clearErr("transaction");
    const items = state.cart.map((x) => ({ productId: x.productId, qty: x.qty }));
    const payment = Number($("#payment-input").value || 0);
    const paymentMethod = String(refs.paymentMethodInput?.value || "tunai");

    try {
      const result = state.editingSaleId
        ? await window.posApi.updateSale({ saleId: state.editingSaleId, items, payment, paymentMethod })
        : await window.posApi.createSale({ items, payment, paymentMethod });

      $("#result-box").style.display = "block";
      const methodLabel = paymentMethod === "qris" ? "QRIS" : "Tunai";
      $("#result-box").innerHTML = `<strong>${state.editingSaleId ? "Transaksi berhasil diubah" : "Transaksi berhasil"}</strong><br>Invoice: ${result.invoiceNo}<br>Metode: ${methodLabel}<br>Total: ${money.format(result.total)}<br>Bayar: ${money.format(result.payment)}<br>Kembalian: ${money.format(result.changeAmount)}<br><button type="button" class="secondary" data-result-action="print" data-sale-id="${result.saleId}">🖨 Cetak</button>`;

      state.cart = [];
      $("#payment-input").value = "";
      resetSaleEditMode();
      renderCart();
      await reloadProducts();
      await reloadSales();
      await reloadRecommendations();
    } catch (error) {
      const m = friendlyError(error, "Simpan transaksi gagal.");
      showErr("transaction", m);
      toastMsg(m);
    }
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

  $("#cancel-sale-edit").addEventListener("click", () => {
    resetSaleEditMode();
    state.cart = [];
    $("#payment-input").value = "";
    clearErr("transaction");
    renderCart();
  });

  $("#history-filter-type").addEventListener("change", () => {
    $("#history-filter-date").style.display = $("#history-filter-type").value === "date" ? "" : "none";
    $("#history-filter-month").style.display = $("#history-filter-type").value === "month" ? "" : "none";
  });

  $("#apply-history-filter").addEventListener("click", async () => {
    clearErr("history");
    try {
      const t = $("#history-filter-type").value;
      const d = $("#history-filter-date").value;
      const m = $("#history-filter-month").value;
      if (t === "date" && !d) throw new Error("Pilih tanggal terlebih dahulu.");
      if (t === "month" && !m) throw new Error("Pilih bulan terlebih dahulu.");
      state.salesFilter = { type: t, date: d, month: m };
      await reloadSales();
    } catch (error) {
      const msg = friendlyError(error, "Gagal menerapkan filter.");
      showErr("history", msg);
      toastMsg(msg);
    }
  });

  $("#reset-history-filter").addEventListener("click", async () => {
    $("#history-filter-type").value = "daily";
    $("#history-filter-date").value = "";
    $("#history-filter-month").value = "";
    state.salesFilter = { type: "daily", date: "", month: "" };
    $("#history-filter-date").style.display = "none";
    $("#history-filter-month").style.display = "none";
    await reloadSales();
  });

  $("#export-history-excel").addEventListener("click", async () => {
    try {
      const r = await window.posApi.exportSales(state.salesFilter);
      toastMsg(r?.canceled ? "Export dibatalkan." : `Export berhasil (${r.count} transaksi).`);
    } catch (e) {
      const m = friendlyError(e, "Gagal export Excel.");
      showErr("history", m);
      toastMsg(m);
    }
  });

  $("#sales-table tbody").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-sale-action]");
    if (!b) return;
    const action = b.dataset.saleAction;
    const saleId = Number(b.dataset.saleId);
    if (!saleId) return;

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

    if (action === "view") {
      try {
        const sale = await window.posApi.getSaleDetail(saleId);
        openSaleDetailModal(sale);
      } catch (error) {
        const m = friendlyError(error, "Gagal memuat rincian transaksi.");
        showErr("history", m);
        toastMsg(m);
      }
      return;
    }

    if (action === "finalize") {
      const ok = await confirmDialog("Tandai transaksi sebagai selesai?", { title: "Selesai", okText: "✅ Selesai", cancelText: "✖ Batal" });
      if (!ok) return;
      await window.posApi.finalizeSale(saleId);
      await reloadSales();
      await reloadRecommendations();
      toastMsg("Transaksi selesai.");
      return;
    }

    if (action === "delete") {
      const ok = await confirmDialog("Hapus riwayat transaksi ini? Stok produk akan dikembalikan.");
      if (!ok) return;
      await window.posApi.deleteSale(saleId);
      await reloadProducts();
      await reloadSales();
      await reloadRecommendations();
      toastMsg("Riwayat transaksi dihapus.");
      return;
    }

    if (action === "edit") {
      try {
        const sale = await window.posApi.getSaleById(saleId);
        await handleTabChange("panel-transaksi");
        state.editingSaleId = sale.id;
        $("#checkout").textContent = "💾 Simpan";
        $("#cancel-sale-edit").style.display = "block";
        $("#sale-mode").textContent = `Mode ubah: ${sale.invoiceNo}`;
        $("#payment-input").value = String(sale.payment);
        if (refs.paymentMethodInput) refs.paymentMethodInput.value = sale.paymentMethod || "tunai";

        state.editBaseQtyByProduct = {};
        sale.items.forEach((x) => {
          state.editBaseQtyByProduct[x.productId] = Number(state.editBaseQtyByProduct[x.productId] || 0) + x.qty;
        });

        state.cart = sale.items.map((x) => {
          const p = state.products.find((z) => z.id === x.productId);
          return { productId: x.productId, name: p ? p.name : x.name, price: p ? p.price : x.price, qty: x.qty };
        });
        renderCart();
        toastMsg(`Transaksi ${sale.invoiceNo} siap diubah.`);
      } catch (error) {
        const m = friendlyError(error, "Gagal memuat transaksi.");
        showErr("history", m);
        toastMsg(m);
      }
    }
  });

  $("#dashboard-trend-mode").addEventListener("change", async () => {
    state.dashboardTrendMode = $("#dashboard-trend-mode").value;
    await reloadDashboard();
  });

  $("#dashboard-best-limit").addEventListener("change", async () => {
    state.dashboardBestLimit = Number($("#dashboard-best-limit").value || 10);
    await reloadDashboard();
  });

  $("#dashboard-best-mode").addEventListener("change", async () => {
    state.dashboardBestMode = $("#dashboard-best-mode").value || "monthly";
    await reloadDashboard();
  });

  $("#user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = {
      id: Number($("#user-id").value || 0),
      username: $("#user-username").value,
      role: $("#user-role").value,
      password: $("#user-password").value
    };

    try {
      if (payload.id) await window.posApi.updateUser(payload);
      else await window.posApi.createUser(payload);
      $("#user-form").reset();
      $("#user-id").value = "";
      await reloadUsers();
      toastMsg("Pengguna disimpan.");
    } catch (error) {
      toastMsg(friendlyError(error, "Gagal simpan pengguna."));
    }
  });

  $("#cancel-user-edit").addEventListener("click", () => {
    $("#user-form").reset();
    $("#user-id").value = "";
  });

  $("#users-table tbody").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-user-action]");
    if (!b) return;
    const user = state.users.find((x) => x.id === Number(b.dataset.userId));
    if (!user) return;

    if (b.dataset.userAction === "edit") {
      $("#user-id").value = user.id;
      $("#user-username").value = user.username;
      $("#user-role").value = user.role;
      $("#user-password").value = "";
      return;
    }

    const ok = await confirmDialog(`Hapus user "${user.username}"?`);
    if (!ok) return;
    try {
      await window.posApi.deleteUser(user.id);
      await reloadUsers();
      toastMsg("Pengguna dihapus.");
    } catch (error) {
      toastMsg(friendlyError(error, "Gagal menghapus pengguna."));
    }
  });

  $("#app-config-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      state.appConfig = await window.posApi.updateAppConfig({
        appName: $("#app-config-name").value,
        appDescription: $("#app-config-description").value
      });
      renderAppConfig();
      toastMsg("Pengaturan aplikasi disimpan.");
    } catch (error) {
      toastMsg(friendlyError(error, "Gagal menyimpan pengaturan aplikasi."));
    }
  });

  $("#sale-detail-close")?.addEventListener("click", closeSaleDetailModal);
  $("#sale-detail-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "sale-detail-modal") closeSaleDetailModal();
  });

  $("#backup-db-btn")?.addEventListener("click", async () => {
    try {
      const r = await window.posApi.backupDatabase();
      toastMsg(r?.canceled ? "Backup dibatalkan." : "Backup database berhasil.");
    } catch (error) {
      toastMsg(friendlyError(error, "Backup database gagal."));
    }
  });

  $("#restore-db-btn")?.addEventListener("click", async () => {
    const ok = await confirmDialog(
      "Restore database akan menimpa data saat ini dan aplikasi akan restart. Lanjutkan?",
      { title: "Restore Database", okText: "♻ Restore", cancelText: "✖ Batal" }
    );
    if (!ok) return;
    try {
      const r = await window.posApi.restoreDatabase();
      if (r?.canceled) {
        toastMsg("Restore dibatalkan.");
        return;
      }
      toastMsg("Restore berhasil. Aplikasi akan restart.");
    } catch (error) {
      toastMsg(friendlyError(error, "Restore database gagal."));
    }
  });

  $("#audit-refresh")?.addEventListener("click", async () => {
    try {
      await reloadAuditLogs();
      toastMsg("Audit log dimuat ulang.");
    } catch (error) {
      toastMsg(friendlyError(error, "Gagal memuat audit log."));
    }
  });

  refs.tabButtons.forEach((b) => b.addEventListener("click", async () => {
    if (b.style.display === "none") return;
    await handleTabChange(b.dataset.tabTarget);
  }));
}

async function bootstrap() {
  try {
    try {
      initTheme();
    } catch {
      document.documentElement.setAttribute("data-theme", "light");
    }

    state.appConfig = await window.posApi.getAppConfig();
    renderAppConfig();
    $("#history-filter-date").style.display = "none";
    $("#history-filter-month").style.display = "none";

    const session = await window.posApi.getSession();
    if (!session) {
      showLogin();
      return;
    }

    state.currentUser = session;
    showApp();
    switchTab(isAdmin() ? "panel-dashboard" : "panel-produk");
    await reloadAll();
  } catch (error) {
    showLogin();
    toastMsg(friendlyError(error, "Gagal memuat aplikasi."));
  }
}

export { bindEvents, bootstrap };


