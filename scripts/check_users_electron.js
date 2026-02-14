const path = require('path');
const { app } = require('electron');
const Database = require('better-sqlite3');
app.whenReady().then(() => {
  const p = path.join(app.getPath('userData'), 'pos.sqlite');
  console.log('DB:', p);
  const db = new Database(p, { readonly: true });
  const users = db.prepare('SELECT id, username, role, password FROM users ORDER BY id').all();
  console.log(JSON.stringify(users, null, 2));
  app.quit();
});
