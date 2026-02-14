const path = require("path");
const Database = require("better-sqlite3");
const dbPath = path.join(process.env.APPDATA || "", "pos-electron", "pos.sqlite");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

const tx = db.transaction(() => {
  db.prepare("DELETE FROM sale_items").run();
  db.prepare("DELETE FROM sales").run();
  db.prepare("DELETE FROM products").run();
  db.prepare("DELETE FROM app_config").run();
  db.prepare(
    "DELETE FROM sqlite_sequence WHERE name IN ('products','sales','sale_items')"
  ).run();
});
tx();

const users = db.prepare("SELECT COUNT(*) AS total FROM users").get().total;
const products = db.prepare("SELECT COUNT(*) AS total FROM products").get().total;
const sales = db.prepare("SELECT COUNT(*) AS total FROM sales").get().total;
const items = db.prepare("SELECT COUNT(*) AS total FROM sale_items").get().total;
const cfg = db.prepare("SELECT COUNT(*) AS total FROM app_config").get().total;

console.log(`DB: ${dbPath}`);
console.log(`users=${users} products=${products} sales=${sales} sale_items=${items} app_config=${cfg}`);

db.close();
