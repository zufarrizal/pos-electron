const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("posApi", {
  login: (payload) => ipcRenderer.invoke("auth:login", payload),
  logout: () => ipcRenderer.invoke("auth:logout"),
  getSession: () => ipcRenderer.invoke("auth:session"),
  resetAdminPassword: () => ipcRenderer.invoke("auth:resetAdminPassword"),

  getAppConfig: () => ipcRenderer.invoke("app:getConfig"),
  updateAppConfig: (payload) => ipcRenderer.invoke("app:updateConfig", payload),

  listProducts: () => ipcRenderer.invoke("products:list"),
  createProduct: (payload) => ipcRenderer.invoke("products:create", payload),
  updateProduct: (payload) => ipcRenderer.invoke("products:update", payload),
  deleteProduct: (id) => ipcRenderer.invoke("products:delete", id),

  createSale: (payload) => ipcRenderer.invoke("sales:create", payload),
  updateSale: (payload) => ipcRenderer.invoke("sales:update", payload),
  getSaleById: (id) => ipcRenderer.invoke("sales:getById", id),
  finalizeSale: (id) => ipcRenderer.invoke("sales:finalize", id),
  deleteSale: (id) => ipcRenderer.invoke("sales:delete", id),
  listSales: (filter) => ipcRenderer.invoke("sales:list", filter),
  exportSales: (filter) => ipcRenderer.invoke("sales:exportExcel", filter),

  listUsers: () => ipcRenderer.invoke("users:list"),
  createUser: (payload) => ipcRenderer.invoke("users:create", payload),
  updateUser: (payload) => ipcRenderer.invoke("users:update", payload),
  deleteUser: (id) => ipcRenderer.invoke("users:delete", id),

  getDashboard: (options) => ipcRenderer.invoke("dashboard:get", options),

  toggleFullscreen: () => ipcRenderer.invoke("window:toggleFullscreen"),
  getFullscreen: () => ipcRenderer.invoke("window:getFullscreen")
});
