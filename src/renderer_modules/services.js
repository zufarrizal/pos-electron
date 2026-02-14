import { $, state, isAdmin, renderAppConfig } from "./shared.js";
import {
  renderProductsTable,
  renderProductPicker,
  renderSalesSummary,
  renderSalesTable,
  renderUsersTable,
  renderDashboard,
  renderCart
} from "./render.js";

async function reloadProducts() {
  state.products = await window.posApi.listProducts();
  renderProductsTable();
  renderProductPicker();
}

async function reloadSales() {
  const r = await window.posApi.listSales(state.salesFilter);
  renderSalesTable(r.rows || []);
  renderSalesSummary(r.summary);
}

async function reloadUsers() {
  if (!isAdmin()) return;
  state.users = await window.posApi.listUsers();
  renderUsersTable();
}

async function reloadDashboard() {
  if (!isAdmin()) return;
  renderDashboard(await window.posApi.getDashboard({ trendMode: state.dashboardTrendMode, topLimit: state.dashboardBestLimit }));
}

async function reloadAll() {
  state.appConfig = await window.posApi.getAppConfig();
  renderAppConfig();
  await reloadDashboard();
  await reloadProducts();
  await reloadSales();
  await reloadUsers();
  renderCart();
}

async function confirmDialog(message, options = {}) {
  return new Promise((resolve) => {
    $("#confirm-title").textContent = options.title || "Konfirmasi";
    $("#confirm-message").textContent = message;
    $("#confirm-ok").textContent = options.okText || "🗑 Hapus";
    $("#confirm-cancel").textContent = options.cancelText || "✖ Batal";
    $("#confirm-modal").style.display = "";
    const close = (v) => {
      $("#confirm-modal").style.display = "none";
      resolve(v);
    };
    $("#confirm-cancel").onclick = () => close(false);
    $("#confirm-ok").onclick = () => close(true);
    $("#confirm-modal").onclick = (e) => {
      if (e.target.id === "confirm-modal") close(false);
    };
  });
}

export {
  reloadProducts,
  reloadSales,
  reloadUsers,
  reloadDashboard,
  reloadAll,
  confirmDialog
};
