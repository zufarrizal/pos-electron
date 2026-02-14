const path = require("path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const XLSX = require("xlsx");
const db = require("./src/db");

let mainWindow;
let currentUser = null;

function ensureLogin() {
  if (!currentUser) throw new Error("Sesi login tidak ditemukan.");
}

function ensureAdmin() {
  ensureLogin();
  if (currentUser.role !== "admin") throw new Error("Akses khusus admin.");
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 840,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, "src", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(() => {
  db.init();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("auth:login", async (_event, payload) => {
  const user = db.login(payload || {});
  currentUser = user;
  return user;
});

ipcMain.handle("auth:logout", async () => {
  currentUser = null;
  return true;
});

ipcMain.handle("auth:session", async () => currentUser);

ipcMain.handle("auth:resetAdminPassword", async () => {
  ensureAdmin();
  return db.resetAdminPassword();
});

ipcMain.handle("app:getConfig", async () => db.getAppConfig());
ipcMain.handle("app:updateConfig", async (_event, payload) => {
  ensureAdmin();
  db.updateAppConfig(payload || {});
  return db.getAppConfig();
});

ipcMain.handle("products:list", async () => db.getProducts());
ipcMain.handle("products:create", async (_event, payload) => {
  ensureLogin();
  return db.createProduct(payload || {});
});
ipcMain.handle("products:update", async (_event, payload) => {
  ensureLogin();
  return db.updateProduct(payload || {});
});
ipcMain.handle("products:delete", async (_event, productId) => {
  ensureLogin();
  return db.deleteProduct(productId);
});

ipcMain.handle("sales:create", async (_event, payload) => {
  ensureLogin();
  return db.createSale({ ...(payload || {}), userId: currentUser.id });
});

ipcMain.handle("sales:update", async (_event, payload) => {
  ensureLogin();
  return db.updateSale(payload || {}, { allowFinalizedEdit: currentUser.role === "admin" });
});

ipcMain.handle("sales:getById", async (_event, saleId) => {
  ensureLogin();
  return db.getSaleById(saleId, { allowFinalizedEdit: currentUser.role === "admin" });
});

ipcMain.handle("sales:finalize", async (_event, saleId) => {
  ensureLogin();
  return db.finalizeSale(saleId);
});

ipcMain.handle("sales:delete", async (_event, saleId) => {
  ensureAdmin();
  return db.deleteSale(saleId);
});

ipcMain.handle("sales:list", async (_event, filter) => db.getSalesReport(filter || {}));

ipcMain.handle("sales:exportExcel", async (_event, filter) => {
  ensureLogin();
  const report = db.getSalesReport(filter || {}, { limit: 100000 });
  const rows = report.rows || [];

  const data = rows.map((x) => ({
    Invoice: x.invoiceNo,
    Kasir: x.cashierName || "-",
    Total: x.total,
    Bayar: x.payment,
    Kembalian: x.changeAmount,
    Status: x.isFinalized === 1 ? "Selesai" : "Draft",
    Waktu: x.createdAt
  }));

  const sum = report.summary || {};
  data.push({});
  data.push({
    Invoice: "TOTAL",
    Kasir: `Transaksi: ${sum.transactionCount || 0}`,
    Total: sum.totalSales || 0,
    Bayar: sum.totalPayment || 0,
    Kembalian: sum.totalChange || 0
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Riwayat");

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Riwayat Transaksi",
    defaultPath: `riwayat-transaksi-${Date.now()}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }]
  });

  if (result.canceled || !result.filePath) return { canceled: true, count: 0 };
  XLSX.writeFile(wb, result.filePath);
  return { canceled: false, count: rows.length, filePath: result.filePath };
});

ipcMain.handle("users:list", async () => {
  ensureAdmin();
  return db.listUsers();
});
ipcMain.handle("users:create", async (_event, payload) => {
  ensureAdmin();
  return db.createUser(payload || {});
});
ipcMain.handle("users:update", async (_event, payload) => {
  ensureAdmin();
  return db.updateUser(payload || {});
});
ipcMain.handle("users:delete", async (_event, userId) => {
  ensureAdmin();
  return db.deleteUser(userId, currentUser.id);
});

ipcMain.handle("dashboard:get", async (_event, options) => {
  ensureAdmin();
  return db.getDashboardData(options || {});
});

ipcMain.handle("window:toggleFullscreen", async () => {
  const now = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(now);
  return now;
});
ipcMain.handle("window:getFullscreen", async () => mainWindow.isFullScreen());
