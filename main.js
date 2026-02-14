const path = require("path");
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const XLSX = require("xlsx");
const db = require("./src/db");

let mainWindow;
let currentUser = null;

const money = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

function ensureLogin() {
  if (!currentUser) throw new Error("Sesi login tidak ditemukan.");
}

function ensureAdmin() {
  ensureLogin();
  if (currentUser.role !== "admin") throw new Error("Akses khusus admin.");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildInvoiceHtml(appCfg, sale) {
  const title = escapeHtml(appCfg?.appName || "POS Kasir");
  const desc = escapeHtml(appCfg?.appDescription || "Electron + SQL");
  const invoiceNo = escapeHtml(sale.invoiceNo);
  const cashier = escapeHtml(sale.cashierName || "-");
  const createdAt = new Date(`${sale.createdAt}Z`).toLocaleString("id-ID");

  const itemsHtml = (sale.items || [])
    .map((item) => {
      const name = escapeHtml(item.name);
      const qty = Number(item.qty || 0);
      const price = money.format(Number(item.price || 0));
      const subtotal = money.format(Number(item.subtotal || 0));
      return `
        <tr>
          <td>${name}</td>
          <td style="text-align:center">${qty}</td>
          <td style="text-align:right">${price}</td>
          <td style="text-align:right">${subtotal}</td>
        </tr>
      `;
    })
    .join("");

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Invoice ${invoiceNo}</title>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; margin: 14px; font-size: 12px; color: #111; }
      .head { text-align: center; margin-bottom: 8px; }
      .title { font-size: 16px; font-weight: 700; }
      .desc { font-size: 11px; color: #444; }
      .line { border-top: 1px dashed #666; margin: 8px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 4px 0; vertical-align: top; }
      th { border-bottom: 1px solid #000; font-size: 11px; }
      .meta td { padding: 2px 0; }
      .tot td { padding: 2px 0; }
      .foot { text-align: center; margin-top: 10px; font-size: 11px; color: #444; }
    </style>
  </head>
  <body>
    <div class="head">
      <div class="title">${title}</div>
      <div class="desc">${desc}</div>
    </div>

    <div class="line"></div>
    <table class="meta">
      <tr><td>Invoice</td><td>: ${invoiceNo}</td></tr>
      <tr><td>Kasir</td><td>: ${cashier}</td></tr>
      <tr><td>Waktu</td><td>: ${escapeHtml(createdAt)}</td></tr>
    </table>
    <div class="line"></div>

    <table>
      <thead>
        <tr>
          <th style="text-align:left">Item</th>
          <th style="text-align:center;width:38px">Qty</th>
          <th style="text-align:right">Harga</th>
          <th style="text-align:right">Sub</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <div class="line"></div>
    <table class="tot">
      <tr><td>Total</td><td style="text-align:right">${money.format(Number(sale.total || 0))}</td></tr>
      <tr><td>Bayar</td><td style="text-align:right">${money.format(Number(sale.payment || 0))}</td></tr>
      <tr><td>Kembali</td><td style="text-align:right">${money.format(Number(sale.changeAmount || 0))}</td></tr>
    </table>

    <div class="line"></div>
    <div class="foot">Terima kasih</div>
  </body>
</html>`;
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

ipcMain.handle("sales:printInvoice", async (_event, saleId) => {
  ensureLogin();
  const sale = db.getSaleById(saleId, { allowFinalizedEdit: true });
  const appCfg = db.getAppConfig();
  const html = buildInvoiceHtml(appCfg, sale);

  const printWindow = new BrowserWindow({
    width: 420,
    height: 680,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true
    }
  });

  await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  const printed = await new Promise((resolve, reject) => {
    printWindow.webContents.print(
      {
        silent: false,
        printBackground: true
      },
      (success, errorType) => {
        if (!success && errorType) reject(new Error(`Print gagal: ${errorType}`));
        else resolve(Boolean(success));
      }
    );
  });

  if (!printWindow.isDestroyed()) printWindow.close();
  return { success: printed };
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
