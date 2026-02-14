const $ = (s) => document.querySelector(s);

const refs = {
  loginScreen: $("#login-screen"),
  loginForm: $("#login-form"),
  loginShortcutActions: $("#login-shortcut-actions"),
  loginResetAdminBtn: $("#login-reset-admin-btn"),
  appHeader: $("#app-header"),
  appMain: $("#app-main"),
  toast: $("#toast"),
  themeToggleBtn: $("#theme-toggle-btn"),
  tabButtons: [...document.querySelectorAll(".tab-btn")],
  tabPanels: [...document.querySelectorAll(".tab-panel")],
  adminOnly: [...document.querySelectorAll(".admin-only")],
  loginError: $("#login-error"),
  productError: $("#product-error"),
  transactionError: $("#transaction-error"),
  historyError: $("#history-error"),
  paymentMethodInput: $("#payment-method"),
  productPickerList: $("#product-picker-list")
};

const state = {
  currentUser: null,
  products: [],
  users: [],
  auditLogs: [],
  cart: [],
  editingSaleId: null,
  editBaseQtyByProduct: {},
  salesFilter: { type: "daily", date: "", month: "" },
  appConfig: { appName: "POS Kasir", appDescription: "Electron + SQL" },
  dashboardTrendMode: "weekly",
  dashboardBestLimit: 10,
  dashboardBestMode: "weekly",
  transactionRecoMode: "monthly",
  transactionRecoLimit: 4
};

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});
const THEME_STORAGE_KEY = "pos-theme";

function isAdmin() {
  return state.currentUser?.role === "admin";
}

function toastMsg(msg) {
  refs.toast.textContent = msg;
  refs.toast.classList.add("show");
  setTimeout(() => refs.toast.classList.remove("show"), 1800);
}

function friendlyError(error, fallback) {
  return String(error?.message || fallback || "Terjadi kesalahan.")
    .replace(/Error invoking remote method '[^']+':\s*/i, "")
    .replace(/^Error:\s*/i, "");
}

function errorMap(section) {
  if (section === "login") return refs.loginError;
  if (section === "product") return refs.productError;
  if (section === "transaction") return refs.transactionError;
  if (section === "history") return refs.historyError;
  return null;
}

function showErr(section, msg) {
  const el = errorMap(section);
  if (!el) return;
  el.textContent = msg;
  el.style.display = "";
}

function clearErr(section) {
  const el = errorMap(section);
  if (!el) return;
  el.textContent = "";
  el.style.display = "none";
}

function clearAllErr() {
  clearErr("login");
  clearErr("product");
  clearErr("transaction");
  clearErr("history");
}

function switchTab(targetId) {
  refs.tabPanels.forEach((p) => p.classList.toggle("active", p.id === targetId));
  refs.tabButtons.forEach((b) => {
    const active = b.dataset.tabTarget === targetId;
    b.classList.toggle("active", active);
    b.setAttribute("aria-selected", active ? "true" : "false");
  });
}

function applyRoleUI() {
  const visible = isAdmin();
  const tabsEl = document.querySelector(".tabs");
  refs.adminOnly.forEach((el) => {
    el.style.display = visible ? "" : "none";
  });
  if (tabsEl) {
    tabsEl.classList.toggle("user-mode", !visible);
    tabsEl.classList.toggle("admin-mode", visible);
  }

  if (
    !visible
    && ($("#panel-dashboard").classList.contains("active")
      || $("#panel-users").classList.contains("active")
      || $("#panel-settings").classList.contains("active"))
  ) {
    switchTab("panel-produk");
  }

}

function showLogin() {
  refs.loginScreen.style.display = "";
  refs.appHeader.style.display = "none";
  refs.appMain.style.display = "none";
  if (refs.loginShortcutActions) refs.loginShortcutActions.style.display = "none";
  setTimeout(() => {
    $("#login-username")?.focus();
  }, 0);
}

async function updateFullscreenButton() {
  try {
    const fs = await window.posApi.getFullscreen();
    $("#fullscreen-btn").textContent = fs ? "🗗 Jendela" : "🖥 Layar Penuh";
  } catch {
    $("#fullscreen-btn").textContent = "🖥 Layar Penuh";
  }
}

function showApp() {
  refs.loginScreen.style.display = "none";
  refs.appHeader.style.display = "";
  refs.appMain.style.display = "";
  const roleLabel = state.currentUser.role === "admin" ? "admin" : "pengguna";
  $("#current-user-text").textContent = `Masuk: ${state.currentUser.username} (${roleLabel})`;
  applyRoleUI();
  updateFullscreenButton();
}

function applyTheme(theme) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", nextTheme);
  if (refs.themeToggleBtn) {
    refs.themeToggleBtn.textContent = nextTheme === "dark" ? "☀ Mode Terang" : "🌙 Mode Gelap";
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // abaikan error storage di lingkungan terbatas
  }
}

function initTheme() {
  let saved = "light";
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "dark" || raw === "light") saved = raw;
  } catch {
    saved = "light";
  }
  applyTheme(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  applyTheme(current === "dark" ? "light" : "dark");
}

function renderAppConfig() {
  $("#app-title").textContent = state.appConfig.appName || "POS Kasir";
  $("#app-description").textContent = state.appConfig.appDescription || "Electron + SQL";
  $("#app-config-name").value = state.appConfig.appName || "POS Kasir";
  $("#app-config-description").value = state.appConfig.appDescription || "Electron + SQL";
  document.title = state.appConfig.appName || "POS Kasir";
}

function resetSaleEditMode() {
  state.editingSaleId = null;
  state.editBaseQtyByProduct = {};
  $("#sale-mode").textContent = "";
  $("#cancel-sale-edit").style.display = "none";
  $("#checkout").textContent = "💳 Bayar";
  if (refs.paymentMethodInput) refs.paymentMethodInput.value = "tunai";
}

export {
  $, refs, state, money,
  isAdmin, toastMsg, friendlyError,
  showErr, clearErr, clearAllErr,
  switchTab, applyRoleUI,
  showLogin, showApp,
  initTheme, toggleTheme,
  renderAppConfig, updateFullscreenButton,
  resetSaleEditMode
};
