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
  const paymentMethod = escapeHtml(String(sale.paymentMethod || "tunai").toUpperCase());
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
      @page { size: 80mm auto; margin: 2mm; }
      html, body { width: 76mm; margin: 0 auto; padding: 0; }
      body { font-family: 'Consolas', 'Courier New', monospace; font-size: 11px; color: #111; }
      .head { text-align: center; margin-bottom: 6px; }
      .title { font-size: 14px; font-weight: 700; line-height: 1.2; }
      .desc { font-size: 10px; color: #444; margin-top: 2px; }
      .line { border-top: 1px dashed #666; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      th, td { padding: 2px 0; vertical-align: top; }
      th { border-bottom: 1px solid #000; font-size: 10px; }
      .meta td { padding: 2px 0; }
      .tot td { padding: 2px 0; }
      .foot { text-align: center; margin-top: 8px; font-size: 10px; color: #444; }
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
      <tr><td>Metode</td><td>: ${paymentMethod}</td></tr>
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

ipcMain.handle("auth:resetAdminPasswordQuick", async () => {
  return db.resetAdminPassword();
});

ipcMain.handle("app:getConfig", async () => db.getAppConfig());
ipcMain.handle("app:updateConfig", async (_event, payload) => {
  ensureAdmin();
  db.updateAppConfig(payload || {});
  return db.getAppConfig();
});

ipcMain.handle("products:list", async () => db.getProducts());
ipcMain.handle("products:recommendations", async (_event, options) => {
  ensureLogin();
  return db.getProductRecommendations(options || {});
});
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
  const activeFilter = filter || {};
  const report = db.getSalesReport(activeFilter, { limit: 100000 });
  const rows = report.rows || [];
  const sum = report.summary || {};

  const wb = XLSX.utils.book_new();
  const filterLabel =
    activeFilter.type === "date"
      ? `Per Tanggal (${activeFilter.date || "-"})`
      : activeFilter.type === "month"
        ? `Per Bulan (${activeFilter.month || "-"})`
        : activeFilter.type === "daily"
          ? "Harian"
          : "Semua";

  const header = [
    "No",
    "Invoice",
    "Kasir",
    "Metode",
    "Total",
    "Bayar",
    "Kembalian",
    "Status",
    "Waktu"
  ];

  const body = rows.map((x, i) => ([
    i + 1,
    x.invoiceNo,
    x.cashierName || "-",
    String(x.paymentMethod || "tunai").toUpperCase(),
    Number(x.total || 0),
    Number(x.payment || 0),
    Number(x.changeAmount || 0),
    x.isFinalized === 1 ? "Selesai" : "Draft",
    new Date(`${x.createdAt}Z`).toLocaleString("id-ID")
  ]));

  const aoa = [
    ["LAPORAN RIWAYAT TRANSAKSI"],
    [`Dibuat: ${new Date().toLocaleString("id-ID")}`],
    [`Filter: ${filterLabel}`],
    [],
    header,
    ...body,
    [],
    ["RINGKASAN"],
    ["Jumlah Transaksi", Number(sum.transactionCount || 0)],
    ["Total Penjualan", Number(sum.totalSales || 0)],
    ["Total Pembayaran", Number(sum.totalPayment || 0)],
    ["Total Kembalian", Number(sum.totalChange || 0)],
    ["Total Tunai", Number(sum.totalTunai || 0)],
    ["Total QRIS", Number(sum.totalQris || 0)]
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 18 },
    { wch: 10 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 22 }
  ];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }];

  const headerRow = 5; // 1-based
  const dataStart = headerRow + 1;
  const dataEnd = dataStart + Math.max(0, body.length - 1);
  ws["!autofilter"] = { ref: `A${headerRow}:I${Math.max(headerRow, dataEnd)}` };

  for (let r = dataStart; r <= dataEnd; r += 1) {
    for (const col of ["E", "F", "G"]) {
      const cellRef = `${col}${r}`;
      if (ws[cellRef]) ws[cellRef].z = '"Rp" #,##0';
    }
  }

  const summaryStart = dataEnd + 4;
  for (let r = summaryStart; r <= summaryStart + 5; r += 1) {
    const cellRef = `B${r}`;
    if (ws[cellRef]) ws[cellRef].z = '"Rp" #,##0';
  }

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
    width: 360,
    height: 800,
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
        printBackground: true,
        margins: { marginType: "none" }
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
