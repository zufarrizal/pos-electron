const { app } = require("electron");
const db = require("../src/db");

app.whenReady().then(() => {
  db.init();
  const products = db.getProducts();
  const totalRestaurant = products.filter((x) => String(x.sku).startsWith("RST-")).length;
  console.log(`Seed selesai. Total produk restoran (RST-): ${totalRestaurant}`);
  app.quit();
});
