const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { app } = require("electron");

let database;
const BCRYPT_ROUNDS = 10;
const BCRYPT_PREFIX = /^\$2[aby]\$\d{2}\$/;

function isPasswordHash(value) {
  return BCRYPT_PREFIX.test(String(value || ""));
}

function hashPassword(plain) {
  return bcrypt.hashSync(String(plain || ""), BCRYPT_ROUNDS);
}

function verifyPassword(plain, stored) {
  const storedValue = String(stored || "");
  if (isPasswordHash(storedValue)) {
    return bcrypt.compareSync(String(plain || ""), storedValue);
  }
  return String(plain || "") === storedValue;
}

function getDbPath() {
  if (app && app.getPath) {
    return path.join(app.getPath("userData"), "pos.sqlite");
  }
  return path.join(process.cwd(), "pos.sqlite");
}

function init() {
  if (database) return;
  const dbPath = getDbPath();
  database = new Database(dbPath);
  database.pragma("journal_mode = WAL");

  database.exec(`
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin','user')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0),
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_no TEXT NOT NULL UNIQUE,
      user_id INTEGER,
      payment_method TEXT NOT NULL DEFAULT 'tunai' CHECK (payment_method IN ('tunai','qris')),
      total INTEGER NOT NULL CHECK (total >= 0),
      payment INTEGER NOT NULL CHECK (payment >= 0),
      change_amount INTEGER NOT NULL CHECK (change_amount >= 0),
      is_finalized INTEGER NOT NULL DEFAULT 0 CHECK (is_finalized IN (0,1)),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL CHECK (price >= 0),
      qty INTEGER NOT NULL CHECK (qty > 0),
      subtotal INTEGER NOT NULL CHECK (subtotal >= 0),
      FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );
  `);

  migrateSalesTable();
  seedAppConfig();
  seedUsers();
  migrateLegacyUserPasswords();
  seedIfEmpty();
}

function close() {
  if (!database) return;
  database.close();
  database = null;
}

function getDatabasePath() {
  return getDbPath();
}

async function backupTo(destinationPath) {
  const outPath = String(destinationPath || "").trim();
  if (!outPath) throw new Error("Path backup tidak valid.");
  if (!database) throw new Error("Database belum siap.");
  await database.backup(outPath);
  return true;
}

function seedAppConfig() {
  const insert = database.prepare(
    "INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)"
  );
  insert.run("app_name", "POS Kasir");
  insert.run("app_description", "Electron + SQL");
}

function migrateSalesTable() {
  const columns = database.prepare("PRAGMA table_info(sales)").all();
  const hasFinalized = columns.some((col) => col.name === "is_finalized");
  const hasUserId = columns.some((col) => col.name === "user_id");
  const hasPaymentMethod = columns.some((col) => col.name === "payment_method");
  if (!hasFinalized) {
    database.exec(
      "ALTER TABLE sales ADD COLUMN is_finalized INTEGER NOT NULL DEFAULT 0 CHECK (is_finalized IN (0,1))"
    );
  }
  if (!hasUserId) {
    database.exec("ALTER TABLE sales ADD COLUMN user_id INTEGER");
  }
  if (!hasPaymentMethod) {
    database.exec(
      "ALTER TABLE sales ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'tunai' CHECK (payment_method IN ('tunai','qris'))"
    );
  }
}

function seedIfEmpty() {
  const count = database.prepare("SELECT COUNT(*) AS total FROM products").get();
  if (count.total > 0) return;

  const menu = [
    ["RST-001", "Nasi Goreng Kampung", 32000, 40],
    ["RST-002", "Nasi Goreng Seafood", 38000, 35],
    ["RST-003", "Mie Goreng Jawa", 30000, 30],
    ["RST-004", "Mie Godog Jawa", 30000, 30],
    ["RST-005", "Sate Ayam Madura", 42000, 30],
    ["RST-006", "Sate Kambing", 52000, 20],
    ["RST-007", "Soto Ayam Lamongan", 30000, 35],
    ["RST-008", "Soto Betawi", 42000, 25],
    ["RST-009", "Rawon Daging", 45000, 25],
    ["RST-010", "Gado-Gado Jakarta", 28000, 25],
    ["RST-011", "Ketoprak", 25000, 20],
    ["RST-012", "Pecel Madiun", 26000, 20],
    ["RST-013", "Rendang Sapi", 55000, 25],
    ["RST-014", "Ayam Gulai", 42000, 25],
    ["RST-015", "Ayam Bakar Taliwang", 46000, 22],
    ["RST-016", "Ayam Penyet Sambal", 36000, 28],
    ["RST-017", "Ayam Geprek Keju", 35000, 25],
    ["RST-018", "Ikan Bakar Jimbaran", 58000, 18],
    ["RST-019", "Ikan Asam Manis", 50000, 18],
    ["RST-020", "Lele Goreng Sambal", 30000, 24],
    ["RST-021", "Bebek Goreng Kremes", 52000, 20],
    ["RST-022", "Empal Gentong", 43000, 20],
    ["RST-023", "Konro Bakar", 62000, 15],
    ["RST-024", "Coto Makassar", 42000, 20],
    ["RST-025", "Gudeg Jogja Komplit", 36000, 22],
    ["RST-026", "Nasi Liwet Solo", 34000, 24],
    ["RST-027", "Nasi Uduk Betawi", 30000, 20],
    ["RST-028", "Nasi Timbel Komplit", 38000, 20],
    ["RST-029", "Nasi Padang Komplit", 50000, 25],
    ["RST-030", "Tongseng Kambing", 52000, 18],
    ["RST-031", "Sup Buntut", 65000, 15],
    ["RST-032", "Capcay Kuah", 34000, 20],
    ["RST-033", "Kwetiau Goreng Seafood", 39000, 18],
    ["RST-034", "Bakso Urat Kuah", 30000, 30],
    ["RST-035", "Mie Ayam Jamur", 28000, 30],
    ["RST-036", "Pempek Kapal Selam", 36000, 20],
    ["RST-037", "Siomay Bandung", 30000, 20],
    ["RST-038", "Batagor Bandung", 30000, 20],
    ["RST-039", "Es Teh Manis", 8000, 100],
    ["RST-040", "Teh Tarik", 18000, 60],
    ["RST-041", "Es Jeruk Peras", 15000, 80],
    ["RST-042", "Jeruk Hangat", 14000, 70],
    ["RST-043", "Es Cendol", 18000, 50],
    ["RST-044", "Es Campur", 22000, 40],
    ["RST-045", "Es Teler", 24000, 35],
    ["RST-046", "Wedang Jahe", 16000, 45],
    ["RST-047", "Bajigur", 17000, 35],
    ["RST-048", "Kopi Tubruk", 16000, 60],
    ["RST-049", "Kopi Susu Gula Aren", 22000, 50],
    ["RST-050", "Jus Alpukat", 24000, 45]
  ];

  const insert = database.prepare(`
    INSERT INTO products (sku, name, price, stock) VALUES (?, ?, ?, ?)
  `);

  const seed = database.transaction(() => {
    for (const item of menu) {
      insert.run(item[0], item[1], item[2], item[3]);
    }
  });

  seed();
}

function seedUsers() {
  const count = database.prepare("SELECT COUNT(*) AS total FROM users").get();
  if (count.total > 0) return;

  const insert = database.prepare(`
    INSERT INTO users (username, password, role) VALUES (?, ?, ?)
  `);
  insert.run("ADMIN", hashPassword("7890"), "admin");
  insert.run("kasir", hashPassword("1234"), "user");
}

function migrateLegacyUserPasswords() {
  const rows = database.prepare("SELECT id, password FROM users").all();
  if (!rows.length) return;

  const update = database.prepare("UPDATE users SET password = ? WHERE id = ?");
  const tx = database.transaction(() => {
    for (const row of rows) {
      if (isPasswordHash(row.password)) continue;
      update.run(hashPassword(row.password), row.id);
    }
  });
  tx();
}

function sanitizeUserRow(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt || user.created_at
  };
}

function login(payload) {
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  if (!username || !password) throw new Error("Username dan password wajib diisi.");

  const user = database
    .prepare(
      "SELECT id, username, password, role, created_at AS createdAt FROM users WHERE lower(username) = lower(?)"
    )
    .get(username);
  if (!user || !verifyPassword(password, user.password)) {
    throw new Error("Login gagal. Username atau password salah.");
  }

  // Upgrade sekali jalan jika masih plaintext lama.
  if (!isPasswordHash(user.password)) {
    database
      .prepare("UPDATE users SET password = ? WHERE id = ?")
      .run(hashPassword(password), user.id);
  }

  return sanitizeUserRow({ ...user, password: undefined });
}

function resetAdminPassword() {
  const tx = database.transaction(() => {
    const userId1 = database
      .prepare("SELECT id, username FROM users WHERE id = 1")
      .get();
    const conflictAdmin = database
      .prepare("SELECT id FROM users WHERE lower(username) = 'admin' AND id <> 1")
      .get();

    if (conflictAdmin) {
      database
        .prepare("UPDATE users SET username = ? WHERE id = ?")
        .run(`ADMIN_${conflictAdmin.id}`, conflictAdmin.id);
    }

    if (!userId1) {
      database
        .prepare("INSERT INTO users (id, username, password, role) VALUES (1, 'ADMIN', ?, 'admin')")
        .run(hashPassword("7890"));
      return;
    }

    database
      .prepare("UPDATE users SET username = 'ADMIN', password = ?, role = 'admin' WHERE id = 1")
      .run(hashPassword("7890"));
  });
  tx();
  return true;
}

function getAppConfig() {
  const rows = database
    .prepare("SELECT key, value FROM app_config WHERE key IN ('app_name', 'app_description')")
    .all();
  const map = {};
  for (const row of rows) map[row.key] = row.value;
  return {
    appName: map.app_name || "POS Kasir",
    appDescription: map.app_description || "Electron + SQL"
  };
}

function addAuditLog(payload = {}) {
  const username = String(payload.username || "system").trim() || "system";
  const role = String(payload.role || "system").trim() || "system";
  const action = String(payload.action || "").trim();
  const entity = String(payload.entity || "system").trim() || "system";
  const entityId = payload.entityId == null ? null : String(payload.entityId);
  const details = payload.details == null ? null : String(payload.details);
  const userId = payload.userId == null ? null : Number(payload.userId);

  if (!action) throw new Error("Audit action wajib diisi.");

  database
    .prepare(
      `
      INSERT INTO audit_logs (user_id, username, role, action, entity, entity_id, details)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `
    )
    .run(
      Number.isFinite(userId) && userId > 0 ? userId : null,
      username,
      role,
      action,
      entity,
      entityId,
      details
    );
  return true;
}

function listAuditLogs(options = {}) {
  const rawLimit = Number(options.limit || 200);
  const limit = Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 1000) : 200;

  return database
    .prepare(
      `
      SELECT
        id,
        user_id AS userId,
        username,
        role,
        action,
        entity,
        entity_id AS entityId,
        details,
        created_at AS createdAt
      FROM audit_logs
      ORDER BY id DESC
      LIMIT ?
      `
    )
    .all(limit);
}

function updateAppConfig(payload) {
  const appName = String(payload.appName || "").trim();
  const appDescription = String(payload.appDescription || "").trim();
  if (!appName) throw new Error("Nama aplikasi wajib diisi.");
  if (!appDescription) throw new Error("Deskripsi aplikasi wajib diisi.");

  const upsert = database.prepare(`
    INSERT INTO app_config (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `);
  const tx = database.transaction(() => {
    upsert.run("app_name", appName);
    upsert.run("app_description", appDescription);
  });
  tx();
  return true;
}

function listUsers() {
  const rows = database
    .prepare(
      "SELECT id, username, role, created_at AS createdAt FROM users ORDER BY id ASC"
    )
    .all();
  return rows.map(sanitizeUserRow);
}

function createUser(payload) {
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const role = payload.role === "admin" ? "admin" : "user";

  if (!username) throw new Error("Username wajib diisi.");
  if (!password) throw new Error("Password wajib diisi.");

  try {
    const result = database
      .prepare("INSERT INTO users (username, password, role) VALUES (?, ?, ?)")
      .run(username, hashPassword(password), role);
    return { id: result.lastInsertRowid };
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      throw new Error("Username sudah digunakan.");
    }
    throw error;
  }
}

function updateUser(payload) {
  const id = Number(payload.id);
  const username = String(payload.username || "").trim();
  const password = String(payload.password || "");
  const role = payload.role === "admin" ? "admin" : "user";
  const setPassword = password.length > 0;

  if (!id) throw new Error("ID user tidak valid.");
  if (!username) throw new Error("Username wajib diisi.");

  try {
    if (setPassword) {
      const result = database
        .prepare("UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?")
        .run(username, hashPassword(password), role, id);
      if (result.changes === 0) throw new Error("User tidak ditemukan.");
      return true;
    }

    const result = database
      .prepare("UPDATE users SET username = ?, role = ? WHERE id = ?")
      .run(username, role, id);
    if (result.changes === 0) throw new Error("User tidak ditemukan.");
    return true;
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      throw new Error("Username sudah digunakan.");
    }
    throw error;
  }
}

function deleteUser(userId, actorUserId) {
  const id = Number(userId);
  const actorId = Number(actorUserId || 0);
  if (!id) throw new Error("ID user tidak valid.");
  if (id === actorId) throw new Error("User aktif tidak bisa menghapus akunnya sendiri.");
  if (id === 1) throw new Error("User id 1 tidak boleh dihapus.");
  const user = database
    .prepare("SELECT id, username FROM users WHERE id = ?")
    .get(id);
  if (!user) throw new Error("User tidak ditemukan.");
  database.prepare("DELETE FROM users WHERE id = ?").run(id);
  return true;
}

function getProducts() {
  return database
    .prepare("SELECT id, sku, name, price, stock FROM products ORDER BY name ASC")
    .all();
}

function getProductRecommendations(options = {}) {
  const mode =
    options.mode === "daily"
      ? "daily"
      : options.mode === "weekly"
        ? "weekly"
        : options.mode === "yearly"
          ? "yearly"
          : "monthly";
  const rawLimit = Number(options.limit || 4);
  const allowedLimits = new Set([4, 8, 12, 16, 20]);
  const limit = allowedLimits.has(rawLimit) ? rawLimit : 4;

  let salesFilterSql = "1=1";
  if (mode === "daily") {
    salesFilterSql = "date(datetime(s.created_at, 'localtime')) = date('now', 'localtime')";
  } else if (mode === "weekly") {
    salesFilterSql = "datetime(s.created_at, 'localtime') >= datetime('now', 'localtime', '-6 days', 'start of day')";
  } else if (mode === "monthly") {
    salesFilterSql = "strftime('%Y-%m', datetime(s.created_at, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')";
  } else if (mode === "yearly") {
    salesFilterSql = "strftime('%Y', datetime(s.created_at, 'localtime')) = strftime('%Y', 'now', 'localtime')";
  }

  return database
    .prepare(
      `
      SELECT
        p.id,
        p.sku,
        p.name,
        p.price,
        p.stock,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.qty ELSE 0 END),0) AS totalQty,
        COALESCE(SUM(CASE WHEN s.id IS NOT NULL THEN si.subtotal ELSE 0 END),0) AS totalRevenue
      FROM products p
      LEFT JOIN sale_items si ON si.product_id = p.id
      LEFT JOIN sales s ON s.id = si.sale_id AND ${salesFilterSql}
      WHERE p.stock > 0
      GROUP BY p.id, p.sku, p.name, p.price, p.stock
      ORDER BY totalQty DESC, totalRevenue DESC, p.stock DESC, p.name ASC
      LIMIT ?
      `
    )
    .all(limit);
}

function createProduct(payload) {
  const sku = String(payload.sku || "").trim();
  const name = String(payload.name || "").trim();
  const price = Number(payload.price || 0);
  const stock = Number(payload.stock || 0);

  if (!sku || !name) throw new Error("SKU dan nama produk wajib diisi.");
  if (!Number.isInteger(price) || price < 0) throw new Error("Harga tidak valid.");
  if (!Number.isInteger(stock) || stock < 0) throw new Error("Stok tidak valid.");

  const stmt = database.prepare(`
    INSERT INTO products (sku, name, price, stock) VALUES (?, ?, ?, ?)
  `);

  try {
    const result = stmt.run(sku, name, price, stock);
    return { id: result.lastInsertRowid };
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      throw new Error("SKU sudah digunakan.");
    }
    throw error;
  }
}

function updateProduct(payload) {
  const id = Number(payload.id);
  const sku = String(payload.sku || "").trim();
  const name = String(payload.name || "").trim();
  const price = Number(payload.price || 0);
  const stock = Number(payload.stock || 0);

  if (!id) throw new Error("ID produk tidak valid.");
  if (!sku || !name) throw new Error("SKU dan nama produk wajib diisi.");
  if (!Number.isInteger(price) || price < 0) throw new Error("Harga tidak valid.");
  if (!Number.isInteger(stock) || stock < 0) throw new Error("Stok tidak valid.");

  const stmt = database.prepare(`
    UPDATE products
    SET sku = ?, name = ?, price = ?, stock = ?
    WHERE id = ?
  `);

  try {
    const result = stmt.run(sku, name, price, stock, id);
    if (result.changes === 0) throw new Error("Produk tidak ditemukan.");
    return true;
  } catch (error) {
    if (String(error.message).includes("UNIQUE")) {
      throw new Error("SKU sudah digunakan.");
    }
    throw error;
  }
}

function deleteProduct(productId) {
  const id = Number(productId);
  if (!id) throw new Error("ID produk tidak valid.");
  const usedCount = database
    .prepare("SELECT COUNT(*) AS total FROM sale_items WHERE product_id = ?")
    .get(id).total;
  if (usedCount > 0) {
    throw new Error("Produk sudah dipakai di transaksi, tidak bisa dihapus.");
  }
  const result = database.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (result.changes === 0) throw new Error("Produk tidak ditemukan.");
  return true;
}

function createSale(payload) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  const payment = Number(payload.payment || 0);
  const userId = Number(payload.userId || 0);
  const paymentMethod = String(payload.paymentMethod || "tunai").toLowerCase();

  if (items.length === 0) throw new Error("Keranjang masih kosong.");

  const normalizedItems = items.map((item) => ({
    productId: Number(item.productId),
    qty: Number(item.qty)
  }));

  for (const item of normalizedItems) {
    if (!item.productId || !Number.isInteger(item.qty) || item.qty <= 0) {
      throw new Error("Item transaksi tidak valid.");
    }
  }
  if (!userId) throw new Error("User kasir tidak valid.");
  if (!["tunai", "qris"].includes(paymentMethod)) {
    throw new Error("Metode pembayaran tidak valid.");
  }

  const generateInvoiceNo = () => {
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const prefix = `INV/${year}/${month}/${day}/`;
    const last = database
      .prepare(
        "SELECT invoice_no AS invoiceNo FROM sales WHERE invoice_no LIKE ? ORDER BY id DESC LIMIT 1"
      )
      .get(`${prefix}%`);
    const lastSerial = last?.invoiceNo
      ? Number(String(last.invoiceNo).split("/").pop() || 0)
      : 0;
    const serial = String(lastSerial + 1).padStart(5, "0");
    return `${prefix}${serial}`;
  };

  const tx = database.transaction(() => {
    const productStmt = database.prepare(
      "SELECT id, name, price, stock FROM products WHERE id = ?"
    );

    let total = 0;
    const lineItems = [];

    for (const item of normalizedItems) {
      const product = productStmt.get(item.productId);
      if (!product) throw new Error("Ada produk yang tidak ditemukan.");
      if (product.stock < item.qty) {
        throw new Error(`Stok tidak cukup untuk ${product.name}.`);
      }
      const subtotal = product.price * item.qty;
      total += subtotal;
      lineItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: item.qty,
        subtotal
      });
    }

    if (!Number.isInteger(payment) || payment < total) {
      throw new Error("Nominal pembayaran kurang dari total.");
    }

    const invoiceNo = generateInvoiceNo();
    const changeAmount = payment - total;
    const saleResult = database
      .prepare(
        "INSERT INTO sales (invoice_no, user_id, payment_method, total, payment, change_amount) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .run(invoiceNo, userId, paymentMethod, total, payment, changeAmount);

    const saleId = saleResult.lastInsertRowid;
    const insertItem = database.prepare(`
      INSERT INTO sale_items (sale_id, product_id, name, price, qty, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const updateStock = database.prepare(
      "UPDATE products SET stock = stock - ? WHERE id = ?"
    );

    for (const line of lineItems) {
      insertItem.run(
        saleId,
        line.productId,
        line.name,
        line.price,
        line.qty,
        line.subtotal
      );
      updateStock.run(line.qty, line.productId);
    }

    return {
      saleId,
      invoiceNo,
      paymentMethod,
      total,
      payment,
      changeAmount
    };
  });

  return tx();
}

function getSaleById(saleId, options = {}) {
  const id = Number(saleId);
  if (!id) throw new Error("ID transaksi tidak valid.");
  const allowFinalizedEdit = Boolean(options.allowFinalizedEdit);

  const sale = database
    .prepare(
      `
      SELECT
        s.id,
        s.invoice_no AS invoiceNo,
        s.payment_method AS paymentMethod,
        s.total,
        s.payment,
        s.change_amount AS changeAmount,
        s.is_finalized AS isFinalized,
        s.created_at AS createdAt,
        COALESCE(u.username, '-') AS cashierName
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE s.id = ?
      `
    )
    .get(id);

  if (!sale) throw new Error("Transaksi tidak ditemukan.");
  if (!allowFinalizedEdit && sale.isFinalized === 1) {
    throw new Error("Transaksi sudah selesai dan tidak bisa diedit.");
  }

  const items = database
    .prepare(
      "SELECT product_id AS productId, name, price, qty, subtotal FROM sale_items WHERE sale_id = ? ORDER BY id ASC"
    )
    .all(id);

  return { ...sale, items };
}

function updateSale(payload, options = {}) {
  const saleId = Number(payload.saleId);
  const items = Array.isArray(payload.items) ? payload.items : [];
  const payment = Number(payload.payment || 0);
  const paymentMethod = String(payload.paymentMethod || "tunai").toLowerCase();
  const allowFinalizedEdit = Boolean(options.allowFinalizedEdit);

  if (!saleId) throw new Error("ID transaksi tidak valid.");
  if (items.length === 0) throw new Error("Keranjang masih kosong.");

  const normalizedItems = items.map((item) => ({
    productId: Number(item.productId),
    qty: Number(item.qty)
  }));

  for (const item of normalizedItems) {
    if (!item.productId || !Number.isInteger(item.qty) || item.qty <= 0) {
      throw new Error("Item transaksi tidak valid.");
    }
  }
  if (!["tunai", "qris"].includes(paymentMethod)) {
    throw new Error("Metode pembayaran tidak valid.");
  }

  const tx = database.transaction(() => {
    const sale = database
      .prepare(
        "SELECT id, invoice_no AS invoiceNo, is_finalized AS isFinalized FROM sales WHERE id = ?"
      )
      .get(saleId);
    if (!sale) throw new Error("Transaksi tidak ditemukan.");
    if (!allowFinalizedEdit && sale.isFinalized === 1) {
      throw new Error("Transaksi sudah selesai dan tidak bisa diedit.");
    }

    const oldItems = database
      .prepare("SELECT product_id AS productId, qty FROM sale_items WHERE sale_id = ?")
      .all(saleId);

    const restoreStock = database.prepare(
      "UPDATE products SET stock = stock + ? WHERE id = ?"
    );
    for (const oldItem of oldItems) {
      const restored = restoreStock.run(oldItem.qty, oldItem.productId);
      if (restored.changes === 0) {
        throw new Error("Produk pada transaksi lama tidak ditemukan.");
      }
    }

    const productStmt = database.prepare(
      "SELECT id, name, price, stock FROM products WHERE id = ?"
    );

    let total = 0;
    const lineItems = [];

    for (const item of normalizedItems) {
      const product = productStmt.get(item.productId);
      if (!product) throw new Error("Ada produk yang tidak ditemukan.");
      if (product.stock < item.qty) {
        throw new Error(`Stok tidak cukup untuk ${product.name}.`);
      }
      const subtotal = product.price * item.qty;
      total += subtotal;
      lineItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: item.qty,
        subtotal
      });
    }

    if (!Number.isInteger(payment) || payment < total) {
      throw new Error("Nominal pembayaran kurang dari total.");
    }

    const changeAmount = payment - total;
    database
      .prepare("UPDATE sales SET payment_method = ?, total = ?, payment = ?, change_amount = ? WHERE id = ?")
      .run(paymentMethod, total, payment, changeAmount, saleId);

    database.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(saleId);

    const insertItem = database.prepare(`
      INSERT INTO sale_items (sale_id, product_id, name, price, qty, subtotal)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const reduceStock = database.prepare(
      "UPDATE products SET stock = stock - ? WHERE id = ?"
    );

    for (const line of lineItems) {
      insertItem.run(
        saleId,
        line.productId,
        line.name,
        line.price,
        line.qty,
        line.subtotal
      );
      reduceStock.run(line.qty, line.productId);
    }

    return {
      saleId,
      invoiceNo: sale.invoiceNo,
      paymentMethod,
      total,
      payment,
      changeAmount
    };
  });

  return tx();
}

function buildSalesFilterClause(filter = {}) {
  const type = String(filter.type || "all");
  const params = [];
  let where = "";

  if (type === "daily") {
    where = "WHERE date(datetime(s.created_at, 'localtime')) = date('now', 'localtime')";
  } else if (type === "date") {
    const date = String(filter.date || "").trim();
    if (date) {
      where = "WHERE date(datetime(s.created_at, 'localtime')) = date(?)";
      params.push(date);
    }
  } else if (type === "month") {
    const month = String(filter.month || "").trim();
    if (month) {
      where = "WHERE strftime('%Y-%m', datetime(s.created_at, 'localtime')) = ?";
      params.push(month);
    }
  }

  return { where, params };
}

function getSalesReport(filter = {}, options = {}) {
  const { where, params } = buildSalesFilterClause(filter);
  const limit = Number(options.limit || 50);
  const rows = database
    .prepare(
      `
      SELECT
        s.id,
        s.invoice_no AS invoiceNo,
        s.payment_method AS paymentMethod,
        s.total,
        s.payment,
        s.change_amount AS changeAmount,
        s.is_finalized AS isFinalized,
        s.created_at AS createdAt,
        COALESCE(u.username, '-') AS cashierName
      FROM sales s
      LEFT JOIN users u ON u.id = s.user_id
      ${where}
      ORDER BY s.id DESC
      LIMIT ?
      `
    )
    .all(...params, limit);

  const summary = database
    .prepare(
      `
      SELECT
        COUNT(*) AS transactionCount,
        COALESCE(SUM(total), 0) AS totalSales,
        COALESCE(SUM(payment), 0) AS totalPayment,
        COALESCE(SUM(change_amount), 0) AS totalChange,
        COALESCE(SUM(CASE WHEN payment_method = 'tunai' THEN total ELSE 0 END), 0) AS totalTunai,
        COALESCE(SUM(CASE WHEN payment_method = 'qris' THEN total ELSE 0 END), 0) AS totalQris
      FROM sales s
      ${where}
      `
    )
    .get(...params);

  return { rows, summary };
}

function getSales(filter = {}) {
  return getSalesReport(filter, { limit: 50 });
}

function finalizeSale(saleId) {
  const id = Number(saleId);
  if (!id) throw new Error("ID transaksi tidak valid.");
  const sale = database
    .prepare("SELECT id, is_finalized AS isFinalized FROM sales WHERE id = ?")
    .get(id);
  if (!sale) throw new Error("Transaksi tidak ditemukan.");
  if (sale.isFinalized === 1) return true;
  database.prepare("UPDATE sales SET is_finalized = 1 WHERE id = ?").run(id);
  return true;
}

function deleteSale(saleId) {
  const id = Number(saleId);
  if (!id) throw new Error("ID transaksi tidak valid.");

  const tx = database.transaction(() => {
    const sale = database
      .prepare("SELECT id, invoice_no AS invoiceNo FROM sales WHERE id = ?")
      .get(id);
    if (!sale) throw new Error("Transaksi tidak ditemukan.");

    const items = database
      .prepare("SELECT product_id AS productId, qty FROM sale_items WHERE sale_id = ?")
      .all(id);

    const restoreStock = database.prepare(
      "UPDATE products SET stock = stock + ? WHERE id = ?"
    );
    for (const item of items) {
      const result = restoreStock.run(item.qty, item.productId);
      if (result.changes === 0) throw new Error("Produk transaksi tidak ditemukan.");
    }

    database.prepare("DELETE FROM sale_items WHERE sale_id = ?").run(id);
    database.prepare("DELETE FROM sales WHERE id = ?").run(id);
    return true;
  });

  return tx();
}

function getDashboardData(options = {}) {
  const trendMode =
    options.trendMode === "daily"
      ? "daily"
      : options.trendMode === "monthly"
        ? "monthly"
        : "weekly";
  const rawTopLimit = Number(options.topLimit || 10);
  const allowedLimits = new Set([5, 10, 20, 50, 100]);
  const topLimit = allowedLimits.has(rawTopLimit) ? rawTopLimit : 10;
  const bestMode =
    options.bestMode === "daily"
      ? "daily"
      : options.bestMode === "weekly"
        ? "weekly"
        : options.bestMode === "yearly"
          ? "yearly"
          : "monthly";

  const txDaily = database
    .prepare(
      "SELECT COUNT(*) AS total FROM sales WHERE date(datetime(created_at, 'localtime')) = date('now', 'localtime')"
    )
    .get().total;
  const txWeekly = database
    .prepare(
      "SELECT COUNT(*) AS total FROM sales WHERE datetime(created_at, 'localtime') >= datetime('now', 'localtime', '-6 days', 'start of day')"
    )
    .get().total;
  const txMonthly = database
    .prepare(
      "SELECT COUNT(*) AS total FROM sales WHERE strftime('%Y-%m', datetime(created_at, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')"
    )
    .get().total;

  const revDaily = database
    .prepare(
      "SELECT COALESCE(SUM(total),0) AS total FROM sales WHERE date(datetime(created_at, 'localtime')) = date('now', 'localtime')"
    )
    .get().total;
  const revWeekly = database
    .prepare(
      "SELECT COALESCE(SUM(total),0) AS total FROM sales WHERE datetime(created_at, 'localtime') >= datetime('now', 'localtime', '-6 days', 'start of day')"
    )
    .get().total;
  const revMonthly = database
    .prepare(
      "SELECT COALESCE(SUM(total),0) AS total FROM sales WHERE strftime('%Y-%m', datetime(created_at, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')"
    )
    .get().total;

  const soldDaily = database
    .prepare(
      `
      SELECT COALESCE(SUM(si.qty),0) AS total
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE date(datetime(s.created_at, 'localtime')) = date('now', 'localtime')
      `
    )
    .get().total;
  const soldWeekly = database
    .prepare(
      `
      SELECT COALESCE(SUM(si.qty),0) AS total
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE datetime(s.created_at, 'localtime') >= datetime('now', 'localtime', '-6 days', 'start of day')
      `
    )
    .get().total;
  const soldMonthly = database
    .prepare(
      `
      SELECT COALESCE(SUM(si.qty),0) AS total
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE strftime('%Y-%m', datetime(s.created_at, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')
      `
    )
    .get().total;

  const totalUsers = database.prepare("SELECT COUNT(*) AS total FROM users").get().total;
  const totalProducts = database.prepare("SELECT COUNT(*) AS total FROM products").get().total;
  const totalProductsAvailable = database
    .prepare("SELECT COUNT(*) AS total FROM products WHERE stock > 0")
    .get().total;
  const totalProductsEmpty = database
    .prepare("SELECT COUNT(*) AS total FROM products WHERE stock = 0")
    .get().total;

  const trend = { mode: trendMode, labels: [], values: [] };
  if (trendMode === "daily") {
    const rows = database
      .prepare(
        `
        SELECT
          CAST(strftime('%H', datetime(created_at, 'localtime')) AS INTEGER) AS h,
          COALESCE(SUM(total),0) AS total
        FROM sales
        WHERE date(datetime(created_at, 'localtime')) = date('now', 'localtime')
        GROUP BY h
        ORDER BY h ASC
        `
      )
      .all();
    const map = {};
    for (const r of rows) map[r.h] = r.total;
    for (let h = 0; h < 24; h += 1) {
      trend.labels.push(`${String(h).padStart(2, "0")}:00`);
      trend.values.push(Number(map[h] || 0));
    }
  } else if (trendMode === "weekly") {
    const rows = database
      .prepare(
        `
        SELECT
          date(datetime(created_at, 'localtime')) AS k,
          COALESCE(SUM(total),0) AS total
        FROM sales
        WHERE datetime(created_at, 'localtime') >= datetime('now', 'localtime', '-6 days', 'start of day')
        GROUP BY k
        ORDER BY k ASC
        `
      )
      .all();
    const map = {};
    for (const r of rows) map[r.k] = r.total;
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const k = `${yyyy}-${mm}-${dd}`;
      trend.labels.push(`${dd}/${mm}`);
      trend.values.push(Number(map[k] || 0));
    }
  } else {
    const rows = database
      .prepare(
        `
        SELECT
          strftime('%Y-%m', datetime(created_at, 'localtime')) AS k,
          COALESCE(SUM(total),0) AS total
        FROM sales
        WHERE datetime(created_at, 'localtime') >= datetime('now', 'localtime', '-5 months', 'start of month')
        GROUP BY k
        ORDER BY k ASC
        `
      )
      .all();
    const map = {};
    for (const r of rows) map[r.k] = r.total;
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const k = `${yyyy}-${mm}`;
      trend.labels.push(k);
      trend.values.push(Number(map[k] || 0));
    }
  }

  let bestWhereSql = "1=1";
  if (bestMode === "daily") {
    bestWhereSql = "date(datetime(s.created_at, 'localtime')) = date('now', 'localtime')";
  } else if (bestMode === "weekly") {
    bestWhereSql = "datetime(s.created_at, 'localtime') >= datetime('now', 'localtime', '-6 days', 'start of day')";
  } else if (bestMode === "monthly") {
    bestWhereSql = "strftime('%Y-%m', datetime(s.created_at, 'localtime')) = strftime('%Y-%m', 'now', 'localtime')";
  } else if (bestMode === "yearly") {
    bestWhereSql = "strftime('%Y', datetime(s.created_at, 'localtime')) = strftime('%Y', 'now', 'localtime')";
  }

  const bestProducts = database
    .prepare(
      `
      SELECT
        si.product_id AS productId,
        si.name AS productName,
        COALESCE(SUM(si.qty),0) AS totalQty,
        COALESCE(SUM(si.subtotal),0) AS totalRevenue
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE ${bestWhereSql}
      GROUP BY si.product_id, si.name
      ORDER BY totalQty DESC, totalRevenue DESC, si.name ASC
      LIMIT ?
      `
    )
    .all(topLimit);

  return {
    totals: {
      transactions: { daily: txDaily, weekly: txWeekly, monthly: txMonthly },
      revenue: { daily: revDaily, weekly: revWeekly, monthly: revMonthly },
      productsSold: { daily: soldDaily, weekly: soldWeekly, monthly: soldMonthly },
      users: totalUsers,
      products: totalProducts,
      productsAvailable: totalProductsAvailable,
      productsEmpty: totalProductsEmpty
    },
    trend,
    bestMode,
    bestProducts
  };
}

module.exports = {
  init,
  close,
  getDatabasePath,
  backupTo,
  login,
  addAuditLog,
  listAuditLogs,
  getAppConfig,
  updateAppConfig,
  resetAdminPassword,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  getProducts,
  getProductRecommendations,
  createProduct,
  updateProduct,
  deleteProduct,
  createSale,
  getSaleById,
  updateSale,
  finalizeSale,
  deleteSale,
  getDashboardData,
  getSalesReport,
  getSales
};
