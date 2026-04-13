const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  // =========================
  // PACIENTES
  // =========================
  listPatients:   () => ipcRenderer.invoke("patients:list"),
  createPatient:  (p) => ipcRenderer.invoke("patients:create", p),
  updatePatient:  (p) => ipcRenderer.invoke("patients:update", p),

  // =========================
  // ARMAZONES
  // =========================
  listFrames:         ()  => ipcRenderer.invoke("frames:list"),
  createFrame:        (p) => ipcRenderer.invoke("frames:create", p),
  updateFrameStock:   (p) => ipcRenderer.invoke("frames:updateStock", p),
  deleteFrame:        (p) => ipcRenderer.invoke("frames:delete", p),
  updateFrame:        (p) => ipcRenderer.invoke("frames:update", p),
  getFramesStockBajo: (p) => ipcRenderer.invoke("frames:stockBajo", p),

  // =========================
  // RECETAS
  // =========================
  createRecipe:          (p)    => ipcRenderer.invoke("recipes:create", p),
  searchRecipes:         (q)    => ipcRenderer.invoke("recipes:search", q),
  getRecipe:             (id)   => ipcRenderer.invoke("recipes:get", id),
  listUpcomingDeliveries:(days) => ipcRenderer.invoke("recipes:deliveriesUpcoming", days),
  listDeliveriesByDate:  (iso)  => ipcRenderer.invoke("recipes:deliveriesByDate", iso),
  listPendingPickup:     ()     => ipcRenderer.invoke("recipes:pendingPickup"),
  markRecipeDelivered:   (id)   => ipcRenderer.invoke("recipes:markDelivered", id),
  markRecipeNoticeSent:  (id)   => ipcRenderer.invoke("recipes:markNoticeSent", id),
  markRecipePickedUp:    (id)   => ipcRenderer.invoke("recipes:markPickedUp", id),
  countRecipesByMonth:   ()     => ipcRenderer.invoke("recipes:countByMonth"),
  deleteRecipe: (id)  => ipcRenderer.invoke("recipes:delete", id),
  deleteVenta:  (id)  => ipcRenderer.invoke("ventas:delete",  id),

  // =========================
  // EVOLUCIONES
  // =========================
  listEvoluciones:    (pid) => ipcRenderer.invoke("patients:evoluciones:list", pid),
  addEvolucion:       (p)   => ipcRenderer.invoke("patients:evoluciones:add", p),
  updateEvolucion:    (p)   => ipcRenderer.invoke("patients:evoluciones:update", p),
  deleteEvolucion:    (id)  => ipcRenderer.invoke("patients:evoluciones:softDelete", id),
  softDeleteEvolucion:(id)  => ipcRenderer.invoke("patients:evoluciones:softDelete", id),
  restoreEvolucion:   (id)  => ipcRenderer.invoke("patients:evoluciones:restore", id),

  // =========================
  // VIDRIOS
  // =========================
  listVidrios:   ()  => ipcRenderer.invoke("vidrios:list"),
  createVidrio:  (p) => ipcRenderer.invoke("vidrios:create", p),
  updateVidrio:  (p) => ipcRenderer.invoke("vidrios:update", p),
  deleteVidrio:  (id)=> ipcRenderer.invoke("vidrios:delete", id),

  // =========================
  // SERVICIOS
  // =========================
  listServicios:   ()  => ipcRenderer.invoke("servicios:list"),
  createServicio:  (p) => ipcRenderer.invoke("servicios:create", p),
  updateServicio:  (p) => ipcRenderer.invoke("servicios:update", p),
  deleteServicio:  (id)=> ipcRenderer.invoke("servicios:delete", id),

  // =========================
  // CONFIG
  // =========================
  getConfig:          ()  => ipcRenderer.invoke("config:get"),
  setConfig:          (p) => ipcRenderer.invoke("config:set", p),
  setSeniaPorcentaje: (n) => ipcRenderer.invoke("config:setSeniaPorcentaje", n),

  // =========================
  // SYSTEM
  // =========================
  openExternal: (url) => ipcRenderer.invoke("system:openExternal", url),
  printToPdf:   (opts) => ipcRenderer.invoke("print:pdf", opts),

  // =========================
  // PROVEEDORES
  // =========================
  listSuppliers:       (tipo)      => ipcRenderer.invoke("suppliers:list", tipo),
  createSupplier:      (p)         => ipcRenderer.invoke("suppliers:create", p),
  updateSupplier:      (p)         => ipcRenderer.invoke("suppliers:update", p),
  deleteSupplier:      (id)        => ipcRenderer.invoke("suppliers:delete", id),
  listSupplierMovements:(idOrPayload)=> ipcRenderer.invoke("suppliers:movements", idOrPayload),
  addSupplierPayment:  (p)         => ipcRenderer.invoke("suppliers:addPayment", p),
  addSupplierPurchase: (p)         => ipcRenderer.invoke("suppliers:addPurchase", p),

  // =========================
  // GASTOS
  // =========================
  listCategoriasGasto:  ()   => ipcRenderer.invoke("gastos:categorias:list"),
  createCategoriaGasto: (p)  => ipcRenderer.invoke("gastos:categorias:create", p),
  updateCategoriaGasto: (p)  => ipcRenderer.invoke("gastos:categorias:update", p),
  deleteCategoriaGasto: (id) => ipcRenderer.invoke("gastos:categorias:delete", id),

  listGastos:     (f)   => ipcRenderer.invoke("gastos:list", f),
  upcomingGastos: (d)   => ipcRenderer.invoke("gastos:upcoming", d),
  createGasto:    (p)   => ipcRenderer.invoke("gastos:create", p),
  updateGasto:    (p)   => ipcRenderer.invoke("gastos:update", p),
  markGastoPagado:   (id) => ipcRenderer.invoke("gastos:markPagado",    id),
  markGastoPendiente:(id) => ipcRenderer.invoke("gastos:markPendiente", id),
  deleteGasto:       (id) => ipcRenderer.invoke("gastos:delete",        id),

  // =========================
  // PAGOS (proveedores)
  // =========================
  getPagosResumen:            ()  => ipcRenderer.invoke("pagos:resumen"),
  getPagosTotalesPorProveedor:()  => ipcRenderer.invoke("pagos:totalesPorProveedor"),
  registrarPago:              (p) => ipcRenderer.invoke("pagos:registrar", p),

  // =========================
  // VENTAS  ← NUEVO
  // =========================
  listVentas:             (p)  => ipcRenderer.invoke("ventas:list", p),
  getVentasStats:         ()   => ipcRenderer.invoke("ventas:stats"),
  updateEstadoPago:       (p)  => ipcRenderer.invoke("ventas:updateEstadoPago", p),
  getVentasTotalMes:      ()   => ipcRenderer.invoke("ventas:totalMes"),
  getBalance:             (p)  => ipcRenderer.invoke("balance:get", p),

  // =========================
  // TURNOS
  // =========================
  listTurnosByMonth: (p)  => ipcRenderer.invoke("turnos:listByMonth", p),
  listTurnosByDate:  (iso)=> ipcRenderer.invoke("turnos:listByDate",  iso),
  createTurno:       (p)  => ipcRenderer.invoke("turnos:create",      p),
  updateTurno:       (p)  => ipcRenderer.invoke("turnos:update",      p),
  updateTurnoEstado: (p)  => ipcRenderer.invoke("turnos:updateEstado", p),
  deleteTurno:       (id) => ipcRenderer.invoke("turnos:delete",      id),

  // =========================
  // WHATSAPP
  // =========================
  whatsappInit:        ()              => ipcRenderer.invoke("whatsapp:init"),
  whatsappGetStatus:   ()              => ipcRenderer.invoke("whatsapp:getStatus"),
  whatsappDisconnect:  ()              => ipcRenderer.invoke("whatsapp:disconnect"),
  whatsappSendMessage: (phone, text)   => ipcRenderer.invoke("whatsapp:sendMessage", { phone, text }),
  onWhatsappStatus:    (cb)            => ipcRenderer.on("whatsapp:statusUpdate", (_e, d) => cb(d)),
  offWhatsappStatus:   ()              => ipcRenderer.removeAllListeners("whatsapp:statusUpdate"),

  // =========================
  // LICENCIA
  // =========================
  checkLicense:    ()     => ipcRenderer.invoke("license:check"),
  activateLicense: (code) => ipcRenderer.invoke("license:activate", code),

  // =========================
  // BACKUP
  // =========================
  backupSave:        ()  => ipcRenderer.invoke("backup:save"),
  backupInfo:        ()  => ipcRenderer.invoke("backup:info"),
  backupPickFolder:  ()  => ipcRenderer.invoke("backup:pickFolder"),
  backupClearFolder: ()  => ipcRenderer.invoke("backup:clearFolder"),

  // =========================
  // AUTO-UPDATE
  // =========================
  checkForUpdates:  ()   => ipcRenderer.invoke("updater:check"),
  downloadUpdate:   ()   => ipcRenderer.invoke("updater:download"),
  installUpdate:    ()   => ipcRenderer.invoke("updater:install"),
  getAppVersion:    ()   => ipcRenderer.invoke("updater:version"),
  onUpdaterStatus:  (cb) => ipcRenderer.on("updater:status", (_e, d) => cb(d)),
  offUpdaterStatus: ()   => ipcRenderer.removeAllListeners("updater:status"),

  // =========================
  // CAJA
  // =========================
  listCuentas:            ()  => ipcRenderer.invoke("cuentas:list"),
  createCuenta:           (p) => ipcRenderer.invoke("cuentas:create", p),
  updateCuenta:           (p) => ipcRenderer.invoke("cuentas:update", p),
  deleteCuenta:           (id)=> ipcRenderer.invoke("cuentas:delete", id),
  getCajaDiariaHoy:       ()  => ipcRenderer.invoke("cajaDiaria:hoy"),
  getCajaDiariaPorFecha:  (f) => ipcRenderer.invoke("cajaDiaria:porFecha", f),
  getCajaSaldos:          ()  => ipcRenderer.invoke("caja:saldos"),
  agregarMovimientoCaja:  (p) => ipcRenderer.invoke("cajaDiaria:agregarMovimiento", p),
});